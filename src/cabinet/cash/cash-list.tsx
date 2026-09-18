import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type { CashDailySummary, CashRegister } from '@/api/cash'
import {
  count,
  money,
  moment,
  movementText,
  registerTypeHints,
  registerTypeLabels,
  signedMoney,
} from './cash-labels'
import type { CashFeedEntry } from './cash-feed'
import { Kpi, KpiStrip } from '../redesign-kpi'

const SEGMENTS = [
  { key: 'all', label: 'Усі' },
  { key: 'cash', label: 'Готівкові' },
  { key: 'bank', label: 'Безготівкові' },
] as const

/**
 * Reconciling a till — counting the notes and recording the difference — is a
 * thing the API has no concept of, so the screen says that rather than leaving
 * a plausible-looking blank.
 */

/**
 * Гроші · Каси — the till list. Balances are shown per currency and never
 * summed: the server keeps each currency separately and converts nothing, and
 * the screen says so out loud rather than inventing a rate.
 */
export function CashList({
  registers,
  summary,
  feed,
  feedTruncated,
  date,
  canCreate,
  canTransfer,
  onTransfer,
}: {
  registers: readonly CashRegister[]
  summary: CashDailySummary | null
  /** Latest movements merged from each till; the API has no shared feed. */
  feed: readonly CashFeedEntry[]
  /** True when only part of the tills were asked for their latest movements. */
  feedTruncated: boolean
  date: string
  canCreate: boolean
  canTransfer: boolean
  onTransfer: () => void
}) {
  const [segment, setSegment] =
    useState<(typeof SEGMENTS)[number]['key']>('all')
  const [query, setQuery] = useState('')

  const counts = {
    all: registers.length,
    cash: registers.filter((one) => one.type === 'cash').length,
    bank: registers.filter((one) => one.type === 'bank').length,
  }
  const needle = query.trim().toLowerCase()
  const shown = registers
    .filter((one) => segment === 'all' || one.type === segment)
    .filter((one) => needle === '' || one.name.toLowerCase().includes(needle))

  const active = registers.filter((one) => one.isActive).length
  const closed = registers.length - active
  const operations = (summary?.registers ?? []).reduce(
    (sum, register) =>
      sum +
      register.currencies.reduce(
        (inner, currency) => inner + currency.operationCount,
        0,
      ),
    0,
  )
  const income = (summary?.registers ?? []).filter((register) =>
    register.currencies.some((currency) => currency.income > 0),
  ).length

  const dayOf = (id: string) =>
    summary?.registers.find((one) => one.id === id)?.currencies ?? []

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              Гроші · Каси
            </p>
            <h1 className="mt-1.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              Каси
            </h1>
            <p className="text-app-muted mt-2.5 max-w-[62ch] text-[14.5px] leading-6 text-pretty">
              Залишки по кожній касі окремо, без конвертації валют.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {canTransfer ? (
              <Button onClick={onTransfer}>Переказ між касами</Button>
            ) : null}
            {canCreate ? (
              <Button
                asChild
                className="px-5 text-sm font-bold"
                variant="primary"
              >
                <Link to="new">
                  <Plus aria-hidden />
                  Нова каса
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <KpiStrip>
          <Kpi
            label="Кас"
            meta={
              closed === 0
                ? `${count(active)} ${plural(active, ['активна', 'активні', 'активних'])}`
                : `${count(active)} ${plural(active, ['активна', 'активні', 'активних'])} · ${count(closed)} ${plural(closed, ['закрита', 'закриті', 'закритих'])}`
            }
            value={count(registers.length)}
          />
          <Kpi
            label="Операцій за день"
            meta={
              summary === null
                ? 'зріз за день ще не прийшов'
                : `${date} · ${count(income)} ${plural(income, ['каса з надходженням', 'каси з надходженнями', 'кас із надходженнями'])}`
            }
            value={count(operations)}
          />
        </KpiStrip>

        <div className="flex flex-wrap items-center gap-3">
          <div
            aria-label="Тип каси"
            className="border-app-line bg-app-raised flex min-w-0 flex-wrap gap-1 rounded-[14px] border p-1"
            role="group"
          >
            {SEGMENTS.map((one) => (
              <button
                aria-pressed={segment === one.key}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-bold whitespace-nowrap',
                  segment === one.key
                    ? 'text-app-ink bg-white/[0.08]'
                    : 'text-app-muted hover:text-app-ink',
                )}
                key={one.key}
                onClick={() => setSegment(one.key)}
                type="button"
              >
                {one.label}
                <span className="text-app-dim font-mono text-[12px]">
                  {count(counts[one.key])}
                </span>
              </button>
            ))}
          </div>
          <span className="border-app-line bg-app-raised focus-within:border-app-line-2 flex h-13 min-w-0 flex-[1_1_240px] items-center gap-3 rounded-[14px] border px-4">
            <Search aria-hidden className="text-app-dim size-4 shrink-0" />
            <input
              aria-label="Пошук кас"
              className="text-app-ink placeholder:text-app-dim min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Назва каси"
              value={query}
            />
          </span>
        </div>

        <p className="text-app-dim text-[13px]">
          Показано {count(shown.length)} з {count(registers.length)}{' '}
          {plural(registers.length, ['каси', 'кас', 'кас'])}
        </p>

        {shown.length === 0 ? (
          <p className="border-app-line bg-app-raised text-app-muted rounded-[20px] border px-6 py-10 text-center text-[14.5px]">
            Кас за цим фільтром немає.
          </p>
        ) : (
          <ul className="grid gap-3.5">
            {shown.map((register) => {
              const currencies = Object.entries(register.balances)
              const today = dayOf(register.id)
              const operationCount = today.reduce(
                (sum, one) => sum + one.operationCount,
                0,
              )
              return (
                <li key={register.id}>
                  <Link
                    className="border-app-line bg-app-raised hover:border-app-line-2 flex flex-wrap items-start gap-x-8 gap-y-5 rounded-[20px] border px-5.5 py-5 transition-colors"
                    to={register.id}
                  >
                    <div className="min-w-0 flex-[1_1_260px]">
                      <p className="flex flex-wrap items-center gap-2.5">
                        <span className="text-app-ink text-[17px] font-bold">
                          {register.name}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-bold',
                            register.isActive
                              ? 'border-state-ok/28 text-state-ok bg-state-ok/10'
                              : 'border-app-line text-app-dim',
                          )}
                        >
                          {register.isActive ? 'Активна' : 'Неактивна'}
                        </span>
                      </p>
                      <p className="text-app-muted mt-1.5 text-[13.5px]">
                        {registerTypeLabels[register.type] ?? register.type}
                        {registerTypeHints[register.type]
                          ? ` · ${registerTypeHints[register.type]}`
                          : ''}
                      </p>
                    </div>

                    <dl className="grid min-w-0 flex-[1_1_220px] gap-1.5">
                      {currencies.length === 0 ? (
                        <p className="text-app-dim text-[13.5px]">
                          Валют ще немає
                        </p>
                      ) : (
                        currencies.map(([currency, balance]) => (
                          <div className="flex justify-end" key={currency}>
                            <dt className="sr-only">{currency}</dt>
                            <dd
                              className={cn(
                                'font-mono text-[15px] tabular-nums',
                                balance === 0
                                  ? 'text-app-dim'
                                  : 'text-app-ink font-medium',
                              )}
                            >
                              {money(balance, currency)}
                            </dd>
                          </div>
                        ))
                      )}
                    </dl>

                    <div className="min-w-0 flex-[1_1_180px]">
                      <p className="text-app-muted text-[13.5px]">
                        {summary === null
                          ? 'Операції за день ще рахуються'
                          : `${count(operationCount)} ${plural(operationCount, ['операція', 'операції', 'операцій'])} за ${date}`}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <section
          aria-label="Останні операції"
          className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
        >
          <h2 className="text-app-ink border-app-line border-b px-5.5 py-4 text-[15px] font-bold">
            Останні операції
          </h2>
          {feed.length === 0 ? (
            <p className="text-app-muted px-5.5 py-6 text-[14px]">
              Операцій ще немає.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">
                  Останні операції по всіх касах
                </caption>
                <thead>
                  <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                    <th className="px-5.5 py-2.5 text-left">Дата</th>
                    <th className="px-3 py-2.5 text-left">Призначення</th>
                    <th className="px-3 py-2.5 text-left">Каса</th>
                    <th className="px-3 py-2.5 text-right">Сума</th>
                    <th className="px-3 py-2.5 text-left">Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {feed.map((entry) => (
                    <tr className="border-app-line border-b" key={entry.id}>
                      <td className="text-app-dim px-5.5 py-3.5 font-mono text-[13px] whitespace-nowrap">
                        {moment(entry.createdAt)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-app-ink font-medium">
                          {entry.note ?? movementText(entry.type)}
                        </span>
                        <span className="text-app-dim mt-0.5 block text-[12.5px]">
                          {entry.createdByName}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <Link
                          className="text-app-muted hover:text-brand underline-offset-4 hover:underline"
                          to={entry.registerId}
                        >
                          {entry.registerName}
                        </Link>
                      </td>
                      <td
                        className={cn(
                          'px-3 py-3.5 text-right font-mono tabular-nums',
                          entry.direction === 'out'
                            ? 'text-app-ink'
                            : 'text-state-ok',
                        )}
                      >
                        {signedMoney(entry)}
                      </td>
                      <td className="text-app-muted px-3 py-3.5">
                        {movementText(entry.type)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-app-dim border-app-line border-t px-5.5 py-3.5 text-[13px] leading-5 text-pretty">
            Останні операції з кас. Повний журнал доступний на картці каси
            {feedTruncated ? ' для показаних вище кас' : ''}.
          </p>
        </section>
      </div>
    </div>
  )
}
