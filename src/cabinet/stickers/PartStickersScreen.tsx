import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Download, Minus, Plus, Printer, Share2 } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { partsApi, type PartListItem } from '@/api/parts'
import { Button, Notice, Pagination, SearchInput } from '@/components/app'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { tenantResetRegistry } from '../tenant-reset-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { usePartStickerPrinting } from './use-part-sticker-printing'
import { PartPrintQueuePanel } from './PartPrintQueuePanel'
import { PART_BATCH_SIZE, type PartStickerSelection } from './part-print-queue'
import { locationLabelMessages } from '../inventory/location-label-messages'
import { partQueueMessages } from './part-queue-messages'
import { stickersMessages } from './messages'
import {
  StickerPageWorkspace,
  STICKER_LIST_PAGE_SIZE as PARTS_PAGE_SIZE,
  StickerListPanel,
  StickerSelectionRow,
} from './StickerWorkspace'
import { StickerSheetPreview } from './StickerSheetPreview'

type QueueItem = PartStickerSelection
interface QueueScope {
  userId: string
  tenantId: string
}
interface StoredSelection {
  version: 1
  expiresAt: number
  items: QueueItem[]
}

const MAX_STICKERS = 200
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000
const selectionKey = ({ userId, tenantId }: QueueScope) =>
  `rozbirka.stickers.queue.v1:${userId}:${tenantId}`
const validSelectionItem = (value: unknown): value is QueueItem => {
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
const validSelection = (value: unknown): value is QueueItem[] => {
  if (!Array.isArray(value) || !value.every(validSelectionItem)) return false
  return value.reduce((sum, item) => sum + item.quantity, 0) <= MAX_STICKERS
}
const readSelection = (scope: QueueScope): QueueItem[] => {
  if (typeof window === 'undefined') return []
  const key = selectionKey(scope)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const stored = JSON.parse(raw) as Partial<StoredSelection>
    if (
      stored.version !== 1 ||
      typeof stored.expiresAt !== 'number' ||
      stored.expiresAt <= Date.now() ||
      !validSelection(stored.items)
    ) {
      localStorage.removeItem(key)
      return []
    }
    return stored.items
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage is unavailable; use an empty in-memory selection.
    }
    return []
  }
}
const writeSelection = (scope: QueueScope, items: QueueItem[]) => {
  if (typeof window === 'undefined') return
  const key = selectionKey(scope)
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
      } satisfies StoredSelection),
    )
  } catch {
    // Storage can be blocked or full; the active in-memory selection remains usable.
  }
}
export function PartStickersScreen({
  definition,
  navigation,
}: CabinetModuleScreenProps & { navigation?: ReactNode }) {
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
      navigation={navigation}
      generationDecision={generationDecision.kind}
      key={scopeIdentity}
      requireLatestMutation={requireLatestMutation}
      scope={scope}
    />
  )
}

