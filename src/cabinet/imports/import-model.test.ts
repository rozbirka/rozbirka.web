import { describe, expect, it } from 'vitest'
import {
  fieldLabel,
  formatCount,
  looksMisdecoded,
  issueText,
  knownIssue,
  statusLabel,
  valueLabel,
  recallDestination,
  rememberDestination,
} from './import-model'

it('flags Cyrillic that was read with the wrong encoding', () => {
  // "Фара ліва", "Двері передні праві" as Windows-1251 bytes read as Latin-1.
  expect(
    looksMisdecoded(['Ôàðà ë³âà', 'Äâåð³ ïåðåäí³ ïðàâ³', 'Äçåðêàëî ë³âå']),
  ).toBe(true)
})

it('leaves correctly read Cyrillic alone', () => {
  expect(
    looksMisdecoded(['Фара ліва', 'Двері передні праві', 'Дзеркало ліве']),
  ).toBe(false)
})

it('leaves Latin names alone — they are not mis-decoded, just Latin', () => {
  expect(looksMisdecoded(['Ford Focus', 'Headlight left', 'Bumper'])).toBe(
    false,
  )
})

it('says nothing about a column of numbers', () => {
  expect(looksMisdecoded(['2', '150', '45.5', null])).toBe(false)
})

it('needs more than one bad cell to call a column broken', () => {
  expect(looksMisdecoded(['Фара ліва', 'Двері', 'Ôàðà'])).toBe(false)
})

it('uses a bounded display filename as the automatic batch name', async () => {
  const { batchNameFromFile } = await import('./import-model')
  expect(batchNameFromFile('C:\\uploads\\Залишки.xlsx', 'uk')).toBe('Залишки')
  expect(batchNameFromFile('/tmp/деталі.CSV', 'uk')).toBe('деталі')
  expect(batchNameFromFile('a'.repeat(250) + '.xlsx', 'uk')).toHaveLength(200)
  expect(batchNameFromFile('.xlsx', 'uk')).toBe('Імпорт запчастин')
  expect(batchNameFromFile('.xlsx', 'en-GB')).toBe('Parts import')
  expect(batchNameFromFile('stock.xlsx', 'en-GB')).toBe('stock')
})

it('requires reviewing legacy source mappings and never carries row source overrides', async () => {
  const { createMapping, needsSourceReview } = await import('./import-model')
  const old = {
    version: 1,
    schemaVersion: 1,
    skippedFields: [],
    rules: [
      { target: 'SourceType', sources: ['source'] },
      { target: 'Name', sources: ['name'] },
    ],
  }
  expect(needsSourceReview(old)).toBe(true)
  const next = createMapping(
    2,
    1,
    [
      { id: 'Name', type: 'string', required: true },
      { id: 'SourceType', type: 'string', required: true },
    ],
    {},
    {},
    old.rules,
  )
  expect(next.rules).toEqual([{ target: 'Name', sources: ['name'] }])
  expect(
    needsSourceReview({
      ...next,
      source: { type: 'newBatch', batchName: 'Залишки' },
    }),
  ).toBe(false)
})

describe('import destination memory', () => {
  it('remembers the destination chosen before mapping is saved', () => {
    rememberDestination('imp-1', {
      source: { type: 'car', carId: 'car-1' },
      fileName: 'склад.xlsx',
    })
    expect(recallDestination('imp-1')).toEqual({
      source: { type: 'car', carId: 'car-1' },
      fileName: 'склад.xlsx',
    })
    expect(recallDestination('imp-2')).toBeNull()
  })

  it('reads new source errors in Ukrainian', () => {
    for (const code of [
      'PART_SOURCE_ARCHIVED',
      'IMPORT_SOURCE_REQUIRED',
      'IMPORT_SOURCE_OVERRIDE',
      'PROFILE_SCHEMA_CHANGED',
    ]) {
      expect(knownIssue(code)).toBe(true)
      expect(issueText(code, 'uk')).not.toContain(code)
      expect(issueText(code, 'en-GB')).not.toContain(code)
      expect(issueText(code, 'pl')).not.toContain(code)
    }
  })
})

describe('localized model text', () => {
  it('reads codes in the requested locale and keeps unknown ones visible', () => {
    expect(fieldLabel('DesiredSalePrice', 'uk')).toBe('Ціна за одиницю')
    expect(fieldLabel('DesiredSalePrice', 'en-GB')).toBe('Unit price')
    expect(fieldLabel('DesiredSalePrice', 'pl')).toBe('Cena jednostkowa')
    expect(fieldLabel('SomethingNew', 'en-GB')).toBe('SomethingNew')
    expect(valueLabel('Reserved', 'en-GB')).toBe('Reserved')
    expect(valueLabel('scrap', 'pl')).toBe('Do utylizacji')
    expect(valueLabel('whatever', 'uk')).toBeNull()
    expect(statusLabel('CompletedWithErrors', 'en-GB')).toBe('Partly completed')
    expect(statusLabel('Mystery', 'pl')).toBe('Mystery')
    expect(issueText('FILE_LIMIT', 'en-GB')).toBe(
      'The file is larger than allowed.',
    )
    expect(issueText('NEW_CODE', 'uk')).toBe('Потребує перевірки (NEW_CODE)')
    expect(issueText('NEW_CODE', 'en-GB')).toBe('Needs checking (NEW_CODE)')
    // Unknown codes still count as unknown, whatever the locale.
    expect(knownIssue('NEW_CODE')).toBe(false)
    expect(knownIssue('toString')).toBe(false)
  })

  it('groups counts with a plain space and the locale separator', () => {
    expect(formatCount(10000, 'uk')).toBe('10 000')
    expect(formatCount(10000, 'en-GB')).toBe('10,000')
    expect(formatCount(10000, 'pl')).toBe('10 000')
    expect(formatCount(1.5, 'uk', { minimumFractionDigits: 1 })).toBe('1,5')
  })
})
