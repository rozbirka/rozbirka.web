import { useMemo, useState } from 'react'
import { Button, DataTable, EmptyState, StatusPill } from '@/components/app'
import { cn } from '@/lib/utils'
import {
  commonMessages,
  formatDate,
  formatTime,
  useLocale,
  useT,
  type Locale,
  type MessageKey,
} from '@/i18n'
import type { StatusTone } from '@/components/app'
import type { ImportCapabilities, ImportStatus } from '@/api/part-imports'
import { ImportEmpty } from './import-empty'
import { importHistoryMessages } from './import-history-messages'
import { importText, issueText, statusLabel } from './import-model'
import { useCount, useImportT } from './use-import-text'

/** The seven states the history chip can take, and the tone each one reads in. */
const TONES: Record<string, StatusTone> = {
  Uploading: 'warn',
  Uploaded: 'warn',
  Analyzing: 'warn',
  NeedsReview: 'warn',
  Ready: 'warn',
  Queued: 'info',
  Running: 'info',
  CancelRequested: 'info',
  Completed: 'ok',
  CompletedWithErrors: 'warn',
  Cancelled: 'neutral',
  Failed: 'danger',
  Expired: 'neutral',
}

const UNFINISHED = new Set(['Uploaded', 'Analyzing', 'NeedsReview', 'Ready'])

const SEGMENTS = [
  { key: 'all', label: 'segmentAll', match: () => true },
  {
    key: 'attention',
    label: 'segmentAttention',
    match: (row: ImportStatus) =>
      UNFINISHED.has(row.status) ||
      row.status === 'CompletedWithErrors' ||
      row.status === 'Failed',
  },
  {
    key: 'done',
    label: 'segmentDone',
    match: (row: ImportStatus) => row.status === 'Completed',
  },
  {
    key: 'stopped',
    label: 'segmentStopped',
    match: (row: ImportStatus) =>
      row.status === 'Cancelled' || row.status === 'Expired',
  },
] as const

interface Zone {
  locale: Locale
  timeZone: string
}

const text = (
  { locale }: Zone,
  key: MessageKey<typeof importHistoryMessages>,
  params?: Record<string, string>,
) => importText(importHistoryMessages, locale, key, params)

/** Dates in the business time zone. */
const day = (value: string, { locale, timeZone }: Zone) =>
  formatDate(value, locale, { timeZone }) ?? value

const dayAndTime = (value: string, zone: Zone) =>
  text(zone, 'dayAndTime', {
    day: day(value, zone),
    time: formatTime(value, zone.locale, zone.timeZone) ?? '',
  })

/**
 * The second line of the identity column: what this import is waiting for, or
 * what became of it. The design puts the author here; the history endpoint
 * deliberately returns no author and no filename, so the line carries the
 * state instead of a name we would have to invent.
 */
function line(row: ImportStatus, zone: Zone) {
  const stage =
    row.status === 'Failed'
      ? row.errorCode
        ? issueText(row.errorCode, zone.locale)
        : text(zone, 'fileNotRead')
      : row.status === 'Expired'
        ? text(zone, 'retentionEnded')
        : row.status === 'Cancelled'
          ? text(zone, 'stopped')
          : row.status === 'NeedsReview'
            ? text(zone, 'mappedNotChecked')
            : row.status === 'Ready'
              ? text(zone, 'readyToRun')
              : statusLabel(row.status, zone.locale).toLocaleLowerCase(
                  zone.locale,
                )
  const until =
    row.retentionExpiresAt !== null && row.status !== 'Expired'
      ? text(zone, 'availableUntil', {
          date: day(row.retentionExpiresAt, zone),
        })
      : ''
  return `${stage}${until}`
}

const actionLabel = (row: ImportStatus, zone: Zone) =>
  UNFINISHED.has(row.status)
    ? text(zone, 'continue')
    : row.status === 'Failed' || row.status === 'Expired'
      ? text(zone, 'details')
      : text(zone, 'result')

