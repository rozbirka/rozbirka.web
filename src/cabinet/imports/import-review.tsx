import { useMemo, useState } from 'react'
import { Button, Notice, StatusPill } from '@/components/app'
import { cn } from '@/lib/utils'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { commonMessages, useLocale, useT } from '@/i18n'
import type { ImportRow, ImportValidation } from '@/api/part-imports'
import { fieldLabel, issueText } from './import-model'
import { importReviewMessages } from './import-review-messages'
import { useCount, useImportT } from './use-import-text'

const PAGE_SIZE = 100

const FILTERS = [
  { key: 'all', label: 'filterAll' },
  { key: 'ready', label: 'filterReady' },
  { key: 'issues', label: 'filterIssues' },
  { key: 'decision', label: 'filterDecision' },
] as const

/** A blocking issue stops the row; a warning only colours it. */
const blocking = (row: ImportRow, decided: boolean) =>
  (row.draft?.issues ?? []).filter(
    (issue) =>
      issue.severity !== 'Warning' &&
      !(issue.code === 'DUPLICATE_DECISION_REQUIRED' && decided),
  )

const needsDecision = (row: ImportRow) =>
  (row.draft?.issues ?? []).some((issue) => issue.severity === 'NeedsDecision')

/**
 * Крок 3 — every row the import is about to create, and the ones it cannot.
 * Cells are not editable here on purpose: a value is wrong because the mapping
 * or the file is wrong, and fixing it in place would hide that.
 */
