import { useEffect, useState } from 'react'
import { Check, Dot, X } from 'lucide-react'
import {
  Button,
  Field,
  Notice,
  Sheet,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { shippingApi, type Shipment } from '@/api/shipping'
import { normalizeApiProblem } from '@/api/errors'
import type { DeliveryOrder } from '@/api/delivery'
import { uah } from './delivery-money'
import {
  readiness,
  readinessBlocks,
  readinessNextStep,
  type ReadinessCheck,
} from './delivery-view'

const eyebrow = (orderNumber: number, part: string) =>
  `Замовлення #${String(orderNumber)} · ${part}`

const when = (value: string | null) => {
  if (value === null) return '—'
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(value)
  return parts ? `${parts[3]}.${parts[2]}.${parts[1]}, ${parts[4]}` : value
}

/** One line of a checklist: what was checked, what was found, and whether it passed. */
function CheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <li className="bg-app-raised flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <span
        aria-hidden
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-full border',
          check.deferred === true || check.pending === true
            ? 'border-app-line-2 text-app-dim'
            : check.ok
              ? 'bg-state-ok border-transparent text-black'
              : 'border-state-danger/50 text-state-danger',
        )}
      >
        {check.deferred === true ? null : check.ok ? (
          <Check className="size-3" />
        ) : check.pending === true ? (
          <Dot className="size-3" />
        ) : (
          <X className="size-3" />
        )}
      </span>
      <span className="min-w-0 flex-1 text-[14px] font-semibold text-white text-pretty">
        {check.label}
      </span>
      <span
        className={cn(
          'ml-auto font-mono text-[12px] tabular-nums',
          check.deferred === true || check.pending === true
            ? 'text-app-muted'
            : check.ok
              ? 'text-state-ok'
              : 'text-state-danger',
        )}
      >
        {check.state}
      </span>
    </li>
  )
}

/**
 * Everything the cabinet can check before asking Nova Poshta for a waybill.
 *
 * Core refuses a Ukrainian waybill while the order owes anything, and the
 * carrier refuses one whose route or parcel it does not like — the first is
 * knowable here, the second is not, and the list says which is which rather
 * than promising a pass.
 */
