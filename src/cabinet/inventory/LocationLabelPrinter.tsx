import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { FileDown, LayoutGrid, Printer, Rows3, X } from 'lucide-react'
import QRCode from 'qrcode'
import {
  Button,
  ConfirmDialog,
  Notice,
  SearchInput,
  Pagination,
  SkeletonRows,
} from '@/components/app'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { tenantResetRegistry } from '../tenant-reset-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  buildZoneLabelHtml,
  type PrintableZoneLabel,
} from './zone-label-output'
import { loadLocationLabels } from './location-label-data'
import { locationLabelMessages } from './location-label-messages'
import { stickersMessages } from '../stickers/messages'
import {
  StickerWorkspace,
  StickerListPanel,
  StickerSelectionRow,
} from '../stickers/StickerWorkspace'
import {
  StickerSheetPreview,
  type StickerPreviewCard,
} from '../stickers/StickerSheetPreview'
import {
  createLabelQueue,
  labelQueueKey,
  MAX_LOCATION_LABELS,
  readLabelQueue,
  sameLabelTarget,
  writeLabelQueue,
  type LocationLabelQueue,
  type LocationLabelTarget,
} from './location-label-queue'

// Register outside the workspace lifecycle so logout also clears a closed/unmounted queue.
tenantResetRegistry.register(({ userId, tenantId }) =>
  writeLabelQueue(labelQueueKey(userId, tenantId), null),
)

export function LocationLabelPrinter({
  target,
}: {
  target: LocationLabelTarget
  inventoryBase: string
}) {
  const t = useT(locationLabelMessages)
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  return (
    <Button
      onClick={() => {
        const next = new URLSearchParams(params)
        next.set('labels', '1')
        setParams(next, { state: navigationState, preventScrollReset: true })
      }}
    >
      <Printer aria-hidden />
      {t(target.kind)}
    </Button>
  )
}

export function LocationLabelsPage({
  target,
  inventoryBase,
  returnFocusRef,
}: {
  target: LocationLabelTarget
  inventoryBase: string
  returnFocusRef?: RefObject<HTMLButtonElement | null> | undefined
}) {
  const cabinet = useCabinet()
  const [params] = useSearchParams()
  const initialIds = params.getAll('label')
  const snapshot = cabinet.snapshot
  if (
    cabinet.status !== 'ready' ||
    !snapshot ||
    cabinet.targetTenant?.id !== snapshot.tenantId ||
    !snapshot.permissions.has('inventory.view')
  )
    return null
  return (
    <ScopedLocationLabels
      key={`${snapshot.userId}:${snapshot.tenantId}:${snapshot.generation}:${target.kind}:${target.parentId}:${JSON.stringify(initialIds)}`}
      initialIds={initialIds}
      target={target}
      inventoryBase={inventoryBase}
      returnFocusRef={returnFocusRef}
      storageKey={labelQueueKey(snapshot.userId, snapshot.tenantId)}
    />
  )
}

