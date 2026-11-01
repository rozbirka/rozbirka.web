import { useEffect, useRef, useState } from 'react'
import { CustomerSearchPicker } from '@/components/customers/CustomerSearchPicker'
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
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { shippingApi, type Shipment, type ShipmentDraft } from '@/api/shipping'
import { commonMessages, useLocale, useT } from '@/i18n'
import { isValidContactPhone, normalizePhone } from '@/lib/phone'
import { SettlementPicker } from '../../integrations/settlement-picker'
import { SheetGroup } from '../sheet-group'
import { Switch } from '../../integrations/dispatch-point-form'
import { deliveryTrustMessages } from '../../customers/delivery-trust-messages'
import { hryvnia, uah } from './delivery-money'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { waybillMessages } from './waybill-messages'
import { recipientFullName, splitRecipientName } from './recipient-name'
import { SummaryList } from './WaybillCreateSheet'
import {
  dimensionsLine,
  parcelsFrom,
  parseDimensions,
  weightOf,
} from './waybill-view'

type FieldKey =
  | 'lastName'
  | 'firstName'
  | 'phone'
  | 'settlement'
  | 'division'
  | 'point'
  | 'places'
  | 'weight'
  | 'dimensions'
  | 'goods'

const ORDER: readonly FieldKey[] = [
  'lastName',
  'firstName',
  'phone',
  'settlement',
  'division',
  'point',
  'places',
  'weight',
  'dimensions',
  'goods',
]

const MISSING = {
  lastName: 'missingLastName',
  firstName: 'missingFirstName',
  phone: 'missingPhone',
  settlement: 'missingSettlement',
  division: 'missingDivision',
  point: 'missingPoint',
  places: 'missingPlaces',
  weight: 'missingWeight',
  dimensions: 'missingDimensions',
  goods: 'missingGoods',
} as const

const ERROR = {
  lastName: 'errorLastName',
  firstName: 'errorFirstName',
  phone: 'errorPhone',
  settlement: 'errorSettlement',
  division: 'errorDivision',
  point: 'errorPoint',
  places: 'errorPlaces',
  weight: 'errorWeight',
  dimensions: 'errorDimensions',
  goods: 'missingGoods',
} as const

const decimal = (value: string): number | null => {
  const parsed = Number(value.replace(',', '.').trim())
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null
}

const formatNumber = (value: number) => String(value).replace('.', ',')

/**
 * «Оформлення доставки» (module 46, 4.2–4.3): who receives the parcel, where
 * it goes, where it leaves from and what it is. It saves a draft and nothing
 * more — the waybill is created separately, after the readiness check and
 * the quote — so the sheet never talks to the carrier beyond its catalogues.
 *
 * A missing detail is named in the notice at the top and on the field
 * itself; what was typed stays in the form.
 */
