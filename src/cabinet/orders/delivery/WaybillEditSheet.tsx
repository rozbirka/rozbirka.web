import { useEffect, useRef, useState } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import { isProblemCode } from '@/api/errors'
import { shippingApi, type Shipment, type ShipmentDraft } from '@/api/shipping'
import { commonMessages, useLocale, useT } from '@/i18n'
import { isValidContactPhone, normalizePhone } from '@/lib/phone'
import { SheetGroup } from '../sheet-group'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { waybillMessages } from './waybill-messages'
import { recipientFullName, splitRecipientName } from './recipient-name'
import {
  dimensionsLine,
  parcelsFrom,
  parseDimensions,
  weightOf,
} from './waybill-view'

/** Why the change needs a new waybill: asked for, or refused by the carrier. */
export type RecreateReason = 'branch' | 'refused'

const formatNumber = (value: number) => String(value).replace('.', ',')

const decimal = (value: string): number | null => {
  const parsed = Number(value.replace(',', '.').trim())
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null
}

/**
 * «Редагувати ТТН» (5.2–5.4): the fields a created waybill may still change
 * before hand-over — the recipient's name and phone and the parcel. The new
 * figures are shown only once Nova Poshta confirms them; a change the carrier
 * takes only as a new waybill goes to the recreate path (5.5), and one made
 * after hand-over is refused with the reason (5.9).
 */