export function WaybillReadinessDrawer({
  busy,
  delivery,
  dispatchPointActive,
  onClose,
  onContinue,
  orderNumber,
  shipment,
}: {
  busy: boolean
  delivery: DeliveryOrder
  dispatchPointActive: boolean
  onClose: () => void
  onContinue: () => void
  orderNumber: number
  shipment: Shipment | null
}) {
  const checks = readiness(delivery, shipment, dispatchPointActive)
  // The quote and the deposit are done on the next screen, so they cannot be
  // what keeps the order off it.
  const blocking = readinessBlocks(checks)
  const passed = blocking.length === 0
  const next = readinessNextStep(checks)

  return (
    <Sheet
      eyebrow={eyebrow(orderNumber, 'перевірка перед ТТН')}
      footer={
        <>
          <p
            className={cn(
              'min-w-0 flex-1 text-[13px]',
              passed ? 'text-app-muted' : 'text-state-warn',
            )}
          >
            {passed
              ? 'Далі — отримувач, посилка й розрахунок'
              : `Перешкод: ${String(blocking.length)}`}
          </p>
          <Button disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button
            disabled={busy || !passed}
            onClick={onContinue}
            title={
              passed
                ? undefined
                : 'Це не виправляється на наступному кроці — відкрийте налаштування інтеграції.'
            }
            variant="primary"
          >
            Продовжити оформлення
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title="Перевірка перед створенням ТТН"
    >
      <Notice tone={passed ? 'ok' : 'warn'}>
        <p className="font-semibold">{next.title}</p>
        <p className="mt-1">{next.note}</p>
      </Notice>

      <section className="grid gap-2">
        <h3 className="text-app-ink text-[13px] font-bold">
          Що сервіс перевіряє сам
        </h3>
        <ul className="border-app-line bg-app-input grid gap-px overflow-hidden rounded-[14px] border">
          {checks.map((check) => (
            <CheckRow check={check} key={check.key} />
          ))}
        </ul>
        <p className="text-app-muted text-[12px] leading-5 text-pretty">
          Останній рядок — не перевірка: маршрут і габарити Нова пошта оцінює
          сама під час створення, тож відмова можлива навіть після зеленого
          списку.
        </p>
      </section>
    </Sheet>
  )
}

/** The waybill as Core stored it, read-only, with the money beside it. */
export function WaybillDataDrawer({
  delivery,
  onClose,
  orderNumber,
  shipment,
}: {
  delivery: DeliveryOrder
  onClose: () => void
  orderNumber: number
  shipment: Shipment
}) {
  const codMatches =
    shipment.codUah != null && shipment.codUah === delivery.outstandingUah
  const parcels = shipment.draft.parcels
  const weight = parcels.reduce((sum, parcel) => sum + parcel.weightKg, 0)

  const rows: { label: string; value: string; tone?: 'ok' | 'danger' }[] = [
    { label: 'Номер', value: shipment.number ?? '—' },
    {
      label: 'Створена',
      value: when(
        shipment.events.find((event) => event.code === 'Created')?.recordedAt ??
          null,
      ),
    },
    {
      label: 'Відділення відправника',
      value: shipment.sender.warehouseName ?? '—',
    },
    {
      label: 'Отримувач',
      value: `${shipment.draft.recipient.name} · ${shipment.draft.recipient.warehouseName ?? 'відділення обрано'}`,
    },
    {
      label: 'Післяплата в накладній',
      value: shipment.codUah == null ? '—' : uah(shipment.codUah),
      ...(codMatches ? { tone: 'ok' as const } : { tone: 'danger' as const }),
    },
    {
      label: 'Залишок за замовленням',
      value: uah(delivery.outstandingUah),
      ...(codMatches ? { tone: 'ok' as const } : { tone: 'danger' as const }),
    },
    {
      label: 'Оголошена вартість',
      value: uah(shipment.draft.declaredValueUah),
    },
    {
      label: 'Посилка',
      value: `${String(parcels.length)} місць · ${String(weight)} кг`,
    },
    {
      label: 'Статус перевізника',
      value: shipment.trackingStatus ?? 'ще не надходив',
    },
  ]

  return (
    <Sheet
      eyebrow={eyebrow(orderNumber, 'накладна')}
      footer={
        <Button onClick={onClose} variant="primary">
          Закрити
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open
      title="Дані накладної"
    >
      {codMatches ? null : (
        <Notice tone="danger">
          Післяплата в накладній розійшлася із залишком за замовленням. Нова
          пошта видасть посилку за сумою в накладній — розбіжність доведеться
          вирішувати вручну.
        </Notice>
      )}
      <dl className="border-app-line bg-app-input grid gap-px overflow-hidden rounded-[14px] border">
        {rows.map((row) => (
          <div
            className="bg-app-raised flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
            key={row.label}
          >
            <dt className="text-app-muted text-[13px]">{row.label}</dt>
            <dd
              className={cn(
                'text-right font-mono text-[13px]',
                row.tone === 'ok'
                  ? 'text-state-ok'
                  : row.tone === 'danger'
                    ? 'text-state-danger'
                    : 'text-app-ink',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {shipment.events.length === 0 ? null : (
        <ol aria-label="Статуси відправлення" className="grid gap-2">
          {shipment.events.map((event) => (
            <li
              className="flex items-baseline justify-between gap-3 text-[13px]"
              key={`${event.recordedAt}-${event.code}`}
            >
              <span className="text-app-ink min-w-0 text-pretty">
                {event.name}
              </span>
              <span className="text-app-dim font-mono text-[12px] whitespace-nowrap">
                {when(event.occurredAt ?? event.recordedAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  )
}

/**
 * Taking over a waybill made in the carrier's own cabinet. The post-payment on
 * it has to equal what the order owes — Core checks that and refuses anything
 * else, so the drawer says the figure before the attempt rather than after.
 */
export function WaybillAttachDrawer({
  delivery,
  integrationId,
  onAttached,
  onClose,
  orderId,
  orderNumber,
}: {
  delivery: DeliveryOrder
  integrationId: string
  onAttached: (shipment: Shipment) => void
  onClose: () => void
  orderId: string
  orderNumber: number
}) {
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = number.replace(/\D/g, '')
  const valid = digits.length >= 10

  const attach = () => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    void shippingApi
      .attach(integrationId, orderId, digits)
      .then((shipment) => {
        onAttached(shipment)
        onClose()
      })
      .catch((problem: unknown) => {
        setError(normalizeApiProblem(problem).message)
      })
      .finally(() => setBusy(false))
  }

  return (
    <Sheet
      description="Накладна, створена в кабінеті Нової пошти, стає накладною цього замовлення."
      eyebrow={eyebrow(orderNumber, 'накладна')}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !valid}
            onClick={attach}
            variant="primary"
          >
            Прив’язати до замовлення
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title="Прив’язати наявну ТТН"
    >
      {error === null ? null : <Notice tone="danger">{error}</Notice>}

      <Field
        hint="14 цифр із кабінету Нової пошти. Пробіли можна лишити."
        label="Номер накладної"
        required
      >
        <TextInput
          className="font-mono text-[18px] tabular-nums"
          inputMode="numeric"
          onChange={(event) => setNumber(event.target.value)}
          placeholder="20451931 5540"
          value={number}
        />
      </Field>

      <Notice tone={delivery.outstandingUah > 0 ? 'warn' : 'ok'}>
        <p className="font-semibold">Прив’язка пройде, якщо</p>
        <ul className="mt-1.5 grid gap-1">
          <li>
            післяплата в накладній дорівнює{' '}
            <span className="font-mono">{uah(delivery.outstandingUah)}</span>
          </li>
          <li>накладна належить тій самій точці відправлення</li>
          <li>її ще не прив’язано до іншого замовлення</li>
        </ul>
      </Notice>
    </Sheet>
  )
}

/**
 * The carrier's label. Core proxies the PDF so the browser never holds an API
 * key; the blob it hands back lives only while this drawer is open.
 */
export function WaybillLabelDrawer({
  integrationId,
  onClose,
  orderId,
  orderNumber,
  waybillNumber,
}: {
  integrationId: string
  onClose: () => void
  orderId: string
  orderNumber: number
  waybillNumber: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let created: string | null = null
    void shippingApi
      .label(integrationId, orderId, { signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch((problem: unknown) => {
        if (!controller.signal.aborted)
          setError(normalizeApiProblem(problem).message)
      })
    return () => {
      controller.abort()
      if (created !== null) URL.revokeObjectURL(created)
    }
  }, [integrationId, orderId])

  return (
    <Sheet
      eyebrow={eyebrow(orderNumber, 'етикетка')}
      footer={
        <>
          <p className="text-app-muted min-w-0 flex-1 font-mono text-[13px]">
            {waybillNumber}
          </p>
          <Button onClick={onClose}>Закрити</Button>
          {url === null ? null : (
            <Button asChild variant="primary">
              <a href={url} rel="noopener noreferrer" target="_blank">
                Відкрити PDF
              </a>
            </Button>
          )}
        </>
      }
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open
      title="Друк етикетки"
    >
      {error === null ? null : <Notice tone="danger">{error}</Notice>}
      {url === null && error === null ? (
        <SkeletonRows label="Готуємо етикетку…" rows={3} />
      ) : null}
      {url === null ? null : (
        <object
          aria-label="Етикетка Нової пошти"
          className="border-app-line h-[60vh] w-full rounded-[14px] border"
          data={url}
          type="application/pdf"
        >
          <p className="text-app-muted p-4 text-[14px]">
            Браузер не показує PDF на місці — відкрийте його в новій вкладці.
          </p>
        </object>
      )}
    </Sheet>
  )
}
