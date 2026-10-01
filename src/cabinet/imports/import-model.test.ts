import { describe, expect, it } from 'vitest'
import {
  looksMisdecoded,
  issueText,
  knownIssue,
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
  expect(batchNameFromFile('C:\\uploads\\Залишки.xlsx')).toBe('Залишки')
  expect(batchNameFromFile('/tmp/деталі.CSV')).toBe('деталі')
  expect(batchNameFromFile('a'.repeat(250) + '.xlsx')).toHaveLength(200)
  expect(batchNameFromFile('.xlsx')).toBe('Імпорт запчастин')
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
      expect(issueText(code)).not.toContain(code)
    }
  })
})
