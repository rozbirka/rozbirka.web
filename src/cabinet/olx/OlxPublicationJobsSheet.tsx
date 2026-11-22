import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { normalizeApiProblem } from '@/api/errors'
import { olxLiveApi, type OlxPublicationJob } from '@/api/olx-live'
import {
  Button,
  ConfirmDialog,
  DateValue,
  ErrorState,
  Notice,
  Sheet,
  SkeletonRows,
  StatusPill,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { tenantRequestScope } from '../tenant-request-scope'
import { OlxBatchResults, type OlxBatchResult } from './OlxBatchSheet'
import { olxBatchMessages } from './olx-batch-messages'
import { olxIssueKeys, olxLiveMessages } from './olx-live-messages'
import {
  olxPublicationMessages,
  readOlxProviderIssue,
} from './olx-publication-messages'

function processedCount(job: OlxPublicationJob) {
  return job.results.filter(({ status }) => status !== 'skipped').length
}

export function OlxPublicationJobsSheet({
  initial,
  review,
  partsHref,
  onClose,
  onChanged,
  returnFocus,
}: {
  initial: OlxPublicationJob | null
  review: readonly OlxBatchResult[]
  partsHref: string
  onClose: () => void
  onChanged: () => void
  returnFocus: () => void
}) {
  const t = useT(olxBatchMessages)
  const tl = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const tc = useT(commonMessages)
  const [id, setId] = useState(initial?.id ?? null)
  const [jobs, setJobs] = useState<OlxPublicationJob[] | null>(null)
  const [selected, setSelected] = useState(initial)
  const [attempt, setAttempt] = useState(0)
  const [retrySelection, setRetrySelection] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [confirmRetry, setConfirmRetry] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const retryRequest = useRef<{ key: string; operationId: string } | null>(null)
  const [settled, setSettled] = useState<{
    id: string | null
    attempt: number
    failed: boolean
  } | null>(null)
  const job = selected?.id === id ? selected : null
  const response =
    settled?.id === id && settled.attempt === attempt ? settled : null
  const pending = response === null

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    void (async () => {
      try {
        if (id) {
          const value = await olxLiveApi.publicationJob(id, { signal })
          if (!signal.aborted) setSelected(value)
        } else {
          const value = await olxLiveApi.publicationJobs({ signal })
          if (!signal.aborted) setJobs(value)
        }
        if (!signal.aborted) setSettled({ id, attempt, failed: false })
      } catch {
        if (!signal.aborted) setSettled({ id, attempt, failed: true })
      }
    })()
    return () => controller.abort()
  }, [id, attempt])

  function refresh() {
    setAttempt((value) => value + 1)
    onChanged()
  }

  const retryable = new Set(
    job?.status === 'completed' || job?.status === 'stopped'
      ? job.results
          .filter(
            ({ status }) =>
              status === 'failed' ||
              status === 'skipped' ||
              status === 'pending',
          )
          .map(({ partId }) => partId)
      : [],
  )
  const selectedForRetry = [...retryable].filter((partId) =>
    retrySelection.has(partId),
  )

  function openJob(next: string | null) {
    setRetrySelection(new Set())
    setConfirmRetry(false)
    setRetryError(null)
    retryRequest.current = null
    setId(next)
  }

  function toggleRetry(partId: string) {
    setRetrySelection((current) => {
      const next = new Set(current)
      if (next.has(partId)) next.delete(partId)
      else next.add(partId)
      return next
    })
  }

  async function enqueueRetry() {
    if (!id || retrying || selectedForRetry.length === 0) return
    const key = JSON.stringify([id, selectedForRetry])
    if (retryRequest.current?.key !== key)
      retryRequest.current = { key, operationId: crypto.randomUUID() }
    const signal = tenantRequestScope.signal
    setRetrying(true)
    setRetryError(null)
    try {
      const next = await olxLiveApi.retryPublicationJob(
        id,
        {
          operationId: retryRequest.current.operationId,
          partIds: selectedForRetry,
        },
        { signal },
      )
      if (signal.aborted) return
      setSelected(next)
      openJob(next.id)
      onChanged()
    } catch (failure) {
      if (signal.aborted) return
      const code = normalizeApiProblem(failure).code
      setRetryError(
        code === 'OLX_BATCH_IN_PROGRESS'
          ? t('jobAlreadyRunning')
          : code === 'OLX_BATCH_RETRY_INVALID'
            ? t('retryUnavailable')
            : code === 'OLX_CONNECTION_CHANGED' ||
                code === 'OLX_NOT_CONNECTED' ||
                code === 'OLX_RECONNECT_REQUIRED'
              ? t('connectionChanged')
              : code === 'FORBIDDEN' || code === 'OLX_WRITE_SCOPE_REQUIRED'
                ? t('permissionChanged')
                : t('jobStartFailed'),
      )
    } finally {
      if (!signal.aborted) setRetrying(false)
    }
  }

  function statusLabel(status: string) {
    return t(
      status === 'queued'
        ? 'jobQueued'
        : status === 'running'
          ? 'processing'
          : status === 'stopped'
            ? 'jobStopped'
            : 'jobCompleted',
    )
  }

  function issues(
    error: string | undefined | null,
    fields: readonly string[] = [],
  ) {
    const labels = fields.map((field) => {
      const local = olxIssueKeys.find((code) => code === field)
      return local
        ? tl(local)
        : tp(readOlxProviderIssue(field).reason ?? 'provider_invalid')
    })
    if (labels.length) return [...new Set(labels)]
    if (!error) return []
    switch (error) {
      case 'OLX_RATE_LIMITED':
        return [t('rateLimit')]
      case 'OLX_NOT_CONNECTED':
      case 'OLX_CONNECTION_CHANGED':
      case 'OLX_RECONNECT_REQUIRED':
        return [t('connectionChanged')]
      case 'FORBIDDEN':
      case 'OLX_DISABLED':
      case 'OLX_WRITE_DISABLED':
      case 'OLX_WRITE_SCOPE_REQUIRED':
        return [t('permissionChanged')]
      case 'OLX_DRAFT_CHANGED':
      case 'OLX_PART_CHANGED':
        return [tp('changed')]
      case 'OLX_WRITE_REJECTED':
        return [tp('providerRejected')]
      case 'OLX_MULTIPLE_MATCHES':
        return [t('retryMultipleMatches')]
      case 'OLX_RESULT_UNKNOWN':
      case 'OLX_UNAVAILABLE':
        return [tp('unknownHint')]
      default:
        return [t('failedAction')]
    }
  }

  const results = new Map(job?.results.map((result) => [result.partId, result]))
  const rows: OlxBatchResult[] = (job?.parts ?? []).map(({ partId }) => {
    const result = results.get(partId)
    const status = result?.status
    return {
      id: partId,
      name: job?.partNames[partId],
      advertId: result?.advertId ?? null,
      status:
        status === 'submitted' ||
        status === 'failed' ||
        status === 'linked' ||
        status === 'pending' ||
        status === 'skipped'
          ? status
          : 'queued',
      issues: issues(result?.error, result?.errorFields ?? []),
    }
  })

  return (
    <Sheet
      open
      title={id ? t('result') : t('jobsTitle')}
      className="sm:w-[min(520px,100vw)]"
      onOpenChange={(open) => {
        if (!open && !retrying) onClose()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        returnFocus()
      }}
      footer={
        <>
          {id && (
            <Button
              variant="quiet"
              onClick={() => {
                openJob(null)
                setAttempt((value) => value + 1)
              }}
            >
              <ArrowLeft aria-hidden /> {tc('back')}
            </Button>
          )}
          <Button onClick={refresh} disabled={pending}>
            <RefreshCw aria-hidden /> {t('jobRefresh')}
          </Button>
          <Button
            onClick={onClose}
            variant={retryable.size ? 'ghost' : 'primary'}
          >
            {t('done')}
          </Button>
          {retryable.size > 0 && (
            <Button
              variant="primary"
              disabled={
                selectedForRetry.length === 0 || pending || response?.failed
              }
              onClick={() => {
                setRetryError(null)
                setConfirmRetry(true)
              }}
            >
              {t('retryAction')}
              {selectedForRetry.length > 0 && ` · ${selectedForRetry.length}`}
            </Button>
          )}
        </>
      }
    >
      <div className="grid min-w-0 gap-3" aria-busy={pending}>
        {response?.failed && (
          <ErrorState title={t('jobLoadFailed')} onRetry={refresh} />
        )}
        {job ? (
          <>
            <div
              className="flex flex-wrap items-center justify-between gap-2"
              role="status"
            >
              <StatusPill
                tone={
                  job.status === 'completed'
                    ? 'ok'
                    : job.status === 'stopped'
                      ? 'warn'
                      : 'info'
                }
              >
                {statusLabel(job.status)}
              </StatusPill>
              <span className="rz-caption">
                {t('progress', {
                  done: processedCount(job),
                  total: job.parts.length,
                })}
              </span>
              <DateValue value={job.updatedAt} />
            </div>
            {(job.status === 'queued' || job.status === 'running') && (
              <Notice>{t('jobContinues')}</Notice>
            )}
            {job.error && (
              <Notice tone="warn">{issues(job.error).join(' ')}</Notice>
            )}
            <OlxBatchResults
              rows={job.id === initial?.id ? [...rows, ...review] : rows}
              partsHref={partsHref}
              busy={false}
              onNavigate={onClose}
              selection={{
                eligible: retryable,
                checked: retrySelection,
                disabled: pending || retrying || response?.failed === true,
                onToggle: toggleRetry,
              }}
            />
          </>
        ) : id === null && jobs ? (
          jobs.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {jobs.map((item) => (
                <li key={item.id}>
                  <Button
                    className="w-full justify-between"
                    onClick={() => openJob(item.id)}
                  >
                    <DateValue value={item.createdAt} />
                    <span className="grid text-left">
                      <span>{statusLabel(item.status)}</span>
                      {item.retryOfJobId && (
                        <span className="rz-caption">{t('retryJob')}</span>
                      )}
                    </span>
                    <span>
                      {processedCount(item)}/{item.parts.length}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Notice>{t('jobEmpty')}</Notice>
          )
        ) : pending ? (
          <SkeletonRows label={tl('loading')} rows={3} />
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmRetry}
        onOpenChange={setConfirmRetry}
        title={t('retryTitle')}
        consequence={t('retryConsequence', { count: selectedForRetry.length })}
        confirmLabel={t('retryAction')}
        destructive={false}
        pending={retrying}
        error={retryError}
        onConfirm={() => void enqueueRetry()}
      />
    </Sheet>
  )
}
