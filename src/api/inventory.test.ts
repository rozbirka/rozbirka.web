import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from './client'
import {
  inventoryApi,
  type BatchPlacePartsRequest,
  type PartPlacementJob,
} from './inventory'

const originalAdapter = apiClient.defaults.adapter!

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function capture(data: unknown = []) {
  const requests: InternalAxiosRequestConfig[] = []
  apiClient.defaults.adapter = (config) => {
    requests.push(config)
    return Promise.resolve({
      data: { data },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    } satisfies AxiosResponse)
  }
  return requests
}

const placement: BatchPlacePartsRequest = {
  partIds: ['part-1', 'part-2'],
  sourceZoneId: 'source-zone',
  zoneId: 'target-zone',
  sectionId: 'section-1',
  shelfId: 'shelf-1',
}
const placementJob: PartPlacementJob = {
  id: 'job-1',
  placement,
  status: 'queued',
  total: 2,
  processed: 0,
  results: [],
  partNames: { 'part-1': 'Door', 'part-2': 'Mirror' },
}

it('starts a placement job with the caller operation ID and cancellation signal', async () => {
  const requests = capture(placementJob)
  const controller = new AbortController()

  expect(
    await inventoryApi.startPlacementJob(placement, 'operation-1', {
      signal: controller.signal,
    }),
  ).toEqual(placementJob)

  expect(requests[0]?.method).toBe('post')
  expect(requests[0]?.url).toBe('/parts/inventory-zones/jobs')
  expect(JSON.parse(requests[0]?.data as string)).toEqual({
    operationId: 'operation-1',
    placement: {
      partIds: ['part-1', 'part-2'],
      sourceZoneId: 'source-zone',
      zoneId: 'target-zone',
      sectionId: 'section-1',
      shelfId: 'shelf-1',
    },
  })
  expect(requests[0]?.signal?.aborted).toBe(false)
  controller.abort()
  expect(requests[0]?.signal?.aborted).toBe(true)
})

it('reads an encoded placement job ID and scopes job recovery to its source zone', async () => {
  const requests = capture(placementJob)
  const controller = new AbortController()

  expect(
    await inventoryApi.getPlacementJob('job/1', {
      signal: controller.signal,
    }),
  ).toEqual(placementJob)
  const listRequests = capture([placementJob])
  expect(
    await inventoryApi.getPlacementJobs('source/zone', {
      signal: controller.signal,
    }),
  ).toEqual([placementJob])

  expect(requests[0]?.method).toBe('get')
  expect(requests[0]?.url).toBe('/parts/inventory-zones/jobs/job%2F1')
  expect(listRequests[0]?.method).toBe('get')
  expect(listRequests[0]?.url).toBe('/parts/inventory-zones/jobs')
  expect(listRequests[0]?.params).toEqual({ sourceZoneId: 'source/zone' })
  expect(requests[0]?.signal?.aborted).toBe(false)
  expect(listRequests[0]?.signal?.aborted).toBe(false)
  controller.abort()
  expect(requests[0]?.signal?.aborted).toBe(true)
  expect(listRequests[0]?.signal?.aborted).toBe(true)
})

it('loads management inventory resources through tenant-scoped routes', async () => {
  const requests = capture()
  const controller = new AbortController()

  await inventoryApi.getWarehouses({ signal: controller.signal })
  await inventoryApi.getSessions({ signal: controller.signal })
  await inventoryApi.getResults('session/1', { signal: controller.signal })

  expect(requests.map(({ method, url }) => [method, url])).toEqual([
    ['get', '/warehouses'],
    ['get', '/inventory/sessions'],
    ['get', '/inventory/sessions/session%2F1/results'],
  ])
  expect(requests.every(({ signal }) => signal?.aborted === false)).toBe(true)
  controller.abort()
  expect(requests.every(({ signal }) => signal?.aborted === true)).toBe(true)
})

