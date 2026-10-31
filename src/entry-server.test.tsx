// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  expectedH1ForRoute,
  prerenderManifest,
  renderRoute,
  structuredDataForRoute,
} from './entry-server'

/** Rendered text the way the prerender check reads it (tags dropped). */
const visibleText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('server product routes', () => {
  it('exports all product SEO entries for prerendering', () => {
    expect(prerenderManifest.map((entry) => entry.path)).toEqual([
      '/',
      '/en',
      '/pl',
    ])
  })

  it('renders the homepage product route', () => {
    const pathname = '/'
    const expectedH1 = 'Більше прибутку з кожного авто на розбірці'

    expect(renderRoute(pathname)).toContain(`<h1`)
    expect(visibleText(renderRoute(pathname))).toContain(expectedH1)
  })

  it('builds homepage structured data from its SEO record', () => {
    const structuredData = structuredDataForRoute('/')

    expect(JSON.stringify(structuredData)).toContain('https://rozbirka.pro/')
  })

  it('provides the expected visible H1 for the homepage', () => {
    expect(expectedH1ForRoute('/')).toBe(
      'Програма для авторозбірки — CRM і ERP Більше прибутку з кожного авто на розбірці',
    )
  })

  it('rejects routes without a product SEO record', () => {
    expect(() => structuredDataForRoute('/privacy')).toThrow(
      'Missing product SEO for /privacy',
    )
  })

  it('omits the retired use-case section and links from the homepage', () => {
    const html = renderRoute('/')

    expect(html).not.toContain('Усе для щоденної роботи авторозбірки')
    expect(html).not.toContain('/oblik-avtozapchastyn')
    expect(html).not.toContain('/oblik-prodazhiv-avtozapchastyn')
  })

  it.each([
    [
      '/en',
      'en-GB',
      'Software for car breakers — CRM and ERP More profit from every car you strip',
    ],
    [
      '/pl',
      'pl',
      'Program do demontażu aut — CRM i ERP Większy zysk z każdego auta w demontażu',
    ],
  ])(
    'renders the %s landing in its own language',
    (pathname, locale, expectedH1) => {
      const html = renderRoute(pathname)

      expect(expectedH1ForRoute(pathname)).toBe(expectedH1)
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
      expect(visibleText(html)).toContain(expectedH1)
      expect(visibleText(html)).not.toContain('Більше прибутку')
      // Language links are anchors with lang and hreflang, so they work
      // before hydration and without JavaScript.
      for (const [href, hreflang] of [
        ['/', 'uk'],
        ['/en', 'en-GB'],
        ['/pl', 'pl'],
      ]) {
        expect(html).toMatch(
          new RegExp(`<a[^>]*href="${href}"[^>]*hrefLang="${hreflang}"`, 'i'),
        )
      }
      expect(JSON.stringify(structuredDataForRoute(pathname))).toContain(
        `https://rozbirka.pro${pathname}#software`,
      )
      expect(html).toMatch(
        new RegExp(
          `role="menuitemradio" aria-checked="true"[^>]*lang="${locale}"`,
        ),
      )
    },
  )

  it('keeps the Ukrainian homepage links on unprefixed URLs', () => {
    const html = renderRoute('/')

    expect(html).toContain('href="/#features"')
    expect(html).toContain('href="/login"')
    expect(renderRoute('/en')).toContain('href="/en#features"')
    expect(renderRoute('/en')).toContain('href="/login"')
  })
})
