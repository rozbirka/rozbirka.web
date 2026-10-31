import { APP_STORE_URL } from '@/lib/app-store'
import { fallbackLandingPlans } from '@/lib/landing-plans'
import type { ProductSeoEntry } from './product-seo'

interface FaqEntry {
  question: string
  answer: string
}

const origin = 'https://rozbirka.pro'

function buildFaqPage(canonical: string, faq: readonly FaqEntry[]) {
  return {
    '@type': 'FAQPage',
    '@id': `${canonical}#faq`,
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  }
}

export function buildStructuredData(
  entry: ProductSeoEntry,
  faq: readonly FaqEntry[],
): Record<string, unknown> {
  const faqPage = buildFaqPage(entry.canonical, faq)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'rozbirka',
        url: `${origin}/`,
        logo: `${origin}/favicon.png`,
        sameAs: [APP_STORE_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'rozbirka',
        url: `${origin}/`,
      },
      {
        '@type': 'SoftwareApplication',
        // `/` keeps `https://rozbirka.pro/#software`; each language version
        // of the landing is its own description of the same product.
        '@id': `${entry.canonical}#software`,
        name: 'rozbirka',
        url: entry.canonical,
        description: entry.description,
        inLanguage: entry.locale,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'CRM, ERP',
        operatingSystem: 'Web, iOS',
        keywords: [entry.primaryQuery, ...entry.supportingQueries].join(', '),
        installUrl: APP_STORE_URL,
        sameAs: [APP_STORE_URL],
        publisher: { '@id': `${origin}/#organization` },
        offers: fallbackLandingPlans(entry.locale).map((plan) => ({
          '@type': 'Offer',
          name: plan.name,
          price: plan.price.replace('$', ''),
          priceCurrency: 'USD',
          url: `${origin}/login?plan=${plan.code}`,
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: plan.price.replace('$', ''),
            priceCurrency: 'USD',
            unitCode: 'MON',
          },
        })),
      },
      faqPage,
    ],
  }
}

export function serializeStructuredData(
  value: Record<string, unknown>,
): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
