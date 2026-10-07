// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  assertProductDocument,
  documentPathForRoute,
  injectProductDocument,
} from './prerender-helpers.mjs'

const seo = {
  path: '/example-product',
  title: 'Приклад & "продукту" <rozbirka>',
  description: 'Опис & "можливості" <продукту>',
  canonical: 'https://rozbirka.pro/example-product?ref=a&b=c',
  ogImage: 'https://rozbirka.pro/og-cover.webp',
  breadcrumbs: [
    { name: 'Головна', path: '/' },
    { name: 'Приклад продукту', path: '/example-product' },
  ],
}

const structuredDataJson = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${seo.canonical}#webpage`,
      url: seo.canonical,
      name: seo.title,
      description: seo.description,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${seo.canonical}#breadcrumbs`,
      itemListElement: seo.breadcrumbs.map((breadcrumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: breadcrumb.name,
        item: `https://rozbirka.pro${breadcrumb.path}`,
      })),
    },
    {
      '@type': 'FAQPage',
      '@id': `${seo.canonical}#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Чи є запчастини на складі?',
          acceptedAnswer: { '@type': 'Answer', text: 'Так.' },
        },
      ],
    },
  ],
})

const template = `<!doctype html>
<html><head>
<title data-product-seo>Base title</title>
<meta data-product-seo name="description" content="Base description" />
<link data-product-seo rel="canonical" href="https://rozbirka.pro/" />
<meta data-product-seo property="og:title" content="Base title" />
<meta data-product-seo property="og:description" content="Base description" />
<meta data-product-seo property="og:url" content="https://rozbirka.pro/" />
<meta data-product-seo property="og:image" content="https://rozbirka.pro/base.webp" />
<meta data-product-seo name="twitter:card" content="summary" />
<meta data-product-seo name="twitter:title" content="Base title" />
<meta data-product-seo name="twitter:description" content="Base description" />
<meta data-product-seo name="twitter:image" content="https://rozbirka.pro/base.webp" />
<script data-product-seo data-product-json-ld type="application/ld+json">{}</script>
</head><body><div id="root"></div></body></html>`

describe('documentPathForRoute', () => {
  it('maps the homepage to the root document', () => {
    expect(documentPathForRoute('/')).toBe('dist/index.html')
  })

  it('maps a product route to its nested document', () => {
    expect(documentPathForRoute('/example-product')).toBe(
      'dist/example-product/index.html',
    )
  })

  it('strips leading and trailing route slashes', () => {
    expect(documentPathForRoute('/example-product/')).toBe(
      'dist/example-product/index.html',
    )
  })
})

describe('injectProductDocument', () => {
  it('replaces marked metadata, JSON-LD, and the empty root', () => {
    const html = injectProductDocument({
      template,
      renderedBody: '<main><h1>Облік запчастин</h1></main>',
      seo,
      structuredDataJson,
    })

    expect(html).toContain(
      '<title data-product-seo>Приклад &amp; "продукту" &lt;rozbirka&gt;</title>',
    )
    expect(html).toContain(
      'name="description" content="Опис &amp; &quot;можливості&quot; &lt;продукту&gt;"',
    )
    expect(html).toContain(
      'rel="canonical" href="https://rozbirka.pro/example-product?ref=a&amp;b=c"',
    )
    expect(html).toContain(
      'property="og:title" content="Приклад &amp; &quot;продукту&quot; &lt;rozbirka&gt;"',
    )
    expect(html).toContain(
      'property="og:url" content="https://rozbirka.pro/example-product?ref=a&amp;b=c"',
    )
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(html).toContain(
      `<script data-product-seo data-product-json-ld type="application/ld+json">${structuredDataJson}</script>`,
    )
    expect(html).toContain(
      '<div id="root"><main><h1>Облік запчастин</h1></main></div>',
    )
  })

  it('replaces marked metadata when the template is Prettier-formatted', () => {
    const formattedTemplate = template.replaceAll(
      '<meta data-product-seo ',
      '<meta\n  data-product-seo\n  ',
    )

    const html = injectProductDocument({
      template: formattedTemplate,
      renderedBody: '<main><h1>Облік запчастин</h1></main>',
      seo,
      structuredDataJson,
    })

    expect(html).toContain(
      'name="description" content="Опис &amp; &quot;можливості&quot; &lt;продукту&gt;"',
    )
  })
})

describe('assertProductDocument', () => {
  const validHtml = injectProductDocument({
    template,
    renderedBody: '<main><h1>Облік запчастин</h1></main>',
    seo,
    structuredDataJson,
  })

  it('accepts a complete product document', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml,
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).not.toThrow()
  })

  it('reports no H1 elements descriptively', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace('<h1>Облік запчастин</h1>', ''),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} must contain exactly one H1; found 0`)
  })

  it('reports two H1 elements descriptively', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace('</main>', '<h1>Ще один заголовок</h1></main>'),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} must contain exactly one H1; found 2`)
  })

  it('reports a missing canonical descriptively', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace('rel="canonical"', 'rel="alternate"'),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} must contain exactly one canonical; found 0`)
  })

  it('reports an empty root descriptively', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace(
          '<div id="root"><main><h1>Облік запчастин</h1></main></div>',
          '<h1>Облік запчастин</h1><div id="root"></div>',
        ),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} has an empty prerender root`)
  })

  it('rejects a unique but incorrect title', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace(
          'Приклад &amp; "продукту" &lt;rozbirka&gt;',
          'Інший унікальний title',
        ),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} title does not match manifest`)
  })

  it('rejects a unique but incorrect description', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace(
          'Опис &amp; &quot;можливості&quot; &lt;продукту&gt;',
          'Інший унікальний description',
        ),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} description does not match manifest`)
  })

  it.each([
    [
      'OG title',
      'property="og:title" content="Приклад &amp; &quot;продукту&quot; &lt;rozbirka&gt;"',
      'property="og:title" content="Застарілий OG title"',
    ],
    [
      'Twitter image',
      'name="twitter:image" content="https://rozbirka.pro/og-cover.webp"',
      'name="twitter:image" content="https://rozbirka.pro/stale.webp"',
    ],
  ])('rejects a stale %s field', (_label, current, stale) => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace(current, stale),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} ${_label} does not match manifest`)
  })

  it('rejects malformed JSON-LD', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace(structuredDataJson, '{invalid'),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} has invalid product JSON-LD`)
  })

  it('rejects an empty JSON-LD graph', () => {
    expect(() =>
      assertProductDocument({
        html: validHtml.replace(structuredDataJson, '{}'),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} JSON-LD must use the Schema.org context`)
  })

  it('rejects duplicate required metadata nodes', () => {
    const canonical = `<link data-product-seo rel="canonical" href="${seo.canonical.replaceAll('&', '&amp;')}" />`
    const unmarkedDuplicate = canonical.replace(' data-product-seo', '')
    expect(() =>
      assertProductDocument({
        html: validHtml.replace(canonical, `${canonical}${unmarkedDuplicate}`),
        seo,
        expectedH1: 'Облік запчастин',
      }),
    ).toThrow(`${seo.path} must contain exactly one canonical; found 2`)
  })
})

