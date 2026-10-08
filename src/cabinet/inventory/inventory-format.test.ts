import { describe, expect, it } from 'vitest'
import { auditChange, auditTitle } from './audit-labels'
import {
  inventoryDate,
  inventoryDay,
  inventoryTime,
  sessionStatus,
} from './inventory-format'

const spaces = (value: string) => value.replace(/\s/g, ' ')

describe('inventory format helpers', () => {
  it('labels session statuses in each locale', () => {
    expect(sessionStatus('inProgress', 'uk')).toEqual(['Триває', 'warn'])
    expect(sessionStatus('inProgress', 'en-GB')).toEqual([
      'In progress',
      'warn',
    ])
    expect(sessionStatus('cancelled', 'pl')).toEqual(['Anulowana', 'danger'])
  })

  it('formats dates in the business time zone', () => {
    const value = '2026-09-02T10:05:00Z'
    expect(inventoryDay(value, 'uk', 'Europe/Kyiv')).toBe('02.09.26')
    expect(inventoryDay(value, 'en-GB', 'Europe/Kyiv')).toBe('02/09/2026')
    expect(spaces(inventoryDate(value, 'en-GB', 'Europe/Kyiv'))).toBe(
      '02/09/2026, 13:05',
    )
    expect(inventoryDate(null, 'uk')).toBe('—')
    expect(inventoryTime(value, 'pl', 'Europe/Warsaw')).toBe('12:05')
    expect(inventoryTime('not a date', 'uk')).toBe('not a date')
  })
})

describe('audit labels', () => {
  it('names known server actions and keeps unknown ones as they came', () => {
    expect(auditTitle('session.started', 'uk')).toBe('Сесію розпочато')
    expect(auditTitle('session.started', 'en-GB')).toBe('Session started')
    expect(auditTitle('scan.voided', 'pl')).toBe('Skan anulowano')
    expect(auditTitle('custom.thing', 'en-GB')).toBe('custom.thing')
  })

  it('reads a before and after pair, with booleans in the reader language', () => {
    expect(auditChange('{"expected":2,"actual":3}', 'en-GB')).toEqual({
      from: '2',
      to: '3',
    })
    expect(auditChange('{"from":true,"to":false}', 'en-GB')).toEqual({
      from: 'on',
      to: 'off',
    })
    expect(auditChange('{"from":true,"to":false}', 'uk')).toEqual({
      from: 'увімкнено',
      to: 'вимкнено',
    })
    expect(auditChange('not json', 'uk')).toBeNull()
  })
})
