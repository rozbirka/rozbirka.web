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
      aside={<CardLink to={base}>{t('operations')}</CardLink>}
      title={t('balances')}
    >
      {lines.length === 0 ? (
        <CardEmpty>{t('noActiveTills')}</CardEmpty>
      ) : (
        lines.map((line) => (
          <CardRow key={line.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="rz-strong m-0 min-w-0 truncate font-medium">
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
    <p className="rz-mono rz-strong m-0 whitespace-nowrap">
      <span aria-hidden>
        {money(amount)} <span className="rz-dim text-caption">{currency}</span>
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
