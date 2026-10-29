import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Printer } from 'lucide-react'
import { inventoryApi } from '@/api/inventory'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Notice,
  Pagination,
  SearchInput,
  SkeletonRows,
} from '@/components/app'
import { useT } from '@/i18n'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { locationLabelMessages } from '../inventory/location-label-messages'
import {
  loadLocationLabelCollection,
  loadStorageStickerCatalogue,
} from '../inventory/location-label-data'
import {
  MAX_LOCATION_LABELS,
  LOCATION_LABEL_BATCH,
  sameLabelTarget,
  type LocationLabelTarget,
} from '../inventory/location-label-queue'
import {
  buildZoneLabelHtml,
  type PrintableZoneLabel,
} from '../inventory/zone-label-output'
import { buildStickerSvg } from './sticker-output'
import {
  StickerPageWorkspace,
  StickerListPanel,
  StickerSelectionRow,
  STICKER_LIST_PAGE_SIZE as PAGE_SIZE,
} from './StickerWorkspace'
import { stickersMessages } from './messages'
import {
  StickerSheetPreview,
  type StickerPreviewCard,
} from './StickerSheetPreview'
import { LocationPrintQueueCard } from './LocationPrintQueueCard'
import { LocationQueueEditor } from './LocationQueueEditor'
import { LocationBatchConfirmation } from './LocationBatchConfirmation'
import { locationStickersMessages } from './location-stickers-messages'
import { locationStickersHref, parseStickerRoute } from './sticker-route'
import { StickerFileActions } from './StickerFileActions'
import {
  downloadStickerHtml,
  shareStickerHtml,
  StickerSharingUnsupported,
  type StickerFileFormat,
} from './sticker-file-output'
import { useStickerFeedback } from './use-sticker-feedback'
import { useLocationPrintQueue } from './use-location-print-queue'
import {
  locationQueueStore,
  withLocationQueueLock,
  type LocationQueueExpected,
  type LocationQueueScope,
} from './location-queue-store'
import { resolveLocationBatch } from './location-batch-output'

interface PendingBatch {
  expected: LocationQueueExpected
  ids: string[]
  signal: AbortSignal
}
interface QueueEditorState {
  expected: LocationQueueExpected
  ids: string[]
  mode: 'remove' | 'confirm'
}

export function LocationStickersScreen({
  navigation,
}: {
  navigation?: ReactNode
}) {
  const cabinet = useCabinet()
  const [params] = useSearchParams()
  const route = parseStickerRoute(params)
  const snapshot = cabinet.snapshot
  if (
    cabinet.status !== 'ready' ||
    !snapshot ||
    snapshot.tenantId !== cabinet.targetTenant?.id ||
    !snapshot.permissions.has('inventory.view')
  )
    return null
  const scope = { userId: snapshot.userId, tenantId: snapshot.tenantId }
  return (
    <ScopedLocationStickers
      key={`${scope.userId}:${scope.tenantId}:${snapshot.generation}:${route.collection?.kind ?? ''}:${route.collection?.parentId ?? ''}`}
      scope={scope}
      tenantSlug={cabinet.targetTenant.slug}
      navigation={navigation}
    />
  )
}

