import { describe, expect, it } from 'vitest'
import {
  daysText,
  featureLabel,
  intervalLabel,
  intervalName,
  limitLabels,
  paymentStatusMeta,
  paymentTypeLabel,
} from './billing-vocabulary'

describe('billing vocabulary', () => {
  it('names plan features per locale and keeps unknown codes', () => {
    expect(featureLabel('bulk_export')).toBe('Масовий експорт')
    expect(featureLabel('bulk_export', 'en-GB')).toBe('Bulk export')
    expect(featureLabel('bulk_export', 'pl')).toBe('Eksport masowy')
    expect(featureLabel('future_feature', 'en-GB')).toBe('future_feature')
  })

  it('names limits and intervals per locale', () => {
    expect(limitLabels('en-GB').map((limit) => limit.label)).toEqual([
      'Cars',
      'Batches',
      'Parts',
      'Team',
      'Tills',
    ])
    expect(intervalLabel('1m', 'uk')).toBe('за місяць')
    expect(intervalLabel('12m', 'en-GB')).toBe('per year')
    expect(intervalLabel('6m', 'pl')).toBe('za 6m')
    expect(intervalName('1m', 'uk')).toBe('місяць')
    expect(intervalName('3m', 'en-GB')).toBe('Quarterly')
  })

  it('counts days with the right plural form', () => {
    expect(daysText(1, 'uk')).toBe('1 день')
    expect(daysText(3, 'uk')).toBe('3 дні')
    expect(daysText(11, 'uk')).toBe('11 днів')
    expect(daysText(1, 'en-GB')).toBe('1 day')
    expect(daysText(7, 'en-GB')).toBe('7 days')
    expect(daysText(2, 'pl')).toBe('2 dni')
  })

  it('labels payments per locale', () => {
    expect(paymentStatusMeta('success', 'en-GB')).toEqual({
      label: 'Paid',
      tone: 'ok',
    })
    expect(paymentStatusMeta('pending', 'uk').label).toBe('Очікує')
    expect(paymentTypeLabel('recurring', 'pl')).toBe('Płatność cykliczna')
  })
})
