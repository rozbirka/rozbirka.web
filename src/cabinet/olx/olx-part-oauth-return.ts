import type { OlxCity, OlxPrepareContent } from '@/api/olx-live'
import type { TenantAccessSnapshot } from '../access-types'

const storageKey = 'rozbirka:olx-part-oauth-return'
const outcomes = [
  'connected',
  'cancelled',
  'failed',
  'account_in_use',
  'already_connected',
  'access_changed',
  'connection_changed',
] as const

export function olxPartOutcome(value: unknown) {
  return outcomes.find((outcome) => outcome === value)
}

export interface OlxPartDraft {
  revision: string | null
  content: OlxPrepareContent
  city: OlxCity | null
  editingDescription: boolean
}

type Scope = Pick<TenantAccessSnapshot, 'userId' | 'tenantId'>

interface PartReturn extends Scope {
  partId: string
  accountId: string | null
  expiresAt: number
  draft: OlxPartDraft | null
}

export function saveOlxPartReturn(
  scope: Scope,
  partId: string,
  accountId: string | null,
  draft: OlxPartDraft | null,
  expiresAt: string,
) {
  const expiry = Date.parse(expiresAt)
  if (!(expiry > Date.now())) return false
  try {
    const value: PartReturn = {
      userId: scope.userId,
      tenantId: scope.tenantId,
      partId,
      accountId,
      expiresAt: expiry,
      draft,
    }
    sessionStorage.setItem(storageKey, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readOlxPartReturn(scope: Scope): PartReturn | null {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return null
    const value = JSON.parse(raw) as PartReturn | null
    if (
      value?.userId !== scope.userId ||
      value?.tenantId !== scope.tenantId ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now() ||
      typeof value.partId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(value.partId)
    )
      return null
    return value
  } catch {
    return null
  }
}

export function clearOlxPartReturn() {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // Storage can be unavailable in the browser.
  }
}
