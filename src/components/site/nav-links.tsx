import { cn } from '@/lib/utils'
import { navDestination, navItems } from '@/components/site/nav-items'
import { useLocale, useT } from '@/i18n'
import { landingPathFor } from '@/seo/landing-locales'
import { siteMessages } from './site-messages'

interface NavLinksProps {
  className?: string
  linkClassName?: string
  /** Extra classes of the link of the section currently on screen. */
  activeClassName?: string
  /** Hash (`#pricing`…) of the section currently on screen, if any. */
  activeHash?: string
  onNavigate?: () => void
}

/** Landing section links of the header (desktop pill and burger menu). */
export function NavLinks({
  className,
  linkClassName,
  activeClassName,
  activeHash,
  onNavigate,
}: NavLinksProps) {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const landingPath = landingPathFor(locale)
  return (
    <ul role="list" className={cn('m-0 flex list-none p-0', className)}>
      {navItems.map((item) => {
        const active = item.hash === activeHash
        return (
          <li key={item.href} className="flex">
            <a
              href={navDestination(item, landingPath)}
              onClick={onNavigate}
              aria-current={active ? 'location' : undefined}
              className={cn(
                'focus-visible:outline-lp-accent focus-visible:outline-2',
                linkClassName,
                active && activeClassName,
              )}
            >
              {t(item.shortLabel ?? item.label)}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