export function WaybillEditSheet({
  integrationId,
  onClose,
  onCloseAutoFocus,
  onRecreate,
  onSaved,
  orderId,
  shipment,
}: {
  integrationId: string
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  /** The change needs a new waybill; `draft` carries it over. */
  onRecreate: (draft: ShipmentDraft, reason: RecreateReason) => void
  /** Nova Poshta confirmed the change; the waybill as it now stands. */
  onSaved: (shipment: Shipment) => void
  orderId: string
  shipment: Shipment
}) {
  const { locale } = useLocale()
  const t = useT(waybillMessages)
  const tc = useT(commonMessages)
  const original = shipment.draft
  const [recipientName, setRecipientName] = useState(() =>
    splitRecipientName(original.recipient.name),
  )
  const name = recipientFullName(recipientName)
  const [phone, setPhone] = useState(original.recipient.phone)
  const [places, setPlaces] = useState(String(original.parcels.length || 1))
  const [weight, setWeight] = useState(formatNumber(weightOf(original.parcels)))
  const [dims, setDims] = useState(dimensionsLine(original.parcels))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const e164 = normalizePhone(phone, 'UA')
  const placesValue = /^\d+$/.test(places.trim()) ? Number(places) : null
  const weightValue = decimal(weight)
  const dimsValue = parseDimensions(dims)
  const invalid = {
    lastName: recipientName.lastName.trim() === '',
    firstName: recipientName.firstName.trim() === '',
    phone: !isValidContactPhone(e164),
    places: placesValue === null || placesValue < 1,
    weight: weightValue === null,
    dims: dimsValue === null,
  }
  const valid = !Object.values(invalid).some(Boolean)

  const changed = {
    name: name.trim() !== original.recipient.name,
    phone: e164 !== original.recipient.phone,
    places: placesValue !== original.parcels.length,
    weight: weightValue !== weightOf(original.parcels),
    dims: dims !== dimensionsLine(original.parcels),
  }
  const dirty = Object.values(changed).some(Boolean)

  const draft = (): ShipmentDraft => ({
    ...original,
    recipient: { ...original.recipient, name: name.trim(), phone: e164 },
    parcels:
      valid && (changed.places || changed.weight || changed.dims)
        ? parcelsFrom(placesValue!, weightValue!, dimsValue!)
        : original.parcels,
  })

  const fail = (message: string) => {
    setError(message)
    window.requestAnimationFrame(() => alertRef.current?.focus())
  }

  const save = async () => {
    if (busy || !valid || !dirty) return
    setBusy(true)
    setError(null)
    const next = draft()
    try {
      onSaved(
        await shippingApi.update(
          integrationId,
          orderId,
          shipment.version,
          next,
        ),
      )
    } catch (problem) {
      if (isProblemCode(problem, 'shipment_recreate_required'))
        onRecreate(next, 'refused')
      else if (isProblemCode(problem, 'shipment_not_editable'))
        fail(t('sentNotice'))
      else fail(deliveryProblemMessage(problem, locale))
    } finally {
      setBusy(false)
    }
  }

  const tail = original.recipient.phone.replace(/\D/g, '').slice(-4)

  return (
    <Sheet
      description={t('editDescription', { number: shipment.number ?? '' })}
      footer={
        <>
          <p className="text-app-muted m-0 min-w-0 flex-1">
            {busy ? t('waitingNp') : ''}
          </p>
          <Button disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            disabled={busy || invalid.lastName || invalid.firstName}
            onClick={() => onRecreate(draft(), 'branch')}
          >
            {t('needNewWaybill')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !valid || !dirty}
            onClick={() => void save()}
            variant="primary"
          >
            {busy ? t('saving') : t('saveChanges')}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={t('editTitle')}
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <SheetGroup title={t('groupRecipient')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['lastName', 'firstName'] as const).map((key) => (
            <Field
              key={key}
              error={
                invalid[key]
                  ? t(key === 'lastName' ? 'errorLastName' : 'errorFirstName')
                  : undefined
              }
              label={t(
                key === 'lastName' ? 'recipientLastName' : 'recipientFirstName',
              )}
              hint={key === 'lastName' ? t('recipientNameReview') : undefined}
              required
            >
              <TextInput
                aria-required
                autoComplete={key === 'lastName' ? 'family-name' : 'given-name'}
                onChange={(event) =>
                  setRecipientName((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                readOnly={busy}
                ref={key === 'lastName' ? nameRef : undefined}
                value={recipientName[key]}
              />
            </Field>
          ))}
          <Field
            hint={t('optionalPatronymic')}
            label={t('recipientMiddleName')}
          >
            <TextInput
              autoComplete="additional-name"
              onChange={(event) =>
                setRecipientName((current) => ({
                  ...current,
                  middleName: event.target.value,
                }))
              }
              readOnly={busy}
              value={recipientName.middleName}
            />
          </Field>
          <Field
            error={invalid.phone && phone !== '' ? t('errorPhone') : undefined}
            hint={changed.phone ? t('changedWas', { tail }) : undefined}
            label={t('phone')}
          >
            <TextInput
              className="font-mono"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              readOnly={busy}
              value={phone}
            />
          </Field>
        </div>
      </SheetGroup>

      <SheetGroup title={t('groupParcel')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            error={invalid.places ? t('errorPlaces') : undefined}
            hint={changed.places ? t('changed') : undefined}
            label={t('places')}
          >
            <TextInput
              inputMode="numeric"
              numeric
              onChange={(event) => setPlaces(event.target.value)}
              readOnly={busy}
              value={places}
            />
          </Field>
          <Field
            error={invalid.weight ? t('errorWeight') : undefined}
            hint={changed.weight ? t('changed') : undefined}
            label={t('weight')}
          >
            <div className="flex items-center gap-1.5">
              <TextInput
                inputMode="decimal"
                numeric
                onChange={(event) => setWeight(event.target.value)}
                readOnly={busy}
                value={weight}
              />
              <span aria-hidden className="rz-dim font-mono text-caption">
                {t('kg')}
              </span>
            </div>
          </Field>
          <Field
            className="col-span-2"
            error={invalid.dims ? t('errorDimensions') : undefined}
            hint={changed.dims ? t('changed') : undefined}
            label={t('dimensions')}
          >
            <div className="flex items-center gap-1.5">
              <TextInput
                className="font-mono"
                onChange={(event) => setDims(event.target.value)}
                readOnly={busy}
                value={dims}
              />
              <span aria-hidden className="rz-dim font-mono text-caption">
                {t('cm')}
              </span>
            </div>
          </Field>
        </div>
      </SheetGroup>

      <SheetGroup hint={t('editLimitsCaption')}>
        <Notice tone="info">{t('editLimits')}</Notice>
      </SheetGroup>
    </Sheet>
  )
}
