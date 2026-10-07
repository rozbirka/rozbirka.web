import { useMemo, useState } from 'react'
import { Button } from '@/components/app'
import { cn } from '@/lib/utils'
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

function Kpi({
  label,
  value,
  unit,
  meta,
  tone,
}: {
  label: string
  value: string
  unit?: string
  meta: string
  tone?: 'plain' | 'warn'
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
            tone === 'warn' ? 'text-state-warn' : 'text-app-ink',
          )}
        >
          {value}
        </span>
        {unit === undefined ? null : (
          <span className="text-app-muted font-mono text-[13px] font-medium">
            {unit}
          </span>
        )}
      </p>
      <p className="text-app-dim mt-3.5 text-[13px]">{meta}</p>
    </div>
  )
}

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
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-px overflow-hidden rounded-[20px] border">
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
      </div>

      {chosenProblems.length === 0 ? null : (
        <div
          className="border-state-warn/25 bg-state-warn-soft flex flex-wrap items-center gap-4 rounded-[18px] border px-5.5 py-4.5"
          role="status"
        >
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="text-state-warn text-[15px] font-bold">
              {t('rowsNeedDecision', { count: chosenProblems.length })}
            </p>
            <p className="text-app-muted mt-1.5 text-[14px] leading-6 text-pretty">
              {t('fixOrExclude')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
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
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          aria-label={t('rowGroups')}
          className="border-app-line bg-app-raised flex max-w-full flex-wrap gap-1 rounded-[12px] border p-1"
          role="group"
        >
          {FILTERS.map((option) => {
            const on = option.key === filter
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
                onClick={() => setFilter(option.key)}
                type="button"
              >
                {t(option.label)}{' '}
                <span
                  className={cn(
                    'font-mono text-[11px] font-medium',
                    on ? 'text-app-muted' : 'text-app-dim',
                  )}
                >
                  {counts[option.key]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-app-dim text-[13px]">
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

      <div className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <caption className="sr-only">{t('tableCaption')}</caption>
            <thead>
              <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                <th className="w-12 px-5.5 py-2.5 text-left">
                  <span className="sr-only">{t('choice')}</span>
                </th>
                <th className="px-3 py-2.5 text-left">{t('row')}</th>
                <th className="px-3 py-2.5 text-left">{t('futureItem')}</th>
                <th className="px-3 py-2.5 text-right">{t('quantity')}</th>
                <th className="px-3 py-2.5 text-right">{t('price')}</th>
                <th className="px-3 py-2.5 text-left">{t('rowState')}</th>
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
                    className={cn(
                      'border-app-line border-b',
                      !on && 'bg-white/[0.015]',
                      on && stops.length > 0 && 'bg-state-warn/[0.04]',
                    )}
                    key={row.rowId}
                  >
                    <td className="px-5.5 py-3.5">
                      <input
                        aria-label={t('importRow', {
                          row: String(row.sourceRow),
                        })}
                        checked={on}
                        className="accent-brand size-4.5"
                        disabled={!editable}
                        onChange={(event) =>
                          toggle(row.rowId, event.target.checked)
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="text-app-dim px-3 py-3.5 font-mono text-[13px]">
                      {row.sourceRow}
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          'block text-[14.5px] font-bold',
                          on ? 'text-app-ink' : 'text-app-dim',
                        )}
                      >
                        {row.draft?.values['Name'] ?? t('notMapped')}
                      </span>
                      <span className="text-app-muted mt-0.5 block font-mono text-[12.5px]">
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
                        'px-3 py-3.5 text-right font-mono text-[13px]',
                        row.draft?.values['Quantity'] == null
                          ? 'text-state-danger'
                          : 'text-app-muted',
                      )}
                    >
                      {row.draft?.values['Quantity'] ?? '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-3.5 text-right font-mono text-[13px]',
                        row.draft?.values['DesiredSalePrice'] == null
                          ? 'text-state-danger'
                          : 'text-app-muted',
                      )}
                    >
                      {row.draft?.values['DesiredSalePrice'] ?? '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      {issues.length === 0 ? (
                        <span className="border-state-ok/35 bg-state-ok-soft text-state-ok inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap">
                          <span
                            aria-hidden
                            className="size-1.5 rounded-full bg-current"
                          />
                          {t('ready')}
                        </span>
                      ) : (
                        <ul className="grid gap-2">
                          {issues.map((issue, index) => (
                            <li key={`${issue.code}-${String(index)}`}>
                              <p
                                className={cn(
                                  'text-[13px] font-bold',
                                  issue.severity === 'Warning'
                                    ? 'text-state-warn'
                                    : 'text-state-danger',
                                )}
                              >
                                {fieldLabel(issue.field, locale)}
                              </p>
                              <p className="text-app-muted mt-0.5 text-[12.5px] leading-5 text-pretty">
                                {issueText(issue.code, locale)}
                              </p>
                              {issue.code === 'DUPLICATE_DECISION_REQUIRED' ? (
                                <Button
                                  className="mt-1.5"
                                  disabled={decided || !editable}
                                  onClick={() =>
                                    onDecision(row.rowId, 'create-separately')
                                  }
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
        <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-5.5 py-4">
          <p className="text-app-dim text-[13px]">
            {t('shown', {
              shown: count(visible.length),
              total: count(rowTotal),
              size: count(PAGE_SIZE),
            })}
          </p>
          <span className="flex items-center gap-2.5">
            <Button
              disabled={rowPage === 1}
              onClick={() => onRowPage(rowPage - 1)}
            >
              {tc('back')}
            </Button>
            <span className="text-app-muted font-mono text-[13px] tabular-nums">
              {rowPage}
            </span>
            <Button
              disabled={rowPage * PAGE_SIZE >= rowTotal}
              onClick={() => onRowPage(rowPage + 1)}
            >
              {tc('next')}
            </Button>
          </span>
        </div>
      </div>

      <div className="border-app-line bg-app-canvas/92 sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t px-4 py-3.5 backdrop-blur-[14px] sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
        <dl className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <dt className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
              {t('selected')}
            </dt>
            <dd className="text-app-ink mt-1 text-[16px] font-bold">
              {t('items', { count: chosen.length })}
            </dd>
          </div>
          <div>
            <dt className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
              {t('units')}
            </dt>
            <dd className="text-app-ink mt-1 font-mono text-[16px] font-medium">
              {count(units)}
            </dd>
          </div>
          <div>
            <dt className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
              {t('excluded')}
            </dt>
            <dd className="text-app-muted mt-1 font-mono text-[16px] font-medium">
              {count(rows.length - chosen.length)}
            </dd>
          </div>
        </dl>
        <Button
          className="h-11.5 px-6 text-[15px] font-bold"
          disabled={busy || !editable || chosen.length === 0}
          onClick={onContinue}
          variant="primary"
        >
          {t('toConfirmation')}
        </Button>
      </div>

      <p className="text-app-dim text-[13px] leading-6">
        {t('pageNote', { size: count(PAGE_SIZE) })}
      </p>
    </div>
  )
}
