import { vi } from 'vitest'
import type { SupportedCurrency } from '@/i18n'
import {
  accountingCurrencyStatus,
  priceGate,
  statusCurrency,
  willLockCurrency,
} from './accounting-currency'
import type { FirstPriceGuard } from './use-accounting-currency'

/**
 * A first-price guard for component tests that render a price form outside
 * the cabinet providers. Defaults to a locked USD currency (nothing to warn
 * about, nothing to re-check).
 */
export function guardFixture({
  currency = 'USD',
  locked = true,
  owner = true,
}: {
  currency?: SupportedCurrency | null
  locked?: boolean | null
  owner?: boolean
} = {}): FirstPriceGuard {
  const status = accountingCurrencyStatus({
    accountingCurrency: currency,
    currencyLocked: locked,
  })
  return {
    status,
    currency: statusCurrency(status),
    owner,
    gate: priceGate(status, owner),
    settingsPath: '/app/demo/settings/business',
    refresh: vi.fn(),
    check: { kind: 'idle' },
    willLock: (hasPrice) => willLockCurrency(status, hasPrice),
    needsCheck: () => false,
    beforeSave: vi.fn(() => Promise.resolve(true)),
    afterSave: vi.fn(),
    acceptConflict: vi.fn(() => null),
    dismiss: vi.fn(),
  }
}
