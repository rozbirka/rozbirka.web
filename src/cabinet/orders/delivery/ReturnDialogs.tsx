import { ConfirmDialog } from '@/components/app'
import { useLocale, useT } from '@/i18n'
import { orderMessages } from '../messages'
import { uah } from './delivery-money'
import { deliveryFlowMessages } from './flow-messages'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  orderNumber: number
  pending: boolean
  error: string | null
  onCloseAutoFocus?: ((event: Event) => void) | undefined
}

/**
 * «Почати повернення?» (10.2): starting a return moves nothing — the goods
 * wait to be accepted and the money to be refunded, each its own step.
 */
export function StartReturnDialog(props: DialogProps) {
  const t = useT(deliveryFlowMessages)
  return (
    <ConfirmDialog
      confirmLabel={t('startReturn')}
      consequence={t('startText', { number: String(props.orderNumber) })}
      destructive={false}
      effects={[t('startGoods'), t('startStock'), t('startMoney')]}
      error={props.error}
      onCloseAutoFocus={props.onCloseAutoFocus}
      onConfirm={props.onConfirm}
      onOpenChange={props.onOpenChange}
      open={props.open}
      pending={props.pending}
      title={t('startTitle')}
    />
  )
}

/**
 * «Скасувати замовлення?» before the parcel leaves (10.13): Core cancels the
 * waybill with Nova Poshta first, and money taken still has to go back.
 */
export function OrderCancelDialog({
  paidUah,
  waybill,
  ...props
}: DialogProps & {
  /** Payments still held, which the refund step gives back. */
  paidUah: number
  /** The live waybill Nova Poshta has to cancel first. */
  waybill: string | null
}) {
  const { locale } = useLocale()
  const t = useT(deliveryFlowMessages)
  const to = useT(orderMessages)
  return (
    <ConfirmDialog
      confirmLabel={to('cancelOrder')}
      consequence={t('cancelText', { number: String(props.orderNumber) })}
      effects={[
        ...(waybill === null ? [] : [t('cancelWaybill', { number: waybill })]),
        ...(paidUah > 0
          ? [t('cancelRefund', { amount: uah(paidUah, locale) })]
          : []),
        t('cancelFinal'),
      ]}
      error={props.error}
      onCloseAutoFocus={props.onCloseAutoFocus}
      onConfirm={props.onConfirm}
      onOpenChange={props.onOpenChange}
      open={props.open}
      pending={props.pending}
      title={t('cancelTitle')}
    />
  )
}
