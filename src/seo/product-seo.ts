import type { Locale } from '../i18n/locales'
import {
  LANDING_ALTERNATES,
  LANDING_PATHS,
  OG_LOCALES,
  type HreflangAlternate,
  type LandingPath,
} from './landing-locales'

export type ProductSeoPath = LandingPath

export interface SeoBaseline {
  status: 'pending-external-tools'
  volume: null
  difficulty: null
  impressions: null
  clicks: null
  ctr: null
  position: null
}

export interface ProductSeoEntry {
  path: ProductSeoPath
  /** Page language: `<html lang>`, copy and FAQ of this document. */
  locale: Locale
  /** Landing variant: one SoftwareApplication graph, no breadcrumbs. */
  landing: true
  canonical: string
  title: string
  description: string
  ogLocale: string
  /** Language versions of this page, including x-default. */
  alternates: readonly HreflangAlternate[]
  primaryQuery: string
  supportingQueries: readonly string[]
  intent: 'commercial-category'
  ogImage: 'https://rozbirka.pro/og-cover-20261111.png'
  faqSchema: boolean
  indexable: true
  includeInSitemap: true
  baseline: SeoBaseline
}

const pendingBaseline: SeoBaseline = {
  status: 'pending-external-tools',
  volume: null,
  difficulty: null,
  impressions: null,
  clicks: null,
  ctr: null,
  position: null,
}

const landingDefaults = {
  landing: true,
  alternates: LANDING_ALTERNATES,
  intent: 'commercial-category',
  ogImage: 'https://rozbirka.pro/og-cover-20261111.png',
  faqSchema: true,
  indexable: true,
  includeInSitemap: true,
  baseline: pendingBaseline,
} as const

export const productSeoEntries: readonly ProductSeoEntry[] = [
  {
    ...landingDefaults,
    path: LANDING_PATHS.uk,
    locale: 'uk',
    canonical: 'https://rozbirka.pro/',
    ogLocale: OG_LOCALES.uk,
    title: 'Програма для авторозбірки: CRM і ERP для запчастин | rozbirka',
    description:
      'rozbirka — програма для авторозбірки: CRM і ERP для обліку авто й запчастин, складу з QR-стікерами, замовлень, кас і команди. Веб і iOS.',
    primaryQuery: 'програма для авторозбірки',
    supportingQueries: [
      'CRM для авторозбірки',
      'ERP для авторозбірки',
      'програма для розборки авто',
    ],
  },
  {
    ...landingDefaults,
    path: LANDING_PATHS['en-GB'],
    locale: 'en-GB',
    canonical: 'https://rozbirka.pro/en',
    ogLocale: OG_LOCALES['en-GB'],
    title: 'Software for car breakers: CRM and ERP for parts | rozbirka',
    description:
      'rozbirka is software for car breakers: CRM and ERP for cars and parts, stock with QR labels, orders, tills and your team. Web and iOS.',
    primaryQuery: 'software for car breakers',
    supportingQueries: [
      'CRM for car breakers',
      'ERP for car breakers',
      'car breakers management system',
      'vehicle dismantler software',
    ],
  },
  {
    ...landingDefaults,
    path: LANDING_PATHS.pl,
    locale: 'pl',
    canonical: 'https://rozbirka.pro/pl',
    ogLocale: OG_LOCALES.pl,
    title: 'Program do demontażu aut: CRM i ERP dla części | rozbirka',
    description:
      'rozbirka to program do demontażu aut: CRM i ERP do ewidencji aut i części, magazynu z naklejkami QR, zamówień, kas i zespołu. Web i iOS.',
    primaryQuery: 'program do demontażu aut',
    supportingQueries: [
      'CRM dla demontażu aut',
      'ERP dla demontażu aut',
      'program dla stacji demontażu pojazdów',
      'program do szrotu',
    ],
  },
]

export const productSeoPaths = productSeoEntries.map((entry) => entry.path)

export function getProductSeo(pathname: string): ProductSeoEntry | undefined {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return productSeoEntries.find((entry) => entry.path === normalized)
}

/** SEO entry of the landing in `locale` (every locale has one). */
export function landingSeoFor(locale: Locale): ProductSeoEntry {
  const entry = productSeoEntries.find((item) => item.locale === locale)
  if (!entry) throw new Error(`Missing landing SEO for ${locale}`)
  return entry
}
