import { expect, it } from 'vitest'
import { looksMisdecoded } from './import-model'

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
