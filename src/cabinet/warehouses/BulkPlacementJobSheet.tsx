import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  inventoryApi,
  type BatchPlacePartResult,
  type BatchPlacePartsRequest,
  type PartPlacementJob,
} from '@/api/inventory'
import type { PartSearchItem } from '@/api/parts'
import { normalizeApiProblem } from '@/api/errors'
import { Button, Notice, Sheet, StatusPill } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { tenantRequestScope } from '../tenant-request-scope'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { PlacementPartInfo } from './PlacementPartInfo'
import { Resource } from '../inventory/InventoryResource'
import { LocationSelect } from '../inventory/LocationSelect'
import { PlacementFieldsSkeleton } from '../inventory/PlacementSkeleton'
import { placementMessages } from '../inventory/placement-messages'
import { useLoad } from '../inventory/use-stock-resource'
import { unassignedMessages } from './unassigned-messages'
import { placementJobMessages } from './placement-job-messages'
import { placementRunning, usePlacementPolling } from './placement-job-polling'

export interface BulkPlacementJobSheetProps {
  warehouseId: string
  sourceZoneId: string
  parts: readonly (Pick<PartSearchItem, 'id' | 'name'> &
    Partial<PartSearchItem>)[]
  initialJob?: PartPlacementJob
  onClose: () => void
  onApplied: (
    ids: ReadonlySet<string>,
    placedIds: ReadonlySet<string>,
    jobId?: string,
  ) => void
  onJobStarted?: (job: PartPlacementJob) => void
  onCompleted?: (job: PartPlacementJob) => void
}

