import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router'
import { SiteHeader } from '@/components/site/header'
import { Hero } from '@/components/site/hero'
import { Features } from '@/components/site/features'
import { Pricing } from '@/components/site/pricing'
import { FAQ } from '@/components/site/faq'
import { landingFaqEntries } from '@/components/site/faq-messages'
import { CtaBanner } from '@/components/site/cta-banner'
import { SiteFooter } from '@/components/site/site-footer'
import type { LandingNavigationState } from '@/components/site/language-switcher'
import { siteMessages } from '@/components/site/site-messages'
import { useLocale, useT } from '@/i18n'
import { landingSeoFor } from '@/seo/product-seo'
import { RouteSeo } from '@/seo/route-seo'

/** After switching the site language, move focus to the new page's H1. */
function useFocusHeadingAfterLanguageSwitch() {
  const location = useLocation()
  const state = location.state as LandingNavigationState | null
  const focusHeading = state?.focusHeading === true

  useEffect(() => {
    if (!focusHeading) return
    window.scrollTo({ top: 0 })
    const heading = document.querySelector<HTMLElement>('#main h1')
    if (!heading) return
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }, [focusHeading, location.key])
}

/**
 * Public landing. Rendered under `LocaleOverride` at `/` (uk), `/en`
 * (en-GB) and `/pl`, so copy, SEO and FAQ follow the route's language.
 */
function App() {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const seo = landingSeoFor(locale)
  const faq = useMemo(() => landingFaqEntries(locale), [locale])
  useFocusHeadingAfterLanguageSwitch()

  return (
    <>
      <RouteSeo entry={seo} faq={faq} />
      <a
        href="#main"
        className="bg-brand text-brand-foreground sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:px-5 focus:py-3 focus:text-sm focus:font-medium"
      >
        {t('skipToContent')}
      </a>
      <div className="min-h-screen bg-black text-white">
        <SiteHeader />
        <main id="main">
          <Hero />
          <div className="font-visuelt">
            <Features />
            <Pricing />
            <FAQ />
            <CtaBanner />
          </div>
        </main>
        <div className="font-visuelt">
          <SiteFooter />
        </div>
      </div>
    </>
  )
}

export default App
