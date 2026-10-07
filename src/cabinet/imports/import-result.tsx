import { Link } from 'react-router'
import { Button } from '@/components/app'
import { cn } from '@/lib/utils'
import {
  commonMessages,
  formatDate,
  formatDateTime,
  useLocale,
  useT,
  type Locale,
} from '@/i18n'
import type { ImportRow, ImportStatus } from '@/api/part-imports'
import { importResultMessages } from './import-result-messages'
import { issueText, statusLabel } from './import-model'
import { useCount, useImportT } from './use-import-text'

const PAGE_SIZE = 100

/** Parts are priced in dollars, like the cars they come off. */
const money = (amount: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger',
  }).format(amount)

/** Date and time in the business time zone; an unparsable value as received. */
const moment = (value: string | null, locale: Locale, timeZone: string) =>
  value === null ? null : (formatDateTime(value, locale, timeZone) ?? value)

const day = (value: string | null, locale: Locale, timeZone: string) =>
  value === null ? null : (formatDate(value, locale, { timeZone }) ?? value)

/** Rows the server will pick up again; everything else needs the file fixed. */
const RETRYABLE = ['Pending', 'RetryableFailure']

function Kpi({
  label,
  value,
  meta,
  tone,
  title,
}: {
  label: string
  value: string
  meta: string
  tone?: 'plain' | 'good' | 'warn' | 'dim'
  title?: string
}) {
  return (
    <div className="bg-app-raised px-6 pt-5.5 pb-6" title={title}>
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-3.5 text-[26px] leading-none font-extrabold tracking-[-0.03em]',
          tone === 'good' && 'text-state-ok',
          tone === 'warn' && 'text-state-warn',
          tone === 'dim' && 'text-app-dim',
          (tone === undefined || tone === 'plain') && 'text-app-ink',
        )}
      >
        {value}
      </p>
      <p className="text-app-dim mt-3.5 text-[13px] leading-5 text-pretty">
        {meta}
      </p>
    </div>
  )
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-px overflow-hidden rounded-[20px] border">
      {children}
    </div>
  )
}

function Panel({
  label,
  title,
  children,
  footer,
}: {
  label: string
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
    >
      <h2 className="text-app-ink border-app-line border-b px-5.5 py-4 text-[15px] font-bold">
        {title}
      </h2>
      {children}
      {footer === undefined ? null : (
        <p className="text-app-dim border-app-line border-t px-5.5 py-3.5 text-[13px] leading-5 text-pretty">
          {footer}
        </p>
      )}
    </section>
  )
}

/**
 * Крок 5 — what the import actually did. The same screen covers the work in
 * flight, the finished run, the partly failed run, the stopped run and the
 * record whose details have expired: they differ in what is true, not in where
 * things live.
 *
 * Every number here is either the server's own execution counter or a sum over
 * the rows currently loaded — and when it is the latter, the screen says so,
 * because a page holds a hundred rows and an import can hold ten thousand.
 */
