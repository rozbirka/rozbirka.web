import { ConfirmDialog } from '@/components/app'
import { useT } from '@/i18n'
import type { RecreateReason } from './WaybillEditSheet'
import { waybillMessages } from './waybill-messages'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** The waybill number as the carrier gave it. */
  number: string
  pending: boolean
  error: string | null
  onCloseAutoFocus?: ((event: Event) => void) | undefined
}

/**
 * «Скасувати накладну?» (5.7): the consequences one by one, focus on the way
 * out. Used by the order block now and meant for the waybill card next.
 */
export function WaybillCancelDialog({
  orderNumber,
  ...props
}: DialogProps & { orderNumber: number }) {
  const t = useT(waybillMessages)
  return (
    <ConfirmDialog
      confirmLabel={t('cancelWaybill')}
      consequence={t('cancelText', { number: props.number })}
      effects={[
        t('cancelStepOpen', { number: String(orderNumber) }),
        t('cancelStepNext'),
        t('cancelStepHistory'),
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

/**
 * «Змінити відділення через нову ТТН?» (5.5): a change the carrier will not
 * apply to the existing waybill is made by cancelling it, waiting for Nova
 * Poshta to confirm, and creating a new one. The change is not finished
 * until that new waybill exists, and the dialog says so before anything is
 * cancelled.
 */
export function WaybillRecreateDialog({
  reason,
  ...props
}: DialogProps & { reason: RecreateReason }) {
  const t = useT(waybillMessages)
  return (
    <ConfirmDialog
      confirmLabel={t('recreateConfirm')}
      consequence={
        reason === 'branch' ? t('recreateBranchText') : t('recreateRefusedText')
      }
      destructive={false}
      effects={[
        t('recreateStepCancel', { number: props.number }),
        reason === 'branch'
          ? t('recreateStepBranch')
          : t('recreateStepChanges'),
        t('recreateStepHistory'),
      ]}
      error={props.error}
      onCloseAutoFocus={props.onCloseAutoFocus}
      onConfirm={props.onConfirm}
      onOpenChange={props.onOpenChange}
      open={props.open}
      pending={props.pending}
      title={
        reason === 'branch' ? t('recreateBranchTitle') : t('needNewWaybill')
      }
    />
  )
}
