import { cn } from '@/lib/utils'
import { navDestination, navItems } from '@/components/site/nav-items'
import { useLocale, useT } from '@/i18n'
import { landingPathFor } from '@/seo/landing-locales'
import { siteMessages } from './site-messages'

interface NavLinksProps {
  className?: string
  linkClassName?: string
  onNavigate?: () => void
}

export function NavLinks({
  className,
  linkClassName,
  onNavigate,
}: NavLinksProps) {
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const landingPath = landingPathFor(locale)
  return (
    <ul role="list" className={cn('flex flex-wrap gap-6', className)}>
      {navItems.map((item) => (
        <li key={item.href}>
          <a
            href={navDestination(item, landingPath)}
            onClick={onNavigate}
            className={cn(
              'text-lp-muted hover:text-lp-accent-hover text-[15px]',
              linkClassName,
            )}
          >
            {t(item.label)}
          </a>
        </li>
      ))}
    </ul>
  )
}
