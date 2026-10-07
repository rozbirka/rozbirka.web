import { useT } from '@/i18n'
import { currencyMessages } from '../currency/messages'
import { useAccountingCurrency } from '../currency/use-accounting-currency'

/** The accounting currency row of the business summary card. */
export function AccountingCurrencySummary() {
  const t = useT(currencyMessages)
  const { status } = useAccountingCurrency()
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-app-muted">{t('title')}</dt>
      <dd
        className={
          status.kind === 'chosen'
            ? 'text-app-ink text-right font-mono font-medium'
            : 'text-app-dim text-right'
        }
      >
        {status.kind === 'chosen'
          ? status.currency
          : status.kind === 'not-chosen'
            ? t('notSet')
            : '—'}
      </dd>
    </div>
  )
}