describe('language versions of the landing', () => {
  const landingSeo = {
    path: '/en',
    landing: true,
    locale: 'en-GB',
    ogLocale: 'en_GB',
    title: 'Software for car breakers | rozbirka',
    description: 'English landing description',
    canonical: 'https://rozbirka.pro/en',
    ogImage: 'https://rozbirka.pro/og-cover.webp',
    alternates: [
      { hreflang: 'uk', href: 'https://rozbirka.pro/' },
      { hreflang: 'en-GB', href: 'https://rozbirka.pro/en' },
      { hreflang: 'pl', href: 'https://rozbirka.pro/pl' },
      { hreflang: 'x-default', href: 'https://rozbirka.pro/' },
    ],
  }
  const landingJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://rozbirka.pro/#organization',
      },
      { '@type': 'WebSite', '@id': 'https://rozbirka.pro/#website' },
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://rozbirka.pro/en#software',
        url: landingSeo.canonical,
        description: landingSeo.description,
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://rozbirka.pro/en#faq',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Q?',
            acceptedAnswer: { '@type': 'Answer', text: 'A.' },
          },
        ],
      },
    ],
  })
  const localizedTemplate = template
    .replace('<html>', '<html lang="uk">')
    .replace('<head>', '<head><meta property="og:locale" content="uk_UA" />')
  const html = injectProductDocument({
    template: localizedTemplate,
    renderedBody: '<main><h1>Know where every part is</h1></main>',
    seo: landingSeo,
    structuredDataJson: landingJson,
  })

  it('writes the document language, og:locale and hreflang alternates', () => {
    expect(html).toContain('<html lang="en-GB">')
    expect(html).toContain('<meta property="og:locale" content="en_GB" />')
    expect(html).toContain(
      '<link data-product-seo rel="canonical" href="https://rozbirka.pro/en" /><link data-product-seo rel="alternate" hreflang="uk" href="https://rozbirka.pro/" />',
    )
    expect(html).toContain(
      '<link data-product-seo rel="alternate" hreflang="x-default" href="https://rozbirka.pro/" />',
    )
    expect(documentPathForRoute('/en')).toBe('dist/en/index.html')
  })

  it('accepts a complete language document', () => {
    expect(() =>
      assertProductDocument({
        html,
        seo: landingSeo,
        expectedH1: 'Know where every part is',
      }),
    ).not.toThrow()
  })

  it('rejects a document left in the template language', () => {
    expect(() =>
      assertProductDocument({
        html: html.replace('<html lang="en-GB">', '<html lang="uk">'),
        seo: landingSeo,
        expectedH1: 'Know where every part is',
      }),
    ).toThrow('/en <html lang> must be en-GB; found uk')
  })

  it('rejects a missing hreflang alternate', () => {
    expect(() =>
      assertProductDocument({
        html: html.replace('hreflang="pl"', 'hreflang="de"'),
        seo: landingSeo,
        expectedH1: 'Know where every part is',
      }),
    ).toThrow('/en must contain exactly one hreflang pl alternate; found 0')
  })
})
