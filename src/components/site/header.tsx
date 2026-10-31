import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router'
import { NavLinks } from '@/components/site/nav-links'
import { useAuth } from '@/auth/AuthContext'
import { useLocale, useT } from '@/i18n'
import { accountPathForPlan, loginPathForPlan } from '@/lib/plan-selection'
import { landingPathFor } from '@/seo/landing-locales'
import { LandingLogo, PrimaryLink } from './landing-ui'
import { landingMessages } from './landing-messages'
import { LanguageMenu, LanguageSegments } from './language-switcher'
import { siteMessages } from './site-messages'
import { AppStoreBadge } from './store-badges'

/** Orange Pro-trial strip above the header. */
function PromoBar() {
  const { status } = useAuth()
  const l = useT(landingMessages)
  const to =
    status === 'authenticated'
      ? accountPathForPlan('pro_monthly')
      : loginPathForPlan('pro_monthly')
  return (
    <Link
      to={to}
      className="bg-lp-accent text-lp-bg hover:bg-lp-accent-hover hover:text-lp-bg flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 px-6 py-2.5 text-center text-[15px] font-medium max-sm:px-4 max-sm:py-2 max-sm:text-[14px]"
    >
      <span>{l('promoText')}</span>
      <span className="font-semibold underline underline-offset-[3px]">
        {l('promoCta')}
      </span>
    </Link>
  )
}

export function SiteHeader() {
  const { status, user } = useAuth()
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const isAuthed = status === 'authenticated'
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const accountLabel = isAuthed
    ? // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty strings should fall through
      user?.displayName || user?.phone || t('account')
    : t('login')

  return (
    <>
      <PromoBar />
      <header className="sticky top-0 z-10 border-b border-white/[0.07] bg-[rgba(11,11,11,0.92)]">
        <nav
          aria-label={t('mainNav')}
          className="mx-auto flex max-w-[1240px] items-center gap-8 px-6 py-3 max-xl:gap-3"
        >
          <a
            href={landingPathFor(locale)}
            aria-label={t('logoLabel')}
            className="text-lp-ink hover:text-lp-ink text-[20px]"
          >
            <LandingLogo />
          </a>
          <NavLinks
            className="hidden flex-1 flex-nowrap whitespace-nowrap max-xl:gap-3 lg:flex"
            linkClassName="max-xl:text-[14px]"
          />

          <div className="ml-auto hidden items-center gap-3 max-xl:gap-2 lg:flex">
            <LanguageMenu />
            <AppStoreBadge />
            <Link
              to={isAuthed ? '/account' : '/login'}
              className="text-lp-ink hover:text-lp-accent-hover flex h-11 max-w-[200px] items-center rounded-full border border-white/16 px-[18px] text-[15px]"
            >
              <span className="truncate">{accountLabel}</span>
            </Link>
            <PrimaryLink to="/login" size="md">
              {l('headerCta')}
            </PrimaryLink>
          </div>

          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-site-menu"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            onClick={() => setOpen((value) => !value)}
            className="text-lp-ink ml-auto grid size-11 place-items-center rounded-full border border-white/16 lg:hidden"
          >
            {open ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </nav>
        {open && (
          <nav
            id="mobile-site-menu"
            aria-label={t('mobileNav')}
            className="mx-auto flex max-w-[1240px] flex-col gap-5 px-6 pt-2 pb-6 lg:hidden"
          >
            <NavLinks
              className="flex-col gap-1"
              linkClassName="flex min-h-11 items-center text-[17px]"
              onNavigate={() => setOpen(false)}
            />
            <LanguageSegments onNavigate={() => setOpen(false)} />
            <div className="self-start">
              <AppStoreBadge onClick={() => setOpen(false)} />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to={isAuthed ? '/account' : '/login'}
                onClick={() => setOpen(false)}
                className="text-lp-ink flex h-11 items-center justify-center rounded-full border border-white/16 px-5 text-[15px]"
              >
                {accountLabel}
              </Link>
              <PrimaryLink to="/login" size="md">
                {l('headerCta')}
              </PrimaryLink>
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
