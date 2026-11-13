import { useEffect, useRef, useState, type RefObject } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router'
import { NavLinks } from '@/components/site/nav-links'
import { navItems } from '@/components/site/nav-items'
import { useAuth } from '@/auth/AuthContext'
import { useLocale, useT } from '@/i18n'
import {
  accountPathForPlan,
  registrationPathForPlan,
} from '@/lib/plan-selection'
import { cn } from '@/lib/utils'
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
      : registrationPathForPlan('pro_monthly')
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

type Tone = 'dark' | 'light'

interface HeaderState {
  /** `light` while the pill is over a `data-tone="light"` section. */
  tone: Tone
  /** The page has scrolled past the top: the pill gets a shadow. */
  scrolled: boolean
  /** Hash of the landing section on screen (`''` above the first). */
  section: string
}

const topState: HeaderState = { tone: 'dark', scrolled: false, section: '' }

/**
 * Follows the page under the floating header: light tone over light
 * sections, a shadow once scrolled, and the nav section on screen (the last
 * one whose top passed 40% of the viewport, as in the mock-up). The server
 * renders the top-of-page state.
 */
function useHeaderState(pillRef: RefObject<HTMLElement | null>) {
  const [state, setState] = useState(topState)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      let tone: Tone = 'dark'
      const pill = pillRef.current?.getBoundingClientRect()
      if (pill) {
        const y = pill.top + pill.height / 2
        for (const element of document.querySelectorAll(
          '[data-tone="light"]',
        )) {
          const box = element.getBoundingClientRect()
          if (box.top <= y && box.bottom >= y) {
            tone = 'light'
            break
          }
        }
      }
      let section = ''
      for (const item of navItems) {
        const element = document.getElementById(item.hash.slice(1))
        if (element && element.getBoundingClientRect().top < innerHeight * 0.4)
          section = item.hash
      }
      const scrolled = window.scrollY > 40
      setState((current) =>
        current.tone === tone &&
        current.scrolled === scrolled &&
        current.section === section
          ? current
          : { tone, scrolled, section },
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [pillRef])

  return state
}

/** Hairline/hover tint: white on dark, black on light (`--hl`). */
const hoverTint = 'hover:bg-[rgba(var(--hl),0.06)]'

