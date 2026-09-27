import type { StatusTone } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import { plural } from '@/lib/utils'
import { deliveryStage, uah } from './delivery-money'

/**
 * The shape of a delivery order on screen, read from the two records Core
 * keeps for it: the money (`/orders/{id}/delivery`) and the waybill
 * (`/shipping/orders/{id}`). Everything here is derived — nothing is stored
 * twice — so the card and its drawers cannot disagree about where the order
 * stands.
 */

/** A waybill exists once the carrier has given it a number. */
export const hasWaybill = (shipment: Shipment | null): boolean =>
  shipment !== null && shipment.number !== null && shipment.number !== ''

export interface LifecycleStep {
  key: string
  label: string
  /** When it happened; empty for a step still ahead. */
  meta: string
  done: boolean
  /** The furthest step reached — the one the eye should land on. */
  current: boolean
}

const stamp = (value: string | null): string => {
  if (value === null) return ''
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(value)
  return parts ? `${parts[3]}.${parts[2]} · ${parts[4]}` : value
}

/**
 * The four moments a delivery order passes through. Payment sits first because
 * that is the order a prepaid sale runs in, not because it gates anything: an
 * unpaid order reaches every later step just the same, and settles when the
 * carrier hands the post-payment back.
 */
export function lifecycle(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
): LifecycleStep[] {
  const paidAt =
    delivery.outstandingUah > 0
      ? null
      : (delivery.payments
          .filter((payment) => payment.refundedAt === null)
          .map((payment) => payment.createdAt)
          .sort()
          .at(-1) ?? null)
  const waybillAt =
    shipment?.events.find((event) => event.code === 'Created')?.recordedAt ??
    (hasWaybill(shipment) ? (shipment?.quoteAt ?? null) : null)

  const steps: {
    key: string
    label: string
    done: boolean
    at: string | null
  }[] = [
    {
      key: 'paid',
      label: 'Оплачено',
      done: delivery.outstandingUah === 0,
      at: paidAt,
    },
    {
      key: 'waybill',
      label: 'ТТН',
      done: hasWaybill(shipment),
      at: waybillAt,
    },
    {
      key: 'dispatched',
      label: 'Передано перевізнику',
      done: delivery.dispatchedAt !== null,
      at: delivery.dispatchedAt,
    },
    {
      key: 'received',
      label: 'Отримано',
      done: delivery.receivedAt !== null,
      at: delivery.receivedAt,
    },
  ]

  return steps.map((step, index) => ({
    key: step.key,
    label: step.label,
    meta: step.done ? stamp(step.at) : '',
    done: step.done,
    current: step.done && steps[index + 1]?.done !== true,
  }))
}

/** The order's own state, said the way the yard says it. */
export function orderChip(delivery: DeliveryOrder): {
  label: string
  tone: StatusTone
} {
  if (delivery.returnedAt !== null) return { label: 'Повернене', tone: 'info' }
  if (delivery.receivedAt !== null) return { label: 'Підтверджене', tone: 'ok' }
  return delivery.outstandingUah === 0
    ? { label: 'Очікує · оплачене', tone: 'info' }
    : { label: 'Очікує · є залишок', tone: 'warn' }
}

/** Where the parcel is, as the carrier record shows it. */
export function shipmentChip(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
): { label: string; tone: StatusTone } {
  if (delivery.receivedAt !== null)
    return { label: 'Отримано клієнтом', tone: 'ok' }
  if (delivery.dispatchedAt !== null)
    return { label: 'Передано перевізнику', tone: 'info' }
  if (hasWaybill(shipment)) return { label: 'ТТН створена', tone: 'neutral' }
  if (shipment?.state === 'Creating')
    return { label: 'ТТН створюється', tone: 'warn' }
  if (shipment?.state === 'Unknown')
    return { label: 'Результат невідомий', tone: 'danger' }
  if (shipment?.state === 'Cancelled')
    return { label: 'ТТН скасована', tone: 'neutral' }
  return { label: 'ТТН не створена', tone: 'warn' }
}

export interface ShipmentFact {
  key: string
  label: string
  value: string
  note: string
  tone: 'ink' | 'ok' | 'warn' | 'danger' | 'dim'
}

/**
 * The four facts a manager checks before touching anything. Post-payment is
 * the one that decides whether the waybill may be created at all: Core keeps
 * it equal to what the order still owes, and a mismatch is a refusal waiting
 * to happen.
 */
