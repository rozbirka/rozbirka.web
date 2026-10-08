import { renderToString } from 'react-dom/server'
import { MemoryRouter, useRoutes } from 'react-router'
import { AuthProvider } from '@/auth/AuthContext'
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider'
import { SOURCE_LOCALE } from '@/i18n/locales'
import { landingFaqEntries } from '@/components/site/faq-messages'
import { siteMessages } from '@/components/site/site-messages'
import { translate } from '@/i18n/messages'
import { getProductSeo, productSeoEntries } from '@/seo/product-seo'
import { buildStructuredData } from '@/seo/structured-data'
import { serializeStructuredData } from '@/seo/structured-data'
import { createAppRoutes } from '@/routes/routes'

// eslint-disable-next-line react-refresh/only-export-components -- SSR entry intentionally exports render helpers alongside its internal route component.
function ServerRoutes() {
  return useRoutes(createAppRoutes(false))
}

export function renderRoute(pathname: string): string {
  return renderToString(
    <AuthProvider>
      {/* The root locale is the Ukrainian source; landing routes pin their
          own language with LocaleOverride and prerender writes <html lang>. */}
      <AppLocaleProvider locale={SOURCE_LOCALE}>
        <MemoryRouter initialEntries={[pathname]}>
          <ServerRoutes />
        </MemoryRouter>
      </AppLocaleProvider>
    </AuthProvider>,
  )
}

export const prerenderManifest = productSeoEntries

export { serializeStructuredData }

export function expectedH1ForRoute(pathname: string): string {
  const seo = getProductSeo(pathname)
  if (!seo) throw new Error(`Missing product SEO for ${pathname}`)
  return translate(siteMessages, seo.locale, 'heroTitle')
}

export function structuredDataForRoute(pathname: string) {
  const seo = getProductSeo(pathname)
  if (!seo) throw new Error(`Missing product SEO for ${pathname}`)
  return buildStructuredData(seo, landingFaqEntries(seo.locale))
}