export function DeliveryDrawer({
  customerSearchAllowed = false,
  customerPhone,
  delivery,
  dispatchPoints,
  integrationId,
  onClose,
  onCloseAutoFocus,
  onMoneyChanged,
  onSaved,
  orderId,
  orderNumber,
  prefill = null,
  shipment,
}: {
  customerSearchAllowed?: boolean
  customerName: string | null
  customerPhone: string | null
  /** The order's money: the post-payment is whatever it still owes. */
  delivery: DeliveryOrder
  dispatchPoints: NovaPoshtaDispatchPoint[]
  integrationId: string
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onMoneyChanged: (delivery: DeliveryOrder) => void
  onSaved: (shipment: Shipment) => void
  orderId: string
  orderNumber: number
  /**
   * What to start from when there is no live draft: the waybill just
   * cancelled for a change, with that change already applied.
   */
  prefill?: ShipmentDraft | null
  shipment: Shipment | null
}) {
  const { locale } = useLocale()
  const t = useT(waybillMessages)
  const td = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const tt = useT(deliveryTrustMessages)
  const [waiveDeposit, setWaiveDeposit] = useState(delivery.depositWaived)
  const saved =
    (shipment?.state === 'Draft' ? shipment.draft : null) ?? prefill ?? null
  const activePoint = (id: string | null | undefined) =>
    dispatchPoints.find((point) => point.id === id) ?? null
  const defaultPoint =
    dispatchPoints.find((point) => point.isDefault) ?? dispatchPoints[0] ?? null

  // A draft pointing at a retired dispatch point moves to the current one:
  // the old sender is exactly what has to be checked again (frame 2.9).
  const [pointId, setPointId] = useState(
    activePoint(saved?.dispatchPointId ?? shipment?.dispatchPointId)?.id ??
      defaultPoint?.id ??
      '',
  )
  // Customer labels may be nicknames; only saved postal details can prefill a recipient name.
  const [recipientName, setRecipientName] = useState(() =>
    splitRecipientName(saved?.recipient.name ?? ''),
  )
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientCustomerId, setRecipientCustomerId] = useState<string | null>(
    null,
  )
  const [phone, setPhone] = useState(
    saved?.recipient.phone ?? customerPhone ?? '',
  )
  const [settlement, setSettlement] = useState<NovaPoshtaSettlement | null>(
    saved?.recipient.settlementRef
      ? {
          ref: saved.recipient.settlementRef,
          name: saved.recipient.settlementName ?? '',
          prohibitedSending: null,
          prohibitedIssuance: null,
        }
      : null,
  )
  const [loadedDivisions, setLoadedDivisions] = useState<{
    settlementRef: string
    items: NovaPoshtaDivision[]
  } | null>(null)
  const [divisionChoice, setDivisionChoice] = useState<string | null>(
    saved?.recipient.warehouseRef ?? null,
  )
  const [places, setPlaces] = useState(
    saved?.parcels.length ? String(saved.parcels.length) : '1',
  )
  const [weight, setWeight] = useState(
    saved?.parcels.length ? formatNumber(weightOf(saved.parcels)) : '',
  )
  const [dims, setDims] = useState(
    saved?.parcels.length ? dimensionsLine(saved.parcels) : '',
  )
  // Core keeps the agreed hryvnia total apart from the order lines and only
  // learns it here; an order configured without one has to be told what the
  // goods cost before the post-payment means anything.
  const askGoods = delivery.agreedTotalUah <= 0
  const [goods, setGoods] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, true>>>({})
  const alertRef = useRef<HTMLDivElement | null>(null)
  // One box per field: the pickers own their inputs, so focus finds the
  // control inside the box rather than needing a ref into each component.
  const boxes = useRef<Partial<Record<FieldKey, HTMLDivElement | null>>>({})
  const focusField = (key: FieldKey) =>
    boxes.current[key]?.querySelector<HTMLElement>('input, select')?.focus()

  const settlementRef = settlement?.ref ?? null

  useEffect(() => {
    if (settlementRef === null) return
    const controller = new AbortController()
    void integrationsApi
      .divisions(integrationId, settlementRef, 1, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted)
            setLoadedDivisions({
              settlementRef,
              items: page.items.filter((item) => item.receivingAllowed),
            })
        },
        () => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({ settlementRef, items: [] })
            setLookupError(td('divisionsUnavailable'))
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, settlementRef, td])

  const divisions =
    settlementRef !== null && loadedDivisions?.settlementRef === settlementRef
      ? loadedDivisions.items
      : null
  const division =
    divisions?.find((item) => item.ref === divisionChoice) ?? null
  const point = activePoint(pointId)

  const e164 = normalizePhone(phone, 'UA')
  const placesValue = /^\d+$/.test(places.trim()) ? Number(places) : null
  const weightValue = decimal(weight)
  const dimsValue = parseDimensions(dims)
  const goodsValue = askGoods ? hryvnia(goods) : delivery.agreedTotalUah
  const declared = askGoods ? (goodsValue ?? 0) : delivery.agreedTotalUah
  const balance = askGoods
    ? Math.max(0, (goodsValue ?? 0) - delivery.appliedUah)
    : delivery.outstandingUah

  const problems = (): FieldKey[] =>
    ORDER.filter((key) => {
      switch (key) {
        case 'lastName':
          return recipientName.lastName.trim() === ''
        case 'firstName':
          return recipientName.firstName.trim() === ''
        case 'phone':
          return !isValidContactPhone(e164)
        case 'settlement':
          return settlementRef === null
        case 'division':
          return division === null
        case 'point':
          return point === null
        case 'places':
          return placesValue === null || placesValue < 1
        case 'weight':
          return weightValue === null
        case 'dimensions':
          return dimsValue === null
        case 'goods':
          return askGoods && (goodsValue === null || goodsValue <= 0)
      }
    })

  // Focus lands on the first required field still empty (section 11).
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const first = problems()[0] ?? 'lastName'
      focusField(first)
    })
    return () => window.cancelAnimationFrame(frame)
    // Only on open: later focus belongs to the person typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (busy) return
    const missing = problems()
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((key) => [key, true])))
      setError(null)
      window.requestAnimationFrame(() => alertRef.current?.focus())
      return
    }
    setErrors({})
    const draft: ShipmentDraft = {
      recipient: {
        name: recipientFullName(recipientName),
        phone: e164,
        settlementRef: settlementRef!,
        warehouseRef: division!.ref,
        // Carried for the cabinet to show; the carrier reads the references.
        warehouseName: division!.name,
        settlementName: settlement?.name ?? null,
        companyName: saved?.recipient.companyName ?? null,
        companyTin: saved?.recipient.companyTin ?? null,
      },
      parcels: parcelsFrom(placesValue!, weightValue!, dimsValue!),
      declaredValueUah: declared,
      payerType: saved?.payerType ?? 'Recipient',
      description: saved?.description ?? td('cargoDescriptionDefault'),
      dispatchPointId: point!.id,
    }
    setBusy(true)
    setError(null)
    try {
      const waiver = delivery.customerTrusted && waiveDeposit
      if (waiver !== delivery.depositWaived) {
        onMoneyChanged(
          await deliveryApi.configure(
            orderId,
            askGoods ? goodsValue! : undefined,
            waiver,
          ),
        )
      } else if (askGoods && goodsValue !== null) {
        onMoneyChanged(await deliveryApi.configure(orderId, goodsValue))
      }
      onSaved(await shippingApi.saveDraft(integrationId, orderId, draft))
    } catch (problem) {
      setError(deliveryProblemMessage(problem, locale))
      window.requestAnimationFrame(() => alertRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }

  const missing = ORDER.filter((key) => errors[key] === true)
  const fieldError = (key: FieldKey) =>
    errors[key] === true ? t(ERROR[key]) : undefined
  const clear = (key: FieldKey) =>
    setErrors((current) => {
      if (current[key] !== true) return current
      const next = { ...current }
      delete next[key]
      return next
    })

  return (
    <Sheet
      bodyClassName="gap-4"
      className="sm:w-[min(600px,100vw)] [&>header_p]:text-caption [&>div:last-child_p]:text-caption [&>div:last-child]:pb-[calc(10px+env(safe-area-inset-bottom))]"
      pending={busy}
      description={t('formDescription', { number: String(orderNumber) })}
      footer={
        <>
          <p className="text-app-muted m-0 min-w-0 flex-1">
            {missing.length > 0 ? '' : t('formNote')}
          </p>
          <Button disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy}
            onClick={() => void save()}
            variant="primary"
          >
            {td('saveDraft')}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={t('formTitle')}
    >
      {missing.length === 0 ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice block tone="danger">
            <p className="m-0">
              {t('missing', {
                list: missing.map((key) => t(MISSING[key])).join(', '),
              })}
            </p>
            <ul className="m-0 mt-1 grid list-none gap-1 p-0">
              {missing.map((key) => (
                <li key={key}>
                  <button
                    className="cursor-pointer text-left underline underline-offset-2"
                    onClick={() => focusField(key)}
                    type="button"
                  >
                    {t(MISSING[key])}
                  </button>
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      )}
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {lookupError === null ? null : <Notice tone="warn">{lookupError}</Notice>}

      <SheetGroup n="1" title={t('groupRecipient')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {customerSearchAllowed && (
            <div className="sm:col-span-2">
              <CustomerSearchPicker
                disabled={busy}
                label={t('recipientSearch')}
                onQueryChange={(next) => {
                  setRecipientQuery(next)
                  setRecipientCustomerId(null)
                }}
                onSelect={(customer) => {
                  setRecipientQuery(customer.name)
                  setPhone(customer.phone ?? '')
                  setRecipientCustomerId(customer.id)
                  clear('phone')
                }}
                query={recipientQuery}
                selectedId={recipientCustomerId}
                showLabel
              />
            </div>
          )}
          {(['lastName', 'firstName'] as const).map((key) => (
            <div
              key={key}
              ref={(element) => {
                boxes.current[key] = element
              }}
            >
              <Field
                error={fieldError(key)}
                label={t(
                  key === 'lastName'
                    ? 'recipientLastName'
                    : 'recipientFirstName',
                )}
                hint={key === 'lastName' ? t('recipientNameReview') : undefined}
                required
              >
                <TextInput
                  aria-required
                  autoComplete={
                    key === 'lastName' ? 'family-name' : 'given-name'
                  }
                  onChange={(event) => {
                    setRecipientName((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                    setRecipientCustomerId(null)
                    clear(key)
                  }}
                  readOnly={busy}
                  value={recipientName[key]}
                />
              </Field>
            </div>
          ))}
          <Field
            hint={t('optionalPatronymic')}
            label={t('recipientMiddleName')}
          >
            <TextInput
              autoComplete="additional-name"
              onChange={(event) => {
                setRecipientName((current) => ({
                  ...current,
                  middleName: event.target.value,
                }))
                setRecipientCustomerId(null)
              }}
              readOnly={busy}
              value={recipientName.middleName}
            />
          </Field>
          <div
            ref={(element) => {
              boxes.current.phone = element
            }}
          >
            <Field error={fieldError('phone')} label={t('phone')} required>
              <TextInput
                className="font-mono"
                inputMode="tel"
                onChange={(event) => {
                  setPhone(event.target.value)
                  setRecipientCustomerId(null)
                  clear('phone')
                }}
                placeholder="+380 XX XXX XX XX"
                value={phone}
              />
            </Field>
          </div>
        </div>
      </SheetGroup>

      <SheetGroup n="2" title={t('groupTo')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div
            ref={(element) => {
              boxes.current.settlement = element
            }}
          >
            <SettlementPicker
              error={fieldError('settlement')}
              integrationId={integrationId}
              onPick={(next) => {
                setSettlement(next)
                setDivisionChoice(null)
                clear('settlement')
              }}
              picked={settlement}
              use="receiving"
            />
          </div>
          <div
            ref={(element) => {
              boxes.current.division = element
            }}
          >
            <Field
              error={fieldError('division')}
              label={t('division')}
              required
            >
              <SelectInput
                disabled={settlementRef === null || divisions === null}
                onChange={(event) => {
                  setDivisionChoice(
                    event.target.value === '' ? null : event.target.value,
                  )
                  clear('division')
                }}
                value={division?.ref ?? ''}
              >
                <option value="">
                  {settlementRef !== null && divisions === null
                    ? td('divisionsLoading')
                    : t('divisionPick')}
                </option>
                {(divisions ?? []).map((item) => (
                  <option key={item.ref} value={item.ref}>
                    {item.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </div>
      </SheetGroup>

      <SheetGroup n="3" title={t('groupFrom')}>
        {dispatchPoints.length === 0 ? (
          <Notice tone="warn">{td('noDispatchPoints')}</Notice>
        ) : (
          <div
            ref={(element) => {
              boxes.current.point = element
            }}
          >
            <Field
              error={fieldError('point')}
              hint={
                point === null
                  ? undefined
                  : t('senderHint', {
                      name: point.companyName ?? point.senderName,
                    })
              }
              label={t('dispatchPoint')}
            >
              <SelectInput
                onChange={(event) => {
                  setPointId(event.target.value)
                  clear('point')
                }}
                value={pointId}
              >
                {point === null ? <option value="" /> : null}
                {dispatchPoints.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        )}
      </SheetGroup>

      <SheetGroup n="4" title={t('groupParcel')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            ref={(element) => {
              boxes.current.places = element
            }}
          >
            <Field error={fieldError('places')} label={t('places')} required>
              <TextInput
                inputMode="numeric"
                numeric
                onChange={(event) => {
                  setPlaces(event.target.value)
                  clear('places')
                }}
                value={places}
              />
            </Field>
          </div>
          <div
            ref={(element) => {
              boxes.current.weight = element
            }}
          >
            <Field error={fieldError('weight')} label={t('weight')} required>
              <div className="rz-input-group">
                <TextInput
                  inputMode="decimal"
                  numeric
                  onChange={(event) => {
                    setWeight(event.target.value)
                    clear('weight')
                  }}
                  value={weight}
                />
                <span aria-hidden className="rz-input-group__addon font-mono">
                  {t('kg')}
                </span>
              </div>
            </Field>
          </div>
          <div
            className="col-span-2"
            ref={(element) => {
              boxes.current.dimensions = element
            }}
          >
            <Field
              error={fieldError('dimensions')}
              label={t('dimensions')}
              required
            >
              <div className="rz-input-group">
                <TextInput
                  className="font-mono"
                  onChange={(event) => {
                    setDims(event.target.value)
                    clear('dimensions')
                  }}
                  placeholder="60×40×30"
                  value={dims}
                />
                <span aria-hidden className="rz-input-group__addon font-mono">
                  {t('cm')}
                </span>
              </div>
            </Field>
          </div>
        </div>
      </SheetGroup>

      <SheetGroup hint={t('codRule')} n="5" title={t('groupCod')}>
        {delivery.depositRequired && delivery.customerTrusted ? (
          <div className="rz-inset grid gap-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={!waiveDeposit}
                disabled={busy}
                label={tt('require')}
                onChange={(required) => setWaiveDeposit(!required)}
              />
              <span className="rz-strong">{tt('require')}</span>
            </div>
            <p className="rz-caption m-0">
              {tt(waiveDeposit ? 'waived' : 'required')}
            </p>
          </div>
        ) : (
          <p className="rz-caption m-0">
            {tt(delivery.depositRequired ? 'required' : 'policyOff')}
          </p>
        )}
        {askGoods ? (
          <div
            ref={(element) => {
              boxes.current.goods = element
            }}
          >
            <Field
              error={fieldError('goods')}
              hint={td('goodsHint')}
              label={td('goodsLabel')}
              required
            >
              <TextInput
                className="font-mono text-left"
                dir="ltr"
                inputMode="decimal"
                onChange={(event) => {
                  setGoods(event.target.value)
                  clear('goods')
                }}
                value={goods}
              />
            </Field>
          </div>
        ) : null}
        <SummaryList
          rows={[
            { label: t('codBalance'), value: uah(balance, locale) },
            { label: t('codDeclared'), value: uah(declared, locale) },
          ]}
          total={{ label: t('codOnWaybill'), value: uah(balance, locale) }}
        />
      </SheetGroup>
    </Sheet>
  )
}