export function shipmentFacts(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
): ShipmentFact[] {
  const created = hasWaybill(shipment)
  const parcels = shipment?.draft.parcels ?? []
  const weight = parcels.reduce((sum, parcel) => sum + parcel.weightKg, 0)
  const first = parcels[0]
  const codMatches =
    shipment?.codUah != null && shipment.codUah === delivery.outstandingUah

  return [
    {
      key: 'waybill',
      label: 'ТТН',
      value: created ? (shipment?.number ?? '—') : 'не створена',
      note: created
        ? ''
        : delivery.outstandingUah > 0
          ? 'буде з післяплатою'
          : 'можна створити',
      tone: created ? 'ink' : 'warn',
    },
    {
      key: 'cod',
      label: 'Післяплата',
      value: shipment?.codUah == null ? '—' : uah(shipment.codUah),
      note: !created
        ? ''
        : codMatches
          ? 'дорівнює залишку'
          : 'не дорівнює залишку',
      tone: !created ? 'dim' : codMatches ? 'ok' : 'danger',
    },
    {
      key: 'parcels',
      label: 'Посилка',
      value:
        parcels.length === 0
          ? '—'
          : `${String(parcels.length)} ${plural(parcels.length, ['місце', 'місця', 'місць'])} · ${String(weight)} кг`,
      note:
        first === undefined
          ? ''
          : `${String(first.lengthCm)} × ${String(first.widthCm)} × ${String(first.heightCm)} см`,
      tone: parcels.length === 0 ? 'dim' : 'ink',
    },
    {
      key: 'deposit',
      label: 'Депозит',
      value:
        delivery.requiredDepositUah <= 0
          ? '—'
          : uah(delivery.requiredDepositUah),
      note: !delivery.depositRequired
        ? 'розбірка не вимагає депозиту'
        : delivery.depositWaived
          ? 'знято для довіреного клієнта'
          : delivery.requiredDepositUah <= 0
            ? 'зʼявиться після розрахунку'
            : delivery.depositSatisfied
              ? 'внесено'
              : `бракує ${uah(delivery.depositShortfallUah)}`,
      tone: !delivery.depositRequired
        ? 'dim'
        : delivery.depositWaived || delivery.depositSatisfied
          ? 'ok'
          : delivery.requiredDepositUah <= 0
            ? 'dim'
            : 'warn',
    },
  ]
}

/**
 * How far the money has got. «Частково» has to mean what it says: an order
 * nobody has paid anything against is not partly paid, and calling it that
 * hides the difference between a deposit taken and a deposit never asked for.
 */
export function paymentStanding(delivery: DeliveryOrder): {
  label: string
  tone: 'ok' | 'warn' | 'dim'
} {
  if (delivery.outstandingUah === 0)
    return { label: 'Оплачено повністю', tone: 'ok' }
  return delivery.appliedUah > 0
    ? { label: 'Оплачено частково', tone: 'warn' }
    : { label: 'Не оплачено', tone: 'dim' }
}

export interface PrimaryAction {
  kind: 'pay' | 'create' | 'dispatch' | 'receive' | 'return' | null
  label: string
  hint: string
}

/**
 * The one move the order is waiting for. Only ever one: the lifecycle is
 * strictly ordered in Core, and offering a later step early is offering a
 * refusal.
 */
export function primaryAction(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
): PrimaryAction {
  if (delivery.returnedAt !== null)
    return {
      kind: null,
      label: '',
      hint: 'Замовлення повернене. Кошти повертаються окремо по кожному платежу.',
    }
  // Money no longer gates the parcel: whatever is still owed travels as the
  // post-payment, so the waybill is the next move even on an unpaid order.
  if (!hasWaybill(shipment))
    return {
      kind: 'create',
      label: 'Створити ТТН',
      hint:
        delivery.outstandingUah > 0
          ? `Післяплата буде ${uah(delivery.outstandingUah)} — рівно залишок.`
          : 'Замовлення оплачене, тож накладна піде без післяплати.',
    }
  if (delivery.dispatchedAt === null)
    return {
      kind: 'dispatch',
      label: 'Передати перевізнику',
      hint: 'Після передачі статус лишається «Очікує».',
    }
  if (delivery.receivedAt === null)
    return {
      kind: 'receive',
      label: 'Отримано клієнтом',
      hint: 'Замовлення стане «Підтверджене».',
    }
  return {
    kind: 'return',
    label: 'Оформити повернення',
    hint: 'Кошти повертаються окремо по кожному платежу.',
  }
}

export interface ReadinessCheck {
  key: string
  label: string
  /** What the check found: a number, a code, a plain word. */
  state: string
  ok: boolean
  /** True when the cabinet cannot know and the carrier decides at creation. */
  deferred?: boolean
  /**
   * Not done yet, and the booking drawer is where it gets done. Such a row is
   * a step ahead rather than a fault, and it must never bar the way to the
   * screen that resolves it: the delivery quote is calculated there and the
   * deposit is derived from that quote, so gating entry on either of them
   * locks a fresh order out of its own first step.
   */
  pending?: boolean
}

