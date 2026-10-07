import { describe, expect, it } from 'vitest'
import {
  getProductSeo,
  landingSeoFor,
  productSeoEntries,
  productSeoPaths,
} from './product-seo'
import {
  LANDING_ALTERNATES,
  landingLocaleForPath,
  landingPathFor,
} from './landing-locales'

describe('product SEO registry', () => {
  it('owns the Ukrainian homepage and its English and Polish versions', () => {
    expect(productSeoPaths).toEqual(['/', '/en', '/pl'])
    expect(productSeoEntries.map((entry) => entry.locale)).toEqual([
      'uk',
      'en-GB',
      'pl',
    ])
    expect(getProductSeo('/')).toBe(productSeoEntries[0])
    expect(getProductSeo('/en')).toBe(landingSeoFor('en-GB'))
    expect(getProductSeo('/pl/')).toBe(landingSeoFor('pl'))
    expect(getProductSeo('/uk')).toBeUndefined()
    expect(getProductSeo('/oblik-avtozapchastyn')).toBeUndefined()
    expect(getProductSeo('/oblik-prodazhiv-avtozapchastyn')).toBeUndefined()
  })

  it('keeps the Ukrainian homepage metadata unchanged', () => {
    expect(landingSeoFor('uk')).toMatchObject({
      path: '/',
      canonical: 'https://rozbirka.pro/',
      ogLocale: 'uk_UA',
      title:
        'Програма для авторозбірки — облік запчастин і продажів | rozbirka',
    })
  })

  it('provides complete canonical and social metadata', () => {
    for (const entry of productSeoEntries) {
      expect(entry.canonical).toBe(
        entry.path === '/'
          ? 'https://rozbirka.pro/'
          : `https://rozbirka.pro${entry.path}`,
      )
      expect(entry.title.length).toBeGreaterThan(20)
      expect(entry.title).toMatch(/\| rozbirka$/)
      expect(entry.description.length).toBeGreaterThan(80)
      expect(entry.ogImage).toBe('https://rozbirka.pro/og-cover.webp')
      expect(entry.indexable).toBe(true)
      expect(entry.includeInSitemap).toBe(true)
      expect(entry.landing).toBe(true)
      expect(landingPathFor(entry.locale)).toBe(entry.path)
    }
    expect(new Set(productSeoEntries.map((entry) => entry.title)).size).toBe(3)
    expect(
      new Set(productSeoEntries.map((entry) => entry.description)).size,
    ).toBe(3)
  })

  it('links every language version with hreflang and x-default to /', () => {
    expect(LANDING_ALTERNATES).toEqual([
      { hreflang: 'uk', href: 'https://rozbirka.pro/' },
      { hreflang: 'en-GB', href: 'https://rozbirka.pro/en' },
      { hreflang: 'pl', href: 'https://rozbirka.pro/pl' },
      { hreflang: 'x-default', href: 'https://rozbirka.pro/' },
    ])
    for (const entry of productSeoEntries) {
      expect(entry.alternates).toBe(LANDING_ALTERNATES)
      expect(entry.alternates).toContainEqual({
        hreflang: entry.locale,
        href: entry.canonical,
      })
    }
  })

  it('maps landing paths back to their language', () => {
    expect(landingLocaleForPath('/')).toBe('uk')
    expect(landingLocaleForPath('/en')).toBe('en-GB')
    expect(landingLocaleForPath('/pl/')).toBe('pl')
    expect(landingLocaleForPath('/privacy')).toBeNull()
  })

  it('normalizes trailing slashes and keeps external metrics unmeasured', () => {
    expect(getProductSeo('/oblik-avtozapchastyn/')).toBeUndefined()
    for (const entry of productSeoEntries) {
      expect(entry.baseline).toEqual({
        status: 'pending-external-tools',
        volume: null,
        difficulty: null,
        impressions: null,
        clicks: null,
        ctr: null,
        position: null,
      })
    }
  })
})
