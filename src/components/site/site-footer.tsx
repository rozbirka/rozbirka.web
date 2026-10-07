import { useEffect, useRef } from 'react'
import { ArrowUp } from 'lucide-react'
import { useLocation } from 'react-router'
import { PageContainer } from '@/components/layout/page-container'
import { BrandLogo } from '@/components/site/brand-logo'
import { NavLinks } from '@/components/site/nav-links'
import { useLocale, useT } from '@/i18n'
import { landingLocaleForPath, landingPathFor } from '@/seo/landing-locales'
import { siteMessages } from './site-messages'

export function SiteFooter() {
  const { pathname } = useLocation()
  const reducedMotion = useRef(false)
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const activeNavProps =
    landingLocaleForPath(pathname) !== null ? { activeHref: '#top' } : {}

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = mq.matches
    const handler = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion.current ? 'auto' : 'smooth',
    })
  }

  return (
    <footer className="font-visuelt bg-background px-6 pt-12 pb-0">
      <PageContainer>
        <nav
          aria-label={t('footerNav')}
          className="flex flex-wrap items-center justify-between gap-6"
        >
          <div className="flex flex-wrap items-center gap-6">
            <BrandLogo href={landingPathFor(locale)} />
            <NavLinks {...activeNavProps} />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <ul role="list" className="flex flex-wrap items-center gap-6">
              <li>
                {/* The privacy policy is a Ukrainian legal text only. */}
                <a
                  href="/privacy"
                  hrefLang={locale === 'uk' ? undefined : 'uk'}
                  className="inline-flex min-h-11 items-center text-[15px] text-neutral-300 hover:text-white"
                >
                  {t('privacyPolicy')}
                </a>
              </li>
            </ul>
            <button
              type="button"
              onClick={scrollToTop}
              aria-label={t('backToTop')}
              className="grid size-14 place-items-center rounded-full text-white ring-1 ring-white/15 transition-colors hover:bg-white/[0.04]"
            >
              <ArrowUp className="size-5" aria-hidden />
            </button>
          </div>
        </nav>
      </PageContainer>

      <div className="mt-16 overflow-hidden" aria-hidden>
        <p className="text-brand text-center text-[clamp(80px,22vw,420px)] leading-[0.9] font-bold tracking-tight whitespace-nowrap select-none">
          rozbirka
        </p>
      </div>
    </footer>
  )
}
