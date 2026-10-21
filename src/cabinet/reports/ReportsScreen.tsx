import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { Calendar, Download, FileText, Printer, RefreshCw } from 'lucide-react'
import {
  Button,
  DataTable,
  DateValue,
  EmptyState,
  Field,
  Notice,
  SkeletonRows,
  StatusPill,
  TextInput,
  formatFileSize,
  useOperation,
  useOptionalToast,
  type StatusTone,
} from '@/components/app'
import { reportsApi, type ReportJob } from '@/api/reports'
import { normalizeApiProblem } from '@/api/errors'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { tenantRequestScope } from '../tenant-request-scope'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  commonMessages,
  intlLocale,
  translate,
  useLocale,
  useT,
  type Locale,
} from '@/i18n'
import { reportsMessages } from './messages'
import { RecordShell } from '../billing/billing-shell'

type ReportsKey = keyof (typeof reportsMessages)['uk']

const POLL_INTERVAL_MS = 5_000

type DisplayStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'unknown'

interface DateRange {
  from: string
  to: string
}

interface Scope {
  key: string
}

interface ScopedFlight {
  key: string
  controller: AbortController
}

interface ScopedError {
  key: string
  message: ReportsKey
}

interface ScopedDownload {
  key: string
  id: string
}

interface ScopedPeriod {
  key: string
  range: DateRange
}

/** The browser refused the print window: a reason the user can act on. */
class PrintWindowBlockedError extends Error {}

const EMPTY_REPORTS: ReportJob[] = []

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const initialRange = (): DateRange => {
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 6)
  return { from: localDate(from), to: localDate(today) }
}

const isCalendarDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

const validRange = (range: DateRange) =>
  isCalendarDate(range.from) &&
  isCalendarDate(range.to) &&
  range.from <= range.to

/** What is wrong with each end of the range, said at the field it belongs to. */
const rangeProblems = (range: DateRange, locale: Locale) => ({
  from: isCalendarDate(range.from)
    ? null
    : translate(reportsMessages, locale, 'fromInvalid'),
  to: !isCalendarDate(range.to)
    ? translate(reportsMessages, locale, 'toInvalid')
    : isCalendarDate(range.from) && range.to < range.from
      ? translate(reportsMessages, locale, 'toBeforeFrom')
      : null,
})

const localDayBoundaryUtc = (value: string, endOfDay: boolean) => {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).toISOString()
}

const statusOf = (report: ReportJob): DisplayStatus => {
  if (
    report.status === 'expired' ||
    (report.status === 'completed' &&
      Date.parse(report.expiresAt) <= Date.now())
  ) {
    return 'expired'
  }
  if (report.status === 'queued') return 'queued'
  if (report.status === 'processing' || report.status === 'running') {
    return 'processing'
  }
  if (report.status === 'completed') return 'completed'
  if (report.status === 'failed') return 'failed'
  return 'unknown'
}

const statusPill: Record<
  DisplayStatus,
  { message: ReportsKey; tone: StatusTone }
> = {
  queued: { message: 'statusQueued', tone: 'neutral' },
  processing: { message: 'statusProcessing', tone: 'info' },
  completed: { message: 'statusCompleted', tone: 'ok' },
  failed: { message: 'statusFailed', tone: 'danger' },
  expired: { message: 'statusExpired', tone: 'warn' },
  unknown: { message: 'statusUnknown', tone: 'neutral' },
}

const isPollingStatus = (status: DisplayStatus) =>
  status === 'queued' || status === 'processing'

/** A percentage only when the server actually reported one. */
const percentOf = (report: ReportJob): number | null => {
  const value = Number(report.progress)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.min(100, Math.round(value))
}

const progressText = (
  report: ReportJob,
  status: DisplayStatus,
  locale: Locale,
): string => {
  if (status === 'queued') {
    return translate(reportsMessages, locale, 'progressQueued')
  }
  const percent = percentOf(report)
  if (percent === null) {
    return translate(reportsMessages, locale, 'progressNoPercent')
  }
  const { itemsProcessed, itemsTotal } = report
  return itemsTotal !== null && itemsTotal > 0 && itemsProcessed !== null
    ? translate(reportsMessages, locale, 'progressItems', {
        percent,
        processed: itemsProcessed,
        total: itemsTotal,
      })
    : translate(reportsMessages, locale, 'progressPercent', { percent })
}

