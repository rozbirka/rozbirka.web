import { useEffect, useState } from 'react'
import {
  Button,
  Field,
  Notice,
  SectionPanel,
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
import { cn } from '@/lib/utils'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import {
  shippingApi,
  type ParcelInput,
  type PayerType,
  type Shipment,
  type ShipmentDraft,
} from '@/api/shipping'
import type { BusinessCountry } from '@/api/tenant-settings'
import { commonMessages, formatMoney, useFormat, useLocale, useT } from '@/i18n'
import { SettlementPicker } from '../../integrations/settlement-picker'
import {
  prepayment,
  quotePresentation,
  quoteState,
  sameDraft,
  type QuoteState,
} from './delivery-labels'
import { deliveryDrawerMessages } from './drawer-messages'
import { uah, wholeUah } from './delivery-money'
import {
  deliveryProblemMessage,
  phoneExample,
} from './nova-poshta-availability'

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

/**
 * The agreed goods total, where an empty field is an answer: goods already
 * paid for owe nothing and the parcel travels without a post-payment. `decimal`
 * treats zero as absent, which is right for a weight and wrong here.
 */
const hryvnia = (value: string): number | null => {
  const text = value.trim()
  if (text === '') return 0
  const parsed = Number(text.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
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
  // The same divided sections as every other form drawer, not cards in a card.
  return (
    <SectionPanel aside={aside} headingLevel={3} title={title} variant="plain">
      {children}
    </SectionPanel>
  )
}

/**
 * Booking one delivery for one order. The form is a draft on Core until it is
 * quoted, and Core clears the quote whenever the draft changes — so the panel
 * never offers a waybill on numbers that no longer answer the form.
 */
export function DeliveryDrawer({
  countryCode = null,
  customerName,
  customerPhone,
  declaredValue,
  delivery,
  dispatchPoints,
  paid,
  integrationId,
  onChanged,
  onClose,
  onMoneyChanged,
  orderId,
  shipment,
}: {
  /** The tenant's country; only picks the phone example. */
  countryCode?: BusinessCountry | null
  customerName: string | null
  customerPhone: string | null
  declaredValue: number | null
  /** The order's money, so the post-payment can be set where it is decided. */
  delivery: DeliveryOrder
  /**
   * What the customer has already handed over, in whatever currency they used.
   * A dollar payment is invisible to the hryvnia post-payment arithmetic, so
   * the only thing standing between the customer and paying twice is seeing it
   * here, beside the field that decides what the carrier collects.
   */
  paid: { amount: number; currency: string } | null
  dispatchPoints: NovaPoshtaDispatchPoint[]
  integrationId: string
  onChanged: (shipment: Shipment) => void
  onClose: () => void
  onMoneyChanged: (delivery: DeliveryOrder) => void
  orderId: string
  shipment: Shipment | null
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const format = useFormat()
  const example = phoneExample(countryCode)
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
    settlementRef: string
    items: NovaPoshtaDivision[]
  } | null>(null)
  const [divisionChoice, setDivisionChoice] = useState<string | null>(
    saved?.recipient.warehouseRef ?? null,
  )
  const [parcels, setParcels] = useState<ParcelDraft[]>(
    saved?.parcels.length ? saved.parcels.map(toParcelDraft) : [emptyParcel],
  )
  const [description, setDescription] = useState(
    saved?.description ?? t('cargoDescriptionDefault'),
  )
  const [declared, setDeclared] = useState(
    String(saved?.declaredValueUah ?? declaredValue ?? ''),
  )
  const [payer, setPayer] = useState<PayerType>(saved?.payerType ?? 'Recipient')
  // The price of the goods, in hryvnia. The post-payment follows from it —
  // never the other way round, or editing what the carrier collects would
  // quietly rewrite what the order is worth.
  const [goods, setGoods] = useState(
    delivery.agreedTotalUah > 0 ? String(delivery.agreedTotalUah) : '',
  )

  const [busy, setBusy] = useState<null | 'draft' | 'estimate' | 'create'>(null)
  const [error, setError] = useState<string | null>(null)
  const [quoteFailure, setQuoteFailure] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // The saved draft's settlement stands until another is picked.
  const settlementRef =
    settlement?.ref ?? saved?.recipient.settlementRef ?? null

  useEffect(() => {
    if (settlementRef === null) return
    const controller = new AbortController()
    void integrationsApi
      .divisions(integrationId, settlementRef, 1, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({
              settlementRef,
              items: page.items.filter((item) => item.receivingAllowed),
            })
          }
        },
        () => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({ settlementRef, items: [] })
            setLookupError(t('divisionsUnavailable'))
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, settlementRef, t])

  const divisions =
    settlementRef !== null && loadedDivisions?.settlementRef === settlementRef
      ? loadedDivisions.items
      : null
  const division =
    divisions?.find((item) => item.ref === divisionChoice) ?? null
  const warehouseRef = division?.ref ?? null

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
  const goodsUah = hryvnia(goods)
  // What Nova Poshta will hold at the counter: the goods less what the
  // customer has already handed over.
  const codUah =
    goodsUah === null ? null : Math.max(0, goodsUah - delivery.appliedUah)
  const ready =
    name.trim() !== '' &&
    PHONE.test(trimmedPhone) &&
    settlementRef !== null &&
    warehouseRef !== null &&
    parcelsReady &&
    declaredValueUah !== null &&
    description.trim() !== '' &&
    pointId !== '' &&
    (!isCompany || (companyName.trim() !== '' && companyTin.trim() !== ''))

  const draft: ShipmentDraft | null = ready
    ? {
        recipient: {
          name: name.trim(),
          phone: trimmedPhone,
          settlementRef: settlementRef,
          warehouseRef: warehouseRef,
          // Carried for the cabinet to show; the carrier reads the references.
          warehouseName: division?.name ?? null,
          settlementName: settlement?.name ?? null,
          companyName: isCompany ? companyName.trim() : null,
          companyTin: isCompany ? companyTin.trim() : null,
        },
        parcels: parcelValues as ParcelInput[],
        declaredValueUah: declaredValueUah,
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
  const quote = quotePresentation(state, locale)
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
      const message = deliveryProblemMessage(problem, locale)
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
    // A figure that does not parse is not a zero: sending one would ship the
    // parcel collecting nothing while the operator believes they typed a sum.
    if (goodsUah === null) return
    if (goodsUah !== delivery.agreedTotalUah) {
      const money = await run('create', () =>
        deliveryApi.configure(orderId, goodsUah),
      )
      if (money === null) return
      onMoneyChanged(money)
    }
    const result = await run('create', () =>
      shippingApi.create(integrationId, orderId),
    )
    if (result !== null) onChanged(result)
  }

  const point = dispatchPoints.find((item) => item.id === pointId) ?? null

  return (
    <Sheet
      description={t('bookingDescription')}
      eyebrow={t('eyebrowNp')}
      footer={
        <>
          <Button
            aria-busy={busy === 'draft'}
            disabled={busy !== null || draft === null}
            onClick={() => void saveDraft()}
          >
            {t('saveDraft')}
          </Button>
          <Button
            aria-busy={busy === 'create'}
            disabled={busy !== null || !quote.canCreate}
            onClick={() => void create()}
            title={quote.canCreate ? undefined : t('createNeedsQuote')}
            variant="primary"
          >
            {t('createWaybill')}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && busy === null) onClose()
      }}
      open
      size="lg"
      title={t('bookingTitle')}
    >
      {error !== null && <Notice tone="danger">{error}</Notice>}
      {lookupError !== null && <Notice tone="warn">{lookupError}</Notice>}

      <div className="grid">
        <Section title={t('sectionDispatch')}>
          {dispatchPoints.length === 0 ? (
            <Notice tone="warn">{t('noDispatchPoints')}</Notice>
          ) : (
            <>
              <Field label={t('dispatchPoint')} required>
                <SelectInput
                  onChange={(event) => setPointId(event.target.value)}
                  value={pointId}
                >
                  {dispatchPoints.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.isDefault ? t('defaultPoint') : ''}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              {point !== null && (
                <p className="text-app-dim text-[12.5px] leading-5 text-pretty">
                  {t('sender', {
                    details: [point.senderName, point.phone, point.companyName]
                      .filter((part) => part !== null && part !== '')
                      .join(' · '),
                  })}
                </p>
              )}
            </>
          )}
        </Section>

        <Section title={t('sectionRecipient')}>
          <Field label={t('recipientName')} required>
            <TextInput
              onChange={(event) => setName(event.target.value)}
              placeholder={t('recipientNamePlaceholder')}
              value={name}
            />
          </Field>
          <Field
            error={
              phone !== '' && !PHONE.test(trimmedPhone)
                ? t('phoneFormat', { example })
                : undefined
            }
            label={t('phone')}
            required
          >
            <TextInput
              className="font-mono"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder={example}
              value={phone}
            />
          </Field>
          <SettlementPicker
            integrationId={integrationId}
            onPick={setSettlement}
            picked={settlement}
            savedHint={saved === null ? undefined : t('savedSettlement')}
            use="receiving"
          />

          <Field
            hint={
              settlementRef === null
                ? t('divisionPickSettlement')
                : t('divisionHint')
            }
            label={t('division')}
            required
          >
            <SelectInput
              disabled={settlementRef === null || divisions === null}
              onChange={(event) =>
                setDivisionChoice(
                  event.target.value === '' ? null : event.target.value,
                )
              }
              value={warehouseRef ?? ''}
            >
              <option value="">
                {divisions === null ? t('divisionsLoading') : t('divisionPick')}
              </option>
              {(divisions ?? []).map((item) => (
                <option key={item.ref} value={item.ref}>
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
            <span className="text-app-muted">{t('isCompany')}</span>
          </label>
          {isCompany && (
            <>
              <Field label={t('companyName')} required>
                <TextInput
                  onChange={(event) => setCompanyName(event.target.value)}
                  value={companyName}
                />
              </Field>
              <Field label={t('companyTin')} required>
                <TextInput
                  className="font-mono"
                  onChange={(event) => setCompanyTin(event.target.value)}
                  placeholder={t('companyTinPlaceholder')}
                  value={companyTin}
                />
              </Field>
            </>
          )}
        </Section>

        <Section
          aside={
            <span className="text-app-dim font-mono text-[11px] tracking-[0.1em] uppercase">
              {t('parcelsCount', { count: parcels.length })}
            </span>
          }
          title={t('sectionParcels')}
        >
          {parcels.map((parcel, index) => (
            <div
              className="border-app-line bg-app-input grid gap-3 rounded-[12px] border px-3.5 py-3"
              key={index}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
                  {t('parcelPlace', { number: index + 1 })}
                </span>
                {parcels.length > 1 && (
                  <Button
                    aria-label={t('parcelRemove', { number: index + 1 })}
                    className="min-h-9 px-2.5 text-xs"
                    onClick={() =>
                      setParcels((list) =>
                        list.filter((_, position) => position !== index),
                      )
                    }
                  >
                    {tc('delete')}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ['weightKg', t('weight')],
                    ['lengthCm', t('length')],
                    ['widthCm', t('width')],
                    ['heightCm', t('height')],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    srLabel={t('parcelSr', { number: index + 1 })}
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
            {t('addParcel')}
          </Button>
        </Section>

        <Section title={t('sectionCargo')}>
          <Field label={t('cargoDescription')} required>
            <TextInput
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </Field>
          <Field hint={t('declaredHint')} label={t('declaredLabel')} required>
            <TextInput
              className="font-mono"
              inputMode="decimal"
              onChange={(event) => setDeclared(event.target.value)}
              value={declared}
            />
          </Field>
          <Field label={t('payer')} required>
            <SelectInput
              onChange={(event) => setPayer(event.target.value as PayerType)}
              value={payer}
            >
              <option value="Recipient">{t('payerRecipient')}</option>
              <option value="Sender">{t('payerSender')}</option>
            </SelectInput>
          </Field>
        </Section>
      </div>

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
              {t('quotedAt', {
                when:
                  format.dateWith(shipment.quoteAt, {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) ?? shipment.quoteAt,
              })}
            </span>
          )}
        </div>
        <p className="text-app-muted text-[13px] leading-5 text-pretty">
          {quote.note}
        </p>

        {paid === null ? null : (
          <Notice tone="info">
            {t('alreadyPaidBefore')}{' '}
            <span className="font-mono">
              {formatMoney(paid.amount, paid.currency, locale)}
            </span>
            {t('alreadyPaidAfter')}
          </Notice>
        )}

        <Field
          error={goodsUah === null ? t('goodsError') : undefined}
          hint={t('goodsHint')}
          label={t('goodsLabel')}
        >
          <TextInput
            className="font-mono tabular-nums"
            inputMode="decimal"
            onChange={(event) => setGoods(event.target.value)}
            placeholder="0"
            value={goods}
          />
        </Field>

        {/* Derived, never typed: the carrier collects what the order still
            owes, and showing it as a field invited editing the price of the
            goods by accident. */}
        <dl className="border-app-line bg-app-raised grid grid-cols-[1fr_auto] items-baseline gap-y-2 rounded-[12px] border px-4 py-3.5 text-[13px]">
          <dt className="text-app-muted">{t('alreadyPaid')}</dt>
          <dd className="text-right font-mono tabular-nums">
            {uah(delivery.appliedUah, locale)}
          </dd>
          <dt className="font-semibold">{t('codOnWaybill')}</dt>
          <dd
            className={cn(
              'text-right font-mono text-[15px] tabular-nums',
              codUah === null || codUah === 0 ? 'text-app-muted' : 'text-white',
            )}
          >
            {codUah === null ? '—' : uah(codUah, locale)}
          </dd>
          <p className="text-app-dim col-span-2 -mt-0.5 text-[12px] text-pretty">
            {codUah === 0 ? t('codNothing') : t('codNote')}
          </p>
        </dl>

        {quote.showMoney && shipment?.quoteUah != null && (
          <dl
            className={`border-app-line bg-app-raised grid gap-2.5 rounded-[12px] border px-4 py-3.5 text-[13px] ${
              quote.dimMoney ? 'opacity-70' : ''
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-app-muted">{t('deliveryThere')}</dt>
              <dd className="text-app-ink font-mono">
                {wholeUah(shipment.quoteUah, locale)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-app-muted">{t('deliveryBack')}</dt>
              <dd className="text-app-ink font-mono">
                {wholeUah(shipment.returnEstimateUah, locale)}
              </dd>
            </div>
            <div className="border-app-line flex items-baseline justify-between gap-4 border-t pt-2.5">
              <dt className="text-app-ink font-semibold">
                {t('prepaymentNeeded')}
              </dt>
              <dd className="text-brand font-mono text-[16px] font-bold">
                {total === null ? '—' : wholeUah(total, locale)}
              </dd>
            </div>
          </dl>
        )}

        <div>
          <Button
            aria-busy={busy === 'estimate'}
            disabled={busy !== null || draft === null}
            onClick={() => void estimate()}
            title={draft === null ? t('fillForm') : undefined}
            variant={quote.canCreate ? 'ghost' : 'primary'}
          >
            {quote.action}
          </Button>
        </div>
        {quote.showMoney && (
          <p className="text-app-dim text-[12px] leading-5 text-pretty">
            {t('quoteExplained')}
          </p>
        )}
      </section>
    </Sheet>
  )
}
