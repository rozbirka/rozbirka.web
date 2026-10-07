import { Card, StatusPill } from '@/components/app'
import type { CarProfitability } from '@/api/cars'
import { useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { carCardMessages } from './car-card-messages'
import { money } from './car-money'
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
  expensesTotal,
  profit,
  purchasePrice,
}: {
  /** Named so the invested figure is not a number to take on trust. */
  expensesTotal: number
  profit: CarProfitability
  purchasePrice: number
}) {
  const { locale } = useLocale()
  const t = useT(carCardMessages)
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
      <dl className="border-app-line bg-app-line grid gap-px overflow-hidden rounded-[14px] border sm:grid-cols-3">
        <Tile
          label={t('invested')}
          note={
            expensesTotal > 0
              ? t('investedWithExpenses', {
                  car: money(purchasePrice),
                  expenses: money(expensesTotal),
                })
              : t('investedPriceOnly')
          }
          value={money(profit.invested)}
        />
        <Tile
          label={t('recouped')}
          note={
            profit.partsSold > 0
              ? t('recoupedFromSales', { count: profit.partsSold })
              : t('noSalesYet')
          }
          value={money(profit.recouped)}
        />
        <Tile
          label={result.label}
          note={
            paid
              ? surplus === null
                ? t('overInvested')
                : t('surplusOfInvested', { percent: surplus })
              : t('stillToSell')
          }
          tone={paid ? 'ok' : 'plain'}
          value={`${paid ? '+' : ''}${money(result.amount)}`}
        />
      </dl>

      {scale !== null && (
        <section className="mt-[22px]">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-app-ink text-[13px] font-semibold">
              {t('payback')}
            </h3>
            <p
              className={cn(
                'font-mono text-[13px]',
                paid ? 'text-state-ok' : 'text-app-muted',
              )}
            >
              {t('recoupedShare', { percent: profit.recoupedPercent ?? 0 })}
            </p>
          </div>

          <div
            aria-label={t('payback')}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={profit.recoupedPercent ?? 0}
            aria-valuetext={t('recoupedShare', {
              percent: profit.recoupedPercent ?? 0,
            })}
            className="relative mt-2.5 h-2.5 rounded-full bg-white/[0.06]"
            role="progressbar"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-l-full bg-white/[0.28]"
              style={{ width: `${String(scale.base)}%` }}
            />
            <span
              className="bg-state-ok absolute inset-y-0 rounded-r-full"
              style={{
                left: `${String(scale.marker)}%`,
                width: `${String(scale.over)}%`,
              }}
            />
            {/* Break-even itself, drawn over both fills so it stays readable. */}
            <span
              className="bg-app-ink absolute -inset-y-[5px] -ml-px w-0.5 rounded-sm"
              style={{ left: `${String(scale.marker)}%` }}
            />
          </div>

          <p className="relative mt-2 h-[18px]">
            <span className="text-app-dim absolute left-0 font-mono text-[11px]">
              0
            </span>
            <span
              className="text-app-muted absolute font-mono text-[11px] whitespace-nowrap"
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
    </Card>
  )
}

function Tile({
  label,
  note,
  tone = 'plain',
  value,
}: {
  label: string
  note: string
  tone?: 'plain' | 'ok'
  value: string
}) {
  return (
    <div className="bg-app-raised min-w-0 px-4 pt-[15px] pb-4">
      <dt
        className={cn(
          'font-mono text-[10px] tracking-[0.14em] uppercase',
          tone === 'ok' ? 'text-state-ok/80' : 'text-app-muted',
        )}
      >
        {label}
      </dt>
      <dd>
        <span
          className={cn(
            'mt-2.5 block font-mono text-[19px] font-medium whitespace-nowrap tabular-nums',
            tone === 'ok' ? 'text-state-ok' : 'text-app-ink',
          )}
        >
          {value}
        </span>
        <span className="text-app-dim mt-1.5 block text-[12px] leading-[1.45] text-pretty">
          {note}
        </span>
      </dd>
    </div>
  )
}
