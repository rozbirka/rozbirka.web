import { Card, StatusPill } from '@/components/app'
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

/**
 * What a car has cost and returned. Three figures carry it — what went in,
 * what came back, and the gap between them — and the bar below puts break-even
 * where it actually falls, so a car that made money never reads like one that
 * merely broke even.
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
  const kind = payoffKind(profit)
  const paid = kind === 'paid'
  const result = payoffResult(profit, locale)
  const scale = payoffScale(profit)
  const surplus = surplusPercent(profit)

  return (
    <Card
      aside={
        <StatusPill tone={paid ? 'ok' : 'neutral'}>
          {payoffLabel(kind, locale)}
        </StatusPill>
      }
      title={t('profitabilityTitle')}
    >
      <div className="grid gap-4">
        {/* Inside a card the figures step down to the title size: a summary
            column is narrower than the page-wide strip they come from. */}
        <div className="[&_.rz-display]:text-title [&_.rz-display]:whitespace-nowrap">
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
              value={money(profit.invested)}
            />
            <Kpi
              label={t('recouped')}
              meta={
                profit.partsSold > 0
                  ? t('recoupedFromSales', { count: profit.partsSold })
                  : t('noSalesYet')
              }
              value={money(profit.recouped)}
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
              value={`${paid ? '+' : ''}${money(result.amount)}`}
            />
          </KpiStrip>
        </div>

        {scale !== null && (
          <section className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="rz-h-card">{t('payback')}</h3>
              <p
                className={cn(
                  'rz-mono m-0',
                  paid ? 'text-state-ok' : 'rz-muted',
                )}
              >
                {t('recoupedShare', { percent: profit.recoupedPercent ?? 0 })}
              </p>
            </div>

            {/* `.rz-meter` with break-even drawn into it: the track is the
                larger of the two sums, so what came back past the investment
                sits visibly beyond the line. */}
            <div
              aria-label={t('payback')}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={profit.recoupedPercent ?? 0}
              aria-valuetext={t('recoupedShare', {
                percent: profit.recoupedPercent ?? 0,
              })}
              className="rz-meter relative overflow-visible"
              role="progressbar"
            >
              <span
                className={cn(
                  'absolute inset-y-0 left-0 rounded-l-full',
                  paid ? undefined : 'bg-app-dim',
                )}
                style={{ width: `${String(scale.base)}%` }}
              />
              <span
                className="absolute inset-y-0 rounded-r-full"
                style={{
                  left: `${String(scale.marker)}%`,
                  width: `${String(scale.over)}%`,
                }}
              />
              {/* Break-even itself, drawn over both fills so it stays readable. */}
              <span
                className="bg-app-ink absolute -inset-y-1 -ml-px w-0.5 rounded-rz-xs"
                style={{ left: `${String(scale.marker)}%` }}
              />
            </div>

            <p className="relative m-0 h-4">
              <span className="rz-dim absolute left-0 font-mono text-micro">
                0
              </span>
              <span
                className="rz-muted absolute font-mono text-micro whitespace-nowrap"
                style={{
                  left: `${String(scale.marker)}%`,
                  transform: `translateX(${scale.marker > 80 ? '-100%' : '-50%'})`,
                }}
              >
                {t('breakEven', { amount: money(profit.invested) })}
              </span>
            </p>
          </section>
        )}
      </div>
    </Card>
  )
}
