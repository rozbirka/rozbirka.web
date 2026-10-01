import { beforeEach, expect, it } from 'vitest'
import {
  readSavedViews,
  sameView,
  savedViewLimit,
  writeSavedViews,
} from './saved-views'

const scope = { userId: 'user-1', tenantId: 'tenant-1', screen: 'parts' }

beforeEach(() => {
  localStorage.clear()
})

it('keeps views apart by user, tenant and screen', () => {
  writeSavedViews(scope, [
    { id: 'v1', name: 'Резерв', query: 'status=reserved' },
  ])

  expect(readSavedViews(scope)).toHaveLength(1)
  expect(readSavedViews({ ...scope, userId: 'user-2' })).toEqual([])
  expect(readSavedViews({ ...scope, tenantId: 'tenant-2' })).toEqual([])
  expect(readSavedViews({ ...scope, screen: 'intakes' })).toEqual([])
})

it('drops a stored payload it cannot trust instead of rendering it', () => {
  localStorage.setItem(
    `rozbirka.views.v1:${scope.userId}:${scope.tenantId}:${scope.screen}`,
    JSON.stringify({
      version: 1,
      views: [{ id: 'v1', name: '   ', query: '' }],
    }),
  )

  expect(readSavedViews(scope)).toEqual([])
  expect(
    localStorage.getItem(
      `rozbirka.views.v1:${scope.userId}:${scope.tenantId}:${scope.screen}`,
    ),
  ).toBeNull()
})

it('stops storing past the limit', () => {
  writeSavedViews(
    scope,
    Array.from({ length: savedViewLimit + 4 }, (_, index) => ({
      id: `v${String(index)}`,
      name: `Подання ${String(index)}`,
      query: `status=${String(index)}`,
    })),
  )

  expect(readSavedViews(scope)).toHaveLength(savedViewLimit)
})

it('recognises the same filters whatever their order, and ignores the page', () => {
  expect(
    sameView('status=reserved&warehouse=w1', 'warehouse=w1&status=reserved'),
  ).toBe(true)
  expect(sameView('status=reserved&page=3', 'status=reserved&page=1')).toBe(
    true,
  )
  expect(sameView('status=reserved', 'status=sold')).toBe(false)
})

it('removes the key rather than storing an empty list', () => {
  writeSavedViews(scope, [
    { id: 'v1', name: 'Резерв', query: 'status=reserved' },
  ])
  writeSavedViews(scope, [])

  expect(
    localStorage.getItem(
      `rozbirka.views.v1:${scope.userId}:${scope.tenantId}:${scope.screen}`,
    ),
  ).toBeNull()
})
