import { expect, it } from 'vitest'
import { createMapping, mayConfirm, isActiveImport } from './import-model'
it('does not infer condition, currency or quantity from missing values', () => {
  const plan = createMapping(
    1,
    2,
    [
      { id: 'Name', type: 'text', required: true },
      { id: 'Quantity', type: 'integer', required: true },
      { id: 'Condition', type: 'enum', required: false },
    ],
    { Name: 'csv:1' },
    {},
    [],
  )
  expect(plan.rules).toEqual([{ target: 'Name', sources: ['csv:1'] }])
  expect(plan.skippedFields).toEqual([])
  expect(plan.version).toBe(3)
})
it('requires the exact revision and selection for confirmation', () => {
  const validation = {
    revision: 5,
    previewVersion: 2,
    digest: 'abc',
    invalidCount: 0,
    selectedCount: 2,
  }
  expect(mayConfirm(validation, 5, 2, ['a', 'b'], ['a', 'b'])).toBe(true)
  expect(mayConfirm(validation, 6, 2, ['a', 'b'], ['a', 'b'])).toBe(false)
  expect(mayConfirm(validation, 5, 2, ['a', 'c'], ['a', 'b'])).toBe(false)
  expect(
    mayConfirm({ ...validation, digest: null }, 5, 2, ['a', 'b'], ['a', 'b']),
  ).toBe(false)
})
it('polls active states and stops terminal states', () => {
  expect(isActiveImport('Running')).toBe(true)
  expect(isActiveImport('Uploaded')).toBe(true)
  expect(isActiveImport('CompletedWithErrors')).toBe(false)
  expect(isActiveImport('NeedsReview')).toBe(false)
})

it('uses source column IDs when excluding columns', () => {
  const plan = createMapping(
    1,
    0,
    [{ id: 'Name', type: 'text', required: true }],
    { Name: 'csv:1' },
    {},
    [],
    ['csv:1', 'csv:2'],
  )
  expect(plan.skippedFields).toEqual(['csv:2'])
})
