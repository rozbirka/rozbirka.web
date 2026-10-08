export interface ProductDocumentSeo {
  path: string
  title: string
  description: string
  canonical: string
  ogImage: string
  /** Landing documents carry a SoftwareApplication graph, no breadcrumbs. */
  landing?: boolean
  /** Document language written to `<html lang>`. */
  locale?: string
  /** `og:locale` value (e.g. `en_GB`). */
  ogLocale?: string
  /** `hreflang` alternates injected after the canonical link. */
  alternates?: readonly { hreflang: string; href: string }[]
  breadcrumbs?: readonly { name: string; path: string }[]
}

export function documentPathForRoute(pathname: string): string

export function injectProductDocument(input: {
  template: string
  renderedBody: string
  seo: ProductDocumentSeo
  structuredDataJson: string
}): string

export function assertProductDocument(input: {
  html: string
  seo: ProductDocumentSeo
  expectedH1: string
}): void
