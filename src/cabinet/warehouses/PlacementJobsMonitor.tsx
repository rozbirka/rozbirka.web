import { useCallback, useEffect, useMemo, useRef } from 'react'
import { inventoryApi, type PartPlacementJob } from '@/api/inventory'
import { Button, Notice } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { tenantRequestScope } from '../tenant-request-scope'
import { useLoad } from '../inventory/use-stock-resource'
import { placementJobMessages } from './placement-job-messages'
import { placementRunning, usePlacementPolling } from './placement-job-polling'

export function PlacementJobsMonitor({
  sourceZoneId,
  paused,
  revision,
  onRunning,
  onCompleted,
  onApplied,
}: {
  sourceZoneId: string
  paused: boolean
  revision: number
  onRunning: (job: PartPlacementJob) => void
  onCompleted: (job: PartPlacementJob) => void
  onApplied: (
    ids: ReadonlySet<string>,
    placedIds: ReadonlySet<string>,
    jobId?: string,
  ) => void
}) {
  const t = useT(placementJobMessages),
    tc = useT(commonMessages)
  const { snapshot } = useCabinet()
  const scope = `${snapshot?.tenantId}:${snapshot?.userId}:${snapshot?.generation}:${sourceZoneId}`
  const loader = useCallback(
    (signal: AbortSignal) =>
      inventoryApi.getPlacementJobs(sourceZoneId, {
        signal: AbortSignal.any([signal, tenantRequestScope.signal]),
      }),
    [sourceZoneId],
  )
  const resource = useLoad(loader, `${scope}:${revision}`, undefined, {
    retainOnReload: true,
  })
  const jobs = useMemo(
    () => (resource.state.kind === 'ready' ? resource.state.data : []),
    [resource.state],
  )
  const refreshFailed =
    resource.state.kind === 'error' ||
    (resource.state.kind === 'ready' && resource.state.refreshError)
  usePlacementPolling(
    !paused && !refreshFailed && jobs.some(placementRunning),
    resource.state.kind === 'loading' ||
      (resource.state.kind === 'ready' && resource.state.refreshing),
    resource.refresh,
    resource.state.kind === 'ready' ? resource.state.updatedAt : null,
  )
  const applied = useRef(new Set<string>())
  const callbacks = useRef({ onApplied, onRunning, onCompleted })
  useEffect(() => {
    callbacks.current = { onApplied, onRunning, onCompleted }
  }, [onApplied, onRunning, onCompleted])
  useEffect(() => {
    if (paused) return
    jobs
      .filter(placementRunning)
      .forEach((job) => callbacks.current.onRunning(job))
    const completed = jobs.filter(
      (job) => !placementRunning(job) && !applied.current.has(job.id),
    )
    if (!completed.length) return
    for (const job of completed) {
      applied.current.add(job.id)
      const settled = new Set(
        job.results
          .filter(
            (item) => item.status === 'placed' || item.status === 'skipped',
          )
          .map((item) => item.partId),
      )
      const placed = new Set(
        job.results
          .filter((item) => item.status === 'placed')
          .map((item) => item.partId),
      )
      if (settled.size) callbacks.current.onApplied(settled, placed, job.id)
      callbacks.current.onCompleted(job)
    }
  }, [jobs, paused])
  if (refreshFailed)
    return (
      <Notice
        tone="warn"
        action={<Button onClick={resource.reload}>{tc('retry')}</Button>}
      >
        {t('listFailed')}
      </Notice>
    )
  return null
}
