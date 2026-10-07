import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Minus, Plus, Printer, Share2 } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { partsApi, type PartListItem } from '@/api/parts'
import {
  Button,
  Notice,
  PageBody,
  Pagination,
  SearchInput,
} from '@/components/app'
import { stickersApi } from '@/api/stickers'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { tenantResetRegistry } from '../tenant-reset-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  buildStickerHtml,
  renderStickers,
  type PrintableSticker,
  type RenderedSticker,
} from './sticker-output'
import { stickersMessages } from './messages'

interface QueueItem {
  id: string
  quantity: number
  availableQuantity?: number
  name?: string
  externalCode?: string | null
  carLabel?: string | null
}
interface QueueScope {
  userId: string
  tenantId: string
}
interface StoredQueue {
  version: 1
  expiresAt: number
  items: QueueItem[]
}

const MAX_STICKERS = 200
const PARTS_PAGE_SIZE = 10
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000
const queueKey = ({ userId, tenantId }: QueueScope) =>
  `rozbirka.stickers.queue.v1:${userId}:${tenantId}`
const validQueueItem = (value: unknown): value is QueueItem => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  const optionalText = (entry: unknown) =>
    entry === undefined || entry === null || typeof entry === 'string'
  return (
    typeof item['id'] === 'string' &&
    item['id'].length > 0 &&
    Number.isInteger(item['quantity']) &&
    Number(item['quantity']) > 0 &&
    (item['availableQuantity'] === undefined ||
      (Number.isInteger(item['availableQuantity']) &&
        Number(item['availableQuantity']) >= Number(item['quantity']))) &&
    optionalText(item['name']) &&
    optionalText(item['externalCode']) &&
    optionalText(item['carLabel'])
  )
}
const validQueue = (value: unknown): value is QueueItem[] => {
  if (!Array.isArray(value) || !value.every(validQueueItem)) return false
  return value.reduce((sum, item) => sum + item.quantity, 0) <= MAX_STICKERS
}
const readQueue = (scope: QueueScope): QueueItem[] => {
  if (typeof window === 'undefined') return []
  const key = queueKey(scope)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const stored = JSON.parse(raw) as Partial<StoredQueue>
    if (
      stored.version !== 1 ||
      typeof stored.expiresAt !== 'number' ||
      stored.expiresAt <= Date.now() ||
      !validQueue(stored.items)
    ) {
      localStorage.removeItem(key)
      return []
    }
    return stored.items
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage is unavailable; use an empty in-memory queue.
    }
    return []
  }
}
const writeQueue = (scope: QueueScope, items: QueueItem[]) => {
  if (typeof window === 'undefined') return
  const key = queueKey(scope)
  try {
    if (!items.length) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        expiresAt: Date.now() + QUEUE_TTL_MS,
        items,
      } satisfies StoredQueue),
    )
  } catch {
    // Storage can be blocked or full; the active in-memory queue remains usable.
  }
}
export function StickersScreen({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const { targetTenant, snapshot } = cabinet
  const access =
    cabinet.status === 'ready' && snapshot
      ? { status: 'ready' as const, snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const generationDecision = evaluateModuleAccess(
    definition,
    access,
    'mutation',
  )
  const scope = useMemo(
    () =>
      targetTenant && snapshot?.userId && snapshot.tenantId === targetTenant.id
        ? { userId: snapshot.userId, tenantId: targetTenant.id }
        : null,
    [snapshot, targetTenant],
  )
  const scopeIdentity = scope ? `${scope.userId}:${scope.tenantId}` : 'none'
  return (
    <TenantStickerQueue
      generationDecision={generationDecision.kind}
      key={scopeIdentity}
      requireLatestMutation={requireLatestMutation}
      scope={scope}
    />
  )
}

function TenantStickerQueue({
  scope,
  generationDecision,
  requireLatestMutation,
}: {
  scope: QueueScope | null
  generationDecision: ReturnType<typeof evaluateModuleAccess>['kind']
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
}) {
  const t = useT(stickersMessages)
  // Printed stickers follow the tenant document language, not the UI locale.
  const documentLocale = useTenantSettings().documentLanguage ?? 'uk'
  const [searchParams, setSearchParams] = useSearchParams()
  // Another screen can send parts here to be printed — one from a part card, a
  // whole batch from an intake. The ids arrive in the URL and join the queue as
  // it is read, so a queue is never a render behind the address bar.
  const requested = useMemo(() => searchParams.getAll('part'), [searchParams])
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    const stored = scope ? readQueue(scope) : []
    const additions: QueueItem[] = []
    for (const id of requested)
      if (
        !stored.some((item) => item.id === id) &&
        !additions.some((item) => item.id === id)
      )
        additions.push({ id, quantity: 1 })
    return additions.length > 0 ? [...stored, ...additions] : stored
  })
  useEffect(() => {
    if (requested.length === 0) return
    // The parameter has done its job; drop it so a reload does not re-queue.
    const next = new URLSearchParams(searchParams)
    next.delete('part')
    setSearchParams(next, { replace: true })
  }, [requested, searchParams, setSearchParams])
  const [search, setSearch] = useState('')
  const [partsPage, setPartsPage] = useState(1)
  const [partsTotal, setPartsTotal] = useState(0)
  const [partsTotalPages, setPartsTotalPages] = useState(1)
  const [parts, setParts] = useState<PartListItem[]>([])
  const [partsUnavailable, setPartsUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printable, setPrintable] = useState<PrintableSticker[]>([])
  const [preview, setPreview] = useState<RenderedSticker[]>([])
  const [busy, setBusy] = useState(false)
  const generationRef = useRef(0)
  const canGenerate = generationDecision === 'allowed'
  const total = useMemo(
    () => queue.reduce((sum, item) => sum + item.quantity, 0),
    [queue],
  )

  useEffect(() => {
    if (scope) writeQueue(scope, queue)
  }, [queue, scope])
  useEffect(() => {
    const controller = new AbortController()
    void partsApi
      .list({
        page: partsPage,
        pageSize: PARTS_PAGE_SIZE,
        status: 'available',
        ...(search.trim() ? { q: search.trim() } : {}),
        signal: controller.signal,
      })
      .then(
        (page) => {
          if (controller.signal.aborted) return
          setParts(page.items.filter((part) => part.quantityAvailable > 0))
          setPartsTotal(page.total)
          setPartsTotalPages(Math.max(1, page.totalPages))
          setPartsUnavailable(false)
          const availability = new Map(
            page.items.map((part) => [part.id, part.quantityAvailable]),
          )
          setQueue((current) =>
            current.flatMap((item) => {
              const available = availability.get(item.id)
              if (available === undefined) return [item]
              if (available <= 0) return []
              return [
                {
                  ...item,
                  availableQuantity: available,
                  quantity: Math.min(item.quantity, available),
                },
              ]
            }),
          )
        },
        () => {
          if (!controller.signal.aborted) setPartsUnavailable(true)
        },
      )
    return () => controller.abort()
  }, [partsPage, search])
  useEffect(() => {
    if (!scope) return
    const unregister = tenantResetRegistry.register((resetScope) => {
      if (
        resetScope.userId !== scope.userId ||
        resetScope.tenantId !== scope.tenantId
      )
        return
      try {
        localStorage.removeItem(queueKey(scope))
      } catch {
        // Scope state is still cleared from memory when storage is unavailable.
      }
      setQueue([])
    })
    return unregister
  }, [scope])
  const selectPart = (part: PartListItem) => {
    if (!canGenerate || partsUnavailable) return
    if (part.quantityAvailable <= 0) {
      setError(t('noStock'))
      return
    }
    if (total >= MAX_STICKERS) {
      setError(t('limit', { max: MAX_STICKERS }))
      return
    }
    setQueue((current) => {
      return current.some((item) => item.id === part.id)
        ? current
        : [
            ...current,
            {
              id: part.id,
              quantity: 1,
              availableQuantity: part.quantityAvailable,
              name: part.name,
              externalCode: part.externalCode ?? null,
              carLabel: part.car
                ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
                : null,
            },
          ]
    })
    setError(null)
    setPrintable([])
    setPreview([])
  }
  const removePart = (partId: string) => {
    setQueue((current) => current.filter((item) => item.id !== partId))
    setPrintable([])
    setPreview([])
    setError(null)
  }
  const togglePart = (part: PartListItem) => {
    const selected = queue.some((item) => item.id === part.id)
    if (selected) {
      removePart(part.id)
      return
    }
    selectPart(part)
  }
  const clear = () => {
    setQueue([])
    setPrintable([])
    setPreview([])
    setError(null)
  }

  const changeQuantity = (partId: string, delta: number) => {
    if (delta > 0 && total >= MAX_STICKERS) {
      setError(t('limit', { max: MAX_STICKERS }))
      return
    }
    setQueue((current) => {
      const entry = current.find((item) => item.id === partId)
      if (!entry) return current
      const available = entry.availableQuantity ?? 1
      const quantity = Math.min(available, Math.max(1, entry.quantity + delta))
      return current.map((item) =>
        item.id === partId ? { ...item, quantity } : item,
      )
    })
    setPrintable([])
    setPreview([])
  }

  const generate = async () => {
    if (!canGenerate || !queue.length || busy) return
    const generation = ++generationRef.current
    setBusy(true)
    setError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      const response = await stickersApi.getBatchData(
        queue.map((item) => item.id),
        { signal: scope.signal },
      )
      if (generation !== generationRef.current) return
      const next = queue.map((queued) => {
        const sticker = response.items.find((item) => item.id === queued.id)
        if (!sticker) throw new Error('missing-sticker')
        const vehicle = [sticker.carBrand, sticker.carModel]
          .filter(Boolean)
          .join(' ')
        const vehicleWithYear = [
          vehicle,
          sticker.carYear ? `(${sticker.carYear})` : '',
        ]
          .filter(Boolean)
          .join(' ')
        const carLabel = [sticker.carCode, vehicleWithYear]
          .filter(Boolean)
          .join(' · ')
        return {
          id: sticker.id,
          name: sticker.name,
          qrCode: sticker.qrCode,
          quantity: queued.quantity,
          carLabel: carLabel || null,
        }
      })
      const rendered = await renderStickers(next, window.location.origin)
      if (generation !== generationRef.current) return
      setPrintable(next)
      setPreview(rendered)
    } catch {
      if (generation === generationRef.current) setError(t('prepareFailed'))
    } finally {
      if (generation === generationRef.current) setBusy(false)
    }
  }
  const artifact = () =>
    buildStickerHtml(printable, window.location.origin, documentLocale)
  const download = async () => {
    try {
      const html = await artifact()
      const url = URL.createObjectURL(
        new Blob([html], { type: 'text/html;charset=utf-8' }),
      )
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = 'rozbirka-stickers.html'
        link.click()
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch {
      setError(t('downloadFailed'))
    }
  }
  const print = async () => {
    try {
      const html = await artifact()
      const printWindow = window.open('', '_blank')
      if (!printWindow) throw new Error('popup-blocked')
      printWindow.opener = null
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } catch {
      setError(t('printFailed'))
    }
  }
  const share = async () => {
    try {
      const html = await artifact()
      const file = new File([html], 'rozbirka-stickers.html', {
        type: 'text/html',
      })
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setError(t('shareUnsupported'))
        return
      }
      await navigator.share({
        files: [file],
        title: t('shareTitle'),
      })
    } catch {
      setError(t('shareFailed'))
    }
  }

  const labelFor = (item: QueueItem) => item.name ?? t('unknownPart')
  const selectedIds = new Set(queue.map((item) => item.id))
  const previewCards = preview.length
    ? preview.slice(0, 6).map((sticker) => ({
        id: sticker.id,
        name: sticker.name,
        detail: sticker.carLabel,
        qrSvg: sticker.qrSvg,
      }))
    : queue
        .flatMap((item) =>
          Array.from({ length: item.quantity }, () => ({
            id: item.id,
            name: labelFor(item),
            detail: item.carLabel ?? null,
            qrSvg: null,
          })),
        )
        .slice(0, 6)
  const selectVisible = () => {
    if (!canGenerate || partsUnavailable) return
    setQueue((current) => {
      const selected = new Set(current.map((item) => item.id))
      let remaining =
        MAX_STICKERS - current.reduce((sum, item) => sum + item.quantity, 0)
      const additions: QueueItem[] = []
      for (const part of parts) {
        if (
          selected.has(part.id) ||
          part.quantityAvailable <= 0 ||
          remaining <= 0
        )
          continue
        additions.push({
          id: part.id,
          quantity: 1,
          availableQuantity: part.quantityAvailable,
          name: part.name,
          externalCode: part.externalCode ?? null,
          carLabel: part.car
            ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
            : null,
        })
        remaining -= 1
      }
      return [...current, ...additions]
    })
    setError(null)
    setPrintable([])
    setPreview([])
  }
  return (
    <PageBody className="gap-6 pb-8">
      <header>
        <h1 className="text-[clamp(34px,4vw,48px)] leading-none font-extrabold tracking-[-0.035em] text-white">
          {t('title')}
        </h1>
        <p className="text-app-muted mt-3 max-w-3xl text-[14px] leading-6">
          {t('subtitle')}
        </p>
      </header>
      {!scope ? <Notice tone="danger">{t('noScope')}</Notice> : null}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border">
          <div className="border-app-line border-b p-4 sm:p-5">
            <SearchInput
              aria-label={t('searchLabel')}
              className="min-h-14 rounded-[16px]"
              disabled={!canGenerate}
              onChange={(event) => {
                setSearch(event.target.value)
                setPartsPage(1)
              }}
              placeholder={t('searchPlaceholder')}
              value={search}
            />
          </div>

          <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <p className="text-app-muted text-[13px] tabular-nums">
              {t('selectedSummary', { objects: queue.length, stickers: total })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-9 px-3 text-[12.5px]"
                disabled={
                  !canGenerate || partsUnavailable || parts.length === 0
                }
                onClick={selectVisible}
              >
                {t('selectAll')}
              </Button>
              <Button
                className="min-h-9 px-3 text-[12.5px]"
                disabled={!queue.length}
                onClick={clear}
              >
                {t('clear')}
              </Button>
            </div>
          </div>

          {partsUnavailable ? (
            <div className="p-5">
              <Notice tone="danger">{t('partsLoadFailed')}</Notice>
            </div>
          ) : null}
          <ul
            className="divide-app-line grid divide-y"
            aria-label={t('partsList')}
          >
            {parts.map((part) => {
              const selected = selectedIds.has(part.id)
              const queued = queue.find((item) => item.id === part.id)
              const vehicle = part.car
                ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
                : t('noCar')
              return (
                <li
                  aria-label={t('partItem', { name: part.name })}
                  className={
                    selected
                      ? 'cursor-pointer bg-white/[0.035] shadow-[inset_2px_0_0_var(--color-brand)]'
                      : 'cursor-pointer transition-colors hover:bg-white/[0.025]'
                  }
                  key={part.id}
                  onClick={() => togglePart(part)}
                >
                  <div className="grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:px-5">
                    <input
                      aria-label={part.name}
                      checked={selected}
                      className="accent-brand pointer-events-none size-[18px]"
                      disabled={!canGenerate || partsUnavailable}
                      readOnly
                      type="checkbox"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-white">
                        {part.name}
                      </p>
                      <p className="text-app-muted mt-1 truncate text-[12.5px]">
                        {vehicle}
                        <span
                          className={
                            part.quantityAvailable > 0
                              ? 'text-state-ok ml-2'
                              : 'text-state-danger ml-2'
                          }
                        >
                          {t('available', { count: part.quantityAvailable })}
                        </span>
                      </p>
                    </div>
                    {selected && queued ? (
                      <div
                        className="border-app-line-2 bg-app-canvas col-start-2 flex h-9 w-fit items-center rounded-[10px] border sm:col-start-auto"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          aria-label={t('decrease', { name: part.name })}
                          className="text-app-muted hover:text-app-ink grid size-9 place-items-center disabled:opacity-35"
                          disabled={queued.quantity <= 1}
                          onClick={() => changeQuantity(queued.id, -1)}
                          type="button"
                        >
                          <Minus aria-hidden className="size-3.5" />
                        </button>
                        <span className="min-w-7 text-center font-mono text-[13px] font-semibold text-white tabular-nums">
                          {queued.quantity}
                        </span>
                        <button
                          aria-label={t('increase', { name: part.name })}
                          className="text-app-muted hover:text-app-ink grid size-9 place-items-center disabled:opacity-35"
                          disabled={
                            total >= MAX_STICKERS ||
                            queued.quantity >= part.quantityAvailable
                          }
                          onClick={() => changeQuantity(queued.id, 1)}
                          type="button"
                        >
                          <Plus aria-hidden className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="hidden sm:block" />
                    )}
                    <span className="text-app-dim hidden max-w-28 truncate text-right font-mono text-[12.5px] sm:block">
                      {part.externalCode ?? '—'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <Pagination
            label={t('pagination')}
            onPage={setPartsPage}
            page={partsPage}
            pageSize={PARTS_PAGE_SIZE}
            total={partsTotal}
            totalPages={partsTotalPages}
          />
        </section>

        <section
          aria-label={t('sheetLabel')}
          className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border xl:sticky xl:top-5"
        >
          <div className="border-app-line flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="font-mono text-[11.5px] tracking-[0.14em] text-white uppercase">
              {t('sheet')}
            </h2>
            <span className="text-app-dim text-[12px]">{t('preview')}</span>
          </div>
          <div className="p-5">
            <div className="grid min-h-[310px] grid-cols-2 gap-1.5 rounded-[16px] bg-[#eee] p-3">
              {Array.from({ length: 6 }, (_, index) => {
                const sticker = previewCards[index]
                return sticker ? (
                  <article
                    aria-label={t('previewSticker', { name: sticker.name })}
                    className="grid min-h-[88px] grid-cols-[42px_minmax(0,1fr)] content-center gap-2 overflow-hidden rounded-[7px] border border-black/10 bg-white p-2 text-black"
                    key={`${sticker.id}-${String(index)}`}
                  >
                    {sticker.qrSvg ? (
                      <div
                        aria-label={t('qrCode', { name: sticker.name })}
                        className="grid size-[42px] place-items-center overflow-hidden bg-white [&>svg]:block [&>svg]:size-full"
                        dangerouslySetInnerHTML={{ __html: sticker.qrSvg }}
                        role="img"
                      />
                    ) : (
                      <div className="grid size-[42px] place-items-center rounded-[3px] bg-black font-mono text-[8px] text-white">
                        QR
                      </div>
                    )}
                    <div className="min-w-0 self-center">
                      <p className="line-clamp-2 text-[9.5px] leading-[1.2] font-extrabold">
                        {sticker.name}
                      </p>
                      {sticker.detail ? (
                        <p className="mt-1 line-clamp-2 text-[7.5px] leading-[1.25] text-black/55">
                          {sticker.detail}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ) : (
                  <div
                    className="min-h-[88px] rounded-[7px] border border-dashed border-black/10 bg-black/[0.025]"
                    key={`empty-${String(index)}`}
                  />
                )
              })}
            </div>

            <p className="text-app-dim mt-3 text-center text-[12px] leading-5">
              {t('sheetHint')}
            </p>

            <dl className="mt-5 grid gap-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-app-muted">{t('selectedObjects')}</dt>
                <dd className="font-mono text-white tabular-nums">
                  {queue.length}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-app-muted">{t('stickersCount')}</dt>
                <dd className="font-mono text-white tabular-nums">{total}</dd>
              </div>
            </dl>

            <Button
              aria-busy={busy}
              className="mt-5 w-full justify-center"
              disabled={!queue.length || !canGenerate || busy}
              onClick={() => (preview.length ? void print() : void generate())}
              variant="primary"
            >
              <Printer aria-hidden />
              {busy
                ? t('preparing')
                : preview.length
                  ? t('print', { count: total })
                  : t('prepare', { count: total })}
            </Button>
            {preview.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  className="min-w-0 px-2.5 text-[12.5px]"
                  disabled={busy}
                  onClick={() => void download()}
                >
                  <Download aria-hidden />
                  {t('download')}
                </Button>
                <Button
                  className="min-w-0 px-2.5 text-[12.5px]"
                  disabled={busy}
                  onClick={() => void share()}
                >
                  <Share2 aria-hidden />
                  {t('share')}
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {!canGenerate ? (
        <p className="text-app-dim text-[13.5px]" role="status">
          {generationDecision === 'subscription-blocked'
            ? t('subscriptionBlocked')
            : generationDecision === 'access-loading'
              ? t('accessLoading')
              : generationDecision === 'access-error'
                ? t('accessError')
                : t('noPermission')}
        </p>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </PageBody>
  )
}
