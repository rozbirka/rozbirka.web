import { expect, it } from 'vitest'
import type { PaymentDto } from '@/api/types'
import { failedRenewal, scheduledCharge } from './subscription-presentation'

const blocked = {
  state: 'blocked' as const,
  currentPeriodEnd: '2026-10-27T10:00:00Z',
}
const attempt: PaymentDto = {
  id: 'failed',
  type: 'recurring',
  status: 'failed',
  amount: 59,
  currency: 'USD',
  createdAt: '2026-10-27T10:00:01Z',
  providerInvoiceId: null,
  checkoutUrl: null,
  checkoutExpiresAt: null,
}
it('recognises a current failed renewal independently of API ordering', () => {
  const previous = {
    ...attempt,
    id: 'paid',
    status: 'success' as const,
    createdAt: '2026-09-27T10:00:00Z',
  }
  expect(failedRenewal(blocked, [previous, attempt])).toEqual(attempt)
})
it.each([
  [{ ...attempt, type: 'checkout' as const }],
  [{ ...attempt, type: 'verification' as const }],
  [{ ...attempt, createdAt: '2026-09-27T10:00:00Z' }],
  [{ ...attempt, createdAt: 'invalid' }],
])(
  'does not turn an unrelated or unprovable failure into a failed renewal: %j',
  (payment) => {
    expect(failedRenewal(blocked, [payment])).toBeNull()
  },
)
it('a newer successful or pending payment prevents a stale failure claim', () => {
  for (const status of ['success', 'pending'] as const) {
    expect(
      failedRenewal(blocked, [
        attempt,
        { ...attempt, id: 'newer', status, createdAt: '2026-10-27T10:00:02Z' },
      ]),
    ).toBeNull()
  }
})
it('does not infer a failure without a known period or for active access', () => {
  expect(
    failedRenewal({ ...blocked, currentPeriodEnd: null }, [attempt]),
  ).toBeNull()
  expect(failedRenewal({ ...blocked, state: 'active' }, [attempt])).toBeNull()
  expect(failedRenewal(blocked, null)).toBeNull()
})
it.each(['blocked', 'cancelled', 'none'] as const)(
  'does not call the end of a %s period a scheduled charge',
  (state) => {
    expect(
      scheduledCharge({
        ...blocked,
        state,
        nextChargeAt: '2026-10-27T10:00:00Z',
      }),
    ).toBeNull()
  },
)
