import type { CashRegister } from '@/api/cash'
import { CardEmpty, CardLink, CardRow, DashboardCard } from './dashboard-card'

const sum = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

/** Preferred reading order for a yard that keeps more than one currency. */
const PREFERRED = ['USD', 'UAH']

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
  const lines = tillLines(registers)

  return (
    <DashboardCard aside={<CardLink to={base}>Операції</CardLink>} title="Каси">
      {lines.length === 0 ? (
        <CardEmpty>Жодної активної каси.</CardEmpty>
      ) : (
        lines.map((line) => (
          <CardRow key={line.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[14px] font-bold text-white">
                {line.name}
              </p>
              <p className="font-mono text-[15px] font-medium whitespace-nowrap tabular-nums text-white">
                {sum.format(line.amount)}{' '}
                <span className="text-app-dim text-[12px]">
                  {line.currency}
                </span>
              </p>
            </div>
          </CardRow>
        ))
      )}
    </DashboardCard>
  )
}

function tillLines(registers: readonly CashRegister[]): TillLine[] {
  return registers.flatMap((register) =>
    Object.entries(register.balances)
      .sort(([left], [right]) => order(left) - order(right))
      .map(([currency, amount]) => ({
        key: `${register.id}:${currency}`,
        name: register.name,
        currency,
        amount,
      })),
  )
}

const order = (currency: string) => {
  const index = PREFERRED.indexOf(currency)
  return index === -1 ? PREFERRED.length : index
}
