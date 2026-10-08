import { Link } from 'react-router'
import { useLocale, useT } from '@/i18n'
import type {
  AnalyticsConfirmedOrdersValue,
  ConfirmedOrdersValue,
  DashboardPeriod,
} from '@/api/dashboard-contract'
import { pickConfirmedOrdersValue } from './order-value'
import type { AccountingCurrencyStatus } from '../currency/accounting-currency'
import { wholeMoney } from '../currency/money'
import { CardRow, DashboardCard } from './dashboard-card'
import { dashboardMoneyMessages } from './money-messages'

/**
 * «Вартість підтверджених замовлень» (ROZ-162 board 4a/4b): the accounting
 * value of confirmed orders (Core `confirmedOrdersValue`, order totals in the
 * accounting currency), kept apart from actual receipts and till balances.
 * Without a chosen currency it says so — never «0 USD» — and only the owner
 * gets the link. Core sends the value only to roles allowed to see it; for
 * anyone else the card is not shown.
 */
export function OrderValueCard({
  settingsPath,
  status,
  period,
  periodLabel,
  analyticsValue,
  summaryValue,
}: {
  /** Owner only: where the currency is chosen. */
  settingsPath: string | null
  status: AccountingCurrencyStatus
  period: DashboardPeriod
  periodLabel: string
  analyticsValue?: AnalyticsConfirmedOrdersValue | null | undefined
  summaryValue?: ConfirmedOrdersValue | null | undefined
}) {
  const t = useT(dashboardMoneyMessages)
  const { locale } = useLocale()
  if (status.kind === 'unknown') return null
  const figure =
    status.kind === 'chosen'
      ? pickConfirmedOrdersValue(period, analyticsValue, summaryValue)
      : null
  if (status.kind === 'chosen' && figure === null) return null
  return (
    <DashboardCard
      aside={
        figure === null ? null : (
          <span className="text-app-muted text-[13px]">{periodLabel}</span>
        )
      }
      title={t('confirmedValue')}
    >
      <CardRow>
        {figure === null ? (
          <div className="grid gap-2">
            <p className="text-app-muted text-[15px] font-semibold">
              {t('notSet')}
            </p>
            {settingsPath === null ? null : (
              <Link
                className="text-brand inline-flex min-h-11 items-center text-[14px] font-semibold underline-offset-4 hover:underline"
                to={`${settingsPath}#accounting-currency`}
              >
                {t('chooseCurrency')} →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-1">
            <p className="font-mono text-[26px] font-medium text-white tabular-nums">
              {wholeMoney(figure.amount, figure.currency, locale)}
            </p>
            <p className="text-app-muted font-mono text-[12px]">
              {t('accountingValue', { code: figure.currency })}
            </p>
          </div>
        )}
      </CardRow>
    </DashboardCard>
  )
}
