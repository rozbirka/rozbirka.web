import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import {
  LOCALE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
  siteLocalePreference,
  useLocale,
  useT,
  type Locale,
} from '@/i18n'
import { landingPathFor, LOCALE_CODES } from '@/seo/landing-locales'
import { siteMessages } from './site-messages'

/** Router state asking the landing to move focus to its H1 after a switch. */
export interface LandingNavigationState {
  focusHeading?: boolean
}

/**
 * Click handler for a language link. The links are plain anchors to `/`,
 * `/en`, `/pl` so they work without JavaScript and in new tabs; with
 * JavaScript a click remembers the public-site language in this browser and
 * a plain click navigates inside the app. The site language is separate from
 * the cabinet one: choosing here never changes the interface language a
 * signed-in user works in, and the profile choice never changes this.
 */
function useChooseLanguage(onDone?: () => void) {
  const { locale: current } = useLocale()
  const navigate = useNavigate()

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>, locale: Locale) => {
      siteLocalePreference.set(locale)
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      event.preventDefault()
      onDone?.()
      if (locale === current) return
      const state: LandingNavigationState = { focusHeading: true }
      void navigate(landingPathFor(locale), { state })
    },
    [current, navigate, onDone],
  )
}

/**
 * Desktop site language button (board 2a): shows the code (UK / EN / PL),
 * opens a menu of native language names. Enter/Space/ArrowDown open it,
 * ArrowUp/Down/Home/End move, Esc closes and returns focus to the button.
 */
export function LanguageMenu({ className }: { className?: string }) {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const pendingFocus = useRef<number | null>(null)

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }, [])

  const choose = useChooseLanguage(() => close(true))

  const openAt = (index: number) => {
    pendingFocus.current = index
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    if (pendingFocus.current !== null) {
      itemRefs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const currentIndex = SUPPORTED_LOCALES.indexOf(locale)
  const count = SUPPORTED_LOCALES.length

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openAt(open ? 0 : currentIndex)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAt(open ? count - 1 : currentIndex)
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const focused = itemRefs.current.findIndex(
      (item) => item === document.activeElement,
    )
    const focusItem = (index: number) => {
      event.preventDefault()
      itemRefs.current[(index + count) % count]?.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        focusItem(focused + 1)
        break
      case 'ArrowUp':
        focusItem(focused < 0 ? count - 1 : focused - 1)
        break
      case 'Home':
        focusItem(0)
        break
      case 'End':
        focusItem(count - 1)
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close(true)
        break
      case 'Tab':
        setOpen(false)
        break
      case ' ':
        // Space activates a menu item like Enter does for links.
        if (focused >= 0) {
          event.preventDefault()
          itemRefs.current[focused]?.click()
        }
        break
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('siteLangAria')}
        onClick={() => (open ? close(false) : openAt(currentIndex))}
        onKeyDown={onButtonKeyDown}
        className="flex h-12 items-center gap-2 rounded-full px-4 text-[15px] text-white ring-1 ring-white/10 transition-all duration-300 hover:bg-white/[0.06] hover:ring-white/25"
      >
        <Globe className="size-4" aria-hidden />
        <span>{LOCALE_CODES[locale]}</span>
        <ChevronDown
          className={cn(
            'size-4 opacity-70 transition-transform duration-300 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-label={t('siteLang')}
        hidden={!open}
        onKeyDown={onMenuKeyDown}
        className="bg-surface-1 absolute top-full right-0 z-50 mt-3 w-64 rounded-[28px] p-2 shadow-2xl ring-1 ring-white/10"
      >
        <p
          aria-hidden
          className="px-4 pt-3 pb-2 text-[11px] font-medium tracking-[0.28em] text-neutral-500 uppercase"
        >
          {t('siteLang')}
        </p>
        {SUPPORTED_LOCALES.map((item, index) => {
          const checked = item === locale
          return (
            <a
              key={item}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              role="menuitemradio"
              aria-checked={checked}
              tabIndex={-1}
              href={landingPathFor(item)}
              hrefLang={item}
              lang={item}
              onClick={(event) => choose(event, item)}
              className={cn(
                'flex min-h-11 items-center justify-between gap-3 rounded-full px-4 text-[15px] transition-colors focus-visible:bg-white/[0.06]',
                checked
                  ? 'text-brand'
                  : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <span>{LOCALE_NATIVE_NAMES[item]}</span>
              {checked && (
                <svg
                  viewBox="0 0 16 16"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M3 8.5l3 3 7-7" />
                </svg>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Mobile site language choice (board 2b): three segments in one row inside
 * the mobile menu, each a link with `lang` and `hreflang`.
 */
export function LanguageSegments({ onNavigate }: { onNavigate?: () => void }) {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const labelId = useId()
  const choose = useChooseLanguage(onNavigate)

  return (
    <div className="flex flex-col gap-3">
      <p
        id={labelId}
        className="px-1 text-[11px] font-medium tracking-[0.28em] text-neutral-500 uppercase"
      >
        {t('siteLang')}
      </p>
      <ul
        role="list"
        aria-labelledby={labelId}
        className="grid grid-cols-3 gap-1.5"
      >
        {SUPPORTED_LOCALES.map((item) => {
          const current = item === locale
          return (
            <li key={item} className="flex">
              <a
                href={landingPathFor(item)}
                hrefLang={item}
                lang={item}
                aria-current={current ? 'true' : undefined}
                onClick={(event) => choose(event, item)}
                className={cn(
                  'flex min-h-12 w-full items-center justify-center rounded-full px-1 text-center text-[13px] leading-tight transition-colors',
                  current
                    ? 'border-brand text-brand border'
                    : 'text-neutral-300 ring-1 ring-white/10 hover:text-white',
                )}
              >
                {LOCALE_NATIVE_NAMES[item]}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
