import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { Check, FileDown, LoaderCircle, Printer, QrCode, X } from 'lucide-react'
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Notice,
  SearchInput,
  Pagination,
  SkeletonRows,
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
  labelQueueKey,
  MAX_LOCATION_LABELS,
  writeLabelQueue,
  type LocationLabelTarget,
} from './location-label-queue'
import './location-labels.css'

const PAGE_SIZE = 15

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

/** Print the current selection directly; saved queues and completion counts are intentionally absent. */
export function LocationLabelsPage({
  target,
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
      returnFocusRef={returnFocusRef}
      sectionShelfCounts={sectionShelfCounts}
      storageKey={labelQueueKey(snapshot.userId, snapshot.tenantId)}
    />
  )
}

function ScopedLocationLabels({
  target,
  returnFocusRef,
  storageKey,
  initialIds,
  sectionShelfCounts,
}: {
  target: LocationLabelTarget
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
  const [error, setError] = useState<{
    text: string
    tone: NoticeTone
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const printRevision = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    // Retire saved location print queues; selection now belongs to this screen.
    writeLabelQueue(storageKey, null)
    return tenantResetRegistry.register((scope) => {
      if (labelQueueKey(scope.userId, scope.tenantId) !== storageKey) return
      printRevision.current += 1
      setSelected(new Set())
      setError(null)
    })
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

  const availableIds = new Set(labels.map((label) => label.id))
  const selection = new Set([...selected].filter((id) => availableIds.has(id)))
  const needle = search.trim().toLocaleLowerCase()
  const visible = labels.filter((label) =>
    `${label.zoneName} ${label.zoneCode}`.toLocaleLowerCase().includes(needle),
  )
  const contextName =
    target.parentName || (labels[0]?.path?.slice(0, -1).join(' → ') ?? '')
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)

  const updateSelection = (next: ReadonlySet<string>) => {
    if (busyRef.current) return
    if (next.size > MAX_LOCATION_LABELS) {
      setError({ text: t('limit', { max: MAX_LOCATION_LABELS }), tone: 'warn' })
      return
    }
    setSelected(new Set(next))
    setError(null)
  }
  // Print failures keep the current selection and offer a persistent retry.
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
    if (busyRef.current || !ids.length) return
    if (ids.length > MAX_LOCATION_LABELS) {
      setError({ text: t('limit', { max: MAX_LOCATION_LABELS }), tone: 'warn' })
      return
    }
    let printWindow: Window | null = null
    const originalRevision = printRevision.current
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
        originalRevision !== printRevision.current
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
        originalRevision !== printRevision.current
      ) {
        printWindow.close()
        return
      }
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      // Keep the current selection for retry or PDF; browser printing has no
      // reliable physical-print completion signal. Nothing is persisted.
    } catch {
      printWindow?.close()
      if (alive.current) printFailed(t('failed'), ids)
    } finally {
      busyRef.current = false
      if (alive.current) setBusy(false)
    }
  }

  const lockReason = busy ? t('printing') : undefined
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
      cell: (label) => (
        <span className="location-labels__code">{label.zoneCode}</span>
      ),
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
          disabled={busy || loading || loadFailed}
          onClick={selectVisible}
          type="button"
        >
          {selectAllLabel}
        </button>
      )}
      <div className="rz-bulk__actions items-center">
        <Button
          disabled={busy || loading || loadFailed}
          onClick={() => void output([...selection])}
        >
          {busy ? (
            <LoaderCircle aria-hidden className="rz-spin" />
          ) : (
            <Printer aria-hidden />
          )}
          {busy ? t('printing') : t('print', { count: selection.size })}
        </Button>
        <Button
          disabled={busy || loading || loadFailed}
          onClick={() => void output([...selection])}
        >
          <FileDown aria-hidden />
          {t('pdf', { count: selection.size })}
        </Button>
        <Button disabled={busy} onClick={() => setOpen(false)} variant="quiet">
          <Check aria-hidden />
          {t('finishSelection')}
        </Button>
        <Button
          aria-label={ta('clearSelection')}
          disabled={busy}
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
      rows={visible.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      )}
      selection={{
        selected: selection,
        onChange: updateSelection,
        rowLabel: (label) => t('select', { name: label.zoneName }),
        unavailable: () => lockReason,
        selectOnRowClick: 'always',
      }}
      footer={
        <Pagination
          label={t('pagination')}
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={visible.length}
          totalPages={pageCount}
          onPage={setPage}
        />
      }
    />
  )

  const notice = error ? <Notice tone={error.tone}>{error.text}</Notice> : null

  return (
    <section
      aria-label={t(target.kind)}
      className={`location-labels location-labels--${target.kind} grid min-w-0 content-start gap-4`}
    >
      {notice}
      {selection.size > 0 ? bulk : toolbar}
      {selection.size > 0 ? <p className="rz-caption">{t('pdfHint')}</p> : null}
      <div className="rz-card location-labels__head">
        <h2 className="rz-h-card">{t(target.kind)}</h2>
        <p className="rz-caption mt-0.5">
          {contextName ? `${contextName} · ` : ''}
          {t('subtitle')}
        </p>
      </div>
      {list}
    </section>
  )
}

interface LabelRow {
  id: string
  zoneName: string
  zoneCode: string
}
