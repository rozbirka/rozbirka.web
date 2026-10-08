import { describe, expect, it } from 'vitest'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { faqMessages, landingFaqEntries } from './faq-messages'
import { featuresMessages } from './features-messages'

/**
 * The accounting currency is chosen per business (ROZ-159), so the landing
 * must not promise prices fixed in US dollars in any language.
 */
describe('landing currency copy', () => {
  const promise = /USD|долар|dollar|dolar|курс|exchange rate|kurs/i

  it.each(SUPPORTED_LOCALES)('promises no dollar prices in %s', (locale) => {
    const copy = [
      ...Object.values(faqMessages[locale]),
      ...Object.values(featuresMessages[locale]),
    ].filter((value): value is string => typeof value === 'string')
    const offending = copy.filter(
      (text) =>
        promise.test(text) &&
        // Naming the dollar among the currencies one can choose is fine.
        !/обираєш|choose|wybierasz/i.test(text),
    )
    expect(offending).toEqual([])
  })

  it.each(SUPPORTED_LOCALES)(
    'says the accounting currency is chosen per business in %s',
    (locale) => {
      const answer = landingFaqEntries(locale)[4]!.answer
      expect(answer).toMatch(/обираєш|You choose|wybierasz/)
    },
  )
})
