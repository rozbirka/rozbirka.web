import type { CashRegister } from '@/api/cash'
import { useT } from '@/i18n'
import { tillCurrencies } from '../currency/catalog-order'
import { useWholeMoney } from '../currency/money'
import { CardEmpty, CardLink, CardRow, DashboardCard } from './dashboard-card'
import { dashboardMoneyMessages } from './money-messages'

interface TillLine {
  key: string
  name: string
  currency: string
  amount: number
}

/**
 * What is in every till right now, one line per currency. Sums are never added
 * across currencies: there is no rate anywhere in the cabinet, and a converted
 * total would be a number nobody could check.
 *
 * The design puts a reconciliation date under each name. Nothing in
 * `CashRegisterDto` records when a till was last counted, so that line is not
 * drawn rather than filled with a date we would have to invent.
 */
export function TillsCard({
  base,
  registers,
}: {
  base: string
  registers: readonly CashRegister[]
}) {
  const t = useT(dashboardMoneyMessages)
  const lines = tillLines(registers)

  return (
    <DashboardCard
      aside={<CardLink to={base}>Операції</CardLink>}
      title={t('balances')}
    >
      {lines.length === 0 ? (
        <CardEmpty>Жодної активної каси.</CardEmpty>
      ) : (
        lines.map((line) => (
          <CardRow key={line.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[14px] font-bold text-white">
                {line.name}
              </p>
              <TillAmount amount={line.amount} currency={line.currency} />
            </div>
          </CardRow>
        ))
      )}
    </DashboardCard>
  )
}

/** One till balance: the number, then its ISO code, read with its name. */
function TillAmount({
  amount,
  currency,
}: {
  amount: number
  currency: string
}) {
  const money = useWholeMoney(null)
  const named = useWholeMoney(currency)
  return (
    <p className="font-mono text-[15px] font-medium whitespace-nowrap tabular-nums text-white">
      <span aria-hidden>
        {money(amount)}{' '}
        <span className="text-app-dim text-[12px]">{currency}</span>
      </span>
      <span className="sr-only">{named(amount)}</span>
    </p>
  )
}

function tillLines(registers: readonly CashRegister[]): TillLine[] {
  return registers.flatMap((register) =>
    tillCurrencies(register).map((currency) => ({
      key: `${register.id}:${currency}`,
      name: register.name,
      currency,
      amount: register.balances[currency] ?? 0,
    })),
  )
}
