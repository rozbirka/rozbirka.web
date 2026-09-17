import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn, plural } from '@/lib/utils'
import type {
  CashDailySummary,
  CashRegister,
  CashTransaction,
} from '@/api/cash'
import {
  count,
  money,
  moment,
  movementText,
  registerTypeHints,
  registerTypeLabels,
  signedMoney,
} from './cash-labels'
import { Kpi, KpiStrip } from './cash-kpi'

/**
 * Everything the till card wants to show and the server does not keep. Each
 * string is what the reader gets on hover of the dash that stands in its place.
 */
const NO_RECONCILIATION =
  'Звіряння залишку сервер не веде: ні дати перерахунку, ні розбіжності, ні періодичності у відповіді немає.'
const NO_OWNER =
  'Відповідального за касу сервер не зберігає — каса належить розбірці, а не людині.'
const NO_WAREHOUSE = 'Звʼязку каси зі складом у відповіді сервера немає.'
const NO_CREATED = 'Дату створення каси сервер не повертає.'
const NO_RUNNING_BALANCE =
  'Залишок після кожної операції рахує сервер і в журналі його не повертає. Рахувати його в браузері не можна: сторінка журналу — не вся історія.'
const NO_TYPE_FILTER =
  'Сервер не фільтрує журнал за типом операції — сегменти впорядковують те, що вже завантажено на цій сторінці.'
const NO_ACCESS_LIST =
  'Списку доступу на касі немає: право працювати з грошима дає роль у бізнесі, одразу на всі каси.'

const SEGMENTS = [
  { key: 'all', label: 'Усі' },
  { key: 'in', label: 'Надходження' },
  { key: 'out', label: 'Витрата' },
  { key: 'transfer', label: 'Переказ' },
] as const

type SegmentKey = (typeof SEGMENTS)[number]['key']

const segmentOf = (entry: CashTransaction): SegmentKey =>
  entry.type.startsWith('transfer')
    ? 'transfer'
    : entry.direction === 'out'
      ? 'out'
      : 'in'

const Dash = ({ title }: { title: string }) => (
  <span className="text-app-dim" title={title}>
    —
  </span>
)

function Card({
  title,
  children,
  note,
}: {
  title: string
  children: ReactNode
  note?: ReactNode
}) {
  return (
    <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
      <h2 className="text-app-ink text-[15px] font-bold">{title}</h2>
      <div className="mt-3.5">{children}</div>
      {note === undefined ? null : (
        <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
          {note}
        </p>
      )}
    </section>
  )
}

