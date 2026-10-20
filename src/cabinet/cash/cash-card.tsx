import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Button, Notice, StatusPill } from '@/components/app'
import { cn } from '@/lib/utils'
import { commonMessages, useT } from '@/i18n'
import type { CashRegister, CashTransaction } from '@/api/cash'
import { useCashText } from './cash-labels'
import { cashMessages } from './cash-messages'
import { RedesignShell } from '../redesign-shell'

const SEGMENTS = [
  { key: 'all', label: 'segAll' },
  { key: 'in', label: 'mvIncome' },
  { key: 'out', label: 'mvExpense' },
  { key: 'transfer', label: 'mvTransfer' },
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
    <section className="rz-card min-w-0">
      <div className="rz-card__head">
        <h2 className="rz-h-card">{title}</h2>
      </div>
      {children}
      {note === undefined ? null : (
        <p className="rz-card__foot rz-caption m-0 block text-pretty">{note}</p>
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
  const { money } = useCashText()
  if (lines.length === 0)
    return <p className="rz-card__body rz-dim m-0">{empty}</p>
  return (
    <dl className="rz-facts">
      {lines.map((line) => (
        <div key={line.currency}>
          <dt className="rz-mono">{line.currency}</dt>
          <dd
            className={cn(
              'rz-num',
              line.amount === 0 ? 'text-app-dim' : 'text-app-strong',
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
  cashHref,
  register,
  ledger,
  ledgerTotal,
  totalOperations,
  lastOperationAt,
  canManage,
  onNewOperation,
  onActivate,
  activating,
  error,
  filters,
  pagination,
  children,
}: {
  cashHref: string
  register: CashRegister
  ledger: readonly CashTransaction[]
  ledgerTotal: number
  totalOperations: number | null
  lastOperationAt: string | null
  canManage: boolean
  onNewOperation?: (() => void) | undefined
  onActivate?: (() => void) | undefined
  activating?: boolean | undefined
  error: string | null
  filters: ReactNode
  pagination: ReactNode
  children?: ReactNode
}) {
  const t = useT(cashMessages)
  const tc = useT(commonMessages)
  const {
    count,
    moment,
    movementText,
    registerHint,
    registerType,
    signedMoney,
  } = useCashText()
  const [segment, setSegment] = useState<SegmentKey>('all')
  const typeHint = registerHint(register.type)
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
              <Link to="edit">{tc('edit')}</Link>
            </Button>
          ) : null}
          {canManage && register.isActive ? (
            <Button onClick={onNewOperation} variant="primary">
              {t('newOperation')}
            </Button>
          ) : null}
          {canManage && !register.isActive && onActivate ? (
            <Button
              aria-busy={activating}
              disabled={activating}
              onClick={onActivate}
              variant="primary"
            >
              {t('activateTill')}
            </Button>
          ) : null}
        </>
      }
      crumb={
        <>
          <Link to={cashHref}>{t('crumb')}</Link>
          <ChevronRight aria-hidden className="size-3 shrink-0" />
          <span aria-current="page">{register.name}</span>
        </>
      }
    >
      <div className="rz-page-head items-center">
        <h1 className="rz-h-page">{register.name}</h1>
        <StatusPill tone={register.isActive ? 'ok' : 'neutral'}>
          {register.isActive ? t('active') : t('inactive')}
        </StatusPill>
        <span className="rz-muted basis-full">
          {`${registerType(register.type)}${typeHint === null ? '' : ` · ${typeHint}`}`}
        </span>
      </div>

      {error === null ? null : <Notice tone="danger">{error}</Notice>}

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label={t('operations')} className="rz-card min-w-0">
          <div className="rz-card__head py-2">
            <div className="min-w-0">
              <h2 className="rz-h-card">{t('operations')}</h2>
              <p className="rz-caption m-0">
                {totalOperations === null
                  ? t('ledgerLoading')
                  : t('operationsTotal', { count: totalOperations })}
                {lastOperationAt
                  ? ` · ${t('lastOperation', { when: moment(lastOperationAt) })}`
                  : ''}
              </p>
            </div>
            <div
              aria-label={t('typeOnPage')}
              className="rz-seg max-w-full flex-wrap"
              role="group"
              title={t('noTypeFilter')}
            >
              {SEGMENTS.map((one) => (
                <button
                  aria-pressed={segment === one.key}
                  key={one.key}
                  onClick={() => setSegment(one.key)}
                  type="button"
                >
                  {t(one.label)}
                  <span className="rz-mono rz-dim">
                    {count(counts[one.key])}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-app-line border-b px-[var(--rz-card-p)] py-3">
            {filters}
          </div>
          {shown.length === 0 ? (
            <p className="rz-card__body rz-muted m-0">
              {ledger.length === 0
                ? t('noOperations')
                : t('noOperationsFiltered')}
            </p>
          ) : (
            <div className="rz-table-scroll">
              <table className="rz-table">
                <caption>{t('ledgerCaption', { name: register.name })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('colDate')}</th>
                    <th scope="col">{t('colPurpose')}</th>
                    <th className="rz-num" scope="col">
                      {t('colAmount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((entry) => (
                    <tr key={entry.id}>
                      <th className="py-2" scope="row">
                        <span className="rz-mono rz-dim font-normal whitespace-nowrap">
                          {moment(entry.createdAt)}
                        </span>
                      </th>
                      <td className="py-2" data-label={t('colPurpose')}>
                        <span className="text-app-ink block font-medium">
                          {entry.note ?? movementText(entry.type)}
                        </span>
                        <span className="rz-caption block">
                          {movementText(entry.type)} · {entry.createdByName}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'rz-num py-2 whitespace-nowrap',
                          entry.direction === 'out'
                            ? 'text-state-danger'
                            : 'text-state-ok',
                        )}
                        data-label={t('colAmount')}
                      >
                        {signedMoney(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="rz-caption border-app-line m-0 border-t px-[var(--rz-card-p)] py-2.5">
            {t('ledgerShown', {
              shown: shown.length,
              loaded: ledger.length,
              count: ledgerTotal,
            })}
          </p>
          {pagination}
        </section>

        <Card note={t('balancesNote')} title={t('balances')}>
          <MoneyLines
            empty={t('noCurrencies')}
            lines={currencies.map(([currency, amount]) => ({
              currency,
              amount,
            }))}
          />
        </Card>
      </div>
      {children}
    </RedesignShell>
  )
}
