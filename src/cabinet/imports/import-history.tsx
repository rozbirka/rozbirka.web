import { useMemo, useState } from 'react'
import {
  Button,
  DataTable,
  EmptyState,
  Notice,
  StatusPill,
} from '@/components/app'
import { Kpi, KpiStrip } from '../redesign-kpi'
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
    <div className="grid min-w-0 gap-3">
      <KpiStrip>
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
          meta={noExecution}
          title={noExecution}
          tone="dim"
          value="—"
        />
        <Kpi
          label={t('rowsWithErrors')}
          meta={noExecution}
          title={noExecution}
          tone="dim"
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
      </KpiStrip>

      {unfinished === undefined ? null : (
        <Notice
          action={
            <Button onClick={() => onOpen(unfinished.id)}>
              {t('continuePreparing')}
            </Button>
          }
          block
          tone="warn"
        >
          <p className="text-app-strong m-0 font-semibold">
            {t('unfinishedTitle')}
          </p>
          <p className="text-app-muted m-0 mt-0.5 text-pretty">
            {t('unfinishedLine', {
              id: unfinished.id.slice(0, 8),
              line: line(unfinished, zone),
            })}
          </p>
        </Notice>
      )}

      <div className="rz-toolbar mt-2">
        <div
          aria-label={t('importGroups')}
          className="rz-seg max-w-full flex-wrap"
          role="group"
        >
          {SEGMENTS.map((option) => {
            const on = option.key === segment
            const shown = imports.filter((row) => option.match(row)).length
            return (
              <button
                aria-pressed={on}
                className="whitespace-nowrap"
                key={option.key}
                onClick={() => setSegment(option.key)}
                type="button"
              >
                {t(option.label)} <span className="rz-count">{shown}</span>
              </button>
            )
          })}
        </div>
        <p className="rz-toolbar__end text-app-dim m-0">
          {t('shownOnPage', {
            shown: count(rows.length),
            total: count(imports.length),
          })}
          {total > imports.length
            ? t('totalCount', { count: count(total) })
            : ''}
        </p>
      </div>

      <DataTable
        caption={t('caption')}
        columns={[
          {
            key: 'id',
            label: t('number'),
            variant: 'primary',
            cell: (row) => (
              <span className="text-app-muted font-mono">
                {row.id.slice(0, 8)}
              </span>
            ),
          },
          {
            key: 'when',
            label: t('dateAndState'),
            cell: (row) => (
              <span className="grid min-w-0 gap-0.5 py-1.5">
                <span className="text-app-strong truncate font-medium">
                  {dayAndTime(row.createdAt, zone)}
                </span>
                <span className="rz-caption truncate">{line(row, zone)}</span>
              </span>
            ),
          },
          {
            key: 'rows',
            label: t('rows'),
            align: 'end',
            cell: (row) => (row.rowCount > 0 ? count(row.rowCount) : '—'),
          },
          {
            key: 'created',
            label: t('created'),
            align: 'end',
            cell: () => (
              <span className="text-app-dim" title={noExecution}>
                —
              </span>
            ),
          },
          {
            key: 'failed',
            label: t('errors'),
            align: 'end',
            cell: () => (
              <span className="text-app-dim" title={noExecution}>
                —
              </span>
            ),
          },
          {
            key: 'status',
            label: t('status'),
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
              <Button onClick={() => onOpen(row.id)} size="sm">
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
          <div className="rz-pager">
            <p className="m-0">{t('retentionNote')}</p>
            <span className="rz-pager__nav">
              <Button
                disabled={page === 1}
                onClick={() => onPage(page - 1)}
                size="sm"
              >
                {tc('back')}
              </Button>
              <span className="text-app-muted font-mono tabular-nums">
                {page}
              </span>
              <Button
                disabled={page * 50 >= total}
                onClick={() => onPage(page + 1)}
                size="sm"
              >
                {t('showMore')}
              </Button>
            </span>
          </div>
        }
        rowKey={(row) => row.id}
        rows={rows}
      />

      <p className="rz-caption m-0">{t('blankColumnsNote')}</p>
    </div>
  )
}
