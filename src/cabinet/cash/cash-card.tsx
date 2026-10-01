import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type { CashRegister, CashTransaction } from '@/api/cash'
import {
  count,
  money,
  moment,
  movementText,
  registerTypeHints,
  registerTypeLabels,
  signedMoney,
} from './cash-labels'
import { RedesignShell, RedesignTitle } from '../redesign-shell'

const NO_TYPE_FILTER =
  'Журнал не фільтрується за типом операції — сегменти впорядковують те, що вже завантажено на цій сторінці.'

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

function MoneyLines({
  lines,
  empty,
}: {
  lines: readonly { currency: string; amount: number }[]
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
              line.amount === 0 ? 'text-app-dim' : 'text-app-ink font-medium',
            )}
          >
            {money(line.amount, line.currency)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function CashCard({
  register,
  ledger,
  ledgerTotal,
  totalOperations,
  lastOperationAt,
  canManage,
  onNewOperation,
  error,
  filters,
  pagination,
  children,
}: {
  register: CashRegister
  ledger: readonly CashTransaction[]
  ledgerTotal: number
  totalOperations: number | null
  lastOperationAt: string | null
  canManage: boolean
  onNewOperation?: (() => void) | undefined
  error: string | null
  filters: ReactNode
  pagination: ReactNode
  children?: ReactNode
}) {
  const [segment, setSegment] = useState<SegmentKey>('all')
  const currencies = Object.entries(register.balances)
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
    <RedesignShell
      actions={
        <>
          {canManage ? (
            <Button asChild>
              <Link to="edit">Редагувати</Link>
            </Button>
          ) : null}
          {canManage && register.isActive ? (
            <Button
              className="px-5 text-sm font-bold"
              onClick={onNewOperation}
              variant="primary"
            >
              Нова операція
            </Button>
          ) : null}
        </>
      }
      crumb={
        <>
          <Link className="hover:text-app-muted" to="..">
            Гроші · Каси
          </Link>
          <span aria-hidden> · </span>
          <span className="text-app-muted">{register.name}</span>
        </>
      }
    >
      <RedesignTitle
        aside={
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold',
              register.isActive
                ? 'border-state-ok/28 text-state-ok bg-state-ok/10'
                : 'border-app-line text-app-dim',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                register.isActive ? 'bg-state-ok' : 'bg-app-dim',
              )}
            />
            {register.isActive ? 'Активна' : 'Неактивна'}
          </span>
        }
        lead={`${registerTypeLabels[register.type] ?? register.type}${registerTypeHints[register.type] ? ` · ${registerTypeHints[register.type]}` : ''}`}
        title={register.name}
      />

      {error === null ? null : (
        <p
          className="border-state-danger/35 bg-state-danger/10 text-state-danger rounded-[16px] border px-4 py-3 text-[13.5px]"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label="Операції"
          className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
        >
          <div className="border-app-line flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-5 py-4">
            <div>
              <h2 className="text-app-ink text-[15px] font-bold">Операції</h2>
              <p className="text-app-dim mt-1 text-[12px]">
                {totalOperations === null
                  ? 'Журнал завантажується'
                  : `${count(totalOperations)} ${plural(totalOperations, ['операція', 'операції', 'операцій'])} усього`}
                {lastOperationAt ? ` · остання ${moment(lastOperationAt)}` : ''}
              </p>
            </div>
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
          <div className="border-app-line border-b px-5 py-3.5">{filters}</div>
          {shown.length === 0 ? (
            <p className="text-app-muted px-5 py-8 text-[14px]">
              {ledger.length === 0
                ? 'Операцій ще немає.'
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
                    <th className="px-5 py-2.5 text-right">Сума</th>
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
                          'px-5 py-3.5 text-right font-mono tabular-nums',
                          entry.direction === 'out'
                            ? 'text-state-danger'
                            : 'text-state-ok',
                        )}
                      >
                        {signedMoney(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-app-line grid gap-3 border-t px-5 py-3.5">
            <p className="text-app-dim text-[13px]">
              Показано {count(shown.length)} з {count(ledger.length)} на цій
              сторінці, усього за фільтром — {count(ledgerTotal)}{' '}
              {plural(ledgerTotal, ['операція', 'операції', 'операцій'])}.
            </p>
            {pagination}
          </div>
        </section>

        <div className="grid min-w-0 content-start gap-5">
          <Card
            note="Валюти зберігаються окремо, конвертація не застосовується."
            title="Залишки"
          >
            <MoneyLines
              empty="Валют ще немає"
              lines={currencies.map(([currency, amount]) => ({
                currency,
                amount,
              }))}
            />
          </Card>
        </div>
      </div>
      {children}
    </RedesignShell>
  )
}
