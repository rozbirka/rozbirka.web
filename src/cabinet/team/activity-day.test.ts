import { expect, it } from 'vitest'
import { activityDayDifference } from './activity-day'

it('compares calendar days in the business zone across midnight and DST', () => {
  const now = Date.parse('2026-10-25T23:15:00Z')
  expect(
    activityDayDifference('2026-10-25T22:30:00Z', now, 'Europe/Kyiv'),
  ).toBe(0)
  expect(
    activityDayDifference('2026-10-25T00:30:00Z', now, 'Europe/Kyiv'),
  ).toBe(1)
  expect(
    activityDayDifference('2026-10-25T00:30:00Z', now, 'Europe/London'),
  ).toBe(0)
  expect(
    activityDayDifference('2026-10-24T21:30:00Z', now, 'Europe/Kyiv'),
  ).toBe(1)
  expect(
    activityDayDifference('2026-10-23T00:30:00Z', now, 'Europe/Kyiv'),
  ).toBe(3)
  expect(activityDayDifference(null, now, 'Europe/Kyiv')).toBeNull()
  expect(activityDayDifference('invalid', now, 'Europe/Kyiv')).toBeNull()
})
