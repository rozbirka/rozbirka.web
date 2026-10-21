import { Link } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Button, SectionPanel, StatusPill } from '@/components/app'
import { cn } from '@/lib/utils'
import { Kpi, KpiStrip } from '../redesign-kpi'
import {
  commonMessages,
  formatDate,
  formatDateTime,
  useLocale,
  useT,
  type Locale,
} from '@/i18n'
import type { ImportRow, ImportStatus } from '@/api/part-imports'
import { wholeMoney } from '../currency/money'
import { importResultMessages } from './import-result-messages'
import { issueText, statusLabel } from './import-model'
import { useCount, useImportT } from './use-import-text'

const PAGE_SIZE = 100

/** Date and time in the business time zone; an unparsable value as received. */
const moment = (value: string | null, locale: Locale, timeZone: string) =>
  value === null ? null : (formatDateTime(value, locale, timeZone) ?? value)

const day = (value: string | null, locale: Locale, timeZone: string) =>
  value === null ? null : (formatDate(value, locale, { timeZone }) ?? value)

/** Rows the server will pick up again; everything else needs the file fixed. */
const RETRYABLE = ['Pending', 'RetryableFailure']

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
    <section aria-label={label} className="rz-card min-w-0">
      <header className="rz-card__head py-2.5">
        <h2 className="rz-h-card">{title}</h2>
      </header>
      {children}
      {footer === undefined ? null : (
        <p className="rz-caption border-app-line m-0 border-t px-(--rz-card-p) py-2.5 text-pretty">
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
  accountingCurrency = null,
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
  /** What imported prices are in; `null` when unknown. */
  accountingCurrency?: string | null
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
    <div className="flex min-w-0 flex-col gap-3">
      <section aria-label={t('importState')} className="rz-card">
        <div className="rz-card__body grid gap-2">
          <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusPill
              tone={
                running
                  ? 'info'
                  : expired
                    ? 'neutral'
                    : partial || stopped
                      ? 'warn'
                      : 'ok'
              }
            >
              {statusLabel(status.status, locale)}
            </StatusPill>
            <span className="rz-caption">
              {t('createdAt', {
                date: moment(status.createdAt, locale, timeZone) ?? '',
              })}
            </span>
          </p>
          <h2 className="rz-h-title mt-1 text-pretty">{headline}</h2>
          <p className="text-app-muted m-0 max-w-[68ch] text-pretty">{lede}</p>

          {running ? (
            <div className="mt-3 grid gap-2">
              <p className="m-0 flex flex-wrap items-baseline gap-x-3">
                <span className="rz-display">{count(committed)}</span>
                <span className="text-app-muted font-semibold">
                  {t('createdOf', { count: count(selected) })}
                </span>
              </p>
              <progress
                aria-label={t('progress')}
                className="accent-state-ok h-1 w-full"
                max={Math.max(1, selected)}
                value={committed}
              />
              <p className="rz-caption m-0 flex flex-wrap gap-x-4 gap-y-1">
                <span>{t('createdCount', { count: count(committed) })}</span>
                <span className={cn(failed > 0 && 'text-state-warn')}>
                  {t('failedCount', { count: count(failed) })}
                </span>
                <span>{t('queuedCount', { count: count(queued) })}</span>
              </p>
            </div>
          ) : null}

          {status.errorCode ? (
            <div className="rz-notice rz-notice--warn mt-2">
              <AlertTriangle aria-hidden />
              <p className="rz-notice__body m-0 text-pretty">
                {issueText(status.errorCode, locale)}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <KpiStrip>
        <Kpi
          label={t('itemsCreated')}
          meta={unitsMeta}
          tone={committed > 0 ? 'plain' : 'dim'}
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
      </KpiStrip>

      {expired ? (
        <div className="grid items-start gap-3 md:grid-cols-2">
          <Panel label={t('whatIsGone')} title={t('whatIsGone')}>
            <ul className="text-app-muted m-0 grid list-none gap-2 px-(--rz-card-p) py-3">
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
            <ul className="text-app-muted m-0 grid list-none gap-2 px-(--rz-card-p) py-3">
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
          <div className="rz-table-scroll">
            <table className="rz-table">
              <thead>
                <tr>
                  <th scope="col">{t('row')}</th>
                  <th scope="col">{t('item')}</th>
                  <th scope="col">{t('reason')}</th>
                  <th scope="col">{t('whatToDo')}</th>
                </tr>
              </thead>
              <tbody>
                {broken.map((row) => {
                  const again = RETRYABLE.includes(row.executionStatus ?? '')
                  return (
                    <tr key={row.rowId}>
                      <th
                        className="text-app-dim font-mono tabular-nums"
                        scope="row"
                      >
                        {count(row.sourceRow)}
                      </th>
                      <td className="text-app-strong font-medium">
                        {row.draft?.values['Name'] ?? '—'}
                      </td>
                      <td>{issueText(row.executionErrorCode ?? '', locale)}</td>
                      <td>
                        <StatusPill tone={again ? 'ok' : 'warn'}>
                          {again ? t('canRetry') : t('fixFile')}
                        </StatusPill>
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
          <div className="rz-table-scroll">
            <table className="rz-table">
              <thead>
                <tr>
                  <th scope="col">{t('row')}</th>
                  <th scope="col">{t('part')}</th>
                  <th className="rz-num" scope="col">
                    {t('quantity')}
                  </th>
                  <th className="rz-num" scope="col">
                    {t('price')}
                  </th>
                  <th scope="col">{t('zone')}</th>
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
                    <tr key={row.rowId}>
                      <th
                        className="text-app-dim font-mono tabular-nums"
                        scope="row"
                      >
                        {count(row.sourceRow)}
                      </th>
                      <td className="py-2">
                        {row.partId ? (
                          <Link
                            className="text-app-strong hover:text-brand-text font-medium underline-offset-4 hover:underline"
                            to={partHref(row.partId)}
                          >
                            {values['Name'] ??
                              t('rowFallback', { row: String(row.sourceRow) })}
                          </Link>
                        ) : (
                          <span className="text-app-strong font-medium">
                            {values['Name'] ??
                              t('rowFallback', { row: String(row.sourceRow) })}
                          </span>
                        )}
                        {code === '' ? null : (
                          <span className="rz-caption mt-0.5 block font-mono">
                            {code}
                          </span>
                        )}
                      </td>
                      <td className="rz-num">{values['Quantity'] ?? '—'}</td>
                      <td className="rz-num">
                        {Number.isFinite(price) && values['DesiredSalePrice']
                          ? wholeMoney(price, accountingCurrency, locale)
                          : '—'}
                      </td>
                      <td>{values['InventoryZoneId'] ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-start gap-3">
        <SectionPanel
          className="min-w-0 flex-[1_1_320px]"
          title={t('createdTogether')}
        >
          <dl className="rz-facts px-0 py-0">
            <div>
              <dt>{t('totalsParts')}</dt>
              <dd className="font-mono tabular-nums">{count(committed)}</dd>
            </div>
            {[t('totalsIntakes'), t('totalsZones'), t('totalsOrders')].map(
              (label) => (
                <div key={label} title={noTotals}>
                  <dt>{label}</dt>
                  <dd className="text-app-dim font-mono">—</dd>
                </div>
              ),
            )}
          </dl>
          <p className="rz-caption m-0 text-pretty">{t('totalsNote')}</p>
          <div className="rz-btn-row">
            <Button asChild>
              <Link to={partsHref}>{t('toCatalogue')}</Link>
            </Button>
          </div>
        </SectionPanel>

        <SectionPanel
          className="min-w-0 flex-[1_1_320px]"
          title={t('fileAndReport')}
        >
          <dl className="rz-facts px-0 py-0">
            <div {...(fileName === null ? { title: noFileName } : {})}>
              <dt>{t('file')}</dt>
              <dd
                className={cn(
                  'break-all',
                  fileName === null ? 'text-app-dim' : 'text-app-strong',
                )}
              >
                {fileName ?? '—'}
              </dd>
            </div>
            <div>
              <dt>{t('rowsInFile')}</dt>
              <dd className="font-mono tabular-nums">
                {count(status.rowCount)}
              </dd>
            </div>
            <div>
              <dt>{t('availableUntil')}</dt>
              <dd
                className={cn(
                  status.retentionExpiresAt === null && 'text-app-dim',
                )}
              >
                {day(status.retentionExpiresAt, locale, timeZone) ??
                  t('notSpecified')}
              </dd>
            </div>
          </dl>
          <div className="rz-btn-row">
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
        </SectionPanel>
      </div>

      {!expired && rowTotal > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="rz-caption m-0">
            {t('pageOf', {
              page: count(rowPage),
              pages: count(Math.ceil(rowTotal / PAGE_SIZE)),
            })}
          </p>
          <div className="rz-btn-row">
            <Button
              disabled={busy || rowPage === 1}
              onClick={() => onRowPage(rowPage - 1)}
              size="sm"
            >
              {tc('back')}
            </Button>
            <Button
              disabled={busy || rowPage * PAGE_SIZE >= rowTotal}
              onClick={() => onRowPage(rowPage + 1)}
              size="sm"
            >
              {tc('next')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rz-card">
        <div className="rz-card__body flex flex-wrap items-center justify-between gap-3">
          <p className="text-app-muted m-0 min-w-0 flex-[1_1_320px] text-pretty">
            {running
              ? t('footerRunning')
              : expired
                ? t('footerExpired')
                : t('footerDone')}
          </p>
          <div className="rz-btn-row">
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
    </div>
  )
}
