import { describe, expect, it } from 'vitest'
import { cabinetModules } from './module-registry'
import { loadingLayout, loadingModule, loadingPreview } from './loading-layout'

describe('route-specific loading layouts', () => {
  it('recognises every registered module, including nested settings routes', () => {
    for (const module of Object.values(cabinetModules)) {
      const pathname = `/app/demo${module.routeSegment}`
      expect(loadingModule(pathname)).toBe(module.key)
      expect(
        loadingLayout(module.key, pathname).columns.length,
      ).toBeGreaterThan(0)
    }
  })

  it('distinguishes lists, records and forms within the same module', () => {
    expect(loadingLayout('cars', '/app/demo/cars').kind).toBe('list')
    expect(loadingLayout('cars', '/app/demo/cars/car-1').kind).toBe('record')
    expect(loadingLayout('cars', '/app/demo/cars/new').kind).toBe('form')
    expect(loadingLayout('cars', '/app/demo/cars/car-1/edit').kind).toBe('form')
    expect(loadingLayout('parts', '/app/demo/parts/part-1').photo).toBe(true)
    expect(
      loadingLayout('parts', '/app/demo/parts/part-1/inventory').kind,
    ).toBe('form')
  })

  it('uses a placement form for the part inventory route owned by warehouses', () => {
    expect(
      loadingLayout('warehouses', '/app/demo/parts/p1/inventory'),
    ).toMatchObject({ kind: 'form', stats: 0, photo: false })
  })

  it('keeps adding an order item on the order record instead of a standalone form', () => {
    expect(
      loadingLayout('orders', '/app/demo/orders/order-1/items/new').kind,
    ).toBe('record')
    expect(loadingLayout('orders', '/app/demo/orders/new').kind).toBe('form')
  })

  it('keeps the new inventory session drawer over the sessions list while loading', () => {
    expect(loadingLayout('inventory', '/app/demo/inventory').stats).toBe(4)
    expect(
      loadingLayout('inventory', '/app/demo/inventory/sessions/new'),
    ).toEqual(loadingLayout('inventory', '/app/demo/inventory'))
    expect(
      loadingLayout('inventory', '/app/demo/inventory/sessions/session-1').kind,
    ).toBe('record')
  })

  it('selects the actual part and intake form compositions, including parts created from an intake', () => {
    expect(loadingLayout('parts', '/app/demo/parts/new')).toMatchObject({
      kind: 'form',
      form: 'part',
    })
    expect(loadingLayout('parts', '/app/demo/parts/p1/edit')).toMatchObject({
      kind: 'form',
      form: 'part',
    })
    expect(loadingLayout('cars', '/app/demo/cars/new')).toMatchObject({
      kind: 'form',
      form: 'car',
    })
    expect(loadingLayout('intakes', '/app/demo/intakes/new')).toMatchObject({
      kind: 'form',
      form: 'intake',
    })
    expect(
      loadingLayout('intakes', '/app/demo/intakes/i1/parts/new'),
    ).toMatchObject({ kind: 'form', form: 'part' })
    expect(
      loadingLayout('parts', '/app/demo/parts/imports/import-1').form,
    ).toBeUndefined()
  })

  it('adapts the warehouse hierarchy and unassigned parts separately', () => {
    const warehouses = loadingLayout('warehouses', '/app/demo/warehouses')
    const sections = loadingLayout(
      'warehouses',
      '/app/demo/warehouses/zones/zone-1',
    )
    const shelves = loadingLayout(
      'warehouses',
      '/app/demo/warehouses/sections/section-1',
    )
    const parts = loadingLayout(
      'warehouses',
      '/app/demo/warehouses/main/unassigned',
    )
    expect(warehouses.stats).toBeGreaterThan(0)
    expect(sections.stats).toBe(0)
    expect(sections.columns).toEqual(shelves.columns)
    expect(sections.columns).not.toEqual(warehouses.columns)
    expect(parts.thumbnails).toBe(true)
  })

  it('keeps import history and import settings distinct from a part record', () => {
    expect(loadingLayout('parts', '/app/demo/parts/imports').kind).toBe('list')
    const form = loadingLayout('parts', '/app/demo/parts/imports/import-1')
    expect(form.kind).toBe('form')
    expect(form.photo).toBe(false)
  })

  it('matches each carrier tab rather than using the same settings placeholder', () => {
    const base = '/app/demo/settings/integrations'
    expect(loadingLayout('integrations', base).kind).toBe('list')
    expect(loadingLayout('integrations', `${base}/np-1`).kind).toBe('settings')
    expect(
      loadingLayout('integrations', `${base}/np-1/dispatch-points`).kind,
    ).toBe('list')
    expect(loadingLayout('integrations', `${base}/np-1/webhook`).kind).toBe(
      'dashboard',
    )
    expect(loadingLayout('integrations', `${base}/np-1/settings`).kind).toBe(
      'form',
    )
    expect(loadingLayout('integrations', `${base}/np-1/connect`).kind).toBe(
      'form',
    )
  })
})

describe('local loading preview', () => {
  it('accepts a held state or a bounded duration in development', () => {
    expect(loadingPreview('?loadingPreview=hold', true)).toBe('hold')
    expect(loadingPreview('?loadingPreview=3000&status=active', true)).toBe(
      3000,
    )
    for (const value of ['', '0', '-1', '999999', 'Infinity', 'NaN', 'abc'])
      expect(loadingPreview(`?loadingPreview=${value}`, true)).toBeNull()
  })

  it('ignores every preview request outside development', () => {
    expect(loadingPreview('?loadingPreview=hold', false)).toBeNull()
    expect(loadingPreview('?loadingPreview=3000', false)).toBeNull()
  })
})