function Kpi({
  label,
  value,
  unit,
  meta,
  tone,
  unavailable,
}: {
  label: string
  value: string
  unit?: string
  meta: string
  tone?: 'plain' | 'warn'
  /** Why the figure is missing. Set means the tile shows a dash and says why. */
  unavailable?: string
}) {
  return (
    <div className="bg-app-raised px-6 pt-5.5 pb-6">
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-[30px] leading-none font-extrabold tracking-[-0.03em]',
            unavailable !== undefined
              ? 'text-app-dim'
              : tone === 'warn'
                ? 'text-state-warn'
                : 'text-app-ink',
          )}
          {...(unavailable === undefined ? {} : { title: unavailable })}
        >
          {unavailable === undefined ? value : '—'}
        </span>
        {unit === undefined || unavailable !== undefined ? null : (
          <span className="text-app-muted font-mono text-[13px] font-medium">
            {unit}
          </span>
        )}
      </p>
      <p className="text-app-dim mt-3.5 text-[13px]">{unavailable ?? meta}</p>
    </div>
  )
}

/**
 * Історія імпортів — the screen someone lands on to start a new import or to
 * come back to one they left. Figures first, then the one import that still
 * wants something, then the list.
 */
export function ImportHistory({
  capabilities,
  imports,
  total,
  page,
  onPage,
  onOpen,
  onNew,
}: {
  capabilities: ImportCapabilities
  imports: readonly ImportStatus[]
  total: number
  page: number
  onPage: (page: number) => void
  onOpen: (id: string) => void
  onNew: () => void
}) {
  const { locale, timeZone } = useLocale()
  const zone: Zone = { locale, timeZone }
  const t = useImportT(importHistoryMessages)
  const tc = useT(commonMessages)
  const count = useCount()
  const [segment, setSegment] = useState<string>('all')
  const active = SEGMENTS.find((s) => s.key === segment) ?? SEGMENTS[0]
  const rows = useMemo(
    () => imports.filter((row) => active.match(row)),
    [active, imports],
  )
  const unfinished = imports.find((row) => UNFINISHED.has(row.status))

  const thisMonth = useMemo(() => {
    const now = new Date()
    return imports.filter((row) => {
      const at = new Date(row.createdAt)
      return (
        at.getMonth() === now.getMonth() &&
        at.getFullYear() === now.getFullYear()
      )
    }).length
  }, [imports])

  // The history endpoint returns no execution for a row — it deliberately
  // carries only the import's own state. So the two figures that count created
  // parts and failed rows have nothing to add up, and say so instead of
  // showing a zero that would read as "nothing went wrong".
  const noExecution = t('noExecution')

  // Nothing imported yet is not an empty table — it is a different screen, and
  // the design treats it as one: no figures to show, no groups to filter.
  if (total === 0)
    return <ImportEmpty capabilities={capabilities} onNew={onNew} />

  return (
    <div className="min-w-0">
      <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-px overflow-hidden rounded-[20px] border">
        <Kpi
          label={t('importsThisMonth')}
          meta={
            unfinished === undefined
              ? t('allTime', { count: count(total) })
              : t('onePreparing')
          }
          value={count(thisMonth)}
        />
        <Kpi
          label={t('partsCreated')}
          meta=""
          unavailable={noExecution}
          value="—"
        />
        <Kpi
          label={t('rowsWithErrors')}
          meta=""
          tone="warn"
          unavailable={noExecution}
          value="—"
        />
        <Kpi
          label={t('fileLimit')}
          meta={t('fileLimitMeta', {
            rows: count(capabilities.limits.maxRows),
            formats: capabilities.formats.join(', ').toUpperCase(),
          })}
          unit="MiB"
          value={String(
            Math.round(capabilities.limits.maxBytes / (1024 * 1024)),
          )}
        />
      </div>

      {unfinished === undefined ? null : (
        <div className="border-state-warn/25 bg-state-warn-soft mt-3.5 flex flex-wrap items-center gap-4 rounded-[18px] border px-5.5 py-4.5">
          <div className="min-w-[240px] flex-[1_1_320px]">
            <p className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="bg-state-warn size-1.75 rounded-full"
              />
              <span className="text-state-warn text-[15px] font-bold">
                {t('unfinishedTitle')}
              </span>
            </p>
            <p className="text-app-muted mt-1.5 text-[14px] leading-6 text-pretty">
              {t('unfinishedLine', {
                id: unfinished.id.slice(0, 8),
                line: line(unfinished, zone),
              })}
            </p>
          </div>
          <Button onClick={() => onOpen(unfinished.id)} variant="primary">
            {t('continuePreparing')}
          </Button>
        </div>
      )}

      <div className="mt-9 flex flex-wrap items-center justify-between gap-5">
        <div
          aria-label={t('importGroups')}
          className="border-app-line bg-app-raised flex max-w-full flex-wrap gap-1 rounded-[12px] border p-1"
          role="group"
        >
          {SEGMENTS.map((option) => {
            const on = option.key === segment
            const shown = imports.filter((row) => option.match(row)).length
            return (
              <button
                aria-pressed={on}
                className={cn(
                  'focus-visible:outline-brand inline-flex min-h-11 items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-bold whitespace-nowrap transition-colors',
                  on
                    ? 'text-app-ink bg-white/[0.08]'
                    : 'text-app-muted hover:text-app-ink',
                )}
                key={option.key}
                onClick={() => setSegment(option.key)}
                type="button"
              >
                {t(option.label)}{' '}
                <span
                  className={cn(
                    'font-mono text-[11px] font-medium',
                    on ? 'text-app-muted' : 'text-app-dim',
                  )}
                >
                  {shown}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-app-dim text-[13px]">
          {t('shownOnPage', {
            shown: count(rows.length),
            total: count(imports.length),
          })}
          {total > imports.length
            ? t('totalCount', { count: count(total) })
            : ''}
        </p>
      </div>

      <div className="mt-4.5">
        <DataTable
          caption={t('caption')}
          columns={[
            {
              key: 'id',
              label: t('number'),
              variant: 'primary',
              cell: (row) => (
                <span className="text-app-muted font-mono text-[14px]">
                  {row.id.slice(0, 8)}
                </span>
              ),
            },
            {
              key: 'when',
              label: t('dateAndState'),
              cell: (row) => (
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-app-ink truncate text-[15px] font-bold tracking-[-0.01em]">
                    {dayAndTime(row.createdAt, zone)}
                  </span>
                  <span className="text-app-muted truncate text-[13px]">
                    {line(row, zone)}
                  </span>
                </span>
              ),
            },
            {
              key: 'rows',
              label: t('rows'),
              align: 'end',
              cell: (row) => (
                <span className="font-mono text-[14px]">
                  {row.rowCount > 0 ? count(row.rowCount) : '—'}
                </span>
              ),
            },
            {
              key: 'created',
              label: t('created'),
              align: 'end',
              cell: () => (
                <span
                  className="text-app-dim font-mono text-[14px]"
                  title={noExecution}
                >
                  —
                </span>
              ),
            },
            {
              key: 'failed',
              label: t('errors'),
              align: 'end',
              cell: () => (
                <span
                  className="text-app-dim font-mono text-[14px]"
                  title={noExecution}
                >
                  —
                </span>
              ),
            },
            {
              key: 'status',
              label: t('status'),
              align: 'end',
              cell: (row) => (
                <StatusPill tone={TONES[row.status] ?? 'neutral'}>
                  {statusLabel(row.status, locale)}
                </StatusPill>
              ),
            },
            {
              key: 'action',
              label: t('action'),
              align: 'end',
              cell: (row) => (
                <Button onClick={() => onOpen(row.id)}>
                  {actionLabel(row, zone)}
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              description={
                imports.length === 0
                  ? t('emptyDescription')
                  : t('groupEmptyDescription')
              }
              title={
                imports.length === 0 ? t('emptyTitle') : t('groupEmptyTitle')
              }
            />
          }
          footer={
            <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
              <p className="text-app-dim text-[13px]">{t('retentionNote')}</p>
              <span className="flex items-center gap-2.5">
                <Button disabled={page === 1} onClick={() => onPage(page - 1)}>
                  {tc('back')}
                </Button>
                <span className="text-app-muted font-mono text-[13px] tabular-nums">
                  {page}
                </span>
                <Button
                  disabled={page * 50 >= total}
                  onClick={() => onPage(page + 1)}
                >
                  {t('showMore')}
                </Button>
              </span>
            </div>
          }
          rowKey={(row) => row.id}
          rows={rows}
        />
      </div>

      <p className="text-app-dim mt-3 text-[13px] leading-6">
        {t('blankColumnsNote')}
      </p>
    </div>
  )
}
