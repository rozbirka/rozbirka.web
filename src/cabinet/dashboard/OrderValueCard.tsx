import { Link } from 'react-router'
import { useT } from '@/i18n'
import type { AccountingCurrencyStatus } from '../currency/accounting-currency'
import { CardRow, DashboardCard } from './dashboard-card'
import { dashboardMoneyMessages } from './money-messages'

/**
 * «Вартість підтверджених замовлень» (ROZ-162 board 4a/4b): the accounting
 * value, kept apart from actual receipts and till balances. Without a chosen
 * currency it says so — never «0 USD» — and only the owner gets the link.
 *
 * The figure itself is pending a Core contract: neither `/dashboard` nor
 * `/dashboard/analytics` reports confirmed-order value in the accounting
 * currency yet, so the card names the currency and says the value is not
 * calculated rather than inventing one from receipts.
 */
export function OrderValueCard({
  settingsPath,
  status,
}: {
  /** Owner only: where the currency is chosen. */
  settingsPath: string | null
  status: AccountingCurrencyStatus
}) {
  const t = useT(dashboardMoneyMessages)
  if (status.kind === 'unknown') return null
  return (
    <DashboardCard title={t('confirmedValue')}>
      <CardRow>
        {status.kind === 'not-chosen' ? (
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
            <p className="text-app-muted font-mono text-[12px]">
              {t('accountingValue', { code: status.currency })}
            </p>
            <p className="text-app-dim text-[13px] leading-5 text-pretty">
              {t('valuePending')}
            </p>
          </div>
        )}
      </CardRow>
    </DashboardCard>
  )
}
