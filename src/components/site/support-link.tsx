import { telegramSupportHref } from '@/lib/telegram-support'
import { MessageCircle } from 'lucide-react'
import { useT } from '@/i18n'
import { siteMessages } from './site-messages'

export function SupportLink({
  floating = false,
  asListItem = false,
}: {
  floating?: boolean
  asListItem?: boolean
}) {
  const t = useT(siteMessages)
  const username: unknown = import.meta.env['VITE_TELEGRAM_SUPPORT_BOT']
  const href = telegramSupportHref(
    typeof username === 'string' ? username : undefined,
  )
  if (!href) return null

  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('supportAria')}
      className={
        floating
          ? 'bg-brand text-brand-foreground font-visuelt fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-12 items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 md:right-6 md:bottom-6'
          : 'inline-flex min-h-11 items-center gap-2 text-[15px] text-neutral-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4'
      }
    >
      <MessageCircle size={20} aria-hidden="true" />
      {t('support')}
    </a>
  )
  return asListItem ? <li>{link}</li> : link
}
