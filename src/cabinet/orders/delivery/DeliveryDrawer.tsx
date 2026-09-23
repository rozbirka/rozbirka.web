import { useEffect, useState } from 'react'
import {
  Button,
  Field,
  Notice,
  SelectInput,
  Sheet,
  TextInput,
} from '@/components/app'
import {
  integrationsApi,
  type NovaPoshtaDispatchPoint,
  type NovaPoshtaDivision,
  type NovaPoshtaSettlement,
} from '@/api/integrations'
import {
  shippingApi,
  type ParcelInput,
  type PayerType,
  type Shipment,
  type ShipmentDraft,
} from '@/api/shipping'
import { normalizeApiProblem } from '@/api/errors'
import { SettlementPicker } from '../../integrations/settlement-picker'
import {
  prepayment,
  quotePresentation,
  quoteState,
  sameDraft,
  type QuoteState,
} from './delivery-labels'

const uah = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

const PHONE = /^\+?[1-9]\d{7,14}$/

interface ParcelDraft {
  weightKg: string
  lengthCm: string
  widthCm: string
  heightCm: string
}

const emptyParcel: ParcelDraft = {
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
}

const toParcelDraft = (parcel: ParcelInput): ParcelDraft => ({
  weightKg: String(parcel.weightKg),
  lengthCm: String(parcel.lengthCm),
  widthCm: String(parcel.widthCm),
  heightCm: String(parcel.heightCm),
})

