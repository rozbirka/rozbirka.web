import { useT } from '@/i18n'
import { currencyMessages } from '../currency/messages'
import { useAccountingCurrency } from '../currency/use-accounting-currency'

/** The accounting currency row of the business summary card (`dl.rz-facts`). */
export function AccountingCurrencySummary() {
  const t = useT(currencyMessages)
  const { status } = useAccountingCurrency()
  return (
    <div>
      <dt>{t('title')}</dt>
      <dd className={status.kind === 'chosen' ? 'rz-mono' : 'rz-dim'}>
        {status.kind === 'chosen'
          ? status.currency
          : status.kind === 'not-chosen'
            ? t('notSet')
            : '—'}
      </dd>
    </div>
  )
}