it('sends exact warehouse, session, adjustment, and placement mutations', async () => {
  const requests = capture()

  await inventoryApi.createWarehouse({ name: 'Основний', code: 'main' })
  await inventoryApi.createSession(['zone-1'])
  await inventoryApi.cancelSession('session-1', 'Перерахунок')
  await inventoryApi.applyAdjustment('session-1', 'part-1', 'Перевірено')
  await inventoryApi.replacePartZones('part-1', ['zone-1'])

  expect(
    requests.map(
      ({
        method,
        url,
        data,
      }): [string | undefined, string | undefined, unknown] => [
        method,
        url,
        data as unknown,
      ],
    ),
  ).toEqual([
    ['post', '/warehouses', JSON.stringify({ name: 'Основний', code: 'main' })],
    ['post', '/inventory/sessions', JSON.stringify({ zoneIds: ['zone-1'] })],
    [
      'post',
      '/inventory/sessions/session-1/cancel',
      JSON.stringify({ reason: 'Перерахунок' }),
    ],
    [
      'post',
      '/inventory/sessions/session-1/adjustments/part-1',
      JSON.stringify({ reason: 'Перевірено' }),
    ],
    [
      'put',
      '/parts/part-1/inventory-zones',
      JSON.stringify({ zoneIds: ['zone-1'] }),
    ],
  ])
})

it('exposes scans as read-only management data without scan mutations', () => {
  expect(inventoryApi).toHaveProperty('getScans')
  expect(inventoryApi).not.toHaveProperty('recordScan')
  expect(inventoryApi).not.toHaveProperty('acquireLease')
  expect(inventoryApi).not.toHaveProperty('completeZone')
})

it('reads one location and scopes shelf listing by its section and zone', async () => {
  const requests = capture()
  await inventoryApi.getSection('section/1')
  await inventoryApi.getShelf('shelf/1')
  await inventoryApi.getShelves('zone-1', {}, 'section-1')
  expect(requests.map(({ url }) => url)).toEqual([
    '/inventory/sections/section%2F1',
    '/inventory/shelves/shelf%2F1',
    '/inventory/shelves',
  ])
  expect(requests[2]?.params).toEqual({
    zoneId: 'zone-1',
    sectionId: 'section-1',
    includePartCounts: false,
  })
})

it('omits part counts for every location list and allows explicit detail consumers to opt in', async () => {
  const requests = capture()
  await inventoryApi.getSections('zone-1', { includePartCounts: false })
  await inventoryApi.getShelves(
    'zone-1',
    { includePartCounts: false },
    'section-1',
  )
  await inventoryApi.getSections('zone-1')
  await inventoryApi.getShelves(undefined, { includePartCounts: true })
  expect(requests.map(({ params }) => params as unknown)).toEqual([
    { zoneId: 'zone-1', includePartCounts: false },
    { zoneId: 'zone-1', sectionId: 'section-1', includePartCounts: false },
    { zoneId: 'zone-1', includePartCounts: false },
    { includePartCounts: true },
  ])
})

it('requests archived locations explicitly and restores through tenant-scoped endpoints', async () => {
  const requests = capture()
  const controller = new AbortController()
  await inventoryApi.getZones({
    warehouseId: 'w',
    archivedOnly: true,
    signal: controller.signal,
  })
  await inventoryApi.getSections('z', {
    archivedOnly: true,
    signal: controller.signal,
  })
  await inventoryApi.restoreZone('zone/old', { signal: controller.signal })
  await inventoryApi.restoreSection('section/old', {
    signal: controller.signal,
  })
  expect(requests.map(({ method, url }) => [method, url])).toEqual([
    ['get', '/inventory/zones'],
    ['get', '/inventory/sections'],
    ['post', '/inventory/zones/zone%2Fold/restore'],
    ['post', '/inventory/sections/section%2Fold/restore'],
  ])
  expect(requests[0]?.params).toMatchObject({
    warehouseId: 'w',
    archivedOnly: true,
  })
  expect(requests[1]?.params).toMatchObject({ zoneId: 'z', archivedOnly: true })
  expect(requests.every(({ signal }) => signal?.aborted === false)).toBe(true)
  controller.abort()
  expect(requests.every(({ signal }) => signal?.aborted === true)).toBe(true)
})