/**
 * What stands between this order and a waybill. The cabinet can only check
 * what Core tells it — the route and the parcel are verified by the carrier
 * during creation, and those rows say so rather than claiming a pass.
 */
export function readiness(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
  dispatchPointActive: boolean,
): ReadinessCheck[] {
  const quoteFresh =
    shipment?.quoteAt != null &&
    Date.now() - new Date(shipment.quoteAt).getTime() < 24 * 60 * 60 * 1000

  return [
    {
      // Not a gate any more, and saying otherwise sends a manager to collect
      // money the carrier is about to collect for them.
      key: 'outstanding',
      label:
        delivery.outstandingUah > 0
          ? 'Залишок поїде післяплатою'
          : 'Залишку немає — післяплати не буде',
      state: uah(delivery.outstandingUah),
      ok: true,
    },
    {
      key: 'deposit',
      label: 'Депозит за доставку внесено',
      // A required deposit of zero is not a deposit that is covered: it is a
      // deposit nobody has worked out yet, because it equals the carrier quote
      // plus the return estimate and neither exists before the calculation.
      // Said as a shortfall it reads «бракує 0,00 ₴», which is not a fact.
      state: !delivery.depositRequired
        ? 'розбірка не вимагає'
        : delivery.depositWaived
          ? 'знято'
          : delivery.requiredDepositUah <= 0
            ? 'зʼявиться після розрахунку'
            : delivery.depositSatisfied
              ? uah(delivery.requiredDepositUah)
              : `бракує ${uah(delivery.depositShortfallUah)}`,
      ok:
        !delivery.depositRequired ||
        delivery.depositWaived ||
        (delivery.requiredDepositUah > 0 && delivery.depositSatisfied),
      // Before the quote there is no figure to pay at all.
      pending:
        delivery.depositRequired &&
        !delivery.depositWaived &&
        delivery.requiredDepositUah <= 0,
    },
    {
      key: 'quote',
      label: 'Розрахунок доставки свіжий',
      state:
        shipment?.quoteAt == null
          ? 'зробимо на наступному кроці'
          : quoteFresh
            ? 'оновлено'
            : 'застарів — оновимо на наступному кроці',
      ok: quoteFresh,
      pending: true,
    },
    {
      key: 'dispatch-point',
      label: 'Точка відправлення активна',
      state: dispatchPointActive ? 'активна' : 'не обрана',
      ok: dispatchPointActive,
    },
    {
      key: 'carrier',
      label: 'Маршрут і габарити',
      state: 'перевіряє Нова пошта під час створення',
      ok: true,
      deferred: true,
    },
  ]
}

/** Whether every check the cabinet can make has passed. */
export const readinessPassed = (checks: readonly ReadinessCheck[]): boolean =>
  checks.every((check) => check.ok)

/**
 * What actually stands between this order and the booking drawer. A step that
 * drawer performs itself is not in the way of reaching it; only something that
 * has to be fixed somewhere else — an inactive dispatch point lives in
 * settings — can keep the order out.
 */
export const readinessBlocks = (
  checks: readonly ReadinessCheck[],
): ReadinessCheck[] =>
  checks.filter(
    (check) => !check.ok && check.deferred !== true && check.pending !== true,
  )

/** The one move that gets this order closer to a waybill, said plainly. */
export function readinessNextStep(checks: readonly ReadinessCheck[]): {
  title: string
  note: string
} {
  const blocking = readinessBlocks(checks)
  const first = blocking[0]
  if (first !== undefined)
    return {
      title: 'Спершу треба виправити налаштування',
      note: `${first.label}: ${first.state}. На наступному кроці це не змінюється — відкрийте налаштування інтеграції.`,
    }
  if (checks.find((check) => check.key === 'quote')?.ok !== true)
    return {
      title: 'Наступний крок — розрахувати доставку',
      note: 'Далі заповнюєте отримувача й посилку та натискаєте «Розрахувати». Звідти ж стане відомий депозит.',
    }
  if (checks.find((check) => check.key === 'deposit')?.ok !== true)
    return {
      title: 'Депозит ще не внесено',
      note: 'Накладну створити можна, але передати посилку перевізнику — лише після депозиту.',
    }
  return {
    title: 'Перешкод не знайдено',
    note: 'Маршрут і габарити Нова пошта перевірить під час створення — відмова можлива вже там.',
  }
}

/** What the yard calls a payment Core tagged with its kind. */
export const paymentKindLabel = (kind: string | null): string =>
  kind === 'prepayment' ? 'Завдаток' : kind === 'cod' ? 'Післяплата' : 'Оплата'

export { deliveryStage }
