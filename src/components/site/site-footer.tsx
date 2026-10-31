import { navDestination, navItems } from '@/components/site/nav-items'
import { useLocale, useT } from '@/i18n'
import { landingPathFor } from '@/seo/landing-locales'
import { LandingLogo, TelegramIcon } from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages } from './landing-messages'
import { siteMessages } from './site-messages'
import { APP_STORE_URL } from './store-badges'

const footerNav = navItems.filter((item) => item.href !== '#reviews')

export function SiteFooter() {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const supportHref = useSupportHref()
  const landingPath = landingPathFor(locale)
  const link = 'text-lp-soft min-h-6 text-[15px]'

  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-14 px-6 pt-[72px] pb-10 max-sm:gap-10 max-sm:pt-14 max-sm:pb-28">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-10 max-sm:grid-cols-2 max-sm:gap-x-6 max-sm:gap-y-8">
          <div className="flex flex-col gap-[18px] max-sm:col-span-2">
            <LandingLogo className="text-[22px]" />
            <span className="text-lp-muted max-w-[260px] text-[15px] leading-[1.5]">
              {l('footerTagline')}
            </span>
          </div>
          <nav
            aria-label={l('footerProduct')}
            className="flex flex-col gap-3.5"
          >
            <span className="text-lp-dim text-[14px]">
              {l('footerProduct')}
            </span>
            {footerNav.map((item) => (
              <a
                key={item.href}
                href={navDestination(item, landingPath)}
                className={link}
              >
                {t(item.label)}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-3.5 max-sm:order-last max-sm:col-span-2">
            <span className="text-lp-dim text-[14px]">
              {l('footerSupport')}
            </span>
            {supportHref && (
              <a
                href={supportHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('supportAria')}
                className="text-lp-ink hover:border-lp-telegram hover:text-lp-ink flex h-12 items-center gap-2.5 self-start rounded-full border border-white/16 pr-5 pl-3 text-[15px] font-semibold whitespace-nowrap"
              >
                <TelegramIcon size={26} />@{supportHref.split('/').pop()}
              </a>
            )}
            <span className="text-lp-muted text-[14px] leading-[1.5]">
              {l('footerSupportHint')}
            </span>
          </div>
          <div className="flex flex-col gap-3.5">
            <span className="text-lp-dim text-[14px]">
              {l('footerPlatform')}
            </span>
            <a href="/login" className={link}>
              {l('footerWeb')}
            </a>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              App Store
            </a>
          </div>
        </div>
        <div className="text-lp-dim flex flex-wrap justify-between gap-x-6 gap-y-4 border-t border-white/[0.07] pt-6 text-[14px]">
          <span>© 2026 rozbirka</span>
          {/* The privacy policy is a Ukrainian legal text only. */}
          <a
            href="/privacy"
            hrefLang={locale === 'uk' ? undefined : 'uk'}
            className="text-lp-dim"
          >
            {t('privacyPolicy')}
          </a>
        </div>
      </div>
    </footer>
  )
}
