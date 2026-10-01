import { describe, expect, it } from 'vitest'
import {
  clearPartDraft,
  readPartDraft,
  savePartDraft,
  sourceCreateHref,
  sourceReturnPath,
} from './source-return'

describe('source return', () => {
  it('returns to the part form with the new source chosen', () => {
    const href = sourceCreateHref('/app/yard', 'cars', '/app/yard/parts/new')
    const search = new URLSearchParams(href.split('?')[1])
    expect(sourceReturnPath(search, '/app/yard', { carId: 'car-9' })).toBe(
      '/app/yard/parts/new?car_id=car-9&draft=1',
    )
    expect(sourceReturnPath(search, '/app/yard', { intakeId: 'in-2' })).toBe(
      '/app/yard/parts/new?intake_id=in-2&draft=1',
    )
  })

  it('replaces a previously chosen source', () => {
    const search = new URLSearchParams({
      return_to: '/app/yard/parts/new?car_id=old',
    })
    expect(sourceReturnPath(search, '/app/yard', { intakeId: 'in-2' })).toBe(
      '/app/yard/parts/new?intake_id=in-2&draft=1',
    )
  })

  it('rejects targets outside the tenant cabinet', () => {
    for (const target of [
      'https://evil.example/app/yard/parts/new',
      '//evil.example/app/yard/',
      '/app/other/parts/new',
    ])
      expect(
        sourceReturnPath(
          new URLSearchParams({ return_to: target }),
          '/app/yard',
        ),
      ).toBeNull()
  })

  it('keeps the typed part for the same tenant only', () => {
    savePartDraft({
      root: '/app/yard',
      values: { name: 'Фара' },
      compatibility: [],
    })
    expect(readPartDraft('/app/other')).toBeNull()
    expect(readPartDraft<{ name: string }>('/app/yard')?.values.name).toBe(
      'Фара',
    )
    clearPartDraft()
    expect(readPartDraft('/app/yard')).toBeNull()
  })
})
