import { useId } from 'react'
import { StatusPill } from '@/components/app'
import type { CarProfitability } from '@/api/cars'
import { useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { carCardMessages } from './car-card-messages'
import { useCarMoney } from './car-money'
import {
  payoffKind,
  payoffLabel,
  payoffResult,
  payoffScale,
  surplusPercent,
} from './car-profitability'

/** Where the car stands against its investment, as a pill beside its name. */
export function CarPayoffPill({ profit }: { profit: CarProfitability }) {
  const { locale } = useLocale()
  const kind = payoffKind(profit)
  return (
    <StatusPill
      tone={kind === 'paid' ? 'ok' : kind === 'recouping' ? 'warn' : 'neutral'}
    >
      {payoffLabel(kind, locale)}
    </StatusPill>
  )
}

/**
 * What a car has cost and returned, as the page-wide KPI strip of the car
 * record. Three figures carry it — what went in, what came back, and the gap
 * between them — and the fourth puts the payback share on a bar with
 * break-even written beside it, so the bar is never colour alone.
 */
export function CarProfitabilityCard({
  currency,
  expensesTotal,
  profit,
  purchasePrice,
}: {
  /** The accounting currency every figure here is kept in; `null` if unknown. */
  currency: string | null
  /** Named so the invested figure is not a number to take on trust. */
  expensesTotal: number
  profit: CarProfitability
  purchasePrice: number
}) {
  const { locale } = useLocale()
  const t = useT(carCardMessages)
  const money = useCarMoney(currency)
  // The figure itself goes bare; the currency sits beside it as the unit.
  const figure = useCarMoney(null)
  const unit = currency ?? undefined
  const kind = payoffKind(profit)
  const paid = kind === 'paid'
  const result = payoffResult(profit, locale)
  const scale = payoffScale(profit)
  const surplus = surplusPercent(profit)
  const percent = profit.recoupedPercent ?? 0
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="grid">
      <h2 className="sr-only" id={titleId}>
        {t('profitabilityTitle')}
      </h2>
      <div className="[&_.rz-display]:whitespace-nowrap lg:[&_.rz-kpis]:grid-cols-4">
        <KpiStrip>
          <Kpi
            label={t('invested')}
            meta={
              expensesTotal > 0
                ? t('investedWithExpenses', {
                    car: money(purchasePrice),
                    expenses: money(expensesTotal),
                  })
                : t('investedPriceOnly')
            }
            {...(unit === undefined ? {} : { unit })}
            value={figure(profit.invested)}
          />
          <Kpi
            label={t('recouped')}
            meta={
              profit.partsSold > 0
                ? t('recoupedFromSales', { count: profit.partsSold })
                : t('noSalesYet')
            }
            {...(unit === undefined ? {} : { unit })}
            value={figure(profit.recouped)}
          />
          <Kpi
            label={result.label}
            meta={
              paid
                ? surplus === null
                  ? t('overInvested')
                  : t('surplusOfInvested', { percent: surplus })
                : t('stillToSell')
            }
            tone={paid ? 'ok' : kind === 'recouping' ? 'warn' : 'plain'}
            {...(unit === undefined ? {} : { unit })}
            value={`${paid ? '+' : ''}${figure(result.amount)}`}
          />
          <Kpi
            label={t('payback')}
            meta={
              scale === null ? (
                t('recoupedShare', { percent })
              ) : (
                <span className="grid gap-1.5">
                  <span
                    aria-label={t('payback')}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={percent}
                    aria-valuetext={t('recoupedShare', { percent })}
                    className={cn(
                      'rz-meter',
                      kind === 'recouping' && 'rz-meter--warn',
                    )}
                    role="progressbar"
                  >
                    <span
                      style={{ width: `${String(Math.min(percent, 100))}%` }}
                    />
                  </span>
                  <span>
                    {t('recoupedShare', { percent })} ·{' '}
                    {t('breakEven', { amount: money(profit.invested) })}
                  </span>
                </span>
              )
            }
            unit="%"
            value={String(percent)}
          />
        </KpiStrip>
      </div>
    </section>
  )
}
