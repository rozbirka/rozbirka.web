import { cn } from '@/lib/utils'
import { navDestination, navItems } from '@/components/site/nav-items'
import { useLocale, useT } from '@/i18n'
import { landingPathFor } from '@/seo/landing-locales'
import { siteMessages } from './site-messages'

interface NavLinksProps {
  activeHref?: string
  className?: string
  onNavigate?: () => void
}

export function NavLinks({ activeHref, className, onNavigate }: NavLinksProps) {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const landingPath = landingPathFor(locale)
  return (
    <ul
      role="list"
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {navItems.map((item) => {
        const isActive = activeHref === item.href
        return (
          <li key={item.href}>
            <a
              href={navDestination(item, landingPath)}
              aria-current={isActive ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(
                'flex h-11 items-center rounded-full px-5 text-[15px] transition-colors',
                isActive
                  ? 'border-brand text-brand border'
                  : 'text-neutral-400 hover:text-white',
              )}
            >
              {t(item.label)}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