export function SiteHeader() {
  const { status, user } = useAuth()
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const isAuthed = status === 'authenticated'
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pillRef = useRef<HTMLElement>(null)
  const { tone, scrolled, section } = useHeaderState(pillRef)

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
  const accountPath = isAuthed ? '/account' : '/login'
  const close = () => setOpen(false)

  return (
    <>
      <PromoBar />
      {/* Floating pill in a sticky, click-through wrapper. Light tone swaps
          the landing tokens for the dark-on-cream ones of the mock-up. */}
      <header
        data-hdrtone={tone}
        className={cn(
          'group/hdr text-lp-ink pointer-events-none sticky top-0 z-20 px-4 pt-3 max-sm:px-2 max-sm:pt-2',
          '[--hb:11,11,11] [--hl:255,255,255]',
          'data-[hdrtone=light]:[--color-lp-dim:#67635d] data-[hdrtone=light]:[--color-lp-ink:#151413] data-[hdrtone=light]:[--color-lp-muted:#5c5954] data-[hdrtone=light]:[--color-lp-soft:#2b2926] data-[hdrtone=light]:[--hb:250,248,244] data-[hdrtone=light]:[--hl:0,0,0]',
        )}
      >
        <nav
          ref={pillRef}
          aria-label={t('mainNav')}
          className={cn(
            'text-lp-ink pointer-events-auto mx-auto flex max-w-[1180px] items-center gap-6 rounded-full border border-white/10 bg-[rgba(var(--hb),0.72)] py-2 pr-2 pl-5 backdrop-blur-[16px] backdrop-saturate-[1.4] transition-[box-shadow,background-color,border-color,color] duration-[350ms] group-data-[hdrtone=light]/hdr:border-black/[0.08] max-[1024px]:gap-4 max-[900px]:justify-between max-sm:gap-3 max-sm:px-5 max-sm:py-2.5',
            scrolled && 'shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
          )}
        >
          <a
            href={landingPathFor(locale)}
            aria-label={t('logoLabel')}
            className="text-lp-ink hover:text-lp-ink flex-none text-[18px]"
          >
            <LandingLogo />
          </a>
          <NavLinks
            activeHash={section}
            className="flex-1 justify-center gap-0.5 max-[900px]:hidden"
            linkClassName={cn(
              'text-lp-muted hover:text-lp-ink flex h-10 items-center rounded-full px-3.5 text-[15px] whitespace-nowrap transition-colors duration-200 max-[1180px]:px-2.5',
              hoverTint,
            )}
            activeClassName="text-lp-ink bg-[rgba(var(--hl),0.08)]"
          />

          <div className="flex min-w-0 items-center gap-1.5">
            {/* Kept from the previous header (not in the mock-up): the
                language and the App Store badge sit before «Увійти» while
                there is room, and move into the burger menu below 900px. */}
            <LanguageMenu className="hidden shrink-0 min-[900px]:block [&>button]:h-10 [&>button]:ring-[rgba(var(--hl),0.16)] group-data-[hdrtone=light]/hdr:[&>button]:text-lp-ink group-data-[hdrtone=light]/hdr:[&>button:hover]:bg-black/[0.06]" />
            <div className="hidden shrink-0 min-[1180px]:block [&>a]:min-h-10">
              <AppStoreBadge />
            </div>
            <Link
              data-login=""
              to={accountPath}
              className={cn(
                'text-lp-soft hover:text-lp-ink flex h-10 min-w-0 max-w-[200px] items-center rounded-full px-4 text-[15px] whitespace-nowrap transition-colors max-sm:hidden min-[900px]:max-[1024px]:hidden',
                hoverTint,
              )}
            >
              <span className="truncate">{accountLabel}</span>
            </Link>
            <PrimaryLink
              to="/login?purpose=registration"
              size="md"
              className="hover:text-lp-bg h-10 shrink-0 gap-2 px-[18px] whitespace-nowrap"
            >
              {l('headerCta')}
              <span aria-hidden className="max-sm:hidden">
                →
              </span>
            </PrimaryLink>
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={open}
              aria-controls="mobile-site-menu"
              aria-label={open ? t('closeMenu') : t('openMenu')}
              onClick={() => setOpen((value) => !value)}
              className="text-lp-ink focus-visible:outline-lp-accent hidden size-10 flex-none cursor-pointer items-center justify-center rounded-full bg-[rgba(var(--hl),0.06)] focus-visible:outline-2 max-[900px]:flex"
            >
              {open ? (
                <X className="size-[18px]" aria-hidden />
              ) : (
                <Menu className="size-[18px]" aria-hidden />
              )}
            </button>
          </div>
        </nav>
        {open && (
          <nav
            id="mobile-site-menu"
            aria-label={t('mobileNav')}
            className="pointer-events-auto mx-auto mt-2 flex max-w-[1180px] animate-[lp-scr-in_.3s_cubic-bezier(.2,.8,.2,1)_both] flex-col rounded-[24px] border border-white/10 bg-[rgba(var(--hb),0.96)] p-2 backdrop-blur-[16px] group-data-[hdrtone=light]/hdr:border-black/[0.08] motion-reduce:animate-none min-[900px]:hidden"
          >
            <NavLinks
              activeHash={section}
              className="flex-col"
              linkClassName={cn(
                'text-lp-ink flex h-[52px] w-full items-center rounded-2xl px-4 text-[17px]',
                hoverTint,
              )}
              activeClassName="bg-[rgba(var(--hl),0.06)]"
              onNavigate={close}
            />
            <Link
              to={accountPath}
              onClick={close}
              className={cn(
                'text-lp-muted flex h-[52px] items-center rounded-2xl px-4 text-[17px]',
                hoverTint,
              )}
            >
              {accountLabel}
            </Link>
            <div className="mt-2 flex flex-col gap-4 border-t border-white/[0.08] px-2 pt-4 pb-2 group-data-[hdrtone=light]/hdr:border-black/[0.08]">
              {/* The segments are styled for dark; recolour them on cream. */}
              <div className="group-data-[hdrtone=light]/hdr:[&_a:not([aria-current])]:text-lp-soft group-data-[hdrtone=light]/hdr:[&_a:not([aria-current])]:ring-black/10 group-data-[hdrtone=light]/hdr:[&_p]:text-lp-dim">
                <LanguageSegments onNavigate={close} />
              </div>
              <div className="self-start">
                <AppStoreBadge onClick={close} />
              </div>
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
