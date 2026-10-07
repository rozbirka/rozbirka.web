import { translate, type Locale, type MessageKey } from '@/i18n'
import { auditMessages } from './audit-messages'

export type AuditKey = MessageKey<typeof auditMessages>

/**
 * What the server calls each event, said in the reader's language. An action
 * the vocabulary does not know is shown as it came rather than guessed at.
 */
const AUDIT_ACTIONS: Record<string, AuditKey> = {
  'session.created': 'actionSessionCreated',
  'session.started': 'actionSessionStarted',
  'session.reopened': 'actionSessionReopened',
  'session.completed': 'actionSessionCompleted',
  'session.cancelled': 'actionSessionCancelled',
  'zone.started': 'actionZoneStarted',
  'zone.completed': 'actionZoneCompleted',
  'scan.recorded': 'actionScanRecorded',
  'scan.voided': 'actionScanVoided',
  'adjustment.applied': 'actionAdjustmentApplied',
}

export const auditTitle = (action: string, locale: Locale) => {
  const key = AUDIT_ACTIONS[action]
  return key === undefined ? action : translate(auditMessages, locale, key)
}

/** The pairs of keys an audit payload uses when it records a change. */
const CHANGE_KEYS: [string, string][] = [
  ['expectedQuantity', 'actualQuantity'],
  ['expected', 'fact'],
  ['expected', 'actual'],
  ['oldValue', 'newValue'],
  ['from', 'to'],
]

/**
 * A before and after, but only when the payload really carries one. Nothing is
 * inferred: an event whose details name no such pair simply has no change row.
 */
export const auditChange = (
  detailsJson: string | null | undefined,
  locale: Locale,
): { from: string; to: string } | null => {
  if (detailsJson == null || detailsJson === '') return null
  let payload: unknown
  try {
    payload = JSON.parse(detailsJson)
  } catch {
    return null
  }
  if (payload === null || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const shown = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : typeof value === 'boolean'
        ? value
          ? translate(auditMessages, locale, 'valueOn')
          : translate(auditMessages, locale, 'valueOff')
        : null
  for (const [fromKey, toKey] of CHANGE_KEYS) {
    const from = shown(record[fromKey])
    const to = shown(record[toKey])
    if (from !== null && to !== null) return { from, to }
  }
  return null
}
