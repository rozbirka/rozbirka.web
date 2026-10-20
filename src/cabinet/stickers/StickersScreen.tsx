import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Minus, Plus, Printer, Share2 } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { partsApi, type PartListItem } from '@/api/parts'
import { Button, Notice, Pagination, SearchInput } from '@/components/app'
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
import {
  StickerWorkspace,
  StickerListPanel,
  StickerSelectionRow,
} from './StickerWorkspace'
import { StickerSheetPreview } from './StickerSheetPreview'

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
    <StickerWorkspace
      title={t('title')}
      subtitle={t('subtitle')}
      notice={!scope ? <Notice tone="danger">{t('noScope')}</Notice> : null}
      list={
        <StickerListPanel
          search={
            <SearchInput
              aria-label={t('searchLabel')}
              disabled={!canGenerate}
              onChange={(event) => {
                setSearch(event.target.value)
                setPartsPage(1)
              }}
              placeholder={t('searchPlaceholder')}
              value={search}
            />
          }
          summary={t('selectedSummary', {
            objects: queue.length,
            stickers: total,
          })}
          actions={
            <>
              {' '}
              <Button
                disabled={
                  !canGenerate || partsUnavailable || parts.length === 0
                }
                onClick={selectVisible}
              >
                {t('selectAll')}
              </Button>
              <Button disabled={!queue.length} onClick={clear}>
                {t('clear')}
              </Button>
            </>
          }
          footer={
            <Pagination
              label={t('pagination')}
              onPage={setPartsPage}
              page={partsPage}
              pageSize={PARTS_PAGE_SIZE}
              total={partsTotal}
              totalPages={partsTotalPages}
            />
          }
        >
          {partsUnavailable ? (
            <div className="p-3">
              <Notice tone="danger">{t('partsLoadFailed')}</Notice>
            </div>
          ) : null}
          <ul
            className="divide-app-line m-0 grid list-none divide-y p-0"
            aria-label={t('partsList')}
          >
            {parts.map((part) => {
              const selected = selectedIds.has(part.id)
              const queued = queue.find((item) => item.id === part.id)
              const vehicle = part.car
                ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
                : t('noCar')
              return (
                <StickerSelectionRow
                  key={part.id}
                  label={t('partItem', { name: part.name })}
                  checkboxLabel={part.name}
                  selected={selected}
                  disabled={!canGenerate || partsUnavailable}
                  onToggle={() => togglePart(part)}
                  name={part.name}
                  code={part.externalCode ?? null}
                  detail={
                    <>
                      {vehicle}
                      <span
                        className={
                          part.quantityAvailable > 0
                            ? 'rz-dot rz-dot--ok ml-2'
                            : 'rz-dot rz-dot--danger ml-2'
                        }
                      >
                        {t('available', { count: part.quantityAvailable })}
                      </span>
                    </>
                  }
                  controls={
                    selected && queued ? (
                      <div
                        className="rz-stepper col-start-2 w-fit sm:col-start-auto"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          aria-label={t('decrease', { name: part.name })}
                          disabled={queued.quantity <= 1}
                          onClick={() => changeQuantity(queued.id, -1)}
                          type="button"
                        >
                          <Minus aria-hidden className="size-3.5" />
                        </button>
                        <span className="rz-mono rz-strong grid h-full min-w-10 place-items-center border-app-line border-x px-2">
                          {queued.quantity}
                        </span>
                        <button
                          aria-label={t('increase', { name: part.name })}
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
                    ) : null
                  }
                />
              )
            })}
          </ul>
        </StickerListPanel>
      }
      preview={
        <StickerSheetPreview
          cards={previewCards}
          objects={queue.length}
          total={total}
          actions={
            <>
              {' '}
              <Button
                aria-busy={busy}
                className="w-full"
                size="lg"
                disabled={!queue.length || !canGenerate || busy}
                onClick={() =>
                  preview.length ? void print() : void generate()
                }
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
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="min-w-0"
                    disabled={busy}
                    onClick={() => void download()}
                  >
                    <Download aria-hidden />
                    {t('download')}
                  </Button>
                  <Button
                    className="min-w-0"
                    disabled={busy}
                    onClick={() => void share()}
                  >
                    <Share2 aria-hidden />
                    {t('share')}
                  </Button>
                </div>
              ) : null}
            </>
          }
        />
      }
    >
      {!canGenerate ? (
        <p className="rz-dim m-0" role="status">
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
    </StickerWorkspace>
  )
}