/**
 * A report period the way the reference writes it — "15.10 – 21.10.2026":
 * the start drops the year when both ends share it.
 */
const periodLabel = (from: string, to: string, locale: Locale) => {
  const day = (value: string) => new Date(`${value}T00:00:00Z`)
  const options = { day: '2-digit', month: '2-digit', timeZone: 'UTC' } as const
  const full = new Intl.DateTimeFormat(intlLocale(locale), {
    ...options,
    year: 'numeric',
  })
  const start =
    from.slice(0, 4) === to.slice(0, 4)
      ? new Intl.DateTimeFormat(intlLocale(locale), options).format(day(from))
      : full.format(day(from))
  return `${start} – ${full.format(day(to))}`
}

/**
 * A date field with the calendar mark the reference draws inside it; the
 * native picker keeps the platform's keyboard and screen-reader behaviour.
 */
function DateField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <span className="relative block">
      <Calendar
        aria-hidden
        className="text-app-dim pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
      />
      <TextInput
        className="cursor-pointer pl-8 font-mono [&::-webkit-calendar-picker-indicator]:hidden"
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => {
          // The native indicator is hidden in favour of the leading mark;
          // the whole field opens the picker instead.
          try {
            event.currentTarget.showPicker()
          } catch {
            // Not supported or not allowed: typing still works.
          }
        }}
        required
        type="date"
        value={value}
      />
    </span>
  )
}

const sameReport = (left: ReportJob, right: ReportJob) =>
  left.id === right.id &&
  left.type === right.type &&
  left.status === right.status &&
  left.stage === right.stage &&
  left.progress === right.progress &&
  left.itemsTotal === right.itemsTotal &&
  left.itemsProcessed === right.itemsProcessed &&
  left.requestedAt === right.requestedAt &&
  left.startedAt === right.startedAt &&
  left.completedAt === right.completedAt &&
  left.expiresAt === right.expiresAt &&
  left.errorMessage === right.errorMessage &&
  left.fileSizeBytes === right.fileSizeBytes

