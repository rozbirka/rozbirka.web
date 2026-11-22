import type { PartCompatibilityItem, PartDetail } from '@/api/parts'
import { translate, type Locale } from '@/i18n'
import { partDetailMessages } from '../parts/part-detail-messages'
import { conditionLabel } from '../parts/part-labels'
import { olxLiveMessages } from './olx-live-messages'

export type OlxDescriptionPart = Pick<PartDetail, 'condition' | 'oemCode'>

export function createOlxDescriptionDraft(
  title: string,
  part: OlxDescriptionPart,
  compatibilities: readonly PartCompatibilityItem[],
  locale: Locale,
  maxLength: number,
) {
  const lines = [title.trim()]
  const condition = part.condition?.trim()
  if (condition) {
    const label = conditionLabel(condition, locale)
    if (label !== condition)
      lines.push(
        translate(olxLiveMessages, locale, 'draftDescriptionCondition', {
          label,
        }),
      )
  }
  const code = part.oemCode?.trim()
  if (code) lines.push(translate(partDetailMessages, locale, 'oem', { code }))

  const vehicles = new Set<string>()
  for (const row of compatibilities) {
    const make = row.makeName?.trim()
    const model = row.modelName?.trim()
    if (row.verificationStatus?.toLowerCase() !== 'verified' || !make || !model)
      continue
    const vehicle = [make, model, row.generationName?.trim()]
      .filter(Boolean)
      .join(' ')
    const { yearFrom, yearTo } = row
    const years =
      yearFrom != null && yearTo != null
        ? yearFrom === yearTo
          ? String(yearFrom)
          : translate(partDetailMessages, locale, 'yearRange', {
              from: String(yearFrom),
              to: String(yearTo),
            })
        : yearFrom != null
          ? translate(partDetailMessages, locale, 'yearFrom', {
              year: String(yearFrom),
            })
          : yearTo != null
            ? translate(partDetailMessages, locale, 'yearTo', {
                year: String(yearTo),
              })
            : null
    vehicles.add(years ? `${vehicle} (${years})` : vehicle)
  }

  let result = lines.filter(Boolean).join('\n')
  let separator = `\n\n${translate(olxLiveMessages, locale, 'draftDescriptionFitment')}\n`
  for (const vehicle of vehicles) {
    if (result.length + separator.length + vehicle.length > maxLength) break
    result += separator + vehicle
    separator = '\n'
  }
  return result
}
