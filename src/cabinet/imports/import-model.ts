import type {
  ImportDestination,
  ImportField,
  ImportMapping,
} from '@/api/part-imports'
import {
  formatNumber,
  translate,
  type Locale,
  type Message,
  type MessageCatalog,
  type MessageParams,
} from '@/i18n'
import {
  importFieldMessages,
  importIssueMessages,
  importModelMessages,
  importStatusMessages,
  importValueMessages,
} from './import-model-messages'
type Catalog<K extends string> = Readonly<Record<K, unknown>>
const has = <K extends string>(catalog: Catalog<K>, key: string): key is K =>
  Object.hasOwn(catalog, key)

/**
 * Text that ends up inside a sentence keeps grouping spaces as plain spaces:
 * uk/pl group thousands with U+00A0, which wraps the same and keeps tests and
 * copy free of invisible characters.
 */
const plainSpaces = (text: string) => text.replace(/\u00a0/g, ' ')

/** Whole number in the locale format, grouping with a plain space. */
export const formatCount = (
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) => plainSpaces(formatNumber(value, locale, options) ?? String(value))

/** `translate` for the import screens, with plain grouping spaces. */
export function importText<M extends Readonly<Record<string, Message>>>(
  catalog: MessageCatalog<M>,
  locale: Locale,
  key: keyof M & string,
  params?: MessageParams,
) {
  return plainSpaces(translate(catalog, locale, key, params))
}

/** Field id as a person reads it; an unknown id is shown as is. */
export const fieldLabel = (id: string, locale: Locale) =>
  has(importFieldMessages.uk, id)
    ? translate(importFieldMessages, locale, id)
    : id

/** Label of an allowed value, or `null` when the value has none. */
export const valueLabel = (value: string, locale: Locale) =>
  has(importValueMessages.uk, value)
    ? translate(importValueMessages, locale, value)
    : null

/** Import status as a person reads it; an unknown status is shown as is. */
export const statusLabel = (status: string, locale: Locale) =>
  has(importStatusMessages.uk, status)
    ? translate(importStatusMessages, locale, status)
    : status

/** Known codes read in the interface language; an unknown one falls back to the server text. */
export const knownIssue = (code: string) => has(importIssueMessages.uk, code)
export function createMapping(
  schemaVersion: number,
  version: number,
  fields: ImportField[],
  columns: Record<string, string>,
  constants: Record<string, string>,
  previous: ImportMapping['rules'],
  skippedSources: string[] = [],
): ImportMapping {
  const rules = fields
    .filter((field) => !['SourceType', 'CarId', 'IntakeId'].includes(field.id))
    .flatMap((f) => {
      const source = columns[f.id]
      const constant = constants[f.id]
      if (source) return [{ target: f.id, sources: [source] }]
      if (constant?.trim())
        return [{ target: f.id, sources: [], constant: constant.trim() }]
      const old = previous.find((r) => r.target === f.id)
      return old ? [old] : []
    })
  return {
    version: version + 1,
    schemaVersion,
    rules,
    skippedFields: skippedSources.filter(
      (id) => !rules.some((rule) => rule.sources.includes(id)),
    ),
  }
}
export function mayConfirm(
  v: {
    revision: number
    previewVersion: number
    digest: string | null
    invalidCount: number
    selectedCount: number
  } | null,
  revision: number,
  preview: number,
  selected: string[],
  validated: string[],
) {
  return (
    !!v?.digest &&
    v.invalidCount === 0 &&
    v.revision === revision &&
    v.previewVersion === preview &&
    selected.length > 0 &&
    v.selectedCount === selected.length &&
    selected.length === validated.length &&
    [...selected].sort().every((id, i) => id === [...validated].sort()[i])
  )
}
export const isActiveImport = (status: string) =>
  [
    'Uploading',
    'Uploaded',
    'Analyzing',
    'Queued',
    'Running',
    'CancelRequested',
  ].includes(status)
export const issueText = (code: string, locale: Locale) =>
  has(importIssueMessages.uk, code)
    ? translate(importIssueMessages, locale, code)
    : translate(importModelMessages, locale, 'unknownIssue', { code })

/**
 * Cyrillic text saved as Windows-1251 and then read as UTF-8 does not fail —
 * it succeeds into nonsense, and the file looks imported until someone reads
 * the names. The giveaway is the character range: every byte lands in the
 * Latin-1 supplement (À-ÿ, ³, ¿) and no Cyrillic letter survives.
 *
 * This is a guess, not a verdict, and the screen says so. It exists because
 * the alternative — the operator noticing on their own — happens after the
 * import, not before it.
 */
export function looksMisdecoded(values: readonly (string | null)[]) {
  const text = values.filter(
    (value): value is string => value !== null && /[^\d\s.,-]/.test(value),
  )
  if (text.length === 0) return false
  const suspicious = text.filter((value) => {
    const letters = [...value].filter((char) => /\p{L}/u.test(char))
    if (letters.length < 3) return false
    const cyrillic = letters.filter((char) => /\p{Script=Cyrillic}/u.test(char))
    const latin1 = letters.filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code >= 0x00a1 && code <= 0x00ff
    })
    return cyrillic.length === 0 && latin1.length / letters.length > 0.5
  })
  return suspicious.length / text.length > 0.5
}

/** Use a display filename only; no upload/storage path becomes an intake name. */
export function batchNameFromFile(name: string, locale: Locale) {
  const stem = name
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/\.(csv|xlsx)$/i, '')
    .trim()
  if (!stem) return translate(importModelMessages, locale, 'defaultBatchName')
  return stem.slice(0, 200)
}

export function needsSourceReview(mapping: ImportMapping | null) {
  return (
    !!mapping &&
    (mapping.schemaVersion !== 2 ||
      !mapping.source ||
      mapping.rules.some((rule) =>
        ['SourceType', 'CarId', 'IntakeId'].includes(rule.target),
      ))
  )
}

/**
 * The destination is saved on the server only with the mapping. Until then it
 * is remembered in this browser, so an upload reopened from history keeps the
 * car or intake it was started from instead of silently becoming a new batch.
 */
const destinationKey = (importId: string) =>
  `rozbirka:import-destination:${importId}`

export function rememberDestination(
  importId: string,
  value: { source: ImportDestination; fileName?: string },
) {
  try {
    localStorage.setItem(destinationKey(importId), JSON.stringify(value))
  } catch {
    // Unavailable storage leaves the explicit "source unknown" notice.
  }
}

export function recallDestination(
  importId: string,
): { source: ImportDestination; fileName?: string } | null {
  try {
    const raw = localStorage.getItem(destinationKey(importId))
    return raw
      ? (JSON.parse(raw) as { source: ImportDestination; fileName?: string })
      : null
  } catch {
    return null
  }
}
