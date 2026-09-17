import { useMemo, useState } from 'react'
import { Button } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type { ImportRow, ImportValidation } from '@/api/part-imports'
import { fieldLabels, issueText } from './import-model'

const PAGE_SIZE = 100

const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')

const FILTERS = [
  { key: 'all', label: 'Усі' },
  { key: 'ready', label: 'Готові' },
  { key: 'issues', label: 'З проблемами' },
  { key: 'decision', label: 'Потребують рішення' },
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
          label="Майбутніх позицій"
          meta={
            rows.length - chosen.length === 0
              ? 'нічого не виключено'
              : `${count(rows.length - chosen.length)} ${plural(rows.length - chosen.length, ['рядок виключено', 'рядки виключено', 'рядків виключено'])}`
          }
          unit={`з ${count(rowTotal)}`}
          value={count(chosen.length)}
        />
        <Kpi
          label="Одиниць товару"
          meta="позиція може мати кілька одиниць"
          unit="шт"
          value={count(units)}
        />
        <Kpi
          label="Рядків з проблемами"
          meta={
            counts.decision === 0
              ? 'усі на цій сторінці'
              : `${count(counts.decision)} ${plural(counts.decision, ['потребує рішення', 'потребують рішення', 'потребують рішення'])}`
          }
          tone={counts.issues > 0 ? 'warn' : 'plain'}
          value={count(counts.issues)}
        />
        <Kpi
          label="Нових сутностей"
          meta={
            validation === null
              ? 'порахується на кроці підтвердження'
              : `${count(validation.plannedZones)} зон · ${count(validation.plannedIntakes)} надходжень`
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
              {count(chosenProblems.length)}{' '}
              {plural(chosenProblems.length, [
                'рядок потребує рішення',
                'рядки потребують рішення',
                'рядків потребують рішення',
              ])}
            </p>
            <p className="text-app-muted mt-1.5 text-[14px] leading-6 text-pretty">
              Виправте їх або виключіть із цього імпорту. Редагувати комірки тут
              не можна — змініть зіставлення колонок або сам файл.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => setFilter('issues')}>
              Показати проблемні
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
              Виключити всі {count(chosenProblems.length)}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          aria-label="Групи рядків"
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
                {option.label}{' '}
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
            {filter === 'all'
              ? 'Фільтр не застосований'
              : 'Фільтр застосований'}
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
              ? 'Зняти вибір'
              : `Вибрати всі ${count(rows.length)}`}
          </Button>
        </div>
      </div>

      <div className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <caption className="sr-only">Майбутні позиції імпорту</caption>
            <thead>
              <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                <th className="w-12 px-5.5 py-2.5 text-left">
                  <span className="sr-only">Вибір</span>
                </th>
                <th className="px-3 py-2.5 text-left">Рядок</th>
                <th className="px-3 py-2.5 text-left">Майбутня позиція</th>
                <th className="px-3 py-2.5 text-right">К-сть</th>
                <th className="px-3 py-2.5 text-right">Ціна</th>
                <th className="px-3 py-2.5 text-left">Стан рядка</th>
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
                        aria-label={`Імпортувати рядок ${String(row.sourceRow)}`}
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
                        {row.draft?.values['Name'] ?? 'Не зіставлено'}
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
                          Готово
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
                                {fieldLabels[issue.field] ?? issue.field}
                              </p>
                              <p className="text-app-muted mt-0.5 text-[12.5px] leading-5 text-pretty">
                                {issueText(issue.code)}
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
                                    ? 'Створюємо окремо'
                                    : 'Створити окремо'}
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
            Показано {count(visible.length)} з {count(rowTotal)} · по{' '}
            {count(PAGE_SIZE)} рядків на сторінку
          </p>
          <span className="flex items-center gap-2.5">
            <Button
              disabled={rowPage === 1}
              onClick={() => onRowPage(rowPage - 1)}
            >
              Назад
            </Button>
            <span className="text-app-muted font-mono text-[13px] tabular-nums">
              {rowPage}
            </span>
            <Button
              disabled={rowPage * PAGE_SIZE >= rowTotal}
              onClick={() => onRowPage(rowPage + 1)}
            >
              Далі
            </Button>
          </span>
        </div>
      </div>

      <div className="border-app-line bg-app-canvas/92 sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t px-4 py-3.5 backdrop-blur-[14px] sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
        <dl className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <dt className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
              Вибрано
            </dt>
            <dd className="text-app-ink mt-1 text-[16px] font-bold">
              {count(chosen.length)}{' '}
              {plural(chosen.length, ['позиція', 'позиції', 'позицій'])}
            </dd>
          </div>
          <div>
            <dt className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
              Одиниць товару
            </dt>
            <dd className="text-app-ink mt-1 font-mono text-[16px] font-medium">
              {count(units)}
            </dd>
          </div>
          <div>
            <dt className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
              Виключено
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
          До підтвердження
        </Button>
      </div>

      <p className="text-app-dim text-[13px] leading-6">
        Ці числа рахуються по завантаженій сторінці — сервер повертає рядки
        сторінками по {count(PAGE_SIZE)}. Повний підсумок дає крок
        підтвердження, і саме він іде на сервер.
      </p>
    </div>
  )
}
