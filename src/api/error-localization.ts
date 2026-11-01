import { requestLocale, SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { apiMessages } from './api-messages'
import type { ApiProblemKind } from './contracts'
import { errorMessages, partEditErrorMessages } from './error-messages'

type ErrorCode = keyof typeof errorMessages.uk
const codes = new Map(
  Object.keys(errorMessages.uk).map((code) => [
    code.toUpperCase(),
    code as ErrorCode,
  ]),
)

// Older servers sometimes return only text, including validation details.
// Recognise our reviewed translations; never render arbitrary server diagnostics.
const knownText = new Map<string, ErrorCode>()
for (const locale of SUPPORTED_LOCALES) {
  const catalog = errorMessages[locale]
  for (const [code, message] of Object.entries(catalog)) {
    if (typeof message === 'string') knownText.set(message, code as ErrorCode)
  }
}
knownText.set('Required', 'NOTEMPTYVALIDATOR')
knownText.set('Cannot change own permissions.', 'CANNOT_CHANGE_OWN_PERMISSIONS')
knownText.set(
  'A customer with this phone already exists.',
  'CUSTOMER_PHONE_EXISTS',
)

// Match only Core's reviewed status messages, then preserve localisation when
// the client-normalised problem is normalised again by its screen.
type PartEditState = keyof typeof partEditErrorMessages.uk
const partEditStates = new Map<string, PartEditState>([
  ['Part is reserved and cannot be edited.', 'reserved'],
  ['Part is sold and cannot be edited.', 'sold'],
])
for (const locale of SUPPORTED_LOCALES) {
  for (const [state, message] of Object.entries(
    partEditErrorMessages[locale],
  )) {
    if (typeof message === 'string')
      partEditStates.set(message, state as PartEditState)
  }
}

export function localizeApiError(
  problem: {
    code?: string | undefined
    message?: string | undefined
    kind: ApiProblemKind
    status?: number | undefined
  },
  locale: Locale = requestLocale.get() ?? SOURCE_LOCALE,
): string {
  if (problem.code?.toUpperCase() === 'PART_NOT_EDITABLE') {
    const state = partEditStates.get(problem.message ?? '') ?? 'unavailable'
    return translate(partEditErrorMessages, locale, state)
  }
  const messageCode = problem.message
    ? knownText.get(problem.message)
    : undefined
  const code =
    (problem.code?.toUpperCase() === 'VALIDATION_ERROR'
      ? messageCode
      : undefined) ??
    (problem.code ? codes.get(problem.code.toUpperCase()) : undefined) ??
    messageCode
  if (code) return translate(errorMessages, locale, code)
  if (problem.status === 429)
    return translate(errorMessages, locale, 'RATE_LIMIT_EXCEEDED')
  if (problem.status === 402)
    return translate(errorMessages, locale, 'PAYMENT_REQUIRED')

  // Preserve and retranslate messages produced by the API client itself.
  for (const supportedLocale of SUPPORTED_LOCALES) {
    const catalog = apiMessages[supportedLocale]
    for (const [key, message] of Object.entries(catalog)) {
      if (message === problem.message) {
        return translate(
          apiMessages,
          locale,
          key as keyof typeof apiMessages.uk,
        )
      }
    }
  }
  return translate(apiMessages, locale, problem.kind)
}

export function localizeValidationMessage(
  message: string,
  locale: Locale = requestLocale.get() ?? SOURCE_LOCALE,
): string {
  return localizeApiError({ message, kind: 'validation' }, locale)
}