const decimal = (value: string): number | null => {
  const parsed = Number(value.replace(',', '.').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-app-line bg-app-raised grid gap-3.5 rounded-[16px] border px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-bold tracking-[-0.01em] text-white">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * Booking one delivery for one order. The form is a draft on Core until it is
 * quoted, and Core clears the quote whenever the draft changes — so the panel
 * never offers a waybill on numbers that no longer answer the form.
 */
export function DeliveryDrawer({
  customerName,
  customerPhone,
  declaredValue,
  dispatchPoints,
  integrationId,
  onChanged,
  onClose,
  orderId,
  shipment,
}: {
  customerName: string | null
  customerPhone: string | null
  declaredValue: number | null
  dispatchPoints: NovaPoshtaDispatchPoint[]
  integrationId: string
  onChanged: (shipment: Shipment) => void
  onClose: () => void
  orderId: string
  shipment: Shipment | null
}) {
  const saved = shipment?.draft ?? null
  const defaultPoint =
    dispatchPoints.find((point) => point.isDefault) ?? dispatchPoints[0] ?? null

  const [pointId, setPointId] = useState(
    shipment?.dispatchPointId ?? defaultPoint?.id ?? '',
  )
  const [name, setName] = useState(saved?.recipient.name ?? customerName ?? '')
  const [phone, setPhone] = useState(
    saved?.recipient.phone ?? customerPhone ?? '',
  )
  const [isCompany, setIsCompany] = useState(
    saved?.recipient.companyName != null,
  )
  const [companyName, setCompanyName] = useState(
    saved?.recipient.companyName ?? '',
  )
  const [companyTin, setCompanyTin] = useState(
    saved?.recipient.companyTin ?? '',
  )
  const [settlement, setSettlement] = useState<NovaPoshtaSettlement | null>(
    null,
  )
  const [loadedDivisions, setLoadedDivisions] = useState<{
    settlementId: number
    items: NovaPoshtaDivision[]
  } | null>(null)
  const [divisionChoice, setDivisionChoice] = useState<number | null>(
    saved?.recipient.divisionId ?? null,
  )
  const [parcels, setParcels] = useState<ParcelDraft[]>(
    saved?.parcels.length ? saved.parcels.map(toParcelDraft) : [emptyParcel],
  )
  const [description, setDescription] = useState(
    saved?.description ?? 'Автозапчастини',
  )
  const [declared, setDeclared] = useState(
    String(saved?.declaredValueUah ?? declaredValue ?? ''),
  )
  const [returnEstimate, setReturnEstimate] = useState(
    String(saved?.returnEstimateUah ?? ''),
  )
  const [payer, setPayer] = useState<PayerType>(saved?.payerType ?? 'Recipient')

  const [busy, setBusy] = useState<null | 'draft' | 'estimate' | 'create'>(null)
  const [error, setError] = useState<string | null>(null)
  const [quoteFailure, setQuoteFailure] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // The saved draft's settlement stands until another is picked.
  const settlementId = settlement?.id ?? saved?.recipient.settlementId ?? null

  useEffect(() => {
    if (settlementId === null) return
    const controller = new AbortController()
    void integrationsApi
      .divisions(integrationId, settlementId, 1, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({
              settlementId,
              items: page.items.filter((item) => item.receivingAllowed),
            })
          }
        },
        () => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({ settlementId, items: [] })
            setLookupError('Довідник відділень Нової пошти зараз недоступний.')
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, settlementId])

  const divisions =
    settlementId !== null && loadedDivisions?.settlementId === settlementId
      ? loadedDivisions.items
      : null
  const divisionId =
    divisions?.some((item) => item.id === divisionChoice) === true
      ? divisionChoice
      : null

  const trimmedPhone = phone.replace(/[\s()-]/g, '')
  const parcelValues = parcels.map((parcel) => ({
    weightKg: decimal(parcel.weightKg),
    lengthCm: decimal(parcel.lengthCm),
    widthCm: decimal(parcel.widthCm),
    heightCm: decimal(parcel.heightCm),
  }))
  const parcelsReady =
    parcelValues.length > 0 &&
    parcelValues.every(
      (parcel) =>
        parcel.weightKg !== null &&
        parcel.lengthCm !== null &&
        parcel.widthCm !== null &&
        parcel.heightCm !== null,
    )
  const declaredValueUah = decimal(declared)
  const returnEstimateUah = decimal(returnEstimate)
  const ready =
    name.trim() !== '' &&
    PHONE.test(trimmedPhone) &&
    settlementId !== null &&
    divisionId !== null &&
    parcelsReady &&
    declaredValueUah !== null &&
    returnEstimateUah !== null &&
    description.trim() !== '' &&
    pointId !== '' &&
    (!isCompany || (companyName.trim() !== '' && companyTin.trim() !== ''))

  const draft: ShipmentDraft | null = ready
    ? {
        recipient: {
          name: name.trim(),
          phone: trimmedPhone,
          settlementId: settlementId,
          divisionId: divisionId,
          companyName: isCompany ? companyName.trim() : null,
          companyTin: isCompany ? companyTin.trim() : null,
        },
        parcels: parcelValues as ParcelInput[],
        declaredValueUah: declaredValueUah,
        returnEstimateUah: returnEstimateUah,
        payerType: payer,
        description: description.trim(),
        dispatchPointId: pointId,
      }
    : null

  const dirty =
    saved === null ||
    draft === null ||
    !sameDraft(draft, { ...saved, dispatchPointId: pointId })

  const state: QuoteState = quoteState({
    shipment,
    dirty,
    busy: busy === 'estimate',
    failure: quoteFailure,
  })
  const quote = quotePresentation(state)
  const total = prepayment(shipment)

  const run = async <T,>(
    kind: 'draft' | 'estimate' | 'create',
    action: () => Promise<T>,
  ): Promise<T | null> => {
    setBusy(kind)
    setError(null)
    try {
      return await action()
    } catch (problem) {
      const message = normalizeApiProblem(problem).message
      if (kind === 'estimate') setQuoteFailure(message)
      else setError(message)
      return null
    } finally {
      setBusy(null)
    }
  }

  const saveDraft = async (): Promise<Shipment | null> => {
    if (draft === null) return null
    const result = await run('draft', () =>
      shippingApi.saveDraft(integrationId, orderId, draft),
    )
    if (result !== null) onChanged(result)
    return result
  }

  const estimate = async () => {
    setQuoteFailure(null)
    if (dirty && (await saveDraft()) === null) return
    const result = await run('estimate', () =>
      shippingApi.estimate(integrationId, orderId),
    )
    if (result !== null) onChanged(result)
  }

  const create = async () => {
    const result = await run('create', () =>
      shippingApi.create(integrationId, orderId),
    )
    if (result !== null) onChanged(result)
  }

  const point = dispatchPoints.find((item) => item.id === pointId) ?? null

  return (
    <Sheet
      description="Нова пошта · Україною, відділення → відділення"
      footer={
        <>
          <Button
            aria-busy={busy === 'draft'}
            disabled={busy !== null || draft === null}
            onClick={() => void saveDraft()}
          >
            Зберегти чернетку
          </Button>
          <Button
            aria-busy={busy === 'create'}
            disabled={busy !== null || !quote.canCreate}
            onClick={() => void create()}
            title={
              quote.canCreate
                ? undefined
                : 'ТТН створюється лише за свіжим розрахунком.'
            }
            variant="primary"
          >
            Створити ТТН
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && busy === null) onClose()
      }}
      open
      size="lg"
      title="Оформлення відправлення"
    >
      {error !== null && <Notice tone="danger">{error}</Notice>}
      {lookupError !== null && <Notice tone="warn">{lookupError}</Notice>}

      <Section title="Відправлення">
        {dispatchPoints.length === 0 ? (
          <Notice tone="warn">
            Немає жодної точки відправлення. Додайте її в налаштуваннях
            інтеграції — без неї накладну не створити.
          </Notice>
        ) : (
          <>
            <Field label="Точка відправлення" required>
              <SelectInput
                onChange={(event) => setPointId(event.target.value)}
                value={pointId}
              >
                {dispatchPoints.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.isDefault ? ' · за замовчуванням' : ''}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {point !== null && (
              <p className="text-app-dim text-[12.5px] leading-5 text-pretty">
                Відправник: {point.senderName} · {point.phone}
                {point.companyName === null ? '' : ` · ${point.companyName}`}
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="Отримувач">
        <Field label="Ім’я отримувача" required>
          <TextInput
            onChange={(event) => setName(event.target.value)}
            placeholder="ПІБ"
            value={name}
          />
        </Field>
        <Field
          error={
            phone !== '' && !PHONE.test(trimmedPhone)
              ? 'Телефон у міжнародному форматі, напр. +380503381172'
              : undefined
          }
          label="Телефон"
          required
        >
          <TextInput
            className="font-mono"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+380"
            value={phone}
          />
        </Field>
        <SettlementPicker
          integrationId={integrationId}
          onPick={setSettlement}
          picked={settlement}
          savedHint={
            saved === null
              ? undefined
              : 'Збережений пункт залишається, доки не виберете інший.'
          }
          use="receiving"
        />

        <Field
          hint={
            settlementId === null
              ? 'Спершу оберіть населений пункт.'
              : 'Показані лише відділення, які видають відправлення.'
          }
          label="Відділення"
          required
        >
          <SelectInput
            disabled={settlementId === null || divisions === null}
            onChange={(event) =>
              setDivisionChoice(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
            value={divisionId === null ? '' : String(divisionId)}
          >
            <option value="">
              {divisions === null ? 'Завантажуємо…' : 'Оберіть відділення'}
            </option>
            {(divisions ?? []).map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <label className="flex items-center gap-2.5 text-[13.5px]">
          <input
            checked={isCompany}
            className="accent-brand size-4"
            onChange={(event) => setIsCompany(event.target.checked)}
            type="checkbox"
          />
          <span className="text-app-muted">
            Отримувач — компанія (назва та код у накладній)
          </span>
        </label>
        {isCompany && (
          <>
            <Field label="Назва компанії" required>
              <TextInput
                onChange={(event) => setCompanyName(event.target.value)}
                value={companyName}
              />
            </Field>
            <Field label="Ідентифікаційний код" required>
              <TextInput
                className="font-mono"
                onChange={(event) => setCompanyTin(event.target.value)}
                placeholder="ЄДРПОУ або ІПН"
                value={companyTin}
              />
            </Field>
          </>
        )}
      </Section>

      <Section
        aside={
          <span className="text-app-dim font-mono text-[11px] tracking-[0.1em] uppercase">
            {parcels.length} місць
          </span>
        }
        title="Посилки"
      >
        {parcels.map((parcel, index) => (
          <div
            className="border-app-line bg-app-input grid gap-3 rounded-[12px] border px-3.5 py-3"
            key={index}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
                Місце {index + 1}
              </span>
              {parcels.length > 1 && (
                <Button
                  aria-label={`Видалити місце ${index + 1}`}
                  className="min-h-9 px-2.5 text-xs"
                  onClick={() =>
                    setParcels((list) =>
                      list.filter((_, position) => position !== index),
                    )
                  }
                >
                  Видалити
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['weightKg', 'Вага, кг'],
                  ['lengthCm', 'Довжина, см'],
                  ['widthCm', 'Ширина, см'],
                  ['heightCm', 'Висота, см'],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  srLabel={`місце ${index + 1}`}
                  required
                >
                  <TextInput
                    className="font-mono"
                    inputMode="decimal"
                    onChange={(event) =>
                      setParcels((list) =>
                        list.map((item, position) =>
                          position === index
                            ? { ...item, [key]: event.target.value }
                            : item,
                        ),
                      )
                    }
                    value={parcel[key]}
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}
        <Button onClick={() => setParcels((list) => [...list, emptyParcel])}>
          Додати посилку
        </Button>
      </Section>

      <Section title="Вантаж">
        <Field label="Опис вантажу" required>
          <TextInput
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </Field>
        <Field
          hint="Скільки Нова пошта відшкодує в разі втрати."
          label="Оголошена вартість, ₴"
          required
        >
          <TextInput
            className="font-mono"
            inputMode="decimal"
            onChange={(event) => setDeclared(event.target.value)}
            value={declared}
          />
        </Field>
        <Field label="Оплата доставки" required>
          <SelectInput
            onChange={(event) => setPayer(event.target.value as PayerType)}
            value={payer}
          >
            <option value="Recipient">Платить отримувач</option>
            <option value="Sender">Платить відправник</option>
          </SelectInput>
        </Field>
        <Field
          hint="Оціночна вартість зворотної доставки, яку ви вводите самі."
          label="Оцінка повернення, ₴"
          required
        >
          <TextInput
            className="font-mono"
            inputMode="decimal"
            onChange={(event) => setReturnEstimate(event.target.value)}
            value={returnEstimate}
          />
        </Field>
      </Section>

      <section
        className={`grid gap-3.5 rounded-[16px] border px-4 py-4 ${
          quote.tone === 'ok'
            ? 'border-state-ok/25 bg-state-ok-soft'
            : quote.tone === 'warn'
              ? 'border-state-warn/25 bg-state-warn-soft'
              : quote.tone === 'danger'
                ? 'border-state-danger/25 bg-state-danger-soft'
                : 'border-app-line bg-app-raised'
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-[15px] font-bold tracking-[-0.01em] text-white">
            {quote.title}
          </h3>
          {shipment?.quoteAt != null && (
            <span className="text-app-dim font-mono text-[11px]">
              розраховано{' '}
              {new Date(shipment.quoteAt).toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <p className="text-app-muted text-[13px] leading-5 text-pretty">
          {quote.note}
        </p>

        {quote.showMoney && shipment?.quoteUah != null && (
          <dl
            className={`border-app-line bg-app-raised grid gap-2.5 rounded-[12px] border px-4 py-3.5 text-[13px] ${
              quote.dimMoney ? 'opacity-70' : ''
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-app-muted">Орієнтовна доставка</dt>
              <dd className="text-app-ink font-mono">
                {uah.format(shipment.quoteUah)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-app-muted">Оцінка повернення</dt>
              <dd className="text-app-ink font-mono">
                {uah.format(shipment.returnEstimateUah)}
              </dd>
            </div>
            <div className="border-app-line flex items-baseline justify-between gap-4 border-t pt-2.5">
              <dt className="text-app-ink font-semibold">
                Необхідна передоплата
              </dt>
              <dd className="text-brand font-mono text-[16px] font-bold">
                {total === null ? '—' : uah.format(total)}
              </dd>
            </div>
          </dl>
        )}

        <div>
          <Button
            aria-busy={busy === 'estimate'}
            disabled={busy !== null || draft === null}
            onClick={() => void estimate()}
            title={
              draft === null
                ? 'Заповніть отримувача, посилки й суми.'
                : undefined
            }
            variant={quote.canCreate ? 'ghost' : 'primary'}
          >
            {quote.action}
          </Button>
        </div>
        {quote.showMoney && (
          <p className="text-app-dim text-[12px] leading-5 text-pretty">
            Передоплата покриває доставку та можливе повернення. Це не тариф
            Нової пошти за доставку в один бік.
          </p>
        )}
      </section>
    </Sheet>
  )
}