function TenantStickerQueue({
  navigation,
  scope,
  generationDecision,
  requireLatestMutation,
}: {
  navigation?: ReactNode
  scope: QueueScope | null
  generationDecision: ReturnType<typeof evaluateModuleAccess>['kind']
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
}) {
  const t = useT(stickersMessages)
  const tq = useT(locationLabelMessages),
    tc = useT(partQueueMessages)
  // Printed stickers follow the tenant document language, not the UI locale.
  const documentLocale = useTenantSettings().documentLanguage ?? 'uk'
  const [searchParams, setSearchParams] = useSearchParams()
  // Another screen can send parts here to be printed — one from a part card, a
  // whole batch from an intake. The ids arrive in the URL and join the selection as
  // it is read, so a selection is never a render behind the address bar.
  const requested = useMemo(() => searchParams.getAll('part'), [searchParams])
  const [selection, setSelection] = useState<QueueItem[]>(() => {
    const stored = scope ? readSelection(scope) : []
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
  const canGenerate = generationDecision === 'allowed'
  const total = useMemo(
    () => selection.reduce((sum, item) => sum + item.quantity, 0),
    [selection],
  )

  const printing = usePartStickerPrinting({
    scope,
    canGenerate,
    requireLatestMutation,
    documentLocale,
  })
  const { preview, busy } = printing
  const batchCount = Math.min(
    PART_BATCH_SIZE,
    printing.queue?.remaining.length ?? 0,
  )
  const exceedsQueueLimit =
    total + (printing.queue?.remaining.length ?? 0) > MAX_STICKERS
  const queuedCounts = new Map<string, number>()
  for (const copy of printing.queue?.remaining ?? [])
    queuedCounts.set(copy.partId, (queuedCounts.get(copy.partId) ?? 0) + 1)
  useEffect(() => {
    if (scope) writeSelection(scope, selection)
  }, [selection, scope])
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
          setSelection((current) =>
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
        localStorage.removeItem(selectionKey(scope))
      } catch {
        // Scope state is still cleared from memory when storage is unavailable.
      }
      setSelection([])
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
    setSelection((current) => {
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
  }
  const removePart = (partId: string) => {
    setSelection((current) => current.filter((item) => item.id !== partId))
    setError(null)
  }
  const togglePart = (part: PartListItem) => {
    const selected = selection.some((item) => item.id === part.id)
    if (selected) {
      removePart(part.id)
      return
    }
    selectPart(part)
  }
  const clear = () => {
    setSelection([])
    setError(null)
  }

  const changeQuantity = (partId: string, delta: number) => {
    if (delta > 0 && total >= MAX_STICKERS) {
      setError(t('limit', { max: MAX_STICKERS }))
      return
    }
    setSelection((current) => {
      const entry = current.find((item) => item.id === partId)
      if (!entry) return current
      const available = entry.availableQuantity ?? 1
      const quantity = Math.min(available, Math.max(1, entry.quantity + delta))
      return current.map((item) =>
        item.id === partId ? { ...item, quantity } : item,
      )
    })
  }

  const labelFor = (item: QueueItem) => item.name ?? t('unknownPart')
  const selectedIds = new Set(selection.map((item) => item.id))
  const previewCards = selection.length
    ? selection
        .flatMap((item) =>
          Array.from({ length: item.quantity }, () => ({
            id: item.id,
            name: labelFor(item),
            detail: item.carLabel ?? null,
            qrSvg: null,
          })),
        )
        .slice(0, 6)
    : preview.length
      ? preview.slice(0, 6).map((sticker) => ({
          id: sticker.id,
          name: sticker.name,
          detail: sticker.carLabel,
          qrSvg: sticker.qrSvg,
        }))
      : (printing.queue?.remaining.slice(0, 6).map((copy) => ({
          id: copy.id,
          name: copy.name ?? t('unknownPart'),
          detail: copy.carLabel ?? null,
          qrSvg: null,
        })) ?? [])
  const selectVisible = () => {
    if (!canGenerate || partsUnavailable) return
    setSelection((current) => {
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
  }
  return (
    <StickerPageWorkspace
      navigation={navigation}
      actions={
        <Button
          aria-busy={busy}
          disabled={
            (!selection.length && !printing.queue) ||
            !canGenerate ||
            busy ||
            exceedsQueueLimit
          }
          onClick={() =>
            selection.length
              ? void printing.enqueue(selection, clear)
              : void printing.output('print')
          }
          variant="primary"
        >
          <Printer aria-hidden />
          {busy
            ? t('preparing')
            : selection.length
              ? printing.queue
                ? tq('add', { count: total })
                : t('prepare', { count: total })
              : printing.queue
                ? t('print', { count: batchCount })
                : t('prepare', { count: 0 })}
        </Button>
      }
      notice={!scope ? <Notice tone="danger">{t('noScope')}</Notice> : null}
      list={
        <div className="grid min-w-0 gap-3">
          <PartPrintQueuePanel printing={printing} disabled={!canGenerate} />
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
              objects: selection.length,
              stickers: total,
            })}
            actions={
              <>
                {' '}
                <Button
                  disabled={
                    !canGenerate ||
                    busy ||
                    partsUnavailable ||
                    parts.length === 0
                  }
                  onClick={selectVisible}
                >
                  {t('selectAll')}
                </Button>
                <Button disabled={busy || !selection.length} onClick={clear}>
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
                const queued = selection.find((item) => item.id === part.id)
                const vehicle = part.car
                  ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
                  : t('noCar')
                return (
                  <StickerSelectionRow
                    key={part.id}
                    label={t('partItem', { name: part.name })}
                    checkboxLabel={part.name}
                    selected={selected}
                    disabled={!canGenerate || partsUnavailable || busy}
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
                        {queuedCounts.has(part.id) ? (
                          <span className="rz-caption ml-2">
                            {tc('queued', {
                              count: queuedCounts.get(part.id)!,
                            })}
                          </span>
                        ) : null}
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
                            disabled={busy || queued.quantity <= 1}
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
                              busy ||
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
        </div>
      }
      preview={
        <StickerSheetPreview
          cards={previewCards}
          objects={
            selection.length ||
            new Set(
              printing.queue?.remaining
                .slice(0, PART_BATCH_SIZE)
                .map((copy) => copy.partId),
            ).size
          }
          total={total || batchCount}
          actions={
            <>
              {preview.length && !selection.length ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="min-w-0"
                    disabled={busy}
                    onClick={() => void printing.output('download')}
                  >
                    <Download aria-hidden />
                    {t('download')}
                  </Button>
                  <Button
                    className="min-w-0"
                    disabled={busy}
                    onClick={() => void printing.output('share')}
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
      {exceedsQueueLimit ? (
        <Notice tone="warn">{t('limit', { max: MAX_STICKERS })}</Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </StickerPageWorkspace>
  )
}
