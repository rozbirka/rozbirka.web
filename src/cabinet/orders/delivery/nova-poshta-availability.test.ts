import { expect, it, vi } from 'vitest'
import { deliveryProblemMessage } from './nova-poshta-availability'

vi.mock('@/auth/useTenantSettings', () => ({ useTenantSettings: () => ({}) }))

it('says a withdrawn right plainly and points to the owner (§11 «Права»)', () => {
  expect(
    deliveryProblemMessage({ kind: 'forbidden', message: 'Forbidden' }, 'uk'),
  ).toBe('Немає права на цю дію. Зверніться до власника.')
  expect(
    deliveryProblemMessage(
      { kind: 'forbidden', message: 'Forbidden' },
      'en-GB',
    ),
  ).toBe('You no longer have permission for this action. Contact the owner.')
})
