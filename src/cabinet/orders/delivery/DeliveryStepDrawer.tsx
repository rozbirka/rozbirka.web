import { useState } from 'react'
import { Button, Notice, Sheet } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import { normalizeApiProblem } from '@/api/errors'
import { uah } from './delivery-money'

export type DeliveryStep = 'dispatch' | 'receive' | 'return'

interface StepCopy {
  title: string
  description: string
  confirm: string
  danger?: boolean
  note?: string
}

const COPY: Record<DeliveryStep, StepCopy> = {
  dispatch: {
    title: 'Передати перевізнику',
    description:
      'Позиції списуються зі складу. Дія проганяє повну перевірку готовності, включно з живими запитами в Нову пошту на маршрут і габарити.',
    confirm: 'Зафіксувати передачу',
    note: 'Фіксується дата передачі. Статус замовлення лишається «Очікує» до підтвердження отримання клієнтом.',
  },
  receive: {
    title: 'Підтвердити отримання клієнтом',
    description:
      'Обовʼязковий крок між передачею перевізнику й будь-якими подальшими діями. Замовлення переходить у «Підтверджене».',
    confirm: 'Зафіксувати отримання',
    note: 'Післяплату в касу інтеграція не зараховує — це окрема дія в касі.',
  },
  return: {
    title: 'Оформити повернення',
    description:
      'Позиції повертаються на склад, замовлення отримує статус «Повернено». Кошти при цьому не повертаються — повернення грошей оформлюється окремо по кожному платежу в касі.',
    confirm: 'Підтвердити повернення',
    danger: true,
    note: 'Сервіс приймає лише повне повернення без пошкоджень. Часткове або пошкоджене він відхиляє й нічого на склад не повертає — такий випадок розбирається вручну.',
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
      setError(normalizeApiProblem(problem).message)
      setPending(false)
    }
  }

  return (
    <Sheet
      description={copy.description}
      eyebrow="Замовлення · Нова пошта"
      footer={
        <div className="flex justify-end gap-2.5">
          <Button disabled={pending} onClick={onClose}>
            Скасувати
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending}
            onClick={() => void confirm()}
            variant={copy.danger === true ? 'danger' : 'primary'}
          >
            {copy.confirm}
          </Button>
        </div>
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={copy.title}
    >
      <div className="grid gap-3.5">
        {error !== null && <Notice tone="danger">{error}</Notice>}
        <dl className="border-app-line bg-app-inset grid gap-2.5 rounded-[14px] border px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-app-muted text-[13px]">Сума замовлення</dt>
            <dd className="text-app-ink font-mono text-[13.5px]">
              {uah(delivery.agreedTotalUah)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-app-muted text-[13px]">Залишок</dt>
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
        {copy.note !== undefined && (
          <p className="text-app-muted text-[12.5px] leading-5 text-pretty">
            {copy.note}
          </p>
        )}
      </div>
    </Sheet>
  )
}
