import { beforeEach, expect, it } from 'vitest'
import { isListDensity, readDensity, writeDensity } from './list-density'

const scope = { userId: 'user-1', tenantId: 'tenant-1', screen: 'parts' }

beforeEach(() => {
  localStorage.clear()
})

it('starts roomy and remembers the tighter choice per user, tenant and screen', () => {
  expect(readDensity(scope)).toBe('comfortable')

  writeDensity(scope, 'compact')

  expect(readDensity(scope)).toBe('compact')
  expect(readDensity({ ...scope, userId: 'user-2' })).toBe('comfortable')
  expect(readDensity({ ...scope, tenantId: 'tenant-2' })).toBe('comfortable')
  expect(readDensity({ ...scope, screen: 'intakes' })).toBe('comfortable')
})

it('stores nothing for the default so an unset list stays unset', () => {
  writeDensity(scope, 'compact')
  writeDensity(scope, 'comfortable')

  expect(
    localStorage.getItem(
      `rozbirka.density.v1:${scope.userId}:${scope.tenantId}:${scope.screen}`,
    ),
  ).toBeNull()
})

it('falls back to roomy for a value it does not recognise', () => {
  localStorage.setItem(
    `rozbirka.density.v1:${scope.userId}:${scope.tenantId}:${scope.screen}`,
    'tiny',
  )

  expect(readDensity(scope)).toBe('comfortable')
  expect(isListDensity('tiny')).toBe(false)
})

it('reads roomy without a scope, before the tenant is known', () => {
  expect(readDensity(null)).toBe('comfortable')
})
