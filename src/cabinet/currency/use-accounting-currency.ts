import { useCallback, useMemo, useState } from 'react'
import { tenantSettings, type TenantSettings } from '@/api/tenant-settings'
import { tenantsApi } from '@/api/tenants'
import { useOptionalAuth } from '@/auth/AuthContext'
import type { SupportedCurrency } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetPath, CABINET_SLUG_PATTERN } from '../cabinet-paths'
import {
  accountingCurrencyStatus,
  isOwnerRole,
  priceGate,
  statusCurrency,
  willLockCurrency,
  type AccountingCurrencyStatus,
  type PriceGate,
} from './accounting-currency'

function businessSettingsPath(slug: string | null): string | null {
  if (slug === null || !CABINET_SLUG_PATTERN.test(slug)) return null
  try {
    return cabinetPath(slug, 'business')
  } catch {
    // A registry without the business module (partial test doubles).
    return null
  }
}

export interface AccountingCurrency {
  status: AccountingCurrencyStatus
  /** The accounting currency when chosen; never a default. */
  currency: SupportedCurrency | null
  owner: boolean
  gate: PriceGate
  /** Business settings screen, for the owner's «choose currency» link. */
  settingsPath: string | null
  /**
   * Read the tenant again and take its business settings into the session.
   * Resolves with the fresh settings of the current tenant.
   */
  refresh: (signal?: AbortSignal) => Promise<TenantSettings>
}

/**
 * The current tenant's accounting currency as the cabinet knows it, plus a
 * re-read that keeps every screen (and `useTenantSettings`) in step.
 */
export function useAccountingCurrency(): AccountingCurrency {
  const cabinet = useCabinet()
  const auth = useOptionalAuth()
  const tenant = cabinet.targetTenant
  const tenantId = tenant?.id ?? null
  const slug = tenant?.slug ?? null
  const role = cabinet.snapshot?.role
  const merge = auth?.mergeTenantSettings
  const status = useMemo(
    () => accountingCurrencyStatus(tenantSettings(tenant)),
    [tenant],
  )
  const owner = isOwnerRole(role)

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const list = await tenantsApi.list(signal ? { signal } : {})
      merge?.(list)
      return tenantSettings(list.find((item) => item.id === tenantId))
    },
    [merge, tenantId],
  )

  return {
    status,
    currency: statusCurrency(status),
    owner,
    gate: priceGate(status, owner),
    settingsPath: businessSettingsPath(slug),
    refresh,
  }
}

export type PriceCheck =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'need-currency' }
  | { kind: 'failed' }
  | { kind: 'conflict'; from: SupportedCurrency; to: SupportedCurrency }

export interface FirstPriceGuard extends AccountingCurrency {
  check: PriceCheck
  /** Currency a save of `hasPrice` would lock now (board 2a), if any. */
  willLock: (hasPrice: boolean) => SupportedCurrency | null
  /**
   * Run before saving. `true` lets the save go on. Before the first price it
   * re-reads the setting: a currency changed while the form was open stops
   * the save with a conflict (board 2c) instead of saving in the new one.
   */
  beforeSave: (
    hasPrice: boolean,
    acceptedNow?: SupportedCurrency | null,
  ) => Promise<boolean>
  /** After a save that stored a price: re-read so the lock shows everywhere. */
  afterSave: (hasPrice: boolean) => void
  /**
   * «Save in EUR»: accept the new currency. The caller saves again, passing
   * the returned currency to `beforeSave` (state settles after the click).
   */
  acceptConflict: () => SupportedCurrency | null
  dismiss: () => void
}

/**
 * The first-price pattern for one form. The currency the form was opened with
 * is remembered, so a change made elsewhere is never applied silently.
 */
export function useFirstPriceGuard(): FirstPriceGuard {
  const accounting = useAccountingCurrency()
  const { status, refresh } = accounting
  const [check, setCheck] = useState<PriceCheck>({ kind: 'idle' })
  const [accepted, setAccepted] = useState<SupportedCurrency | null>(null)
  // The currency the form was opened with. A form opened before any currency
  // existed had no price to type, so it takes the first one it sees.
  const [opened] = useState<SupportedCurrency | null>(accounting.currency)
  const formCurrency = accepted ?? opened ?? accounting.currency

  const beforeSave = useCallback(
    async (hasPrice: boolean, acceptedNow?: SupportedCurrency | null) => {
      if (!hasPrice || status.kind === 'unknown') return true
      const expected = acceptedNow ?? formCurrency
      if (status.kind === 'chosen' && status.locked === true) return true
      setCheck({ kind: 'checking' })
      let fresh: TenantSettings
      try {
        fresh = await refresh()
      } catch {
        setCheck({ kind: 'failed' })
        return false
      }
      const next = accountingCurrencyStatus(fresh)
      if (next.kind === 'not-chosen') {
        setCheck({ kind: 'need-currency' })
        return false
      }
      if (
        next.kind === 'chosen' &&
        expected !== null &&
        next.currency !== expected
      ) {
        setCheck({ kind: 'conflict', from: expected, to: next.currency })
        return false
      }
      setCheck({ kind: 'idle' })
      return true
    },
    [formCurrency, refresh, status],
  )

  const afterSave = useCallback(
    (hasPrice: boolean) => {
      if (!hasPrice || (status.kind === 'chosen' && status.locked === true))
        return
      void refresh().catch(() => undefined)
    },
    [refresh, status],
  )

  const acceptConflict = useCallback(() => {
    const to = check.kind === 'conflict' ? check.to : null
    if (to !== null) setAccepted(to)
    setCheck({ kind: 'idle' })
    return to
  }, [check])

  const dismiss = useCallback(() => setCheck({ kind: 'idle' }), [])

  return {
    ...accounting,
    check,
    willLock: (hasPrice) => willLockCurrency(status, hasPrice),
    beforeSave,
    afterSave,
    acceptConflict,
    dismiss,
  }
}
