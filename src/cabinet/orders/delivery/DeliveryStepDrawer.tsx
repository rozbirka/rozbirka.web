import { useState } from 'react'
import { Button, Notice, Sheet } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import { commonMessages, useLocale, useT, type MessageKey } from '@/i18n'
import { uah } from './delivery-money'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'

export type DeliveryStep = 'dispatch' | 'receive' | 'return'

type DrawerKey = MessageKey<typeof deliveryDrawerMessages>

interface StepCopy {
  title: DrawerKey
  description: DrawerKey
  confirm: DrawerKey
  danger?: boolean
  note: DrawerKey
}

const COPY: Record<DeliveryStep, StepCopy> = {
  dispatch: {
    title: 'dispatchTitle',
    description: 'dispatchDescription',
    confirm: 'dispatchConfirm',
    note: 'dispatchNote',
  },
  receive: {
    title: 'receiveTitle',
    description: 'receiveDescription',
    confirm: 'receiveConfirm',
    note: 'receiveNote',
  },
  return: {
    title: 'returnTitle',
    description: 'returnDescription',
    confirm: 'returnConfirm',
    danger: true,
    note: 'returnNote',
  },
}

/**
 * One confirmation for the three steps Core records on a delivery order.
 * Each writes stock or a status that cannot be undone from this screen, so
 * each says plainly what it will do before it is allowed to happen.
 */
export function DeliveryStepDrawer({
  delivery,
  onClose,
  onConfirm,
  step,
}: {
  delivery: DeliveryOrder
  onClose: () => void
  onConfirm: () => Promise<void>
  step: DeliveryStep
}) {
  const copy = COPY[step]
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (problem) {
      setError(deliveryProblemMessage(problem, locale))
      setPending(false)
    }
  }

  return (
    <Sheet
      description={t(copy.description)}
      eyebrow={t('eyebrowNp')}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button disabled={pending} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending}
            onClick={() => void confirm()}
            variant={copy.danger === true ? 'danger' : 'primary'}
          >
            {t(copy.confirm)}
          </Button>
        </div>
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={t(copy.title)}
    >
      <div className="grid gap-3.5">
        {error !== null && <Notice tone="danger">{error}</Notice>}
        <dl className="border-app-line bg-app-inset grid gap-2.5 rounded-[14px] border px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-app-muted text-[13px]">{t('orderTotal')}</dt>
            <dd className="text-app-ink font-mono text-[13.5px]">
              {uah(delivery.agreedTotalUah)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-app-muted text-[13px]">{t('balance')}</dt>
            <dd
              className={`font-mono text-[13.5px] ${
                delivery.outstandingUah === 0
                  ? 'text-app-ink'
                  : 'text-state-warn'
              }`}
            >
              {uah(delivery.outstandingUah)}
            </dd>
          </div>
        </dl>
        <p className="text-app-muted text-[12.5px] leading-5 text-pretty">
          {t(copy.note)}
        </p>
      </div>
    </Sheet>
  )
}
