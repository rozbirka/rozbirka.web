import { requestLocale, SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { apiMessages } from './api-messages'
import type { ApiProblemKind } from './contracts'
import { errorMessages } from './error-messages'

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
knownText.set(
  'A customer with this phone already exists.',
  'CUSTOMER_PHONE_EXISTS',
)

export function localizeApiError(
  problem: {
    code?: string | undefined
    message?: string | undefined
    kind: ApiProblemKind
    status?: number | undefined
  },
  locale: Locale = requestLocale.get() ?? SOURCE_LOCALE,
): string {
  const code =
    (problem.code ? codes.get(problem.code.toUpperCase()) : undefined) ??
    (problem.message ? knownText.get(problem.message) : undefined)
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
