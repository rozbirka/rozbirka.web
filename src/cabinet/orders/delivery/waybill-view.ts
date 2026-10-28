import type { DeliveryOrder } from '@/api/delivery'
import type {
  ExternalShipmentPreview,
  ParcelInput,
  Shipment,
  ShipmentDraft,
  ShippingContact,
} from '@/api/shipping'
import { translate, type Locale, type MessageParams } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { QUOTE_TTL_MS } from './delivery-labels'
import { deliveryMessages } from './messages'

/**
 * Where an order's waybill stands, read once from the two records Core keeps
 * (module 46 §4–5). Every block, button and sheet of the order's Nova Poshta
 * card is chosen from this one value, so the state×action matrix of section
 * 11 lives in a single place.
 */
export type WaybillStage =
  | 'none'
  | 'draft'
  /** A draft whose dispatch point was replaced in the settings (frame 2.9). */
  | 'draftStale'
  | 'creating'
  | 'unknown'
  | 'created'
  | 'sent'
  | 'received'
  | 'cancelling'
  | 'cancelUnknown'
  | 'cancelled'

export function waybillStage(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
  activePointIds: readonly string[],
): WaybillStage {
  if (shipment === null) return 'none'
  switch (shipment.state) {
    case 'Draft':
      // Completing a new setup deactivates every older dispatch point and
      // drops the drafts' quotes. A draft still pointing at a retired point
      // has to be checked against the new sender before it can be quoted.
      // An empty list is a points read that failed, not a retired point.
      return activePointIds.length > 0 &&
        !activePointIds.includes(shipment.dispatchPointId)
        ? 'draftStale'
        : 'draft'
    case 'Creating':
      return 'creating'
    case 'Unknown':
      return 'unknown'
    case 'Cancelling':
      return 'cancelling'
    case 'CancelUnknown':
      return 'cancelUnknown'
    case 'Cancelled':
      return 'cancelled'
    default:
      if ((shipment.receivedAt ?? delivery.receivedAt) !== null)
        return 'received'
      if ((shipment.dispatchedAt ?? delivery.dispatchedAt) !== null)
        return 'sent'
      return 'created'
  }
}

/** The stages a carrier operation left without an answer. */
export const unresolvedStage = (stage: WaybillStage): boolean =>
  stage === 'unknown' ||
  stage === 'cancelUnknown' ||
  stage === 'creating' ||
  stage === 'cancelling'

/** The stages that have a live waybill number on the carrier's side. */
export const liveWaybillStage = (stage: WaybillStage): boolean =>
  stage === 'created' || stage === 'sent' || stage === 'received'

const tr = (
  locale: Locale,
  key: keyof typeof deliveryMessages.uk,
  params?: MessageParams,
) => translate(deliveryMessages, locale, key, params)

/** `Ірина Коваль · +380 67 214 55 08`. */
export const contactLine = (contact: Pick<ShippingContact, 'name' | 'phone'>) =>
  [contact.name, contact.phone === '' ? '' : formatPhone(contact.phone)]
    .filter((part) => part !== '')
    .join(' · ')

/** `Київ` out of `м. Київ, Київська обл.` — the town a clerk says. */
const town = (name: string | null | undefined): string =>
  (name ?? '')
    .split(',')[0]
    ?.replace(/^(м\.|с\.|смт)\s*/u, '')
    .trim() ?? ''

/** `№12` out of `Відділення №12 (до 30 кг): вул. Богатирська, 6`. */
const branchNumber = (name: string | null | undefined): string =>
  /№\s*\d+/u.exec(name ?? '')?.[0].replace(/\s+/gu, '') ?? name ?? ''

/** One end of a route, `Київ №12`; empty when the carrier gave no branch. */
export const place = (contact: ShippingContact): string =>
  contact.warehouseName == null || contact.warehouseName === ''
    ? ''
    : [town(contact.settlementName), branchNumber(contact.warehouseName)]
        .filter((part) => part !== '')
        .join(' ')

/** `Київ №12 → Львів №5`; a missing end reads `—`. */
export const routeLine = (from: ShippingContact, to: ShippingContact) =>
  `${place(from) || '—'} → ${place(to) || '—'}`

/** `Львів · Відділення №5`, the destination as frame 2.9 writes it. */
export const destinationLine = (to: ShippingContact) =>
  [town(to.settlementName), to.warehouseName?.split(':')[0] ?? '']
    .filter((part) => part !== '')
    .join(' · ')

