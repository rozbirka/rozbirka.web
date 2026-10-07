import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from './client'
import { partsApi } from './parts'

const originalAdapter = apiClient.defaults.adapter!

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('sends server-supported inventory filters and preserves all selected source ids', async () => {
  let request: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = (config) => {
    request = config
    return Promise.resolve({
      data: {
        data: { items: [], page: 2, pageSize: 30, total: 0, totalPages: 0 },
      },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    } satisfies AxiosResponse)
  }

  await partsApi.list({
    q: 'bumper',
    status: 'available',
    make: 'Ford',
    page: 2,
    carIds: ['car-1', 'car-2'],
    intakeIds: ['intake-1'],
  })

  expect(request?.url).toBe('/parts')
  expect(request?.params).toEqual({
    q: 'bumper',
    status: 'available',
    make: 'Ford',
    page: 2,
    per_page: 30,
    car_ids: ['car-1', 'car-2'],
    intake_ids: ['intake-1'],
  })
})

it('round-trips only OpenAPI-supported part changes and does not fabricate compatibility fields', async () => {
  let request: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = (config) => {
    request = config
    return Promise.resolve({
      data: { data: { id: 'part-1' } },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    } satisfies AxiosResponse)
  }

  await partsApi.update('part-1', {
    name: 'Front bumper',
    photoKeys: ['owned-key'],
    desiredSalePrice: { isSet: false },
  })

  expect(request?.method).toBe('put')
  expect(request?.url).toBe('/parts/part-1')
  expect(JSON.parse(request?.data as string)).toEqual({
    name: 'Front bumper',
    photoKeys: ['owned-key'],
    desiredSalePrice: { isSet: false },
  })
  expect(JSON.parse(request?.data as string)).not.toHaveProperty(
    'compatCarBrand',
  )
})

it('restores relations Core omits rather than sends as null', async () => {
  // `JsonIgnoreCondition.WhenWritingNull` drops a null property entirely, so a
  // part with no car arrives without `car` at all. Read straight off the
  // response, `part.car === null` is false and the next access crashes.
  apiClient.defaults.adapter = (config) =>
    Promise.resolve({
      data: {
        data: {
          items: [
            {
              id: 'part-1',
              name: 'Передній бампер',
              photos: ['a.jpg'],
              quantityTotal: 1,
              quantityReserved: 0,
              quantityAvailable: 1,
              quantitySoldTotal: 0,
              status: 'available',
            },
          ],
          page: 1,
          pageSize: 30,
          total: 1,
          totalPages: 1,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    } satisfies AxiosResponse)

  const page = await partsApi.list()

  expect(page.items[0]?.car).toBeNull()
  expect(page.items[0]?.order).toBeNull()
  expect(page.items[0]?.externalCode).toBeNull()
})

it('normalizes origin facet ids returned by Core to the filter contract', async () => {
  apiClient.defaults.adapter = (config) =>
    Promise.resolve({
      data: {
        data: {
          origins: [
            { id: 'Car', name: 'Car', count: 953 },
            { id: 'Batch', name: 'Batch', count: 370 },
          ],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    } satisfies AxiosResponse)

  const facets = await partsApi.facets({}, ['origin'])

  expect(facets.origins).toEqual([
    { id: 'car', name: 'Car', count: 953 },
    { id: 'batch', name: 'Batch', count: 370 },
  ])
})