/** A stack of per-currency money lines — currencies are never added up. */
function MoneyLines({
  lines,
  empty,
}: {
  lines: readonly { currency: string; amount: number; sign?: '+' | '−' }[]
  empty: string
}) {
  if (lines.length === 0)
    return <p className="text-app-dim text-[13.5px]">{empty}</p>
  return (
    <dl className="grid gap-1.5">
      {lines.map((line) => (
        <div
          className="flex items-baseline justify-between gap-4"
          key={line.currency}
        >
          <dt className="text-app-muted font-mono text-[12px] tracking-[0.1em]">
            {line.currency}
          </dt>
          <dd
            className={cn(
              'font-mono text-[15px] tabular-nums',
              line.amount === 0
                ? 'text-app-dim'
                : line.sign === '+'
                  ? 'text-state-ok'
                  : 'text-app-ink font-medium',
            )}
          >
            {line.sign === undefined || line.amount === 0 ? '' : line.sign}
            {money(line.amount, line.currency)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Гроші · Каси · картка каси. The ledger, the balances and the day figures all
 * come from the server as they are; everything the server does not keep —
 * reconciliation, an owner, a warehouse, a running balance — stands as a dash
 * that says why on hover.
 */
export function CashCard({
  register,
  ledger,
  ledgerTotal,
  totalOperations,
  lastOperationAt,
  daySummary,
  date,
  canManage,
  error,
  filters,
  pagination,
  children,
}: {
  register: CashRegister
  /** One page of the ledger, exactly as the server returned it. */
  ledger: readonly CashTransaction[]
  /** Total rows behind the current filter, per the server. */
  ledgerTotal: number
  totalOperations: number | null
  lastOperationAt: string | null
  daySummary: CashDailySummary['registers'][number] | null
  date: string
  canManage: boolean
  /** A failure banner, shown inside the shell so it keeps the page rhythm. */
  error: string | null
  filters: ReactNode
  pagination: ReactNode
  /** The movement and transfer forms, rendered under the card. */
  children: ReactNode
}) {
  const [segment, setSegment] = useState<SegmentKey>('all')
  const currencies = Object.entries(register.balances)
  const dayCurrencies = daySummary?.currencies ?? []
  const counts = {
    all: ledger.length,
    in: ledger.filter((one) => segmentOf(one) === 'in').length,
    out: ledger.filter((one) => segmentOf(one) === 'out').length,
    transfer: ledger.filter((one) => segmentOf(one) === 'transfer').length,
  }
  const shown = ledger.filter(
    (one) => segment === 'all' || segmentOf(one) === segment,
  )

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              <Link className="hover:text-app-muted" to="..">
                Гроші · Каси
              </Link>
              <span aria-hidden> · </span>
              <span className="text-app-muted">{register.name}</span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <h1 className="text-[34px] leading-[1.04] font-extrabold tracking-[-0.03em] text-white sm:text-[42px]">
                {register.name}
              </h1>
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
            </div>
            <p className="text-app-muted mt-2 text-[14px]">
              {registerTypeLabels[register.type] ?? register.type}
              {registerTypeHints[register.type]
                ? ` · ${registerTypeHints[register.type]}`
                : ''}
              <span aria-hidden> · </span>
              <span className="text-app-dim" title={NO_OWNER}>
                відповідального сервер не зберігає
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="border-app-line text-app-dim inline-flex min-h-11 cursor-not-allowed items-center rounded-[12px] border px-4 text-[13.5px] font-bold"
              disabled
              title={NO_RECONCILIATION}
              type="button"
            >
              Звірити залишок
            </button>
            {canManage ? (
              <Link
                className="border-app-line bg-app-raised text-app-ink hover:border-app-line-2 inline-flex min-h-11 items-center rounded-[12px] border px-4 text-[13.5px] font-bold"
                to="edit"
              >
                Редагувати
              </Link>
            ) : null}
            {canManage ? (
              <a
                className="bg-brand text-brand-foreground hover:bg-brand-hover inline-flex min-h-11 items-center rounded-[12px] px-5 text-[13.5px] font-bold"
                href="#cash-operations"
              >
                Нова операція
              </a>
            ) : null}
          </div>
        </div>

        {error === null ? null : (
          <p
            className="border-state-danger/35 bg-state-danger/10 text-state-danger rounded-[16px] border px-4 py-3 text-[13.5px]"
            role="alert"
          >
            {error}
          </p>
        )}

        <KpiStrip>
          <Kpi
            label="Надходження за день"
            meta={
              daySummary === null
                ? 'зріз за день ще не прийшов'
                : `${date} · сервер зводить рух лише за добу`
            }
            value={
              <MoneyLines
                empty="—"
                lines={dayCurrencies.map((one) => ({
                  currency: one.currency,
                  amount: one.income,
                  sign: '+',
                }))}
              />
            }
          />
          <Kpi
            label="Витрати за день"
            meta={
              daySummary === null
                ? 'зріз за день ще не прийшов'
                : `${date} · кожна валюта окремо`
            }
            value={
              <MoneyLines
                empty="—"
                lines={dayCurrencies.map((one) => ({
                  currency: one.currency,
                  amount: one.expense,
                  sign: '−',
                }))}
              />
            }
          />
          <Kpi
            label="Операцій усього"
            meta={
              lastOperationAt === null
                ? 'журнал порожній'
                : `остання ${moment(lastOperationAt)}`
            }
            value={totalOperations === null ? '—' : count(totalOperations)}
          />
        </KpiStrip>

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section
            aria-label="Операції"
            className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
          >
            <div className="border-app-line flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-5 py-4">
              <h2 className="text-app-ink text-[15px] font-bold">Операції</h2>
              <div
                aria-label="Тип операції на цій сторінці"
                className="flex min-w-0 flex-wrap gap-1"
                role="group"
                title={NO_TYPE_FILTER}
              >
                {SEGMENTS.map((one) => (
                  <button
                    aria-pressed={segment === one.key}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-[13px] font-bold whitespace-nowrap',
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
            </div>
            <div className="border-app-line border-b px-5 py-3.5">
              {filters}
            </div>
            {shown.length === 0 ? (
              <p className="text-app-muted px-5 py-8 text-[14px]">
                {ledger.length === 0
                  ? 'Операцій ще немає — журнал заповнюється після першого надходження чи витрати.'
                  : 'Операцій за цим фільтром на цій сторінці немає.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <caption className="sr-only">
                    Журнал операцій каси «{register.name}»
                  </caption>
                  <thead>
                    <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                      <th className="px-5 py-2.5 text-left">Дата</th>
                      <th className="px-3 py-2.5 text-left">Призначення</th>
                      <th className="px-3 py-2.5 text-right">Сума</th>
                      <th
                        className="px-5 py-2.5 text-right"
                        title={NO_RUNNING_BALANCE}
                      >
                        Залишок
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((entry) => (
                      <tr className="border-app-line border-b" key={entry.id}>
                        <td className="text-app-dim px-5 py-3.5 font-mono text-[13px] whitespace-nowrap">
                          {moment(entry.createdAt)}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-app-ink font-medium">
                            {entry.note ?? movementText(entry.type)}
                          </span>
                          <span className="text-app-dim mt-0.5 block text-[12.5px]">
                            {movementText(entry.type)} · {entry.createdByName}
                          </span>
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
                        <td className="px-5 py-3.5 text-right font-mono">
                          <Dash title={NO_RUNNING_BALANCE} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-app-line grid gap-3 border-t px-5 py-3.5">
              <p className="text-app-dim text-[13px] leading-5 text-pretty">
                Показано {count(shown.length)} з {count(ledger.length)} на цій
                сторінці, усього за фільтром — {count(ledgerTotal)}{' '}
                {plural(ledgerTotal, ['операція', 'операції', 'операцій'])}.
                Стовпець «Залишок» порожній: сервер рахує баланс сам і в журналі
                його не повертає.
              </p>
              {pagination}
            </div>
          </section>

          <div className="grid min-w-0 content-start gap-5">
            <Card title="Останнє звіряння">
              <p className="text-[24px] leading-none font-extrabold">
                <Dash title={NO_RECONCILIATION} />
              </p>
              <p className="text-app-dim mt-3 text-[13px] leading-5 text-pretty">
                Ні дати перерахунку, ні розбіжності сервер не зберігає, тож
                показати тут нічого.
              </p>
            </Card>
            <Card
              note="Валюти зберігаються окремо, конвертація не застосовується."
              title="Залишки"
            >
              <MoneyLines
                empty="Валют ще немає — додайте першу в редагуванні каси."
                lines={currencies.map(([currency, amount]) => ({
                  currency,
                  amount,
                }))}
              />
            </Card>

            <Card title="Налаштування">
              <dl className="grid gap-2.5 text-[13.5px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Тип</dt>
                  <dd className="text-app-ink text-right font-medium">
                    {registerTypeLabels[register.type] ?? register.type}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Валюти</dt>
                  <dd className="text-app-ink text-right font-mono font-medium">
                    {currencies.length === 0
                      ? '—'
                      : currencies.map(([code]) => code).join(', ')}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Склад</dt>
                  <dd className="text-right">
                    <Dash title={NO_WAREHOUSE} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Звіряння</dt>
                  <dd className="text-right">
                    <Dash title={NO_RECONCILIATION} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Створена</dt>
                  <dd className="text-right">
                    <Dash title={NO_CREATED} />
                  </dd>
                </div>
              </dl>
            </Card>

            <Card title="Доступ">
              <p
                className="text-app-muted text-[13.5px] leading-5 text-pretty"
                title={NO_ACCESS_LIST}
              >
                Каса не має власного списку людей: право працювати з грошима дає
                роль у бізнесі, одразу на всі каси.
              </p>
            </Card>
          </div>
        </div>

        <div className="grid gap-5" id="cash-operations">
          {children}
        </div>
      </div>
    </div>
  )
}
