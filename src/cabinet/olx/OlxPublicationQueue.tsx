import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Pencil, RefreshCw } from 'lucide-react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { normalizeApiProblem } from '@/api/errors'
import {
  olxLiveApi,
  type OlxPublicationJob,
  type RetryOlxPublicationJob,
} from '@/api/olx-live'
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  DataTable,
  DateValue,
  ErrorState,
  Notice,
  Pagination,
  SearchInput,
  SectionPanel,
  Segmented,
  SkeletonRows,
  StatusPill,
  useOptionalToast,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { tenantRequestScope } from '../tenant-request-scope'
import { OlxBatchResults, type OlxBatchResult } from './OlxBatchSheet'
import { OlxQueueRepairSheet } from './OlxQueueRepairSheet'
import { olxBatchMessages } from './olx-batch-messages'
import { olxIssueKeys, olxLiveMessages } from './olx-live-messages'
import {
  olxPublicationMessages,
  readOlxProviderIssue,
  olxProviderFieldLabel,
} from './olx-publication-messages'

function processedCount(job: OlxPublicationJob) {
  return job.results.filter(({ status }) => status !== 'skipped').length
}

export interface OlxQueueNavigationState {
  owner: string
  jobId: string
  review: OlxBatchResult[]
}

const pageSize = 10
const filters = [
  'all',
  'queued',
  'accepted',
  'failed',
  'pending',
  'skipped',
] as const
type QueueFilter = (typeof filters)[number]
type QueueStatus =
  | Exclude<QueueFilter, 'all' | 'accepted'>
  | 'sending'
  | 'payment'
  | 'submitted'
  | 'linked'
type QueueRow = Omit<OlxBatchResult, 'status'> & {
  position: number
  status: QueueStatus
  revision: string
  error: string | null
  errorFields: string[] | null
  observedStatus: string | null
  oem: string | null
}

function rowFilter(status: QueueStatus): QueueFilter {
  if (status === 'sending') return 'queued'
  if (
    status === 'queued' ||
    status === 'failed' ||
    status === 'pending' ||
    status === 'skipped'
  )
    return status
  return 'accepted'
}

export function OlxPublicationQueue({
  owner,
  queueHref,
  partsHref,
  listingHref,
  activeAccountId,
  canSeeDiagnostics = false,
}: {
  owner: string
  queueHref: string
  partsHref: string
  listingHref?: string | undefined
  activeAccountId?: string | null | undefined
  canSeeDiagnostics?: boolean
}) {
  const [params] = useSearchParams()
  const jobId = params.get('job')
  const id = jobId === '' ? null : jobId
  const showHistory = params.has('history')
  const fromBatch = useLocation().state as OlxQueueNavigationState | null
  const review =
    fromBatch?.jobId === id && fromBatch.owner === owner ? fromBatch.review : []
  return (
    <QueueView
      key={id ? `job:${id}` : String(showHistory)}
      id={id}
      showHistory={showHistory}
      review={review}
      queueHref={queueHref}
      partsHref={partsHref}
      listingHref={listingHref}
      activeAccountId={activeAccountId}
      canSeeDiagnostics={canSeeDiagnostics}
    />
  )
}

