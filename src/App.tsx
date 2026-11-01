import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router'
import { SiteHeader } from '@/components/site/header'
import { Hero, IntegrationsTicker } from '@/components/site/hero'
import { Reviews } from '@/components/site/reviews'
import { Pains } from '@/components/site/pains'
import { HowItWorks } from '@/components/site/how-it-works'
import { CarsSpotlight } from '@/components/site/cars-demo'
import { OrdersSpotlight } from '@/components/site/orders-demo'
import {
  StockSpotlight,
  TeamSpotlight,
  TrialBand,
} from '@/components/site/spotlights'
import { Features } from '@/components/site/features'
import { Compare } from '@/components/site/compare'
import { Pricing } from '@/components/site/pricing'
import { FAQ } from '@/components/site/faq'
import { landingFaqEntries } from '@/components/site/faq-messages'
import { StartCta } from '@/components/site/start-cta'
import { SupportLink } from '@/components/site/support-link'
import { SiteFooter } from '@/components/site/site-footer'
import type { LandingNavigationState } from '@/components/site/language-switcher'
import { siteMessages } from '@/components/site/site-messages'
import { useLandingMotion } from '@/components/site/use-landing-motion'
import { intlLocale, useLocale, useT } from '@/i18n'
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
 * Public landing (mock-up «Rozbirka Landing v6»). Rendered under
 * `LocaleOverride` at `/` (uk), `/en` (en-GB) and `/pl`, so copy, SEO and
 * FAQ follow the route's language.
 */
function App() {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const seo = landingSeoFor(locale)
  const faq = useMemo(() => landingFaqEntries(locale), [locale])
  useFocusHeadingAfterLanguageSwitch()
  useLandingMotion(intlLocale(locale))

  return (
    <>
      <RouteSeo entry={seo} faq={faq} />
      <a
        href="#main"
        className="bg-lp-accent text-lp-bg sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:px-5 focus:py-3 focus:text-sm focus:font-medium"
      >
        {t('skipToContent')}
      </a>
      <div className="text-lp-ink font-onest relative isolate min-h-dvh overflow-x-clip bg-[#0a0706] leading-[normal] antialiased">
        {/* Glass theme: warm glows behind the page, drifting with --sy. */}
        <div
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
          aria-hidden
        >
          <span className="absolute -top-[25vw] -left-[20vw] size-[70vw] translate-x-[calc(var(--sy,0)*3px)] translate-y-[calc(var(--sy,0)*4px)] rounded-full bg-[radial-gradient(circle,rgba(255,106,26,0.15),transparent_62%)]" />
          <span className="absolute top-[30vh] -right-[22vw] size-[60vw] translate-x-[calc(var(--sy,0)*-3px)] translate-y-[calc(var(--sy,0)*-5px)] rounded-full bg-[radial-gradient(circle,rgba(255,160,70,0.09),transparent_62%)]" />
          <span className="absolute -bottom-[20vw] left-[30vw] size-[40vw] translate-y-[calc(var(--sy,0)*-3px)] rounded-full bg-[radial-gradient(circle,rgba(255,90,20,0.08),transparent_62%)]" />
        </div>
        <SiteHeader />
        <SupportLink />
        <main id="main">
          <Hero />
          <IntegrationsTicker />
          <Reviews />
          <Pains />
          <HowItWorks />
          <CarsSpotlight />
          <StockSpotlight />
          <OrdersSpotlight />
          <TeamSpotlight />
          <TrialBand />
          <Features />
          <Compare />
          <Pricing />
          <FAQ />
          <StartCta />
        </main>
        <SiteFooter />
      </div>
    </>
  )
}

export default App
