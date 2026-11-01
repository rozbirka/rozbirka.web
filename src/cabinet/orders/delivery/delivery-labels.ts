import type { StatusTone } from '@/components/app'
import { translate, type Locale, type MessageKey } from '@/i18n'
import { hryvnia } from './delivery-money'
import { deliveryMessages } from './messages'

/** Core refuses to create a waybill on a quote older than this. */
export const QUOTE_TTL_MS = 24 * 60 * 60 * 1000

type DeliveryKey = MessageKey<typeof deliveryMessages>

const STATES: Record<string, { key: DeliveryKey; tone: StatusTone }> = {
  Draft: { key: 'stateDraft', tone: 'neutral' },
  Creating: { key: 'stateCreating', tone: 'info' },
  Created: { key: 'stateCreated', tone: 'ok' },
  Unknown: { key: 'shipUnknown', tone: 'warn' },
  Cancelling: { key: 'stateCancelling', tone: 'info' },
  Cancelled: { key: 'stateCancelled', tone: 'neutral' },
  CancelUnknown: { key: 'stateCancelUnknown', tone: 'warn' },
}

export function shipmentStatePresentation(
  state: string,
  locale: Locale,
): {
  label: string
  tone: StatusTone
} {
  const known = STATES[state]
  return known === undefined
    ? { label: state, tone: 'neutral' }
    : {
        label: translate(deliveryMessages, locale, known.key),
        tone: known.tone,
      }
}

/** Core's own ceiling for an order total. */
const AGREED_TOTAL_MAX = 9_999_999_999

/**
 * The agreed order total as Core will take it: an ordinary hryvnia figure that
 * also stays under Core's ceiling.
 */
export function agreedTotal(input: string): number | null {
  const value = hryvnia(input)
  return value !== null && value <= AGREED_TOTAL_MAX ? value : null
}