export const ReportsScreen: ComponentType<CabinetModuleScreenProps> = ({
  definition,
}) => {
  const cabinet = useCabinet()
  const { locale } = useLocale()
  const t = useT(reportsMessages)
  const tc = useT(commonMessages)
  const toast = useOptionalToast()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const scope = useMemo<Scope | null>(() => {
    const snapshot = cabinet.snapshot
    if (cabinet.status !== 'ready' || snapshot === null) return null
    return {
      key: `${snapshot.userId}:${snapshot.tenantId}:${snapshot.generation}`,
    }
  }, [cabinet.snapshot, cabinet.status])
  const canManage = cabinet.snapshot?.permissions.has('reports.manage') ?? false
  const [range, setRange] = useState<DateRange>(initialRange)
  const [reports, setReports] = useState<ReportJob[]>([])
  const [reportsScopeKey, setReportsScopeKey] = useState<string | null>(null)
  const [settledScopeKey, setSettledScopeKey] = useState<string | null>(null)
  const [error, setError] = useState<ScopedError | null>(null)
  const [creatingScopeKey, setCreatingScopeKey] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<ScopedDownload | null>(null)
  /**
   * The list endpoint does not return the range a job covers, so the period is
   * known only for jobs this session asked for — in this tenant. Everything
   * else says the period is unknown rather than guessing one.
   */
  const [periods, setPeriods] = useState<Record<string, ScopedPeriod>>({})
  const currentScopeRef = useRef(scope?.key ?? null)
  const accessRef = useRef({
    key: scope?.key ?? null,
    permissions: cabinet.snapshot?.permissions ?? null,
  })
  const createFlightRef = useRef<ScopedFlight | null>(null)
  const downloadFlightRef = useRef<ScopedFlight | null>(null)
  const transferRef = useRef<ReportJob | null>(null)

  const scopeKey = scope?.key ?? null
  const visibleReports = reportsScopeKey === scopeKey ? reports : EMPTY_REPORTS
  const isLoading = scopeKey !== null && settledScopeKey !== scopeKey
  const visibleError = error?.key === scopeKey ? t(error.message) : null
  const isCreating = creatingScopeKey === scopeKey
  const currentDownloading =
    downloading?.key === scopeKey ? downloading.id : null

  useEffect(() => {
    currentScopeRef.current = scopeKey
    accessRef.current = {
      key: scopeKey,
      permissions: cabinet.snapshot?.permissions ?? null,
    }
  }, [cabinet.snapshot, scopeKey])

  useEffect(() => {
    const key = scopeKey
    createFlightRef.current?.controller.abort('tenant-scope-changed')
    downloadFlightRef.current?.controller.abort('tenant-scope-changed')
    if (key === null) return

    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    void reportsApi
      .list({ page: 1, pageSize: 20 }, { signal })
      .then((page) => {
        if (signal.aborted || currentScopeRef.current !== key) return
        setReports(page.items)
        setReportsScopeKey(key)
      })
      .catch(() => {
        if (!signal.aborted && currentScopeRef.current === key) {
          setError({
            key,
            message: 'listFailed',
          })
        }
      })
      .finally(() => {
        if (!signal.aborted && currentScopeRef.current === key) {
          setSettledScopeKey(key)
        }
      })
    return () => controller.abort('report-list-invalidated')
  }, [scope, scopeKey])

  const pollableIdsKey = useMemo(
    () =>
      visibleReports
        .filter((report) => isPollingStatus(statusOf(report)))
        .map((report) => report.id)
        .join('|'),
    [visibleReports],
  )

  useEffect(() => {
    const key = scopeKey
    if (key === null || pollableIdsKey === '') return
    const reportIds = pollableIdsKey.split('|')
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    const inFlight = new Set<string>()
    const poll = async () => {
      await Promise.all(
        reportIds.map(async (reportId) => {
          if (inFlight.has(reportId) || signal.aborted) return
          inFlight.add(reportId)
          try {
            const next = await reportsApi.get(reportId, { signal })
            if (signal.aborted || currentScopeRef.current !== key) return
            setReports((current) => {
              const previous = current.find((item) => item.id === next.id)
              if (previous === undefined || sameReport(previous, next)) {
                return current
              }
              return current.map((item) => (item.id === next.id ? next : item))
            })
            setReportsScopeKey(key)
          } catch {
            // A later interval can recover a transient polling error.
          } finally {
            inFlight.delete(reportId)
          }
        }),
      )
    }
    void poll()
    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
      controller.abort('report-poll-invalidated')
    }
  }, [pollableIdsKey, scopeKey])

  const createReport = useCallback(async () => {
    const access = accessRef.current
    if (access.key === null || !access.permissions?.has('reports.manage')) {
      if (access.key !== null && currentScopeRef.current === access.key) {
        setError({
          key: access.key,
          message: 'noCreatePermission',
        })
      }
      return
    }
    if (!validRange(range)) return
    if (createFlightRef.current !== null) return
    const controller = new AbortController()
    let signal: AbortSignal = controller.signal
    createFlightRef.current = { key: access.key, controller }
    setCreatingScopeKey(access.key)
    try {
      const mutationScope = requireLatestMutation({ quota: false })
      requireLatestMutation({ permission: 'finance.view', quota: false })
      signal = AbortSignal.any([controller.signal, mutationScope.signal])
      const created = await reportsApi.create(
        {
          type: 'carSales',
          carSales: {
            from: localDayBoundaryUtc(range.from, false),
            to: localDayBoundaryUtc(range.to, true),
          },
        },
        { signal },
      )
      if (signal.aborted || currentScopeRef.current !== access.key) return
      const owner = access.key
      setReports((current) => [
        created,
        ...current.filter((report) => report.id !== created.id),
      ])
      setPeriods((current) => ({
        ...current,
        [created.id]: { key: owner, range: { ...range } },
      }))
      setReportsScopeKey(access.key)
      // Notifications rule (module 00 §5): an action that went through is a
      // toast; the row itself then shows the job's progress.
      toast?.show({ tone: 'ok', message: t('createdToast') })
    } catch {
      if (!signal.aborted && currentScopeRef.current === access.key) {
        setError({
          key: access.key,
          message: 'createFailed',
        })
      }
    } finally {
      if (createFlightRef.current?.controller === controller) {
        createFlightRef.current = null
        if (currentScopeRef.current === access.key) setCreatingScopeKey(null)
      }
    }
  }, [range, requireLatestMutation, t, toast])

  const transfer = async (print: boolean) => {
    const report = transferRef.current
    const access = accessRef.current
    if (
      report === null ||
      statusOf(report) !== 'completed' ||
      currentDownloading !== null ||
      access.key === null
    ) {
      return
    }
    const popup = print ? window.open('', '_blank', 'noopener') : null
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    downloadFlightRef.current?.controller.abort('report-download-replaced')
    downloadFlightRef.current = { key: access.key, controller }
    setDownloading({ key: access.key, id: report.id })
    try {
      const file = await reportsApi.download(report.id, { signal })
      if (signal.aborted || currentScopeRef.current !== access.key) {
        popup?.close()
        return
      }
      if (print && popup === null) throw new PrintWindowBlockedError()
      const url = URL.createObjectURL(file.blob)
      if (print && popup) {
        popup.addEventListener('load', () => popup.print(), { once: true })
        popup.location.href = url
      } else if (!print) {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = file.filename
        anchor.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (failure) {
      popup?.close()
      // A tenant switch already discarded this request: nothing to report.
      if (signal.aborted || currentScopeRef.current !== access.key) return
      throw failure
    } finally {
      if (downloadFlightRef.current?.controller === controller) {
        downloadFlightRef.current = null
        if (currentScopeRef.current === access.key) setDownloading(null)
      }
    }
  }

  // No success toast: the browser's own download and print windows are the
  // confirmation, and a tenant switch mid-flight ends the run without a file.
  const savePdf = useOperation(() => transfer(false), {
    errorMessage: (failure) =>
      t('downloadRetry', { reason: normalizeApiProblem(failure).message }),
  })
  const printPdf = useOperation(() => transfer(true), {
    errorMessage: (failure) =>
      failure instanceof PrintWindowBlockedError
        ? t('printBlocked')
        : t('printRetry', { reason: normalizeApiProblem(failure).message }),
  })
  const { reset: resetSave } = savePdf
  const { reset: resetPrint } = printPdf

  useEffect(() => {
    // A failure belongs to the tenant it happened in, and to no other.
    resetSave()
    resetPrint()
  }, [resetPrint, resetSave, scopeKey])

  const problems = rangeProblems(range, locale)
  const rangeIsValid = validRange(range)
  const transferBusy = savePdf.pending || printPdf.pending
  const transferError = savePdf.error ?? printPdf.error

  return (
    <RecordShell
      crumb={`${t('eyebrow')} · ${t('title')}`}
      labelledBy="reports-title"
    >
      <div className="rz-page-head">
        <h1 className="rz-h-page" id="reports-title">
          {t('title')}
        </h1>
        <span className="rz-muted">{t('lead')}</span>
      </div>

      {canManage ? (
        <form
          aria-busy={isCreating}
          aria-label={t('createForm')}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void createReport()
          }}
        >
          <section aria-labelledby="new-report-title" className="rz-card">
            <header className="rz-card__head grid content-center gap-0.5 py-2.5">
              <h2 className="rz-h-card" id="new-report-title">
                {t('newReport')}
              </h2>
              <p className="rz-caption m-0">{t('newReportHint')}</p>
            </header>
            <div className="rz-card__body grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,236px))]">
                <Field
                  error={problems.from}
                  hint={t('fromHint')}
                  label={t('fromLabel')}
                  required
                >
                  <DateField
                    onChange={(value) =>
                      setRange((current) => ({ ...current, from: value }))
                    }
                    value={range.from}
                  />
                </Field>
                <Field
                  error={problems.to}
                  hint={t('toHint')}
                  label={t('toLabel')}
                  required
                >
                  <DateField
                    onChange={(value) =>
                      setRange((current) => ({ ...current, to: value }))
                    }
                    value={range.to}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  aria-busy={isCreating}
                  disabled={isCreating || !rangeIsValid}
                  type="submit"
                  variant="primary"
                >
                  {isCreating ? t('creating') : t('create')}
                </Button>
              </div>
            </div>
          </section>
        </form>
      ) : (
        <Notice tone="info">{t('viewOnly')}</Notice>
      )}

      {visibleError ? <Notice tone="danger">{visibleError}</Notice> : null}
      {transferError ? <Notice tone="danger">{transferError}</Notice> : null}

      {isLoading ? (
        <SkeletonRows label={t('loading')} rows={3} />
      ) : (
        <DataTable
          caption={t('list')}
          columns={[
            {
              key: 'period',
              label: t('columnPeriod'),
              variant: 'primary',
              cell: (report) => {
                const known = periods[report.id]
                const period = known?.key === scopeKey ? known.range : undefined
                if (period === undefined) {
                  return (
                    <>
                      <span
                        aria-hidden
                        className="rz-dim inline-block min-w-44"
                      >
                        —
                      </span>
                      <span className="sr-only">{t('periodUnknown')}</span>
                    </>
                  )
                }
                return (
                  <span className="rz-mono inline-block min-w-44">
                    {periodLabel(period.from, period.to, locale)}
                  </span>
                )
              },
            },
            {
              key: 'requested',
              label: t('columnCreated'),
              cell: (report) => (
                <DateValue
                  className="rz-mono text-app-muted"
                  value={report.requestedAt}
                />
              ),
            },
            {
              key: 'status',
              label: t('columnStatus'),
              cell: (report) => {
                const status = statusOf(report)
                const pill = statusPill[status]
                const percent = percentOf(report)
                return (
                  <span className="grid min-w-0 justify-items-end gap-1 py-2 md:justify-items-start">
                    <StatusPill tone={pill.tone}>{t(pill.message)}</StatusPill>
                    {isPollingStatus(status) ? (
                      <span
                        aria-live="polite"
                        className="grid w-full justify-items-end gap-1 md:justify-items-start"
                        role="status"
                      >
                        <span className="rz-caption rz-muted">
                          {progressText(report, status, locale)}
                        </span>
                        {percent === null ? null : (
                          <span aria-hidden className="rz-meter w-24">
                            <span
                              className="bg-state-info transition-[width] duration-[var(--rz-dur-slow)]"
                              style={{ width: `${String(percent)}%` }}
                            />
                          </span>
                        )}
                      </span>
                    ) : null}
                    {status === 'failed' ? (
                      <span className="rz-caption rz-muted">
                        {report.errorMessage
                          ? t('failedReason', { reason: report.errorMessage })
                          : t('failedUnknown')}{' '}
                        {canManage ? t('replaceHint') : t('askOwner')}
                      </span>
                    ) : null}
                    {status === 'expired' ? (
                      <span className="rz-caption rz-muted">
                        {t('expiredPrefix')}{' '}
                        <DateValue value={report.expiresAt} withTime={false} />,{' '}
                        {t('fileDeleted')}{' '}
                        {canManage ? t('newReportHint2') : t('askOwner')}
                      </span>
                    ) : null}
                    {status === 'completed' ? (
                      <span className="rz-caption">
                        PDF
                        {report.fileSizeBytes === null
                          ? ''
                          : ` · ${formatFileSize(report.fileSizeBytes, locale)}`}{' '}
                        · {t('availableUntil')}{' '}
                        <DateValue value={report.expiresAt} withTime={false} />
                      </span>
                    ) : null}
                  </span>
                )
              },
            },
            {
              key: 'actions',
              label: tc('actions'),
              align: 'end',
              headerHidden: true,
              cell: (report) => {
                const status = statusOf(report)
                if (status === 'completed') {
                  const active = currentDownloading === report.id
                  return (
                    <span className="flex w-full justify-end gap-2 whitespace-nowrap font-(family-name:--rz-font)">
                      <Button
                        aria-busy={savePdf.pending && active}
                        disabled={transferBusy}
                        onClick={() => {
                          transferRef.current = report
                          savePdf.run()
                        }}
                        size="sm"
                      >
                        <Download aria-hidden />
                        {t('downloadPdf')}
                      </Button>
                      <Button
                        aria-busy={printPdf.pending && active}
                        disabled={transferBusy}
                        size="sm"
                        onClick={() => {
                          transferRef.current = report
                          printPdf.run()
                        }}
                      >
                        <Printer aria-hidden />
                        {t('print')}
                      </Button>
                    </span>
                  )
                }
                if (
                  canManage &&
                  (status === 'failed' || status === 'expired')
                ) {
                  return (
                    <span className="flex w-full justify-end font-(family-name:--rz-font)">
                      <Button
                        disabled={isCreating || !rangeIsValid}
                        onClick={() => void createReport()}
                        size="sm"
                      >
                        <RefreshCw aria-hidden />
                        {status === 'failed'
                          ? t('createReplacement')
                          : t('createNew')}
                      </Button>
                    </span>
                  )
                }
                return null
              },
            },
          ]}
          empty={
            <EmptyState
              className="min-h-[220px] border-0"
              description={t('emptyDescription')}
              icon={<FileText aria-hidden />}
              label={t('list')}
              title={t('emptyTitle')}
              tone="neutral"
            />
          }
          rowKey={(report) => report.id}
          rows={visibleReports}
        />
      )}
    </RecordShell>
  )
}
