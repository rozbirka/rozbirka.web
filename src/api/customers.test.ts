import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import {
  customerAddressChanges,
  customerAddressForCreate,
  customersApi,
  parseCustomerCountry,
} from './customers'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('customersApi', () => {
  it('sends every directory control to the server endpoint', async () => {
    const controller = new AbortController()
    const result = {
      items: [],
      page: 2,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      counts: { all: 0, regular: 0, occasional: 0, noOrders: 0 },
    }
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: result })

    await expect(
      customersApi.directory(
        {
          q: 'Ірина',
          segment: 'regular',
          sort: 'name_asc',
          page: 2,
        },
        { signal: controller.signal },
      ),
    ).resolves.toEqual(result)

    expect(get).toHaveBeenCalledWith('/customers/directory', {
      params: {
        q: 'Ірина',
        segment: 'regular',
        sort: 'name_asc',
        page: 2,
      },
      signal: controller.signal,
    })
  })

  it('sends the directory query to the authoritative server search endpoint', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: [
        {
          id: 'customer-1',
          name: 'Ірина',
          phone: '+380501112233',
          ordersCount: 2,
        },
      ],
    })

    await expect(customersApi.search('Ірина')).resolves.toEqual([
      {
        id: 'customer-1',
        name: 'Ірина',
        phone: '+380501112233',
        ordersCount: 2,
      },
    ])

    expect(get).toHaveBeenCalledWith('/customers/search', {
      params: { q: 'Ірина' },
    })
  })

  it('keeps CRUD and lifecycle calls on the documented customer endpoints', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { customer: { id: 'customer-1', name: 'Ірина' } },
    })
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({
      data: { customer: { id: 'customer-1', name: 'Олена' } },
    })
    const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({})
    const controller = new AbortController()
    const options = { signal: controller.signal }

    await customersApi.create(
      { name: 'Ірина', phone: null, notes: null },
      options,
    )
    await customersApi.update('customer-1', { name: 'Олена' }, options)
    await customersApi.activate('customer-1', options)
    await customersApi.deactivate('customer-1', options)
    await customersApi.remove('customer-1', options)

    expect(post).toHaveBeenCalledWith(
      '/customers',
      { name: 'Ірина', phone: null, notes: null },
      { signal: controller.signal },
    )
    expect(patch).toHaveBeenNthCalledWith(
      1,
      '/customers/customer-1',
      { name: 'Олена' },
      { signal: controller.signal },
    )
    expect(patch).toHaveBeenNthCalledWith(
      2,
      '/customers/customer-1/activate',
      undefined,
      { signal: controller.signal },
    )
    expect(patch).toHaveBeenNthCalledWith(
      3,
      '/customers/customer-1/deactivate',
      undefined,
      { signal: controller.signal },
    )
    expect(remove).toHaveBeenCalledWith('/customers/customer-1', {
      signal: controller.signal,
    })
  })
})

describe('customer address', () => {
  it('reads a missing address as not set, so the current API keeps working', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { id: 'customer-1', name: 'Ірина', orders: [] },
    })

    await expect(customersApi.getById('customer-1')).resolves.toEqual({
      id: 'customer-1',
      name: 'Ірина',
      orders: [],
      countryCode: null,
      city: null,
      street: null,
      building: null,
      postcode: null,
    })
  })

  it('normalizes the address of every customer response', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        items: [
          {
            id: 'customer-1',
            name: 'John',
            countryCode: ' gb ',
            city: 'London',
            street: '  ',
            building: 12,
            postcode: 'NW1 6XE',
          },
          { id: 'customer-2', name: 'Unknown', countryCode: 'XX1' },
          { id: 'customer-3', name: 'Nowhere', countryCode: 'ZZ' },
        ],
        page: 1,
        pageSize: 20,
        total: 3,
        totalPages: 1,
      },
    })

    const result = await customersApi.list()

    expect(result.items[0]).toMatchObject({
      countryCode: 'GB',
      city: 'London',
      street: null,
      building: null,
      postcode: 'NW1 6XE',
    })
    expect(result.items[1]?.countryCode).toBeNull()
    expect(result.items[2]?.countryCode).toBeNull()
    expect(parseCustomerCountry('de')).toBe('DE')
    expect(parseCustomerCountry('Ukraine')).toBeNull()
    expect(parseCustomerCountry(null)).toBeNull()
  })

  it('normalizes the customer returned by create and update', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { customer: { id: 'customer-1', name: 'Anna', countryCode: 'pl' } },
    })

    await expect(
      customersApi.create({ name: 'Anna', countryCode: 'PL', city: 'Kraków' }),
    ).resolves.toEqual({
      customer: {
        id: 'customer-1',
        name: 'Anna',
        countryCode: 'PL',
        city: null,
        street: null,
        building: null,
        postcode: null,
      },
    })
  })

  it('sends only filled address fields on create', () => {
    expect(
      customerAddressForCreate({
        countryCode: 'GB',
        city: ' London ',
        street: '',
        building: '  ',
        postcode: 'NW1 6XE',
      }),
    ).toEqual({ countryCode: 'GB', city: 'London', postcode: 'NW1 6XE' })
  })

  it('sends only changed address fields on update, clearing with an empty string', () => {
    expect(
      customerAddressChanges(
        {
          countryCode: 'PL',
          city: 'Kraków',
          street: 'Floriańska',
          building: '15',
          postcode: null,
        },
        {
          countryCode: 'PL',
          city: '',
          street: 'Floriańska ',
          building: '17',
          postcode: '31-019',
        },
      ),
    ).toEqual({ city: '', building: '17', postcode: '31-019' })
  })
})
