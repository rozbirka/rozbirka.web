import { equipmentApi } from '@/api/equipment'
import type { PartCompatibilityInput } from '@/api/parts'
import { SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { compatibilityMessages } from './compatibility-messages'

/** The equipment type a car yard writes compatibility against. */
export const PASSENGER_CAR = 'passenger_car'

/** Years the catalogue could plausibly mean. */
export const YEAR_MIN = 1950
export const YEAR_MAX = new Date().getFullYear() + 2

/**
 * One vehicle a part fits, as the form holds it: names from the same vehicle
 * list the car form uses. Identifiers come later — Core stores compatibility
 * against its own catalogue, so the names are resolved when the form is sent.
 */
export interface CompatibilityRow {
  key: string
  brand: string
  model: string
  year: string
}

export const emptyRow = (key: string): CompatibilityRow => ({
  key,
  brand: '',
  model: '',
  year: '',
})

export const isBlankRow = (row: CompatibilityRow): boolean =>
  row.brand === '' && row.model === '' && row.year.trim() === ''

export const filledRows = (rows: CompatibilityRow[]): CompatibilityRow[] =>
  rows.filter((row) => !isBlankRow(row))

const year = (value: string): number | null => {
  const text = value.trim()
  if (!/^\d{4}$/.test(text)) return null
  const parsed = Number(text)
  return parsed >= YEAR_MIN && parsed <= YEAR_MAX ? parsed : null
}

/** What is wrong with a row. A row nobody touched is not a row yet. */
export function rowProblem(
  row: CompatibilityRow,
  locale: Locale = SOURCE_LOCALE,
): string | null {
  if (isBlankRow(row)) return null
  if (row.brand === '')
    return translate(compatibilityMessages, locale, 'chooseMake')
  if (row.year.trim() !== '' && year(row.year) === null)
    // Years are not grouped: «1 950» would read as a quantity.
    return translate(compatibilityMessages, locale, 'yearRange', {
      min: String(YEAR_MIN),
      max: String(YEAR_MAX),
    })
  return null
}

export function rowsProblem(
  rows: CompatibilityRow[],
  locale: Locale = SOURCE_LOCALE,
): string | null {
  for (const row of rows) {
    const problem = rowProblem(row, locale)
    if (problem !== null) return problem
  }
  return null
}

const sameName = (left: string, right: string) =>
  left.trim().localeCompare(right.trim(), undefined, {
    sensitivity: 'accent',
  }) === 0

export type ResolvedCompatibility =
  | { kind: 'none' }
  | { kind: 'ready'; items: PartCompatibilityInput[] }
  /** Names the yard's catalogue does not know; saving them would lose them. */
  | { kind: 'unknown'; brands: string[] }

/**
 * Turns the chosen vehicle names into what Core stores. The two catalogues are
 * separate — the vehicle list comes from outside, compatibility lives on the
 * yard's own — so every make is looked up by name, and anything the yard has
 * never seen is reported rather than dropped on the floor.
 */
export async function resolveCompatibility(
  rows: CompatibilityRow[],
  options: { signal?: AbortSignal } = {},
): Promise<ResolvedCompatibility> {
  const wanted = filledRows(rows)
  if (wanted.length === 0) return { kind: 'none' }

  const request = options.signal ? { signal: options.signal } : {}
  const types = await equipmentApi.types(request)
  // By code, not by position: the list is ordered by name, and makes were only
  // ever catalogued under passenger cars.
  const type = types.find((item) => item.code === PASSENGER_CAR) ?? types[0]
  if (type === undefined)
    return { kind: 'unknown', brands: wanted.map((row) => row.brand) }

  const items: PartCompatibilityInput[] = []
  const unknown: string[] = []

  for (const row of wanted) {
    const makes = await equipmentApi.makes(type.id, row.brand, request)
    const make = makes.find((item) => sameName(item.name, row.brand))
    if (make === undefined) {
      unknown.push(row.brand)
      continue
    }
    const models =
      row.model === ''
        ? []
        : await equipmentApi.models(make.id, row.model, request)
    const model = models.find((item) => sameName(item.name, row.model))
    const from = year(row.year)
    items.push({
      equipmentTypeId: type.id,
      makeId: make.id,
      modelId: model?.id ?? null,
      yearFrom: from,
      yearTo: from,
    })
  }

  return unknown.length > 0
    ? { kind: 'unknown', brands: [...new Set(unknown)] }
    : { kind: 'ready', items }
}

export const unknownBrandsMessage = (
  brands: string[],
  locale: Locale = SOURCE_LOCALE,
): string =>
  translate(compatibilityMessages, locale, 'unknownBrands', {
    count: brands.length,
    brands: brands.join(', '),
  })
