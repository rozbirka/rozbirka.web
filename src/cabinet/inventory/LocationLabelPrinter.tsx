import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
  Check,
  FileDown,
  LoaderCircle,
  Play,
  Printer,
  QrCode,
  X,
} from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Notice,
  SearchInput,
  Pagination,
  SkeletonRows,
  StatusPill,
  type DataColumn,
  type NoticeTone,
  useOptionalToast,
} from '@/components/app'
import { appMessages } from '@/components/app/app-messages'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useFormat, useT } from '@/i18n'
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
import { locationBrowserMessages } from './location-browser-messages'
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
import './location-labels.css'

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
  sectionShelfCounts,
}: {
  target: LocationLabelTarget
  inventoryBase: string
  returnFocusRef?: RefObject<HTMLButtonElement | null> | undefined
  sectionShelfCounts?: ReadonlyMap<string, number> | undefined
  /** Kept for callers; the list now draws its own cards at every width. */
  flush?: boolean
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
      sectionShelfCounts={sectionShelfCounts}
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
  sectionShelfCounts,
}: {
  target: LocationLabelTarget
  inventoryBase: string
  returnFocusRef?: RefObject<HTMLButtonElement | null> | undefined
  storageKey: string
  initialIds: string[]
  sectionShelfCounts?: ReadonlyMap<string, number> | undefined
}) {
  const t = useT(locationLabelMessages)
  const ta = useT(appMessages)
  const tb = useT(locationBrowserMessages)
  const toast = useOptionalToast()
  const f = useFormat()
  const documentLocale = useTenantSettings().documentLanguage ?? 'uk'
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.warehouses,
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
  const [error, setError] = useState<{
    text: string
    tone: NoticeTone
  } | null>(null)
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
  const pageCount = Math.max(1, Math.ceil(visible.length / 10))
  const currentPage = Math.min(page, pageCount)

  const continuation = queue
    ? `${inventoryBase}/${queue.target.kind === 'zone' ? '' : queue.target.kind === 'section' ? 'zones/' : 'sections/'}${encodeURIComponent(queue.target.parentId)}?labels=1`
    : ''
  const updateSelection = (next: ReadonlySet<string>) => {
    if (locked || busyRef.current) return
    if (sameQueue) {
      if (queueRef.current !== queue) return
      if (next.size > MAX_LOCATION_LABELS) {
        setError({
          text: t('limit', { max: MAX_LOCATION_LABELS }),
          tone: 'warn',
        })
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
      setError({ text: t('limit', { max: MAX_LOCATION_LABELS }), tone: 'warn' })
      return
    }
    commit(createLabelQueue({ ...target, parentName: contextName }, ids))
    setSelected(new Set())
    setError(null)
  }
  /* Module 12, 2.11: a failed print keeps the queue, so it is a danger toast
     with a retry that stays until closed; without a toast host it stays on
     the page. */
  const printFailed = (text: string, ids: string[]) => {
    if (toast === null) {
      setError({ text, tone: 'danger' })
      return
    }
    toast.show({
      tone: 'danger',
      message: text,
      action: {
        label: t('retry'),
        kind: 'retry',
        onAction: () => void output(ids),
      },
    })
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
        printFailed(t('blocked'), ids)
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
        setError({ text: t('missing'), tone: 'warn' })
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
      if (alive.current) printFailed(t('failed'), ids)
    } finally {
      busyRef.current = false
      if (alive.current) setBusy(false)
    }
  }

  const queued = new Set(batch)
  const lockReason = busy
    ? t('printing')
    : queue !== null && !sameQueue
      ? t('otherQueue', { name: queue.target.parentName })
      : undefined
  const columns: DataColumn<LabelRow>[] = [
    {
      key: 'name',
      label: t('name'),
      variant: 'primary',
      cell: (label) => label.zoneName,
    },
    {
      key: 'code',
      label: t('code'),
      cell: (label) => <span className="font-mono">{label.zoneCode}</span>,
    },
  ]
  if (target.kind === 'section')
    columns.push({
      key: 'shelves',
      label: tb('shelves'),
      align: 'end',
      cell: (label) => {
        const count = sectionShelfCounts?.get(label.id)
        return (
          <span className="font-mono tabular-nums">
            {count === undefined ? '—' : (f.number(count) ?? String(count))}
          </span>
        )
      },
    })
  if (sameQueue)
    columns.push({
      key: 'queued',
      label: t('queue'),
      align: 'end',
      headerHidden: true,
      cell: (label) =>
        queued.has(label.id) ? (
          // The end column is mono for numbers; the status reads as text.
          <span className="font-sans">
            <StatusPill tone="info">{t('queued')}</StatusPill>
          </span>
        ) : null,
    })
  const selectVisible = () =>
    updateSelection(
      new Set([...selection, ...visible.map((label) => label.id)]),
    )
  const everythingVisibleSelected =
    visible.length > 0 && visible.every((label) => selection.has(label.id))
  const selectAllLabel = t(needle ? 'selectResults' : 'selectAll', {
    count: visible.length,
  })

  const toolbar = (
    <div className="rz-toolbar" role="search">
      <SearchInput
        aria-label={t('search')}
        placeholder={t('search')}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(1)
        }}
      />
      <div className="rz-toolbar__end flex-wrap items-center">
        {sameQueue ? (
          <Button
            disabled={locked || loading || loadFailed || !visible.length}
            onClick={selectVisible}
            variant="quiet"
          >
            {selectAllLabel}
          </Button>
        ) : null}
        <Button disabled={busy} onClick={() => setOpen(false)}>
          <Check aria-hidden />
          {t('finishSelection')}
        </Button>
      </div>
    </div>
  )

  const bulk = (
    <div aria-label={ta('bulkRegion')} className="rz-bulk" role="region">
      <p className="text-app-ink flex items-baseline gap-1.5">
        <span className="rz-bulk__count">{selection.size}</span>
        <span>{ta('bulkSelected', { noun: '' }).trim()}</span>
      </p>
      {everythingVisibleSelected ? null : (
        <button
          className="text-app-muted hover:text-app-ink cursor-pointer text-caption underline underline-offset-2 disabled:cursor-not-allowed"
          disabled={locked || loading || loadFailed}
          onClick={selectVisible}
          type="button"
        >
          {selectAllLabel}
        </button>
      )}
      <div className="rz-bulk__actions items-center">
        <Button
          disabled={locked || loading || loadFailed}
          onClick={prepareSelection}
        >
          <Printer aria-hidden />
          {t('create', { count: selection.size })}
        </Button>
        <Button
          aria-label={ta('clearSelection')}
          disabled={locked}
          onClick={() => updateSelection(new Set())}
          size="icon"
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  )

  const list = loading ? (
    <SkeletonRows columns={2} rows={4} />
  ) : loadFailed ? (
    <ErrorState
      title={t('loadFailed')}
      retryLabel={t('retry')}
      onRetry={() => {
        setLoading(true)
        setLoadFailed(false)
        setRevision((value) => value + 1)
      }}
    />
  ) : !visible.length ? (
    <EmptyState
      icon={<QrCode aria-hidden />}
      title={t(needle ? 'noMatches' : 'empty')}
      tone="neutral"
    />
  ) : (
    <DataTable<LabelRow>
      caption={t(target.kind)}
      columns={columns}
      rowKey={(label) => label.id}
      rows={visible.slice((currentPage - 1) * 10, currentPage * 10)}
      selection={{
        selected: selection,
        onChange: updateSelection,
        rowLabel: (label) => t('select', { name: label.zoneName }),
        unavailable: () => lockReason,
      }}
      footer={
        pageCount > 1 ? (
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
    />
  )

  const notice = error ? <Notice tone={error.tone}>{error.text}</Notice> : null

  return (
    <section
      aria-label={t(target.kind)}
      className={`location-labels location-labels--${target.kind} grid min-w-0 content-start gap-4`}
    >
      {queue && !sameQueue ? (
        <div className="rz-card rz-card__body grid gap-3">
          <Notice tone="warn">
            {t('otherQueue', { name: queue.target.parentName })}
          </Notice>
          <div className="rz-btn-row flex-wrap">
            <Button asChild>
              <Link to={continuation}>
                <Play aria-hidden />
                {t('continue')}
              </Link>
            </Button>
            <Button onClick={() => setCancelQueue(queue)} variant="quiet">
              <X aria-hidden />
              {t('cancelQueue')}
            </Button>
          </div>
        </div>
      ) : null}
      {sameQueue ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid min-w-0 content-start gap-4">
            {toolbar}
            {list}
          </div>
          <section aria-label={t('queue')} className="rz-card min-w-0">
            <header className="rz-card__head py-2.5">
              <div className="min-w-0">
                <h2 className="rz-h-card">{t('queue')}</h2>
                <p className="rz-caption mt-0.5">
                  {t('queueCount', { count: queue.totalCount })}
                </p>
              </div>
            </header>
            <div className="rz-card__body grid gap-3">
              {notice}
              <p className="text-app-muted text-caption">
                {t('progress', {
                  printed: queue.printedCount,
                  total: queue.totalCount,
                  remaining: batch.length,
                })}
              </p>
              {busy ? (
                <div className="location-labels__row">
                  <Button aria-busy disabled variant="primary">
                    <LoaderCircle aria-hidden className="rz-spin" />
                    {t('printing')}
                  </Button>
                  <p className="rz-caption">{t('pdfHint')}</p>
                </div>
              ) : (
                <>
                  <div className="rz-btn-row flex-wrap">
                    <Button
                      disabled={locked || loading || loadFailed}
                      onClick={() => void output(batch)}
                      variant="primary"
                    >
                      <Printer aria-hidden />
                      {t('print', { count: batch.length })}
                    </Button>
                    <Button
                      disabled={locked || loading || loadFailed}
                      onClick={() => void output(batch)}
                    >
                      <FileDown aria-hidden />
                      {t('pdf', { count: batch.length })}
                    </Button>
                  </div>
                  <div className="location-labels__row">
                    <Button
                      onClick={() => setCancelQueue(queue)}
                      variant="quiet"
                    >
                      <X aria-hidden />
                      {t('cancelQueue')}
                    </Button>
                    <p className="rz-caption">{t('pdfHint')}</p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      ) : (
        <>
          {notice}
          {selection.size > 0 && queue === null ? bulk : toolbar}
          <div className="rz-card location-labels__head">
            <h2 className="rz-h-card">{t(target.kind)}</h2>
            <p className="rz-caption mt-0.5">
              {contextName ? `${contextName} · ` : ''}
              {t('subtitle')}
            </p>
          </div>
          {list}
        </>
      )}
      <ConfirmDialog
        open={cancelQueue !== null}
        onOpenChange={(next) => {
          if (!next) setCancelQueue(null)
        }}
        title={t('cancelTitle')}
        consequence={t('cancelHint')}
        confirmLabel={t('cancelQueue')}
        destructive
        onConfirm={() => {
          if (queueRef.current === cancelQueue) commit(null)
          setCancelQueue(null)
          setError(null)
        }}
      />
    </section>
  )
}

interface LabelRow {
  id: string
  zoneName: string
  zoneCode: string
}