/** A bulk write is one idempotent server job. Polling never writes placements. */
export function BulkPlacementJobSheet({
  warehouseId,
  sourceZoneId,
  parts,
  initialJob,
  onClose,
  onApplied,
  onJobStarted,
  onCompleted,
}: BulkPlacementJobSheetProps) {
  const t = useT(unassignedMessages),
    tj = useT(placementJobMessages),
    tp = useT(placementMessages),
    tc = useT(commonMessages)
  const { snapshot: cabinet } = useCabinet()
  const scopeKey = `${cabinet?.tenantId}:${cabinet?.userId}:${cabinet?.generation}`
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.warehouses,
  )
  const [job, setJob] = useState<PartPlacementJob | null>(initialJob ?? null)
  const [history, setHistory] = useState<BatchPlacePartResult[]>([])
  const [zoneId, setZoneId] = useState<string | null>(
    initialJob?.placement.zoneId ?? null,
  )
  const [sectionId, setSectionId] = useState<string | null>(
    initialJob?.placement.sectionId ?? null,
  )
  const [shelfId, setShelfId] = useState<string | null>(
    initialJob?.placement.shelfId ?? null,
  )
  const [accessError, setAccessError] = useState(false)
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const flight = useRef<AbortController | null>(null)
  const launch = useRef<{
    placement: BatchPlacePartsRequest
    operationId: string
  } | null>(null)
  useEffect(() => () => flight.current?.abort(), [])
  const jobId = job?.id
  const loadJob = useCallback(
    async (signal: AbortSignal) => {
      if (!jobId) return null
      try {
        return await inventoryApi.getPlacementJob(jobId, {
          signal: AbortSignal.any([signal, tenantRequestScope.signal]),
        })
      } catch (cause) {
        if (
          !signal.aborted &&
          ['forbidden', 'session-expired', 'not-found'].includes(
            normalizeApiProblem(cause).kind,
          )
        )
          setAccessError(true)
        throw cause
      }
    },
    [jobId],
  )
  const resource = useLoad(loadJob, `${scopeKey}:${jobId ?? ''}`, undefined, {
    retainOnReload: true,
  })
  const current = accessError
    ? null
    : resource.state.kind === 'ready'
      ? (resource.state.data ?? job)
      : job
  const running = placementRunning(current)
  const readError =
    resource.state.kind === 'error' ||
    (resource.state.kind === 'ready' && resource.state.refreshError)
  usePlacementPolling(
    running && !readError,
    resource.state.kind === 'loading' ||
      (resource.state.kind === 'ready' && resource.state.refreshing),
    resource.refresh,
    resource.state.kind === 'ready' ? resource.state.updatedAt : null,
  )
  const outcomes = useMemo(
    () => [
      ...new Map(
        [...history, ...(current?.results ?? [])].map((item) => [
          item.partId,
          item,
        ]),
      ).values(),
    ],
    [history, current],
  )
  const allParts = useMemo<
    (Pick<PartSearchItem, 'id' | 'name'> & Partial<PartSearchItem>)[]
  >(
    () =>
      parts.length
        ? [...new Map(parts.map((part) => [part.id, part])).values()]
        : (initialJob?.placement.partIds ?? []).map((id) => ({
            id,
            name: initialJob?.partNames[id] ?? id,
          })),
    [parts, initialJob],
  )
  const settledIds = new Set(
    outcomes
      .filter((item) => item.status === 'placed' || item.status === 'skipped')
      .map((item) => item.partId),
  )
  const remaining = allParts
    .filter((part) => !settledIds.has(part.id))
    .map((part) => part.id)
  const placed = outcomes.filter((item) => item.status === 'placed').length
  const callbacks = useRef({ onApplied, onJobStarted, onCompleted })
  useEffect(() => {
    callbacks.current = { onApplied, onJobStarted, onCompleted }
  }, [onApplied, onJobStarted, onCompleted])
  const applied = useRef(new Set<string>())
  useEffect(() => {
    if (
      !current ||
      placementRunning(current) ||
      applied.current.has(current.id)
    )
      return
    applied.current.add(current.id)
    const settled = new Set(
      current.results
        .filter((item) => item.status === 'placed' || item.status === 'skipped')
        .map((item) => item.partId),
    )
    const placedIds = new Set(
      current.results
        .filter((item) => item.status === 'placed')
        .map((item) => item.partId),
    )
    if (settled.size)
      callbacks.current.onApplied(settled, placedIds, current.id)
    callbacks.current.onCompleted?.(current)
  }, [current])

  const warehouseLoader = useCallback(
    (signal: AbortSignal) => inventoryApi.getWarehouse(warehouseId, { signal }),
    [warehouseId],
  )
  const warehouse = useLoad(warehouseLoader, `${scopeKey}:${warehouseId}`)
  const sectionLoader = useCallback(
    (signal: AbortSignal) =>
      zoneId
        ? inventoryApi.getSections(zoneId, { signal })
        : Promise.resolve([]),
    [zoneId],
  )
  const sections = useLoad(sectionLoader, `${scopeKey}:${zoneId ?? ''}`)
  const shelfLoader = useCallback(
    (signal: AbortSignal) =>
      sectionId
        ? inventoryApi.getShelves(undefined, { signal }, sectionId)
        : Promise.resolve([]),
    [sectionId],
  )
  const shelves = useLoad(shelfLoader, `${scopeKey}:${sectionId ?? ''}`)
  const house = warehouse.state.kind === 'ready' ? warehouse.state.data : null
  const zones = house?.isActive
    ? house.zones.filter((zone) => zone.isActive && !zone.isSystemUnassigned)
    : []
  const target = zones.find((zone) => zone.id === zoneId)
  const sectionOptions =
    sections.state.kind === 'ready'
      ? sections.state.data.filter(
          (item) => item.isActive && item.zoneId === zoneId,
        )
      : []
  const section = sectionOptions.find((item) => item.id === sectionId)
  const shelfOptions =
    shelves.state.kind === 'ready'
      ? shelves.state.data.filter(
          (item) =>
            item.isActive &&
            item.zoneId === zoneId &&
            item.sectionId === sectionId,
        )
      : []
  const ready = Boolean(
    target &&
    sections.state.kind === 'ready' &&
    (!sectionId ||
      (section &&
        shelves.state.kind === 'ready' &&
        (!shelfId || shelfOptions.some((item) => item.id === shelfId)))),
  )
  const attempted = Boolean(current) || submitted
  const place = async () => {
    if (
      flight.current ||
      running ||
      !ready ||
      !zoneId ||
      !remaining.length ||
      allParts.length > 1000 ||
      (current && readError)
    )
      return
    const controller = new AbortController()
    flight.current = controller
    setPending(true)
    setError(null)
    setSubmitted(true)
    try {
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      launch.current ??= {
        operationId: crypto.randomUUID(),
        placement: {
          partIds: remaining,
          sourceZoneId,
          zoneId,
          ...(sectionId ? { sectionId } : {}),
          ...(shelfId ? { shelfId } : {}),
        },
      }
      const accepted = await inventoryApi.startPlacementJob(
        launch.current.placement,
        launch.current.operationId,
        { signal: AbortSignal.any([controller.signal, scope.signal]) },
      )
      if (controller.signal.aborted || scope.signal.aborted) return
      setHistory(outcomes)
      setJob(accepted)
      launch.current = null
      callbacks.current.onJobStarted?.(accepted)
    } catch (cause) {
      if (controller.signal.aborted || tenantRequestScope.signal.aborted) return
      const problem = normalizeApiProblem(cause)
      if (
        ['validation', 'forbidden', 'session-expired'].includes(problem.kind)
      ) {
        launch.current = null
        if (problem.kind === 'forbidden' || problem.kind === 'session-expired')
          setAccessError(true)
        setSubmitted(false)
        setError(problem.message)
      } else setError(tj('launchUnknown'))
    } finally {
      if (!controller.signal.aborted) {
        flight.current = null
        setPending(false)
      }
    }
  }
  const locked = pending || attempted
  const jobStatus =
    current?.status === 'queued'
      ? 'queued'
      : current?.status === 'running'
        ? 'running'
        : current?.status === 'failed'
          ? 'failed'
          : 'completed'
  const reason = (item: BatchPlacePartResult) =>
    item.reason === 'noStock'
      ? tj('noStock')
      : item.reason === 'moved'
        ? tj('moved')
        : item.reason === 'conflictingLocation'
          ? tj('conflictingLocation')
          : item.reason === 'locked'
            ? tj('locked')
            : item.reason === 'notFound'
              ? tj('notFound')
              : item.status === 'failed'
                ? tj('genericFailure')
                : null
  if (accessError)
    return (
      <Sheet
        open
        title={t('bulkTitle')}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        footer={<Button onClick={onClose}>{tc('close')}</Button>}
      >
        <Notice tone="danger">{tj('unavailable')}</Notice>
      </Sheet>
    )
  return (
    <Sheet
      open
      title={t('bulkTitle')}
      eyebrow={house?.name}
      onOpenChange={(open) => {
        if (!open && !flight.current) onClose()
      }}
      footer={
        <>
          <Button disabled={pending} onClick={onClose}>
            {running ? tj('minimize') : attempted ? t('done') : tc('cancel')}
          </Button>
          {!running && remaining.length > 0 ? (
            <Button
              variant="primary"
              disabled={
                pending ||
                !ready ||
                allParts.length > 1000 ||
                Boolean(current && readError)
              }
              aria-busy={pending}
              onClick={() => void place()}
            >
              {current ? t('retryRemaining') : t('place')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h3 className="rz-h-card">
            {t('selectedCount', { count: allParts.length })}
          </h3>
          <p className="rz-caption">{t('bulkHint')}</p>
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {allParts.length > 1000 ? (
          <Notice tone="warn">{tj('limit')}</Notice>
        ) : null}
        {current ? (
          <section
            aria-label={tj(jobStatus)}
            className="rz-inset grid gap-2"
            role="status"
          >
            <strong>{tj(jobStatus)}</strong>
            <span className="rz-caption">
              {tj('progress', {
                count: current.processed,
                total: current.total,
              })}
            </span>
            <progress
              className="h-1.5 w-full accent-[var(--rz-brand)]"
              value={current.processed}
              max={Math.max(1, current.total)}
              aria-label={tj('progress', {
                count: current.processed,
                total: current.total,
              })}
            />
            <span>
              {t('bulkResult', { count: placed, total: allParts.length })}
            </span>
            {running ? <p className="rz-caption">{tj('background')}</p> : null}
          </section>
        ) : null}
        {current?.status === 'failed' ? (
          <Notice tone="warn">{tj('jobFailed')}</Notice>
        ) : null}
        {readError && current ? (
          <Notice
            role="alert"
            tone="warn"
            action={<Button onClick={resource.reload}>{tc('retry')}</Button>}
          >
            {tj('refreshFailed')}
          </Notice>
        ) : null}
        <Resource
          framed={false}
          state={warehouse.state}
          retry={warehouse.reload}
          loadingContent={
            <PlacementFieldsSkeleton fields={['zone', 'section', 'shelf']} />
          }
        >
          {() =>
            zones.length ? (
              <div className="grid gap-3">
                <LocationSelect
                  label={t('zone')}
                  searchLabel={t('searchZone')}
                  noneLabel={t('chooseZone')}
                  options={zones}
                  value={zoneId}
                  disabled={locked}
                  onChange={(id) => {
                    setZoneId(id)
                    setSectionId(null)
                    setShelfId(null)
                  }}
                />
                {target ? (
                  <Resource
                    framed={false}
                    state={sections.state}
                    retry={sections.reload}
                    loadingContent={
                      <PlacementFieldsSkeleton fields={['section']} />
                    }
                  >
                    {() => (
                      <>
                        <LocationSelect
                          label={tp('section')}
                          searchLabel={tp('sectionSearch')}
                          noneLabel={tp('noSection')}
                          options={sectionOptions}
                          value={sectionId}
                          disabled={locked}
                          onChange={(id) => {
                            setSectionId(id)
                            setShelfId(null)
                          }}
                        />
                        {section ? (
                          <Resource
                            framed={false}
                            state={shelves.state}
                            retry={shelves.reload}
                            loadingContent={
                              <PlacementFieldsSkeleton fields={['shelf']} />
                            }
                          >
                            {() => (
                              <LocationSelect
                                label={tp('shelf')}
                                searchLabel={tp('shelfSearch')}
                                noneLabel={tp('noShelf')}
                                options={shelfOptions}
                                value={shelfId}
                                disabled={locked}
                                onChange={setShelfId}
                              />
                            )}
                          </Resource>
                        ) : null}
                      </>
                    )}
                  </Resource>
                ) : null}
              </div>
            ) : (
              <Notice tone="info">
                {t(house?.isActive ? 'noActiveZones' : 'archived')}
              </Notice>
            )
          }
        </Resource>
        <ul
          tabIndex={0}
          aria-label={t('selectedParts')}
          className="border-app-line divide-app-line m-0 max-h-96 list-none divide-y overflow-y-auto rounded-panel border p-0"
        >
          {allParts.map((part) => {
            const item = outcomes.find((result) => result.partId === part.id)
            const message = item ? reason(item) : null
            return (
              <li
                key={part.id}
                className="flex min-h-11 items-start justify-between gap-3 px-3 py-2"
              >
                <span className="grid min-w-0 gap-1">
                  {!item &&
                  typeof part.quantity === 'number' &&
                  part.unit &&
                  part.status ? (
                    <PlacementPartInfo
                      name={part.name}
                      oemCode={part.oemCode ?? null}
                      code={part.externalCode ?? null}
                      quantity={part.quantity}
                      unit={part.unit}
                      status={part.status}
                      car={
                        part.car
                          ? [part.car.make, part.car.model, part.car.year]
                              .filter(Boolean)
                              .join(' · ')
                          : null
                      }
                    />
                  ) : (
                    <span className="font-semibold break-words">
                      {part.name}
                    </span>
                  )}
                  {message ? (
                    <span
                      className={
                        item?.status === 'failed'
                          ? 'text-state-danger text-caption'
                          : 'rz-caption'
                      }
                    >
                      {message}
                    </span>
                  ) : null}
                </span>
                {item ? (
                  <StatusPill
                    className="text-app-strong"
                    tone={
                      item.status === 'placed'
                        ? 'ok'
                        : item.status === 'failed'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {tj(
                      item.status === 'placed'
                        ? 'placed'
                        : item.status === 'failed'
                          ? 'itemFailed'
                          : 'skipped',
                    )}
                  </StatusPill>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </Sheet>
  )
}