export const weightOf = (parcels: readonly ParcelInput[]) =>
  Math.round(parcels.reduce((sum, parcel) => sum + parcel.weightKg, 0) * 100) /
  100

/** `1 місце · 4,2 кг`. */
export const parcelLine = (
  parcels: readonly ParcelInput[],
  locale: Locale,
): string =>
  parcels.length === 0
    ? '—'
    : tr(locale, 'factParcelValue', {
        count: parcels.length,
        weight: weightOf(parcels),
      })

/** `60×40×30` of the first piece, as the form types it. */
export const dimensionsLine = (parcels: readonly ParcelInput[]): string => {
  const first = parcels[0]
  return first === undefined
    ? ''
    : `${String(first.lengthCm)}×${String(first.widthCm)}×${String(first.heightCm)}`
}

/** The first moment the waybill existed, when the carrier recorded one. */
export const createdAt = (shipment: Shipment): string | null =>
  shipment.events.find((event) => event.code === 'Created')?.recordedAt ?? null

/** True while a quote taken in the last 24 hours still stands. */
export const quoteFresh = (shipment: Shipment | null, now = Date.now()) =>
  shipment?.quoteAt != null &&
  now - new Date(shipment.quoteAt).getTime() < QUOTE_TTL_MS

/**
 * The parcel as the form types it — pieces, total weight and one set of
 * dimensions — turned into Core's per-piece list. Identical pieces share the
 * weight evenly; that is the only reading of «3 місця · 12 кг» there is.
 */
export function parcelsFrom(
  places: number,
  weightKg: number,
  dims: { lengthCm: number; widthCm: number; heightCm: number },
): ParcelInput[] {
  const each = Math.round((weightKg / places) * 1000) / 1000
  return Array.from({ length: places }, () => ({ ...dims, weightKg: each }))
}

/** `60×40×30`, `60x40x30`, `60 * 40 * 30` → three positive centimetres. */
export function parseDimensions(
  value: string,
): { lengthCm: number; widthCm: number; heightCm: number } | null {
  const parts = value
    .split(/[×xXхХ*]/u)
    .map((part) => Number(part.replace(',', '.').trim()))
  if (parts.length !== 3 || parts.some((part) => !(part > 0))) return null
  const [lengthCm, widthCm, heightCm] = parts as [number, number, number]
  return { lengthCm, widthCm, heightCm }
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('uk') === b.trim().toLocaleLowerCase('uk')

/**
 * What an external waybill disagrees with the order about. Core refuses a
 * mismatch on its own; the cabinet still compares what the preview carries,
 * so a disagreement is shown next to the number rather than written into the
 * order (6.9).
 */
export interface PreviewMismatch {
  recipient: boolean
  cod: boolean
}

export function previewMismatch(
  preview: ExternalShipmentPreview,
  draft: ShipmentDraft | null,
  delivery: DeliveryOrder,
): PreviewMismatch {
  return {
    recipient:
      draft !== null && !sameName(preview.recipient.name, draft.recipient.name),
    // Without the finance right Core hides the amount; nothing to compare.
    cod:
      preview.codAmountUah !== null &&
      !preview.recordsReceipt &&
      preview.codAmountUah !== delivery.outstandingUah,
  }
}

/** The preview lacks the recipient's branch, so the route cannot be told. */
export const previewIncomplete = (preview: ExternalShipmentPreview) =>
  (preview.recipient.warehouseRef ?? '') === ''

/**
 * A carrier contact with the names the cabinet already knows for the same
 * references: the carrier answers with GUIDs, and a clerk reads names.
 */
export const withKnownNames = (
  contact: ShippingContact,
  known: ShippingContact | null | undefined,
): ShippingContact =>
  contact.warehouseRef === known?.warehouseRef &&
  (contact.warehouseName == null || contact.warehouseName === '')
    ? {
        ...contact,
        warehouseName: known.warehouseName ?? null,
        settlementName: contact.settlementName ?? known.settlementName ?? null,
      }
    : contact

/** Which unanswered operation a result check settles. */
export const reconcileOperation = (shipment: Shipment): 'create' | 'cancel' =>
  shipment.state === 'Unknown' || shipment.state === 'Creating'
    ? 'create'
    : 'cancel'
