import { useT } from '@/i18n'
import { TelegramIcon } from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { siteMessages } from './site-messages'

/** Round Telegram button pinned to the bottom-right corner of the landing. */
export function SupportLink() {
  const t = useT(siteMessages)
  const href = useSupportHref()
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('supportAria')}
      title={t('support')}
      className="bg-lp-telegram fixed right-5 bottom-[calc(20px+env(safe-area-inset-bottom))] z-[61] flex size-[60px] items-center justify-center max-sm:right-4 max-sm:bottom-[calc(16px+env(safe-area-inset-bottom))] max-sm:size-[52px] rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:scale-[1.08]"
    >
      <TelegramIcon size={60} className="block size-full" />
    </a>
  )
}