function QueueView({
  id,
  showHistory,
  review,
  queueHref,
  partsHref,
  listingHref,
  activeAccountId,
  canSeeDiagnostics,
}: {
  id: string | null
  showHistory: boolean
  review: OlxBatchResult[]
  queueHref: string
  partsHref: string
  listingHref?: string | undefined
  activeAccountId?: string | null | undefined
  canSeeDiagnostics: boolean
}) {
  const t = useT(olxBatchMessages)
  const tl = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const tc = useT(commonMessages)
  const navigate = useNavigate()
  const toast = useOptionalToast()
  const [repair, setRepair] = useState<{
    row: QueueRow
    trigger: HTMLButtonElement | null
  } | null>(null)
  const rowMenuTriggers = useRef(new Map<string, HTMLButtonElement>())
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const retryLifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    retryLifetime.current = controller
    return () => controller.abort()
  }, [])
  const jobHref = (jobId: string) =>
    `${queueHref}?job=${encodeURIComponent(jobId)}`
  const [attempt, setAttempt] = useState(0)
  const [retrySelection, setRetrySelection] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [confirmRetry, setConfirmRetry] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const retryRequest = useRef<{ key: string; operationId: string } | null>(null)
  const [read, setRead] = useState<{
    attempt: number
    data?: OlxPublicationJob | OlxPublicationJob[]
    checkedAt?: string
    failed?: boolean
  }>({ attempt: -1 })
  const jobs = Array.isArray(read.data) ? read.data : null
  const job = Array.isArray(read.data) ? null : read.data
  const pending = read.attempt !== attempt
  const failed = !pending && read.failed

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    void (async () => {
      try {
        const data = id
          ? await olxLiveApi.publicationJob(id, { signal })
          : await olxLiveApi.publicationJobs({ signal })
        if (!signal.aborted)
          setRead({ attempt, data, checkedAt: new Date().toISOString() })
      } catch {
        if (!signal.aborted)
          setRead((previous) => ({ ...previous, attempt, failed: true }))
      }
    })()
    return () => controller.abort()
  }, [id, attempt])

  function refresh() {
    setAttempt((value) => value + 1)
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

  async function submitRetry(
    jobId: string,
    partIds: string[],
    signal: AbortSignal,
    expectedRevisions?: NonNullable<
      RetryOlxPublicationJob['expectedRevisions']
    >,
  ) {
    const key = JSON.stringify([jobId, partIds, expectedRevisions])
    if (retryRequest.current?.key !== key)
      retryRequest.current = { key, operationId: crypto.randomUUID() }
    const next = await olxLiveApi.retryPublicationJob(
      jobId,
      {
        operationId: retryRequest.current.operationId,
        partIds,
        ...(expectedRevisions ? { expectedRevisions } : {}),
      },
      { signal },
    )
    if (signal.aborted) return
    if (expectedRevisions)
      toast?.show({ tone: 'ok', message: t('queueRepairQueued') })
    void navigate(jobHref(next.id))
  }

  function retryFailure(failure: unknown) {
    switch (normalizeApiProblem(failure).code) {
      case 'OLX_BATCH_IN_PROGRESS':
        return t('jobAlreadyRunning')
      case 'OLX_BATCH_RETRY_INVALID':
        return t('retryUnavailable')
      case 'OLX_CONNECTION_CHANGED':
      case 'OLX_NOT_CONNECTED':
      case 'OLX_RECONNECT_REQUIRED':
        return t('connectionChanged')
      case 'FORBIDDEN':
      case 'OLX_WRITE_SCOPE_REQUIRED':
        return t('permissionChanged')
      case 'OLX_DRAFT_CHANGED':
        return t('queueRepairChanged')
      default:
        return t('jobStartFailed')
    }
  }

  async function enqueueRetry() {
    const lifetime = retryLifetime.current
    if (!id || retrying || !lifetime || selectedForRetry.length === 0) return
    const signal = AbortSignal.any([lifetime.signal, tenantRequestScope.signal])
    setRetrying(true)
    setRetryError(null)
    try {
      await submitRetry(id, selectedForRetry, signal)
    } catch (failure) {
      if (!signal.aborted) setRetryError(retryFailure(failure))
    } finally {
      if (!signal.aborted) setRetrying(false)
    }
  }

  function statusPill({ status, results }: OlxPublicationJob) {
    if (status === 'completed') {
      const needsAttention = results.some(
        ({ status }) => status === 'failed' || status === 'pending',
      )
      return (
        <StatusPill tone={needsAttention ? 'warn' : 'ok'}>
          {t(needsAttention ? 'jobCompletedWithIssues' : 'jobCompleted')}
        </StatusPill>
      )
    }
    if (status === 'stopped')
      return <StatusPill tone="warn">{t('jobStopped')}</StatusPill>
    return (
      <StatusPill tone="info">
        {t(status === 'queued' ? 'jobQueued' : 'processing')}
      </StatusPill>
    )
  }

  function issues(
    error: string | undefined | null,
    fields: readonly string[] = [],
  ) {
    const labels = (canSeeDiagnostics ? fields : []).map((issue) => {
      const local = olxIssueKeys.find((code) => code === issue)
      if (local) return tl(local)
      const { field, reason } = readOlxProviderIssue(issue)
      const label = olxProviderFieldLabel(field)
      const explanation = tp(reason ?? 'provider_invalid')
      return label ? `${tp(label)} · ${explanation}` : explanation
    })
    if (labels.length) return [...new Set(labels)]
    if (!error) return fields.length > 0 ? [tp('diagnosticsRestricted')] : []
    switch (error) {
      case 'OLX_RATE_LIMITED':
        return [t('rateLimit')]
      case 'OLX_PAYMENT_REQUIRED':
        return [tp('limitedHint')]
      case 'OLX_NOT_CONNECTED':
      case 'OLX_CONNECTION_CHANGED':
      case 'OLX_RECONNECT_REQUIRED':
        return [t('connectionChanged')]
      case 'FORBIDDEN':
      case 'OLX_DISABLED':
      case 'OLX_WRITE_DISABLED':
      case 'OLX_WRITE_SCOPE_REQUIRED':
        return [t('permissionChanged')]
      case 'OLX_PART_EXCLUDED':
        return [tp('partExcluded')]
      case 'OLX_DRAFT_CHANGED':
      case 'OLX_PART_CHANGED':
        return [tp('changed')]
      case 'OLX_WRITE_REJECTED':
        return [
          tp(canSeeDiagnostics ? 'providerRejected' : 'diagnosticsRestricted'),
        ]
      case 'OLX_MULTIPLE_MATCHES':
        return [t('retryMultipleMatches')]
      case 'OLX_RESULT_UNKNOWN':
      case 'OLX_UNAVAILABLE':
        return [tp('unknownHint')]
      default:
        return [
          canSeeDiagnostics ? t('failedAction') : tp('diagnosticsRestricted'),
        ]
    }
  }

  const results = new Map(job?.results.map((result) => [result.partId, result]))
  const rows = (job?.parts ?? []).map(
    ({ partId, revision }, index): QueueRow => {
      const result = results.get(partId)
      const status =
        result?.error === 'OLX_PAYMENT_REQUIRED' && result.advertId
          ? 'payment'
          : result?.status
      return {
        id: partId,
        position: index + 1,
        revision,
        oem: job?.partOems?.[partId] ?? null,
        error: result?.error ?? null,
        errorFields: result?.errorFields ?? null,
        observedStatus: result?.observedStatus ?? null,
        name: job?.partNames[partId],
        advertId: result?.advertId ?? null,
        status:
          status === 'payment' ||
          status === 'submitted' ||
          status === 'failed' ||
          status === 'linked' ||
          status === 'pending' ||
          status === 'skipped'
            ? status
            : job?.inFlightPartId === partId
              ? 'sending'
              : 'queued',
        issues: issues(result?.error, result?.errorFields ?? []),
      }
    },
  )

  const labels = {
    all: t('queueAll'),
    queued: t('jobQueued'),
    accepted: t('queueAccepted'),
    failed: t('queueRejected'),
    pending: t('queueReconcile'),
    skipped: t('skipped'),
  }
  const counts = {
    all: rows.length,
    queued: 0,
    accepted: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
  }
  for (const row of rows) counts[rowFilter(row.status)]++
  const term = query.trim().toLocaleLowerCase()
  const filtered = rows.filter(
    (row) =>
      (filter === 'all' || rowFilter(row.status) === filter) &&
      [row.name, row.oem].some((value) =>
        (value ?? '').toLocaleLowerCase().includes(term),
      ),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const remainder = job?.status === 'stopped' ? 'skipped' : 'pending'
  const done = job ? processedCount(job) : 0
  const progress = job ? t('progress', { done, total: rows.length }) : ''
  const refreshButton = (
    <Button onClick={refresh} disabled={pending}>
      <RefreshCw aria-hidden /> {id ? t('jobRefresh') : tc('refresh')}
    </Button>
  )

  const active = showHistory
    ? undefined
    : jobs?.find(({ status }) => status === 'queued' || status === 'running')
  if (active) return <Navigate replace to={jobHref(active.id)} />

  return (
    <div className="grid min-w-0 gap-4" aria-busy={pending}>
      {id && (
        <div>
          <Button asChild variant="quiet">
            <Link to={`${queueHref}?history=1`}>
              <ArrowLeft aria-hidden /> {t('queueHistory')}
            </Link>
          </Button>
        </div>
      )}
      {failed && <ErrorState title={t('jobLoadFailed')} onRetry={refresh} />}
      {job ? (
        <>
          {job.error && (
            <Notice tone="warn">{issues(job.error).join(' ')}</Notice>
          )}
          <div className="rz-toolbar">
            <SearchInput
              aria-label={t('queueSearch')}
              className="min-w-0"
              placeholder={t('queueSearch')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
            <Segmented
              label={t('queueStatus')}
              name="olx-queue-status"
              as="toggle"
              className="flex-1"
              options={filters.map((value) => ({
                value,
                label: `${labels[value]} · ${counts[value]}`,
              }))}
              value={filter}
              onChange={(value) => {
                setFilter(value)
                setPage(1)
              }}
            />
          </div>
          <SectionPanel
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  {t('queueJobDate')} <DateValue value={job.createdAt} />
                </span>
                {statusPill(job)}
              </span>
            }
            description={
              <>
                {job.requestedByName && (
                  <>{t('queueStartedBy', { name: job.requestedByName })} · </>
                )}
                {t('queueChecked')} <DateValue value={read.checkedAt} />
              </>
            }
            aside={refreshButton}
            className="[&_.rz-kpis]:border-0 [&_.rz-kpis]:rounded-none max-md:[&_.rz-kpi:not(:first-child)]:hidden"
            footer={
              retryable.size > 0 ? (
                <Button
                  variant="primary"
                  disabled={selectedForRetry.length === 0 || pending || failed}
                  onClick={() => {
                    setRetryError(null)
                    setConfirmRetry(true)
                  }}
                >
                  {t('retryAction')}
                  {selectedForRetry.length > 0 &&
                    ` · ${selectedForRetry.length}`}
                </Button>
              ) : undefined
            }
          >
            <KpiStrip>
              <Kpi
                label={t('queueProcessed')}
                value={done}
                unit={t('queueOfTotal', { total: rows.length })}
                meta={
                  <span
                    role="progressbar"
                    aria-label={progress}
                    aria-valuenow={done}
                    aria-valuemin={0}
                    aria-valuemax={rows.length}
                    className="rz-meter rz-meter--brand mt-2"
                  >
                    <span
                      style={{
                        width: `${rows.length ? (done / rows.length) * 100 : 0}%`,
                      }}
                    />
                  </span>
                }
              />
              <Kpi
                label={t('submittedGroup')}
                value={counts.accepted}
                tone="ok"
                meta={null}
              />
              <Kpi
                label={labels.failed}
                value={counts.failed}
                tone="danger"
                meta={null}
              />
              <Kpi
                label={labels[remainder]}
                value={counts[remainder]}
                tone="warn"
                meta={null}
              />
            </KpiStrip>
            {(job.status === 'queued' || job.status === 'running') && (
              <p className="rz-caption m-0">{t('jobContinues')}</p>
            )}
          </SectionPanel>
          <DataTable
            caption={t('result')}
            density="compact"
            rows={filtered.slice(
              (currentPage - 1) * pageSize,
              currentPage * pageSize,
            )}
            rowKey={(row) => row.id}
            empty={<p className="rz-caption m-0 p-4">{t('queueNoMatches')}</p>}
            columns={[
              {
                key: 'number',
                label: '№',
                hideNarrow: true,
                cell: (row) => (
                  <span className="rz-num text-app-muted">{row.position}</span>
                ),
              },
              {
                key: 'part',
                label: t('queuePart'),
                variant: 'primary',
                cell: (row) => (
                  <div className="grid gap-0.5">
                    <span>{row.name ?? row.id}</span>
                    {row.oem && (
                      <span className="rz-caption font-mono">{row.oem}</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'status',
                label: t('queueStatus'),
                cell: (row) => {
                  const status = rowFilter(row.status)
                  const tone =
                    row.status === 'payment' || status === 'pending'
                      ? 'warn'
                      : status === 'accepted'
                        ? 'ok'
                        : status === 'failed'
                          ? 'danger'
                          : row.status === 'sending'
                            ? 'info'
                            : 'neutral'
                  return (
                    <StatusPill tone={tone}>
                      {row.status === 'payment'
                        ? t('paymentGroup')
                        : row.status === 'linked'
                          ? t('linkedGroup')
                          : status === 'accepted'
                            ? t('submittedGroup')
                            : row.status === 'sending'
                              ? t('queueSending')
                              : labels[status]}
                    </StatusPill>
                  )
                },
              },
              {
                key: 'result',
                label: t('queueResult'),
                cell: (row) => (
                  <div className="grid gap-1">
                    {row.advertId && (
                      <span className="font-mono tabular-nums">
                        {t('advert', { id: row.advertId })}
                      </span>
                    )}
                    {row.observedStatus && (
                      <span className="rz-caption">
                        {t('queueProviderStatus', {
                          status: row.observedStatus,
                        })}
                      </span>
                    )}
                    {row.issues?.length ? (
                      <span className="rz-caption">
                        {row.issues.join(' · ')}
                      </span>
                    ) : (
                      !row.advertId &&
                      !row.observedStatus && (
                        <span className="text-app-muted">—</span>
                      )
                    )}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: tc('actions'),
                align: 'end',
                headerHidden: true,
                cell: (row) => (
                  <div className="rz-btn-row justify-end">
                    {retryable.has(row.id) && (
                      <label className="inline-flex size-8 items-center justify-center">
                        <input
                          type="checkbox"
                          className="rz-check"
                          checked={retrySelection.has(row.id)}
                          disabled={pending || retrying || failed}
                          aria-label={t(
                            row.status === 'pending'
                              ? 'retryVerifyPart'
                              : 'retrySelectPart',
                            { name: row.name ?? row.id },
                          )}
                          onChange={(event) => {
                            const next = new Set(retrySelection)
                            if (event.target.checked) next.add(row.id)
                            else next.delete(row.id)
                            setRetrySelection(next)
                          }}
                        />
                      </label>
                    )}
                    {job.accountId &&
                    job.accountId === activeAccountId &&
                    row.status === 'failed' &&
                    retryable.has(row.id) &&
                    (row.error === 'OLX_WRITE_REJECTED' ||
                      row.error === 'OLX_CONTENT_INVALID' ||
                      row.error === 'OLX_DRAFT_CHANGED') ? (
                      <ActionMenu
                        label={`${tc('actions')} · ${row.name ?? row.id}`}
                        triggerRef={(node) => {
                          if (node) rowMenuTriggers.current.set(row.id, node)
                          else rowMenuTriggers.current.delete(row.id)
                        }}
                        actions={[
                          {
                            key: 'repair',
                            label: t('queueRepair'),
                            icon: <Pencil aria-hidden />,
                            disabled: pending || retrying || failed === true,
                            onSelect: () =>
                              setRepair({
                                row,
                                trigger:
                                  rowMenuTriggers.current.get(row.id) ?? null,
                              }),
                          },
                          {
                            key: 'part',
                            label: t('queueRepairOpenPart'),
                            icon: <ArrowUpRight aria-hidden />,
                            onSelect: () =>
                              void navigate(
                                `${partsHref}/${encodeURIComponent(row.id)}`,
                              ),
                          },
                        ]}
                      />
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        variant="quiet"
                        aria-label={`${t('details')} · ${row.name ?? row.id}`}
                      >
                        <Link
                          to={`${partsHref}/${encodeURIComponent(row.id)}/olx`}
                        >
                          <ArrowUpRight aria-hidden />
                        </Link>
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            footer={
              filtered.length > 0 && (
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  total={filtered.length}
                  pageSize={pageSize}
                  onPage={setPage}
                />
              )
            }
          />
          {review.length > 0 && (
            <OlxBatchResults rows={review} partsHref={partsHref} busy={false} />
          )}
        </>
      ) : id === null && jobs ? (
        <SectionPanel title={t('queueHistory')} aside={refreshButton}>
          <DataTable
            caption={t('queueHistory')}
            rows={jobs}
            rowKey={(item) => item.id}
            density="compact"
            empty={<Notice>{t('jobEmpty')}</Notice>}
            columns={[
              {
                key: 'date',
                label: t('queueDate'),
                variant: 'primary',
                cell: (item) => (
                  <span className="rz-cell-main flex-wrap gap-y-1">
                    <Link
                      className="text-app-strong hover:text-brand-text"
                      to={jobHref(item.id)}
                    >
                      <DateValue value={item.createdAt} />
                    </Link>
                    {item.retryOfJobId && (
                      <span className="rz-caption">{t('retryJob')}</span>
                    )}
                  </span>
                ),
              },
              {
                key: 'author',
                label: t('queueAuthor'),
                cell: (item) => item.requestedByName ?? '—',
              },
              {
                key: 'positions',
                label: t('queuePositions'),
                align: 'end',
                cell: (item) => item.parts.length,
              },
              {
                key: 'accepted',
                label: labels.accepted,
                align: 'end',
                cell: (item) =>
                  item.results.filter(
                    ({ status }) =>
                      status === 'submitted' || status === 'linked',
                  ).length,
              },
              {
                key: 'rejected',
                label: labels.failed,
                align: 'end',
                cell: (item) =>
                  item.results.filter(({ status }) => status === 'failed')
                    .length,
              },
              {
                key: 'progress',
                label: t('queueProcessed'),
                align: 'end',
                cell: (item) => `${processedCount(item)}/${item.parts.length}`,
              },
              {
                key: 'status',
                label: t('queueStatus'),
                cell: (item) => statusPill(item),
              },
            ]}
          />
        </SectionPanel>
      ) : pending ? (
        <SkeletonRows label={tl('loading')} rows={3} />
      ) : null}
      {job?.accountId && job.accountId === activeAccountId && repair && (
        <OlxQueueRepairSheet
          partId={repair.row.id}
          partLabel={[repair.row.name ?? repair.row.id, repair.row.oem]
            .filter(Boolean)
            .join(' · ')}
          partHref={`${partsHref}/${encodeURIComponent(repair.row.id)}`}
          listingHref={listingHref}
          accountId={job.accountId}
          jobRevision={repair.row.revision}
          canSeeDiagnostics={canSeeDiagnostics}
          providerFields={
            canSeeDiagnostics && repair.row.error === 'OLX_WRITE_REJECTED'
              ? repair.row.errorFields
              : null
          }
          trigger={repair.trigger}
          onClose={() => setRepair(null)}
          onRetry={(revision, signal) =>
            submitRetry(job.id, [repair.row.id], signal, {
              [repair.row.id]: revision,
            })
          }
          retryFailure={retryFailure}
        />
      )}
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
    </div>
  )
}
