import { useState } from 'react'
import type { ConfirmPayment } from '@/api/orders'
import type { DeliveryOrder, RecordDeliveryPayment } from '@/api/delivery'
import { normalizeApiProblem } from '@/api/errors'
import { useLocale, useT } from '@/i18n'
import { OrderPaymentDrawer, type PaymentOutcome } from '../OrderPaymentDrawer'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { uah } from './delivery-money'

const UAH_ONLY = ['UAH'] as const

/** Standard payment UI; delivery keeps its UAH-only endpoint and payment kind. */
export function DeliveryRecordPaymentDrawer({
  accountingCurrency = null,
  codWaybill = null,
  delivery,
  onClose,
  onCloseAutoFocus,
  onRecord,
  orderNumber,
  orderValue = null,
}: {
  accountingCurrency?: string | null
  codWaybill?: string | null
  delivery: DeliveryOrder
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onRecord: (input: RecordDeliveryPayment) => Promise<void>
  orderNumber: number
  orderValue?: number | null
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tf = useT(deliveryFlowMessages)
  const [pending, setPending] = useState(false)
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null)
  // Core's PayableCeiling also accepts the delivery deposit before pricing goods.
  const ceiling =
    delivery.agreedTotalUah > 0
      ? delivery.outstandingUah
      : Math.max(
          0,
          Math.round(delivery.requiredDepositUah * 100) -
            Math.round(delivery.appliedUah * 100),
        ) / 100

  const record = async (payment: ConfirmPayment) => {
    if (pending || payment.currency !== 'UAH' || payment.amount > ceiling)
      return
    setPending(true)
    setOutcome(null)
    try {
      await onRecord({
        accountId: payment.accountId,
        amountUah: payment.amount,
        feeUah: 0,
        kind: codWaybill === null ? 'prepayment' : 'cod',
      })
      onClose()
    } catch (problem) {
      const kind = normalizeApiProblem(problem).kind
      const retryable =
        kind === 'network' || kind === 'timeout' || kind === 'server'
      setOutcome({
        kind: retryable ? 'retryable' : 'refused',
        message: retryable
          ? tf('paymentSaveFailed')
          : deliveryProblemMessage(problem, locale),
      })
      setPending(false)
    }
  }

  return (
    <OrderPaymentDrawer
      accountingCurrency={accountingCurrency}
      allowedCurrencies={UAH_ONLY}
      busy={pending}
      emptyTillsMessage={t('recordNoUahTills')}
      existing={[]}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      onSave={(_payments, added) => {
        void record(added)
      }}
      open
      orderNumber={orderNumber}
      orderValue={orderValue}
      outcome={outcome}
      validatePayment={(payment) =>
        payment.amount > ceiling
          ? t('recordOverLimit', { amount: uah(ceiling, locale) })
          : null
      }
    />
  )
}