function ScopedLocationStickers({
  scope,
  tenantSlug,
  navigation,
}: {
  scope: LocationQueueScope
  tenantSlug: string
  navigation?: ReactNode
}) {
  const t = useT(locationLabelMessages),
    ts = useT(locationStickersMessages),
    tp = useT(stickersMessages)
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate()
  const route = parseStickerRoute(params)
  const kind = route.collection?.kind,
    parentId = route.collection?.parentId
  const seed = route.selectAll ? 'all' : route.selectedIds.join(',')
  const loadedRequest = useRef('')
  const queueState = useLocationPrintQueue(scope)
  const queue = queueState.queue
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.warehouses,
  )
  const documentLocale = useTenantSettings().documentLanguage ?? 'uk'
  const [data, setData] = useState<{
    target: LocationLabelTarget
    labels: PrintableZoneLabel[]
  } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading',
    ),
    [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1)
  const { error, message, setError, setMessage } = useStickerFeedback()
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingBatch | null>(null)
  const [editor, setEditor] = useState<QueueEditorState | null>(null)
  const [cancel, setCancel] = useState<LocationQueueExpected | null>(null)
  const [preview, setPreview] = useState<StickerPreviewCard[]>([])
  const mounted = useRef(true),
    outputBusy = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!kind || !parentId) return
    const requestKey = `${kind}:${parentId}:${reload}`
    if (!seed && loadedRequest.current === requestKey) return
    const controller = new AbortController()
    void loadStorageStickerCatalogue({ kind, parentId }, controller.signal)
      .then(async (result) => {
        if (controller.signal.aborted) return
        // Upgrade only the resolved legacy collection, under the same owner lock.
        const owner = { userId: scope.userId, tenantId: scope.tenantId }
        await withLocationQueueLock(owner, () => {
          if (controller.signal.aborted) return
          const current = locationQueueStore.getSnapshot()
          if (
            current.scope?.userId !== owner.userId ||
            current.scope?.tenantId !== owner.tenantId
          )
            return
          if (
            current.queue?.target.kind === kind &&
            current.queue.target.parentId === parentId &&
            kind !== 'warehouse'
          ) {
            locationQueueStore.retarget(result.target, {
              queueId: current.queue.id,
              revision: current.revision,
            })
          }
        })
        if (controller.signal.aborted) return
        const initialLoad = loadedRequest.current === ''
        loadedRequest.current = requestKey
        setData(result)
        setStatus('ready')
        if (seed || initialLoad) {
          const requested =
            !seed || seed === 'all' ? null : new Set(seed.split(','))
          const activeQueue = locationQueueStore.getSnapshot().queue
          const queuedIds = new Set(
            activeQueue && sameLabelTarget(result.target, activeQueue.target)
              ? activeQueue.remainingIds
              : [],
          )
          const requestedIds = new Set(
            result.labels
              .filter(
                (label) =>
                  (kind === 'warehouse' ||
                    (label.kind === kind && label.parentId === parentId)) &&
                  (!requested || requested.has(label.id)),
              )
              .map((label) => label.id),
          )
          const firstRequestedIndex = result.labels
            .filter((label) => !queuedIds.has(label.id))
            .findIndex((label) => requestedIds.has(label.id))
          setPage(Math.floor(Math.max(0, firstRequestedIndex) / PAGE_SIZE) + 1)
          if (!seed) return
          setSelected(
            new Set([...requestedIds].filter((id) => !queuedIds.has(id))),
          )
          setParams(
            (current) => {
              const next = new URLSearchParams(current)
              next.delete('select')
              next.delete('label')
              return next
            },
            { replace: true },
          )
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })
    return () => controller.abort()
  }, [kind, parentId, reload, seed, setParams, scope.userId, scope.tenantId])
  useEffect(() => {
    if (route.invalid || kind || !queue) return
    void navigate(locationStickersHref(tenantSlug, queue.target, []), {
      replace: true,
    })
  }, [route.invalid, kind, queue, tenantSlug, navigate])
  useEffect(() => {
    if (route.invalid || kind || queue) return
    const controller = new AbortController()
    void inventoryApi.getWarehouses({ signal: controller.signal }).then(
      (warehouses) => {
        if (controller.signal.aborted) return
        const first = warehouses.find((warehouse) => warehouse.isActive)
        if (first)
          void navigate(
            locationStickersHref(
              tenantSlug,
              { kind: 'warehouse', parentId: first.id },
              [],
            ),
            { replace: true },
          )
        else setStatus('ready')
      },
      () => {
        if (!controller.signal.aborted) setStatus('error')
      },
    )
    return () => controller.abort()
  }, [route.invalid, kind, queue, tenantSlug, navigate, reload])
  const same = Boolean(
    data && queue && sameLabelTarget(data.target, queue.target),
  )
  const queued = useMemo(
    () => new Set(same ? queue?.remainingIds : []),
    [same, queue],
  )
  const [previousQueued, setPreviousQueued] = useState(queued)
  if (previousQueued !== queued) {
    setPreviousQueued(queued)
    setSelected(
      (current) => new Set([...current].filter((id) => !queued.has(id))),
    )
  }
  const chosen =
    data?.labels.filter(
      (label) => selected.has(label.id) && !queued.has(label.id),
    ) ?? []
  const needle = search.trim().toLocaleLowerCase()
  const filtered =
    data?.labels.filter(
      (label) =>
        !queued.has(label.id) &&
        `${label.zoneName} ${label.zoneCode} ${label.path?.join(' ') ?? ''}`
          .toLocaleLowerCase()
          .includes(needle),
    ) ?? []
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    currentPage = Math.min(page, pageCount)
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const previewLabels = chosen.length
    ? chosen
    : ((same
        ? queue?.remainingIds
            .slice(0, 6)
            .flatMap(
              (id) => data?.labels.find((label) => label.id === id) ?? [],
            )
        : []) ?? [])
  const previewCount =
    chosen.length ||
    (same && queue
      ? Math.min(LOCATION_LABEL_BATCH, queue.remainingIds.length)
      : 0)
  const previewKey = JSON.stringify(
    previewLabels
      .slice(0, 6)
      .map((label) => [label.id, label.qrCode, label.zoneName, label.zoneCode]),
  )
  useEffect(() => {
    let active = true
    const labels = JSON.parse(previewKey) as [string, string, string, string][]
    void Promise.all(
      labels.map(async ([id, qrCode, name, detail]) => ({
        id,
        name,
        detail,
        qrSvg: await buildStickerSvg(qrCode),
      })),
    ).then(
      (cards) => {
        if (active) setPreview(cards)
      },
      () => {
        if (active) setPreview([])
      },
    )
    return () => {
      active = false
    }
  }, [previewKey])
  const expected = queue
    ? { queueId: queue.id, revision: queueState.revision }
    : null
  const matchesSnapshot = (token: LocationQueueExpected) =>
    queue?.id === token.queueId && queueState.revision === token.revision
  const isCurrent = (token: LocationQueueExpected) => {
    const current = locationQueueStore.getSnapshot()
    return (
      mounted.current &&
      current.scope?.userId === scope.userId &&
      current.scope.tenantId === scope.tenantId &&
      current.queue?.id === token.queueId &&
      current.revision === token.revision
    )
  }
  const pendingValid =
    pending && !pending.signal.aborted && matchesSnapshot(pending.expected)
      ? pending
      : null
  const editorValid = editor && matchesSnapshot(editor.expected) ? editor : null
  const guard = () =>
    requireLatestMutation({ permission: 'inventory.view', quota: false })
  const runQueueMutation = async (operation: () => void) => {
    if (outputBusy.current) return
    outputBusy.current = true
    setBusy(true)
    try {
      await withLocationQueueLock(scope, () => {
        if (!mounted.current) return
        guard()
        operation()
      })
    } catch {
      if (mounted.current) setError(ts('createFailed'))
    } finally {
      outputBusy.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const changeQueue = () => {
    if (!data || !chosen.length || busy) return
    void runQueueMutation(() => {
      const result = queue
        ? queueState.append(
            data.target,
            chosen.map((label) => label.id),
          )
        : queueState.start(
            data.target,
            chosen.map((label) => label.id),
          )
      if (!result.ok) {
        setError(
          result.reason === 'limit'
            ? ts('limit', { max: MAX_LOCATION_LABELS })
            : ts('createFailed'),
        )
        return
      }
      setSelected(new Set())
      setError(null)
      setMessage(null)
    })
  }
  const output = async (
    format: 'print' | StickerFileFormat,
    fromQueue = true,
  ) => {
    if (outputBusy.current || !data || status !== 'ready') return
    const original = fromQueue ? queue : null
    if (fromQueue && (!original || !same)) return
    const token = original
      ? { queueId: original.id, revision: queueState.revision }
      : null
    const ids = original
      ? original.remainingIds.slice(0, LOCATION_LABEL_BATCH)
      : chosen.map((label) => label.id)
    if (!ids.length || ids.length > MAX_LOCATION_LABELS) return
    let popup: Window | null = null
    try {
      const mutation = guard()
      if (format === 'print' || format === 'pdf') {
        popup = window.open('', '_blank')
        if (!popup) {
          setError(t('blocked'))
          return
        }
        popup.opener = null
      }
      outputBusy.current = true
      setBusy(true)
      setError(null)
      if (format === 'print') setPending(null)
      const current = () => {
        const owner = locationQueueStore.getSnapshot().scope
        return (
          mounted.current &&
          !mutation.signal.aborted &&
          owner?.userId === scope.userId &&
          owner.tenantId === scope.tenantId &&
          (!token || isCurrent(token))
        )
      }
      const fresh = await loadLocationLabelCollection(
        data.target,
        mutation.signal,
      )
      if (!current()) {
        popup?.close()
        return
      }
      setData(fresh)
      const labels = original
        ? resolveLocationBatch(original, fresh.labels)
        : ids.map((id) => {
            const label = fresh.labels.find((label) => label.id === id)
            if (!label) throw new Error('missing-location')
            return label
          })
      const html = await buildZoneLabelHtml(labels, documentLocale)
      if (!current()) {
        popup?.close()
        return
      }
      guard()
      if (popup) {
        popup.document.write(html)
        popup.document.close()
        popup.focus()
        popup.print()
        if (format === 'print' && token && current())
          setPending({
            expected: token,
            ids: [...ids],
            signal: mutation.signal,
          })
      } else if (format === 'download') downloadStickerHtml(html)
      else await shareStickerHtml(html, tp('shareTitle'))
    } catch (error) {
      popup?.close()
      if (mounted.current)
        setError(
          error instanceof StickerSharingUnsupported
            ? tp('shareUnsupported')
            : t('failed'),
        )
    } finally {
      outputBusy.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const confirm = (ids: string[]) => {
    if (
      !pendingValid ||
      !ids.length ||
      ids.some((id) => !pendingValid.ids.includes(id))
    )
      return
    void runQueueMutation(() => {
      if (!queueState.acknowledge(ids, pendingValid.expected)) {
        setError(ts('createFailed'))
        return
      }
      if (!locationQueueStore.getSnapshot().queue) setMessage(ts('completed'))
      setPending(null)
      setEditor(null)
    })
  }
  const list = (
    <div className="grid min-w-0 gap-3">
      {queue ? (
        <LocationPrintQueueCard
          queue={queue}
          busy={busy || status === 'loading'}
          sameCollection={same && status === 'ready'}
          onPrint={() => void output('print')}
          onPdf={() => void output('pdf')}
          onContinue={() =>
            void navigate(locationStickersHref(tenantSlug, queue.target, []))
          }
          onManage={() => {
            if (expected)
              setEditor({
                expected,
                ids: [...queue.remainingIds],
                mode: 'remove',
              })
          }}
          onCancel={() => setCancel(expected)}
        />
      ) : null}
      {pendingValid ? (
        <LocationBatchConfirmation
          onAll={() => confirm(pendingValid.ids)}
          onPartial={() =>
            setEditor({
              expected: pendingValid.expected,
              ids: pendingValid.ids,
              mode: 'confirm',
            })
          }
          onNone={() => setPending(null)}
        />
      ) : null}
      <StickerListPanel
        search={
          <SearchInput
            aria-label={t('search')}
            placeholder={t('search')}
            value={search}
            disabled={busy}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        }
        summary={tp('selectedSummary', {
          objects: chosen.length,
          stickers: chosen.length,
        })}
        actions={
          <>
            <Button
              disabled={busy || status !== 'ready' || !filtered.length}
              onClick={() =>
                setSelected(
                  new Set([
                    ...selected,
                    ...visible
                      .filter((label) => !queued.has(label.id))
                      .map((label) => label.id),
                  ]),
                )
              }
            >
              {tp('selectAll')}
            </Button>
            <Button
              disabled={busy || !selected.size}
              onClick={() => setSelected(new Set())}
            >
              {tp('clear')}
            </Button>
          </>
        }
        footer={
          <Pagination
            label={t('pagination')}
            onPage={setPage}
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            totalPages={pageCount}
          />
        }
      >
        {status === 'loading' && !route.invalid ? (
          <SkeletonRows rows={4} columns={3} />
        ) : status === 'error' ? (
          <ErrorState
            title={t('loadFailed')}
            retryLabel={t('retry')}
            onRetry={() => {
              setStatus('loading')
              setReload((value) => value + 1)
            }}
          />
        ) : !filtered.length ? (
          <EmptyState title={t(needle ? 'noMatches' : 'empty')} />
        ) : null}
        <ul
          className="divide-app-line m-0 grid list-none divide-y p-0"
          aria-label={t('warehouse')}
        >
          {visible.map((label) => (
            <StickerSelectionRow
              key={label.id}
              label={t('select', { name: label.zoneName })}
              checkboxLabel={t('select', { name: label.zoneName })}
              selected={selected.has(label.id)}
              disabled={busy || status !== 'ready'}
              onToggle={() =>
                setSelected((current) => {
                  const next = new Set(current)
                  if (next.has(label.id)) next.delete(label.id)
                  else next.add(label.id)
                  return next
                })
              }
              name={label.zoneName}
              code={label.zoneCode}
              detail={
                <>
                  {label.path?.slice(0, -1).join(' · ') ??
                    data?.target.parentName}
                  <span className="rz-dot rz-dot--ok ml-2">
                    {t(label.kind ?? 'zone')}
                  </span>
                </>
              }
            />
          ))}
        </ul>
        {queue && !same ? (
          <div className="p-3">
            <Notice tone="warn">
              {t('otherQueue', { name: queue.target.parentName })}
            </Notice>
          </div>
        ) : null}
      </StickerListPanel>
    </div>
  )
  return (
    <StickerPageWorkspace
      navigation={navigation}
      actions={
        <Button
          aria-busy={busy}
          variant="primary"
          disabled={
            busy ||
            status !== 'ready' ||
            chosen.length > MAX_LOCATION_LABELS ||
            Boolean(queue && !same) ||
            (!chosen.length && !(queue && same))
          }
          onClick={() => (chosen.length ? changeQueue() : void output('print'))}
        >
          <Printer aria-hidden />
          {busy
            ? tp('preparing')
            : chosen.length && queue
              ? t('add', { count: chosen.length })
              : !chosen.length && queue && same
                ? tp('print', {
                    count: Math.min(
                      LOCATION_LABEL_BATCH,
                      queue.remainingIds.length,
                    ),
                  })
                : tp('prepare', { count: chosen.length })}
        </Button>
      }
      notice={
        <>
          {route.invalid ? (
            <Notice tone="danger">{ts('invalid')}</Notice>
          ) : null}
          {queueState.persistenceError ? (
            <Notice tone="warn">{ts('storageError')}</Notice>
          ) : null}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {message ? (
            <p role="status" className="rz-muted">
              {message}
            </p>
          ) : null}
        </>
      }
      list={list}
      preview={
        <StickerSheetPreview
          cards={preview}
          objects={previewCount}
          total={previewCount}
          actions={
            previewCount > 0 ? (
              <div className="grid gap-2">
                {chosen.length > MAX_LOCATION_LABELS ? (
                  <Notice tone="warn">
                    {ts('limit', { max: MAX_LOCATION_LABELS })}
                  </Notice>
                ) : null}
                <StickerFileActions
                  count={previewCount}
                  source={chosen.length ? 'selection' : 'batch'}
                  disabled={
                    busy ||
                    status !== 'ready' ||
                    chosen.length > MAX_LOCATION_LABELS
                  }
                  onOutput={(format) =>
                    void output(format, chosen.length === 0)
                  }
                />
              </div>
            ) : null
          }
        />
      }
    >
      {editorValid ? (
        <LocationQueueEditor
          key={`${editorValid.expected.queueId}:${editorValid.expected.revision}:${editorValid.mode}`}
          ids={editorValid.ids}
          labels={data?.labels ?? []}
          mode={editorValid.mode}
          onClose={() => setEditor(null)}
          onSubmit={(ids) => {
            if (editorValid.mode === 'confirm') {
              confirm(ids)
              return
            }
            void runQueueMutation(() => {
              if (!queueState.remove(ids, editorValid.expected))
                setError(ts('createFailed'))
              else if (!locationQueueStore.getSnapshot().queue)
                setMessage(ts('emptied'))
              setEditor(null)
            })
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(cancel && matchesSnapshot(cancel))}
        onOpenChange={(open) => {
          if (!open) setCancel(null)
        }}
        title={t('cancelTitle')}
        consequence={t('cancelHint')}
        confirmLabel={t('cancelQueue')}
        pending={busy}
        onConfirm={() => {
          if (cancel)
            void runQueueMutation(() => {
              if (!queueState.discard(cancel)) setError(ts('createFailed'))
              setCancel(null)
              setPending(null)
            })
        }}
      />
    </StickerPageWorkspace>
  )
}