export function ImportReviewStep({
  rows,
  rowTotal,
  rowPage,
  onRowPage,
  selected,
  onSelected,
  decisions,
  onDecision,
  validation,
  onContinue,
  busy,
  editable,
}: {
  rows: readonly ImportRow[]
  rowTotal: number
  rowPage: number
  onRowPage: (page: number) => void
  selected: readonly string[]
  onSelected: (next: string[]) => void
  decisions: Readonly<Record<string, string>>
  onDecision: (rowId: string, decision: string) => void
  validation: ImportValidation | null
  onContinue: () => void
  busy: boolean
  editable: boolean
}) {
  const { locale } = useLocale()
  const t = useImportT(importReviewMessages)
  const tc = useT(commonMessages)
  const count = useCount()
  const [filter, setFilter] = useState<string>('all')
  const picked = useMemo(() => new Set(selected), [selected])

  const counts = {
    all: rows.length,
    ready: rows.filter(
      (row) => blocking(row, decisions[row.rowId] !== undefined).length === 0,
    ).length,
    issues: rows.filter((row) => (row.draft?.issues ?? []).length > 0).length,
    decision: rows.filter(needsDecision).length,
  }

  const visible = rows.filter((row) => {
    const decided = decisions[row.rowId] !== undefined
    if (filter === 'ready') return blocking(row, decided).length === 0
    if (filter === 'issues') return (row.draft?.issues ?? []).length > 0
    if (filter === 'decision') return needsDecision(row)
    return true
  })

  const chosen = rows.filter((row) => picked.has(row.rowId))
  const chosenProblems = chosen.filter(
    (row) => blocking(row, decisions[row.rowId] !== undefined).length > 0,
  )
  const units = chosen.reduce((sum, row) => {
    const quantity = Number(row.draft?.values['Quantity'] ?? '')
    return sum + (Number.isFinite(quantity) ? quantity : 0)
  }, 0)

  const toggle = (rowId: string, on: boolean) =>
    onSelected(
      on ? [...selected, rowId] : selected.filter((id) => id !== rowId),
    )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <KpiStrip>
        <Kpi
          label={t('futureItems')}
          meta={
            rows.length - chosen.length === 0
              ? t('nothingExcluded')
              : t('rowsExcluded', { count: rows.length - chosen.length })
          }
          unit={t('ofTotal', { count: count(rowTotal) })}
          value={count(chosen.length)}
        />
        <Kpi
          label={t('units')}
          meta={t('unitsMeta')}
          unit={t('pieces')}
          value={count(units)}
        />
        <Kpi
          label={t('rowsWithIssues')}
          meta={
            counts.decision === 0
              ? t('allOnThisPage')
              : t('needDecision', { count: counts.decision })
          }
          tone={counts.issues > 0 ? 'warn' : 'plain'}
          value={count(counts.issues)}
        />
        <Kpi
          label={t('newEntities')}
          meta={
            validation === null
              ? t('countedOnConfirm')
              : t('zonesAndIntakes', {
                  zones: count(validation.plannedZones),
                  intakes: count(validation.plannedIntakes),
                })
          }
          {...(validation === null ? { tone: 'dim' as const } : {})}
          value={
            validation === null
              ? '—'
              : count(
                  validation.plannedZones +
                    validation.plannedIntakes +
                    validation.plannedCars +
                    validation.plannedCustomers +
                    validation.plannedWarehouses,
                )
          }
        />
      </KpiStrip>

      {chosenProblems.length === 0 ? null : (
        <Notice
          action={
            <div className="rz-btn-row">
              <Button onClick={() => setFilter('issues')}>
                {t('showProblems')}
              </Button>
              <Button
                disabled={!editable}
                onClick={() =>
                  onSelected(
                    selected.filter(
                      (id) => !chosenProblems.some((row) => row.rowId === id),
                    ),
                  )
                }
              >
                {t('excludeAll', { count: count(chosenProblems.length) })}
              </Button>
            </div>
          }
          block
          tone="warn"
        >
          <p className="text-app-strong m-0 font-semibold">
            {t('rowsNeedDecision', { count: chosenProblems.length })}
          </p>
          <p className="text-app-muted m-0 mt-0.5 text-pretty">
            {t('fixOrExclude')}
          </p>
        </Notice>
      )}

      <div className="rz-toolbar">
        <div
          aria-label={t('rowGroups')}
          className="rz-seg max-w-full flex-wrap"
          role="group"
        >
          {FILTERS.map((option) => {
            const on = option.key === filter
            return (
              <button
                aria-pressed={on}
                className="whitespace-nowrap"
                key={option.key}
                onClick={() => setFilter(option.key)}
                type="button"
              >
                {t(option.label)}{' '}
                <span className="rz-count">{counts[option.key]}</span>
              </button>
            )
          })}
        </div>
        <div className="rz-toolbar__end flex-wrap items-center gap-3">
          <span className="text-app-dim">
            {filter === 'all' ? t('filterOff') : t('filterOn')}
          </span>
          <Button
            disabled={!editable}
            onClick={() =>
              onSelected(
                chosen.length === rows.length
                  ? []
                  : [
                      ...new Set([
                        ...selected,
                        ...rows.map((row) => row.rowId),
                      ]),
                    ],
              )
            }
          >
            {chosen.length === rows.length
              ? t('clearSelection')
              : t('selectAll', { count: count(rows.length) })}
          </Button>
        </div>
      </div>

      <div className="rz-table-wrap">
        <div className="rz-table-scroll">
          <table className="rz-table">
            <caption>{t('tableCaption')}</caption>
            <thead>
              <tr>
                <th className="rz-col-check" scope="col">
                  <span className="sr-only">{t('choice')}</span>
                </th>
                <th scope="col">{t('row')}</th>
                <th scope="col">{t('futureItem')}</th>
                <th className="rz-num" scope="col">
                  {t('quantity')}
                </th>
                <th className="rz-num" scope="col">
                  {t('price')}
                </th>
                <th scope="col">{t('rowState')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const on = picked.has(row.rowId)
                const decided = decisions[row.rowId] !== undefined
                const issues = row.draft?.issues ?? []
                const stops = blocking(row, decided)
                return (
                  <tr
                    {...(on ? { 'aria-selected': true } : {})}
                    className={cn(
                      on && stops.length > 0 && 'bg-state-warn-soft',
                    )}
                    key={row.rowId}
                  >
                    <td className="rz-col-check">
                      <input
                        aria-label={t('importRow', {
                          row: String(row.sourceRow),
                        })}
                        checked={on}
                        className="rz-check align-middle"
                        disabled={!editable}
                        onChange={(event) =>
                          toggle(row.rowId, event.target.checked)
                        }
                        type="checkbox"
                      />
                    </td>
                    <th className="text-app-dim font-mono" scope="row">
                      {row.sourceRow}
                    </th>
                    <td className="py-2">
                      <span
                        className={cn(
                          'block font-medium',
                          on ? 'text-app-strong' : 'text-app-dim',
                        )}
                      >
                        {row.draft?.values['Name'] ?? t('notMapped')}
                      </span>
                      <span className="rz-caption mt-0.5 block font-mono">
                        {[
                          row.draft?.values['ExternalCode'],
                          row.draft?.values['OemCode'] == null
                            ? null
                            : `OEM ${row.draft.values['OemCode']}`,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </span>
                    </td>
                    <td
                      className={cn(
                        'rz-num',
                        row.draft?.values['Quantity'] == null &&
                          'text-state-danger',
                      )}
                    >
                      {row.draft?.values['Quantity'] ?? '—'}
                    </td>
                    <td
                      className={cn(
                        'rz-num',
                        row.draft?.values['DesiredSalePrice'] == null &&
                          'text-state-danger',
                      )}
                    >
                      {row.draft?.values['DesiredSalePrice'] ?? '—'}
                    </td>
                    <td className="py-2">
                      {issues.length === 0 ? (
                        <StatusPill tone="ok">{t('ready')}</StatusPill>
                      ) : (
                        <ul className="m-0 grid list-none gap-2 p-0">
                          {issues.map((issue, index) => (
                            <li key={`${issue.code}-${String(index)}`}>
                              <p
                                className={cn(
                                  'm-0 font-semibold',
                                  issue.severity === 'Warning'
                                    ? 'text-state-warn'
                                    : 'text-state-danger',
                                )}
                              >
                                {fieldLabel(issue.field, locale)}
                              </p>
                              <p className="text-app-muted m-0 mt-0.5 text-caption text-pretty">
                                {issueText(issue.code, locale)}
                              </p>
                              {issue.code === 'DUPLICATE_DECISION_REQUIRED' ? (
                                <Button
                                  className="mt-1.5"
                                  disabled={decided || !editable}
                                  onClick={() =>
                                    onDecision(row.rowId, 'create-separately')
                                  }
                                  size="sm"
                                >
                                  {decided
                                    ? t('creatingSeparately')
                                    : t('createSeparately')}
                                </Button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="rz-pager">
          <p className="m-0">
            {t('shown', {
              shown: count(visible.length),
              total: count(rowTotal),
              size: count(PAGE_SIZE),
            })}
          </p>
          <span className="rz-pager__nav">
            <Button
              disabled={rowPage === 1}
              onClick={() => onRowPage(rowPage - 1)}
              size="sm"
            >
              {tc('back')}
            </Button>
            <span className="text-app-muted font-mono tabular-nums">
              {rowPage}
            </span>
            <Button
              disabled={rowPage * PAGE_SIZE >= rowTotal}
              onClick={() => onRowPage(rowPage + 1)}
              size="sm"
            >
              {tc('next')}
            </Button>
          </span>
        </div>
      </div>

      <div className="rz-card sticky bottom-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-(--rz-card-p) py-2.5">
          <dl className="rz-totals items-baseline">
            <div className="flex items-baseline gap-1.5">
              <dt>{t('selected')}</dt>
              <dd className="text-app-strong">
                {t('items', { count: chosen.length })}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt>{t('units')}</dt>
              <dd className="text-app-strong">{count(units)}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt>{t('excluded')}</dt>
              <dd>{count(rows.length - chosen.length)}</dd>
            </div>
          </dl>
          <Button
            disabled={busy || !editable || chosen.length === 0}
            onClick={onContinue}
            size="lg"
            variant="primary"
          >
            {t('toConfirmation')}
          </Button>
        </div>
      </div>

      <p className="rz-caption m-0">
        {t('pageNote', { size: count(PAGE_SIZE) })}
      </p>
    </div>
  )
}
