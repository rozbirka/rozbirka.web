import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { siteMessages } from './site-messages'

interface BrandLogoProps {
  className?: string
  href?: string
}

export function BrandLogo({ className, href = '/' }: BrandLogoProps) {
  const t = useT(siteMessages)
  return (
    <a
      href={href}
      aria-label={t('logoLabel')}
      className={cn(
        'text-brand inline-block text-2xl font-semibold tracking-tight',
        className,
      )}
    >
      rozbirka
    </a>
  )
}
