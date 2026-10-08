import { describe, expect, it } from 'vitest'
import { homepageFaqEntries } from '@/components/site/faq'
import { landingFaqEntries } from '@/components/site/faq-messages'
import { getProductSeo, landingSeoFor } from './product-seo'
import { buildStructuredData, serializeStructuredData } from './structured-data'

function occurrences(value: string, text: string): number {
  return value.split(text).length - 1
}

describe('structured data', () => {
  it('builds the required homepage graph from the visible FAQ copy', () => {
    const homeGraph = buildStructuredData(
      getProductSeo('/')!,
      homepageFaqEntries,
    )

    expect(JSON.stringify(homeGraph)).toContain('"@type":"Organization"')
    expect(JSON.stringify(homeGraph)).toContain('"@type":"WebSite"')
    expect(JSON.stringify(homeGraph)).toContain('"@type":"SoftwareApplication"')

    const serialized = serializeStructuredData(homeGraph)
    for (const entry of homepageFaqEntries) {
      expect(occurrences(serialized, entry.question)).toBe(1)
      expect(occurrences(serialized, entry.answer)).toBe(1)
    }
  })

  it('keeps the homepage software id and gives each language its own', () => {
    const graphOf = (value: Record<string, unknown>) =>
      value['@graph'] as { '@type': string; '@id': string; url?: string }[]
    const uk = graphOf(
      buildStructuredData(getProductSeo('/')!, homepageFaqEntries),
    )
    const pl = graphOf(
      buildStructuredData(landingSeoFor('pl'), landingFaqEntries('pl')),
    )

    expect(
      uk.find((node) => node['@type'] === 'SoftwareApplication'),
    ).toMatchObject({
      '@id': 'https://rozbirka.pro/#software',
      url: 'https://rozbirka.pro/',
    })
    expect(
      pl.find((node) => node['@type'] === 'SoftwareApplication'),
    ).toMatchObject({
      '@id': 'https://rozbirka.pro/pl#software',
      url: 'https://rozbirka.pro/pl',
    })
    expect(pl.find((node) => node['@type'] === 'FAQPage')?.['@id']).toBe(
      'https://rozbirka.pro/pl#faq',
    )
    expect(JSON.stringify(pl)).toContain(
      'Czy widzę zysk osobno dla każdego auta?',
    )
  })

  it('escapes script-terminating characters during serialization', () => {
    expect(serializeStructuredData({ value: '</script>' })).toContain(
      '\\u003c/script>',
    )
  })
})