function ScopedLocationLabels({
  target,
  inventoryBase,
  returnFocusRef,
  storageKey,
  initialIds,
}: {
  target: LocationLabelTarget
  inventoryBase: string
  returnFocusRef?: RefObject<HTMLButtonElement | null> | undefined
  storageKey: string
  initialIds: string[]
}) {
  const t = useT(locationLabelMessages)
  const ts = useT(stickersMessages)
  const documentLocale = useTenantSettings().documentLanguage ?? 'uk'
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const open = params.get('labels') === '1'
  const setOpen = (next: boolean) => {
    if (!next && returnFocusRef)
      requestAnimationFrame(() => returnFocusRef.current?.focus())
    return setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        if (next) copy.set('labels', '1')
        else {
          copy.delete('labels')
          copy.delete('label')
        }
        return copy
      },
      { replace: true, preventScrollReset: true, state: navigationState },
    )
  }
  const [labels, setLabels] = useState<PrintableZoneLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState(() => params.get('locationSearch') ?? '')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    new Set(initialIds),
  )
  const [queue, setQueue] = useState(() => readLabelQueue(storageKey))
  const queueRef = useRef(queue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [cancelQueue, setCancelQueue] = useState<LocationLabelQueue | null>(
    null,
  )
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const commit = (next: LocationLabelQueue | null) => {
    queueRef.current = next
    setQueue(next)
    writeLabelQueue(storageKey, next)
  }
  useEffect(() => {
    const receive = () => {
      const next = readLabelQueue(storageKey)
      queueRef.current = next
      setQueue(next)
      setCancelQueue(null)
      setSelected(new Set())
    }
    const storage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) receive()
    }
    window.addEventListener('storage', storage)
    const unregister = tenantResetRegistry.register((scope) => {
      if (labelQueueKey(scope.userId, scope.tenantId) === storageKey) receive()
    })
    return () => {
      window.removeEventListener('storage', storage)
      unregister()
    }
  }, [storageKey])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void loadLocationLabels(
      { kind: target.kind, parentId: target.parentId, parentName: '' },
      controller.signal,
    ).then(
      (data) => {
        if (controller.signal.aborted) return
        setLabels(data)
        setLoading(false)
      },
      () => {
        if (controller.signal.aborted) return
        setLoadFailed(true)
        setLoading(false)
      },
    )
    return () => controller.abort()
  }, [open, target.kind, target.parentId, revision]) // target name is display-only

  const sameQueue = queue !== null && sameLabelTarget(queue.target, target)
  const locked = busy || (queue !== null && !sameQueue)
  const availableIds = new Set(labels.map((label) => label.id))
  const selection = new Set(
    sameQueue
      ? queue.remainingIds
      : [...selected].filter((id) => availableIds.has(id)),
  )
  const needle = search.trim().toLocaleLowerCase()
  // Keep removed/archived prepared labels in the same list so they can be unchecked.
  const unavailableLabels = sameQueue
    ? queue.remainingIds
        .filter((id) => !availableIds.has(id))
        .map((id) => ({
          id,
          zoneName: `${t('unavailable')} · ${id}`,
          zoneCode: id,
        }))
    : []
  const visible = [...labels, ...unavailableLabels].filter((label) =>
    `${label.zoneName} ${label.zoneCode}`.toLocaleLowerCase().includes(needle),
  )
  const batch = sameQueue ? queue.remainingIds : []
  const contextName =
    target.parentName ||
    (labels[0]?.path?.slice(0, -1).join(' → ') ??
      (sameQueue ? queue.target.parentName : ''))
  const previewLabels = [...selection].flatMap((id) => {
    const label = labels.find((item) => item.id === id)
    return label ? [label] : []
  })
  const previewSource = JSON.stringify(
    previewLabels.slice(0, 6).map((label) => ({
      id: label.id,
      name: label.zoneName,
      detail: label.zoneCode,
      qrCode: label.qrCode,
    })),
  )
  const [renderedPreview, setRenderedPreview] = useState<{
    source: string
    cards: StickerPreviewCard[]
  } | null>(null)
  useEffect(() => {
    if (!sameQueue) return
    let cancelled = false
    const cards = JSON.parse(previewSource) as {
      id: string
      name: string
      detail: string
      qrCode: string
    }[]
    void Promise.all(
      cards.map(async (card) => ({
        ...card,
        qrSvg: await QRCode.toString(card.qrCode, {
          type: 'svg',
          margin: 0,
          errorCorrectionLevel: 'H',
        }),
      })),
    ).then(
      (cards) => {
        if (!cancelled) setRenderedPreview({ source: previewSource, cards })
      },
      () => {
        /* Actual print preparation reports QR errors and preserves the queue. */
      },
    )
    return () => {
      cancelled = true
    }
  }, [previewSource, sameQueue])
  const previewCards =
    sameQueue && renderedPreview?.source === previewSource
      ? renderedPreview.cards
      : previewLabels.slice(0, 6).map((label) => ({
          id: label.id,
          name: label.zoneName,
          detail: label.zoneCode,
        }))
  const pageCount = Math.max(1, Math.ceil(visible.length / 10))
  const currentPage = Math.min(page, pageCount)

  const continuation = queue
    ? `${inventoryBase}/${queue.target.kind === 'zone' ? 'warehouses' : queue.target.kind === 'section' ? 'zones' : 'sections'}/${encodeURIComponent(queue.target.parentId)}?labels=1`
    : ''
  const updateSelection = (next: ReadonlySet<string>) => {
    if (locked || busyRef.current) return
    if (sameQueue) {
      if (queueRef.current !== queue) return
      if (next.size > MAX_LOCATION_LABELS) {
        setError(t('limit', { max: MAX_LOCATION_LABELS }))
        return
      }
      setSelected(new Set())
      commit(
        next.size
          ? {
              ...queue,
              remainingIds: [...next],
              totalCount: queue.printedCount + next.size,
            }
          : null,
      )
    } else {
      setSelected(next)
    }
    setError(null)
  }
  const prepareSelection = () => {
    if (locked || sameQueue || !selection.size) return
    const ids = [...selection]
    if (ids.length > MAX_LOCATION_LABELS) {
      setError(t('limit', { max: MAX_LOCATION_LABELS }))
      return
    }
    commit(createLabelQueue({ ...target, parentName: contextName }, ids))
    setSelected(new Set())
    setError(null)
  }
  const output = async (ids: string[]) => {
    if (busyRef.current || !ids.length || ids.length > MAX_LOCATION_LABELS)
      return
    let printWindow: Window | null = null
    const originalQueue = queueRef.current
    try {
      const scope = requireLatestMutation({
        permission: 'inventory.view',
        quota: false,
      })
      // Open synchronously on the user's click, before network/QR rendering awaits.
      printWindow = window.open('', '_blank')
      if (!printWindow) {
        setError(t('blocked'))
        return
      }
      printWindow.opener = null
      busyRef.current = true
      setBusy(true)
      setError(null)
      const fresh = await loadLocationLabels(target, scope.signal)
      if (
        !alive.current ||
        scope.signal.aborted ||
        originalQueue !== queueRef.current
      ) {
        printWindow.close()
        return
      }
      setLabels(fresh)
      const resolved = ids.map((id) => fresh.find((label) => label.id === id))
      if (resolved.some((label) => !label?.qrCode)) {
        setError(t('missing'))
        printWindow.close()
        return
      }
      const batchLabels = resolved as PrintableZoneLabel[]
      const html = await buildZoneLabelHtml(batchLabels, documentLocale)
      if (
        !alive.current ||
        scope.signal.aborted ||
        originalQueue !== queueRef.current
      ) {
        printWindow.close()
        return
      }
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      // As on Stickers, printing leaves the prepared queue available for retry.
      // Browsers cannot tell cancellation, PDF export or physical printing apart.
    } catch {
      printWindow?.close()
      if (alive.current) setError(t('failed'))
    } finally {
      busyRef.current = false
      if (alive.current) setBusy(false)
    }
  }

  return (
    <StickerWorkspace
      embedded
      showHeader={false}
      back={
        <>
          <SearchInput
            aria-label={t('search')}
            placeholder={t('search')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </>
      }
      title={t(target.kind)}
      label={t(target.kind)}
      subtitle={
        <>
          {contextName ? `${contextName} · ` : ''}
          {t('subtitle')}
        </>
      }
      notice={
        <>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {queue && !sameQueue ? (
            <Notice block>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
                <p className="m-0 min-w-0 flex-1 break-words">
                  {t('otherQueue', { name: queue.target.parentName })}
                </p>
                <div className="rz-btn-row items-center xl:shrink-0">
                  <Button asChild>
                    <Link to={continuation}>{t('continue')}</Link>
                  </Button>
                  <Button onClick={() => setCancelQueue(queue)}>
                    {t('cancelQueue')}
                  </Button>
                </div>
              </div>
            </Notice>
          ) : null}
        </>
      }
      list={
        <StickerListPanel
          embedded
          search={null}
          summary={ts('selectedSummary', {
            objects: selection.size,
            stickers: selection.size,
          })}
          actions={
            <>
              <Button
                disabled={locked || loading || loadFailed || !visible.length}
                onClick={() =>
                  updateSelection(
                    new Set([
                      ...selection,
                      ...visible.map((label) => label.id),
                    ]),
                  )
                }
              >
                {t(needle ? 'selectResults' : 'selectAll', {
                  count: visible.length,
                })}
              </Button>
              <Button
                disabled={locked || !selection.size}
                onClick={() => updateSelection(new Set())}
              >
                {ts('clear')}
              </Button>
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                <X aria-hidden />
                {t('finishSelection')}
              </Button>
            </>
          }
          footer={
            !loading && !loadFailed ? (
              <Pagination
                label={t('pagination')}
                page={currentPage}
                pageSize={10}
                total={visible.length}
                totalPages={pageCount}
                onPage={setPage}
              />
            ) : null
          }
        >
          {loading ? (
            <div className="p-3">
              <SkeletonRows rows={4} />
            </div>
          ) : loadFailed ? (
            <div className="p-3">
              <Notice tone="danger">
                {t('loadFailed')}{' '}
                <Button
                  onClick={() => {
                    setLoading(true)
                    setLoadFailed(false)
                    setRevision((value) => value + 1)
                  }}
                >
                  {t('retry')}
                </Button>
              </Notice>
            </div>
          ) : (
            <ul
              className="divide-app-line m-0 grid list-none divide-y p-0"
              aria-label={t(target.kind)}
            >
              {visible
                .slice((currentPage - 1) * 10, currentPage * 10)
                .map((label) => (
                  <StickerSelectionRow
                    key={label.id}
                    appearance="location"
                    icon={
                      target.kind === 'shelf' ? (
                        <Rows3 aria-hidden className="size-4" />
                      ) : (
                        <LayoutGrid aria-hidden className="size-4" />
                      )
                    }
                    label={label.zoneName}
                    checkboxLabel={t('select', { name: label.zoneName })}
                    selected={selection.has(label.id)}
                    disabled={locked}
                    onToggle={() => {
                      const next = new Set(selection)
                      if (next.has(label.id)) next.delete(label.id)
                      else next.add(label.id)
                      updateSelection(next)
                    }}
                    name={label.zoneName}
                    detail={label.zoneCode}
                  />
                ))}
              {!visible.length ? (
                <li className="rz-muted p-3">
                  {t(needle ? 'noMatches' : 'empty')}
                </li>
              ) : null}
            </ul>
          )}
        </StickerListPanel>
      }
      preview={
        <StickerSheetPreview
          cards={previewCards}
          objects={selection.size}
          total={selection.size}
          actions={
            <>
              {!sameQueue ? (
                <Button
                  className="w-full"
                  size="lg"
                  variant="primary"
                  disabled={locked || !selection.size || loading || loadFailed}
                  onClick={prepareSelection}
                >
                  <Printer aria-hidden />
                  {ts('prepare', { count: selection.size })}
                </Button>
              ) : null}
              {sameQueue ? (
                <>
                  <Button
                    className="w-full"
                    size="lg"
                    variant="primary"
                    disabled={locked || loading || loadFailed}
                    onClick={() => void output(batch)}
                  >
                    <Printer aria-hidden />
                    {busy ? t('printing') : t('print', { count: batch.length })}
                  </Button>
                  <Button
                    className="w-full"
                    disabled={locked || loading || loadFailed}
                    onClick={() => void output(batch)}
                  >
                    <FileDown aria-hidden />
                    {t('pdf', { count: batch.length })}
                  </Button>
                  <p className="rz-caption m-0">{t('pdfHint')}</p>
                </>
              ) : null}
            </>
          }
        />
      }
    >
      <ConfirmDialog
        open={cancelQueue !== null}
        onOpenChange={(next) => {
          if (!next) setCancelQueue(null)
        }}
        title={t('cancelTitle')}
        consequence={t('cancelHint')}
        confirmLabel={t('cancelQueue')}
        onConfirm={() => {
          if (queueRef.current === cancelQueue) commit(null)
          setCancelQueue(null)
          setError(null)
        }}
      />
    </StickerWorkspace>
  )
}