export function ImportResultStep({
  status,
  rows,
  rowTotal,
  rowPage,
  onRowPage,
  fileName,
  partsHref,
  partHref,
  onCancel,
  onRetry,
  onReport,
  onRetryReport,
  onSource,
  onNewImport,
  busy,
}: {
  status: ImportStatus
  rows: readonly ImportRow[]
  rowTotal: number
  rowPage: number
  onRowPage: (page: number) => void
  /** Known only while the upload is still in this browser session. */
  fileName: string | null
  partsHref: string
  partHref: (partId: string) => string
  onCancel: () => void
  onRetry: () => void
  onReport: () => void
  onRetryReport: () => void
  onSource: () => void
  onNewImport: () => void
  busy: boolean
}) {
  const { locale, timeZone } = useLocale()
  const t = useImportT(importResultMessages)
  const tc = useT(commonMessages)
  const count = useCount()
  // The execution never reports how long it ran, who started it or what the
  // uploaded file was called — so those cells say so instead of guessing.
  const noTiming = t('noTiming')
  const noTotals = t('noTotals')
  const noFileName = t('noFileName')
  const execution = status.execution
  const selected = execution?.selected ?? status.rowCount
  const committed = execution?.committed ?? 0
  const failed = execution?.failed ?? 0
  const queued = Math.max(0, selected - committed - failed)
  const expired = status.status === 'Expired'
  const running = ['Queued', 'Running', 'CancelRequested'].includes(
    status.status,
  )
  const stopped = status.status === 'Cancelled'
  const partial = failed > 0

  const created = rows.filter((row) => row.executionStatus === 'Committed')
  const broken = rows.filter((row) => row.executionErrorCode)
  const retryable = broken.filter((row) =>
    RETRYABLE.includes(row.executionStatus ?? ''),
  ).length
  // A page holds a hundred rows; the execution counters cover the whole import.
  // Anything summed from rows says so unless the page happens to hold them all.
  const allCreated = created.length >= committed
  const allBroken = broken.length >= failed
  const units = created.reduce((sum, row) => {
    const quantity = Number(row.draft?.values['Quantity'] ?? '')
    return sum + (Number.isFinite(quantity) ? quantity : 0)
  }, 0)
  const unitsMeta = expired
    ? t('detailsUnavailable')
    : t(allCreated ? 'units' : 'unitsOnPage', { count: units })

  const reportReady = !expired && status.report?.status === 'Ready'
  const reportFailed = status.report?.status === 'Failed'

  const headline = expired
    ? t('headlineExpired')
    : running
      ? t('headlineRunning')
      : stopped
        ? t('headlineStopped', { count: count(committed) })
        : partial
          ? t('headlinePartial', {
              created: t('partsCreated', { count: committed }),
              failed: t('rowsFailed', { count: failed }),
            })
          : t('partsCreated', { count: committed })

  const lede = expired
    ? t('ledeExpired')
    : running
      ? t('ledeRunning')
      : stopped
        ? t('ledeStopped', { count: committed })
        : partial
          ? t('ledePartial')
          : t('ledeDone')

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <section
        aria-label={t('importState')}
        className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-6 pb-6 sm:px-8"
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-[12.5px] font-bold',
              running && 'border-brand/34 text-brand bg-brand/10',
              !running &&
                !expired &&
                !partial &&
                !stopped &&
                'border-state-ok/30 text-state-ok bg-state-ok/10',
              (partial || stopped) &&
                'border-state-warn/30 text-state-warn bg-state-warn-soft',
              expired && 'border-app-line text-app-dim',
            )}
          >
            {statusLabel(status.status, locale)}
          </span>
          <span className="text-app-dim text-[13.5px]">
            {t('createdAt', {
              date: moment(status.createdAt, locale, timeZone) ?? '',
            })}
          </span>
        </p>
        <h2 className="text-app-ink mt-4 text-[26px] leading-[1.12] font-extrabold tracking-[-0.03em] text-pretty sm:text-[32px]">
          {headline}
        </h2>
        <p className="text-app-muted mt-2.5 max-w-[68ch] text-[14.5px] leading-6 text-pretty">
          {lede}
        </p>

        {running ? (
          <div className="mt-6">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[40px] leading-none font-extrabold tracking-[-0.03em] text-white">
                {count(committed)}
              </span>
              <span className="text-app-muted text-[15px] font-bold">
                {t('createdOf', { count: count(selected) })}
              </span>
            </p>
            <progress
              aria-label={t('progress')}
              className="mt-4 h-2 w-full"
              max={Math.max(1, selected)}
              value={committed}
            />
            <p className="text-app-dim mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <span>{t('createdCount', { count: count(committed) })}</span>
              <span className={cn(failed > 0 && 'text-state-warn')}>
                {t('failedCount', { count: count(failed) })}
              </span>
              <span>{t('queuedCount', { count: count(queued) })}</span>
            </p>
          </div>
        ) : null}

        {status.errorCode ? (
          <p className="border-state-warn/26 bg-state-warn-soft text-state-warn mt-5 rounded-[14px] border px-4 py-3 text-[13.5px] leading-5 text-pretty">
            {issueText(status.errorCode, locale)}
          </p>
        ) : null}
      </section>

      <Strip>
        <Kpi
          label={t('itemsCreated')}
          meta={unitsMeta}
          tone={committed > 0 ? 'good' : 'dim'}
          value={t('createdOfTotal', {
            created: count(committed),
            total: count(selected),
          })}
        />
        <Kpi
          label={t('errors')}
          meta={
            expired
              ? t('detailsUnavailable')
              : failed === 0
                ? stopped
                  ? t('stopNotError')
                  : t('allRowsPassed')
                : t(allBroken ? 'retryable' : 'retryableOnPage', {
                    count: count(retryable),
                  })
          }
          tone={failed === 0 ? 'plain' : 'warn'}
          value={t('rows', { count: failed })}
        />
        <Kpi
          label={t('duration')}
          meta={t('unknown')}
          title={noTiming}
          tone="dim"
          value="—"
        />
        <Kpi
          label={t('report')}
          meta={
            expired
              ? t('retentionEnded')
              : reportReady
                ? t('allRowsWithStatuses', { count: status.rowCount })
                : reportFailed
                  ? t('reportFailed')
                  : t('reportPreparing')
          }
          tone={reportReady && !expired ? 'plain' : 'dim'}
          value={
            expired
              ? t('reportUnavailable')
              : reportReady
                ? t('reportReady')
                : reportFailed
                  ? t('reportError')
                  : t('reportInProgress')
          }
        />
      </Strip>

      {expired ? (
        <div className="flex flex-wrap items-start gap-3.5">
          <Panel label={t('whatIsGone')} title={t('whatIsGone')}>
            <ul className="text-app-muted grid gap-2.5 px-5.5 py-4 text-[13.5px] leading-6">
              {[
                t('goneSource'),
                t('goneRows'),
                t('goneReport'),
                t('goneRetry'),
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <span aria-hidden className="text-app-dim">
                    —
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            footer={t('remainsFooter')}
            label={t('whatRemains')}
            title={t('whatRemains')}
          >
            <ul className="text-app-muted grid gap-2.5 px-5.5 py-4 text-[13.5px] leading-6">
              {[
                t('partsInCatalogue', { count: committed }),
                t('remainsTotals'),
                t('remainsEntities'),
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <span aria-hidden className="text-state-ok">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      {!expired && broken.length > 0 ? (
        <Panel
          footer={running ? t('retryAfterFinish') : t('retryNote')}
          label={t('failedRows')}
          title={t(allBroken ? 'failedRowsTitle' : 'failedRowsTitleOnPage', {
            count: count(broken.length),
          })}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">{t('row')}</th>
                  <th className="px-3 py-2.5 text-left">{t('item')}</th>
                  <th className="px-3 py-2.5 text-left">{t('reason')}</th>
                  <th className="px-3 py-2.5 text-left">{t('whatToDo')}</th>
                </tr>
              </thead>
              <tbody>
                {broken.map((row) => {
                  const again = RETRYABLE.includes(row.executionStatus ?? '')
                  return (
                    <tr className="border-app-line border-b" key={row.rowId}>
                      <td className="text-app-dim px-5.5 py-3.5 font-mono text-[13px] tabular-nums">
                        {count(row.sourceRow)}
                      </td>
                      <td className="text-app-ink px-3 py-3.5 font-medium">
                        {row.draft?.values['Name'] ?? '—'}
                      </td>
                      <td className="text-app-muted px-3 py-3.5">
                        {issueText(row.executionErrorCode ?? '', locale)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap',
                            again
                              ? 'border-state-ok/24 text-state-ok bg-state-ok/10'
                              : 'border-state-warn/24 text-state-warn bg-state-warn-soft',
                          )}
                        >
                          {again ? t('canRetry') : t('fixFile')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {!expired && created.length > 0 ? (
        <Panel
          footer={t('createdFooter', {
            count: rowTotal,
            created: count(created.length),
            shown: count(rows.length),
            size: count(PAGE_SIZE),
          })}
          label={t('createdItems')}
          title={t('createdItems')}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">{t('row')}</th>
                  <th className="px-3 py-2.5 text-left">{t('part')}</th>
                  <th className="px-3 py-2.5 text-right">{t('quantity')}</th>
                  <th className="px-3 py-2.5 text-right">{t('price')}</th>
                  <th className="px-3 py-2.5 text-left">{t('zone')}</th>
                </tr>
              </thead>
              <tbody>
                {created.map((row) => {
                  const values = row.draft?.values ?? {}
                  const code = [
                    values['ExternalCode'],
                    values['OemCode'] ? `OEM ${values['OemCode']}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  const price = Number(values['DesiredSalePrice'] ?? '')
                  return (
                    <tr className="border-app-line border-b" key={row.rowId}>
                      <td className="text-app-dim px-5.5 py-3.5 font-mono text-[13px] tabular-nums">
                        {count(row.sourceRow)}
                      </td>
                      <td className="px-3 py-3.5">
                        {row.partId ? (
                          <Link
                            className="text-app-ink hover:text-brand font-medium underline-offset-4 hover:underline"
                            to={partHref(row.partId)}
                          >
                            {values['Name'] ??
                              t('rowFallback', { row: String(row.sourceRow) })}
                          </Link>
                        ) : (
                          <span className="text-app-ink font-medium">
                            {values['Name'] ??
                              t('rowFallback', { row: String(row.sourceRow) })}
                          </span>
                        )}
                        {code === '' ? null : (
                          <span className="text-app-dim mt-1 block font-mono text-[12px]">
                            {code}
                          </span>
                        )}
                      </td>
                      <td className="text-app-ink px-3 py-3.5 text-right font-mono tabular-nums">
                        {values['Quantity'] ?? '—'}
                      </td>
                      <td className="text-app-ink px-3 py-3.5 text-right font-mono tabular-nums">
                        {Number.isFinite(price) && values['DesiredSalePrice']
                          ? money(price)
                          : '—'}
                      </td>
                      <td className="text-app-muted px-3 py-3.5">
                        {values['InventoryZoneId'] ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-start gap-3.5">
        <section
          aria-label={t('createdTogether')}
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[20px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">
            {t('createdTogether')}
          </h2>
          <dl className="mt-3.5 grid gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-app-muted text-[13.5px]">
                {t('totalsParts')}
              </dt>
              <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                {count(committed)}
              </dd>
            </div>
            {[t('totalsIntakes'), t('totalsZones'), t('totalsOrders')].map(
              (label) => (
                <div
                  className="flex flex-wrap items-baseline justify-between gap-3"
                  key={label}
                  title={noTotals}
                >
                  <dt className="text-app-dim text-[13.5px]">{label}</dt>
                  <dd className="text-app-dim font-mono text-[13px]">—</dd>
                </div>
              ),
            )}
          </dl>
          <p className="text-app-dim mt-4 text-[13px] leading-5 text-pretty">
            {t('totalsNote')}
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to={partsHref}>{t('toCatalogue')}</Link>
            </Button>
          </div>
        </section>

        <section
          aria-label={t('fileAndReport')}
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[20px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">
            {t('fileAndReport')}
          </h2>
          <dl className="mt-3.5 grid gap-2.5">
            <div
              className="flex flex-wrap items-baseline justify-between gap-3"
              {...(fileName === null ? { title: noFileName } : {})}
            >
              <dt className="text-app-muted text-[13.5px]">{t('file')}</dt>
              <dd
                className={cn(
                  'min-w-0 text-[13.5px] break-all',
                  fileName === null ? 'text-app-dim' : 'text-app-ink',
                )}
              >
                {fileName ?? '—'}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-app-muted text-[13.5px]">
                {t('rowsInFile')}
              </dt>
              <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                {count(status.rowCount)}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-app-muted text-[13.5px]">
                {t('availableUntil')}
              </dt>
              <dd
                className={cn(
                  'text-[13.5px]',
                  status.retentionExpiresAt === null
                    ? 'text-app-dim'
                    : 'text-app-ink',
                )}
              >
                {day(status.retentionExpiresAt, locale, timeZone) ??
                  t('notSpecified')}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              disabled={busy || !reportReady}
              onClick={onReport}
              title={reportReady ? undefined : t('reportStillPreparing')}
            >
              {t('downloadReport')}
            </Button>
            {reportFailed ? (
              <Button disabled={busy} onClick={onRetryReport}>
                {t('retryReport')}
              </Button>
            ) : null}
            {expired ? null : (
              <Button disabled={busy} onClick={onSource}>
                {t('downloadSource')}
              </Button>
            )}
          </div>
        </section>
      </div>

      {!expired && rowTotal > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-app-dim text-[13px]">
            {t('pageOf', {
              page: count(rowPage),
              pages: count(Math.ceil(rowTotal / PAGE_SIZE)),
            })}
          </p>
          <div className="flex gap-2.5">
            <Button
              disabled={busy || rowPage === 1}
              onClick={() => onRowPage(rowPage - 1)}
            >
              {tc('back')}
            </Button>
            <Button
              disabled={busy || rowPage * PAGE_SIZE >= rowTotal}
              onClick={() => onRowPage(rowPage + 1)}
            >
              {tc('next')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-app-line bg-app-raised flex flex-wrap items-center justify-between gap-4 rounded-[18px] border px-5.5 py-5">
        <p className="text-app-muted min-w-0 flex-[1_1_320px] text-[13.5px] leading-6 text-pretty">
          {running
            ? t('footerRunning')
            : expired
              ? t('footerExpired')
              : t('footerDone')}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {running ? (
            <Button disabled={busy} onClick={onCancel} variant="primary">
              {t('stopImport')}
            </Button>
          ) : null}
          {!running && !expired && (queued > 0 || retryable > 0) ? (
            <Button disabled={busy} onClick={onRetry} variant="primary">
              {queued > 0
                ? t('importRest', { count: queued })
                : t('retryRows', { count: retryable })}
            </Button>
          ) : null}
          <Button disabled={busy} onClick={onNewImport}>
            {t('newImport')}
          </Button>
        </div>
      </div>
    </div>
  )
}
