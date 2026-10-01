import { describe, expect, it } from 'vitest'
import type { CarListItem } from '@/api/cars'
import type { IntakeListItem } from '@/api/intakes'
import type { CabinetModuleKey } from '../module-registry'
import { dashboardTasks, daysSince } from './dashboard-tasks'

const ALL = new Set<CabinetModuleKey>(['cars', 'parts', 'intakes'])
const NOW = new Date('2026-09-19T09:00:00Z')

const car = (overrides: Partial<CarListItem> = {}): CarListItem => ({
  id: 'car-1',
  code: 'BC 9102 TX',
  brand: 'Ford',
  model: 'F-150',
  year: 2022,
  color: null,
  status: 'active',
  acquiredAt: '2026-07-19T09:00:00Z',
  partsCount: 120,
  soldPartsCount: 8,
  coverPhotoUrl: null,
  profitability: {
    invested: 14_600,
    recouped: 9_120,
    recoupedPercent: 62,
    partsAvailable: 112,
  },
  ...overrides,
})

const intake = (overrides: Partial<IntakeListItem> = {}): IntakeListItem => ({
  id: 'intake-1',
  name: 'IN-0312',
  supplier: 'Nissan Leaf 2019',
  purchasedAt: null,
  totalCost: null,
  partsCount: 0,
  soldCount: 0,
  createdAt: '2026-09-18T09:00:00Z',
  createdBy: { id: 'user-1', displayName: 'Дмитро' },
  ...overrides,
})

const inputs = (overrides: Parameters<typeof dashboardTasks>[0]) => overrides

it('measures whole days and refuses an unparsable date', () => {
  expect(daysSince('2026-07-19T09:00:00Z', NOW)).toBe(62)
  expect(daysSince('not a date', NOW)).toBeNull()
})

it('names a car that has stood too long without paying for itself', () => {
  const tasks = dashboardTasks(
    inputs({
      slug: 'koval',
      allowed: ALL,
      cars: [car()],
      intakes: null,
      outOfStockPartsCount: null,
      now: NOW,
    }),
  )

  expect(tasks).toEqual([
    {
      id: 'car:car-1',
      tone: 'info',
      title: 'Ford F-150 стоїть 62 дні',
      meta: 'Відбито 62% · 112 позицій без продажу',
      action: 'Переглянути',
      to: '/app/koval/cars/car-1',
    },
  ])
})

describe('a car that is not a question', () => {
  it.each([
    [
      'is younger than the threshold',
      car({ acquiredAt: '2026-09-01T09:00:00Z' }),
    ],
    [
      'has already paid for itself',
      car({
        profitability: {
          invested: 100,
          recouped: 140,
          recoupedPercent: 140,
          partsAvailable: 2,
        },
      }),
    ],
  ])('is left out when it %s', (_, item) => {
    expect(
      dashboardTasks(
        inputs({
          slug: 'koval',
          allowed: ALL,
          cars: [item],
          intakes: null,
          outOfStockPartsCount: null,
          now: NOW,
        }),
      ),
    ).toEqual([])
  })
})

it('puts an empty intake first and keeps the oldest cars only', () => {
  const tasks = dashboardTasks(
    inputs({
      slug: 'koval',
      allowed: ALL,
      cars: [
        car({ id: 'a', acquiredAt: '2026-07-19T09:00:00Z' }),
        car({ id: 'b', acquiredAt: '2026-05-19T09:00:00Z' }),
        car({ id: 'c', acquiredAt: '2026-06-19T09:00:00Z' }),
      ],
      intakes: [intake(), intake({ id: 'full', partsCount: 12 })],
      outOfStockPartsCount: 96,
      now: NOW,
    }),
  )

  expect(tasks.map((task) => task.id)).toEqual([
    'intake:intake-1',
    'car:b',
    'car:c',
    'parts:out-of-stock',
  ])
  expect(tasks[0]?.title).toBe('Приймання IN-0312 без позицій')
  expect(tasks.at(-1)?.title).toBe('96 позицій з нульовим залишком')
})

it('says nothing about a module this account cannot open', () => {
  expect(
    dashboardTasks(
      inputs({
        slug: 'koval',
        allowed: new Set<CabinetModuleKey>(),
        cars: [car()],
        intakes: [intake()],
        outOfStockPartsCount: 96,
        now: NOW,
      }),
    ),
  ).toEqual([])
})

it('waits for a count rather than announcing zero out-of-stock positions', () => {
  const base = {
    slug: 'koval',
    allowed: ALL,
    cars: null,
    intakes: null,
    now: NOW,
  }
  expect(
    dashboardTasks(inputs({ ...base, outOfStockPartsCount: null })),
  ).toEqual([])
  expect(dashboardTasks(inputs({ ...base, outOfStockPartsCount: 0 }))).toEqual(
    [],
  )
})
