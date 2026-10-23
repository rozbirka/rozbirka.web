import { WifiOff } from 'lucide-react'
import { useT } from '@/i18n'
import { shellMessages } from './shell-messages'
import { useOnline } from './use-online'

/**
 * Says the connection is gone, and — the part that matters in a metal shed —
 * says what happens to the work in progress. The bar sits above the screen
 * rather than replacing it, so a form half filled in stays on screen and stays
 * filled in. It is the design system's module banner (`.rz-banner--warn`).
 */
export function ConnectionNotice() {
  const online = useOnline()
  const t = useT(shellMessages)
  if (online) return null

  return (
    <div className="rz-banner rz-banner--warn text-app-ink" role="status">
      <WifiOff aria-hidden className="text-state-warn size-[15px] shrink-0" />
      <span className="font-semibold">{t('offline.title')}</span>
      <span className="text-app-muted">{t('offline.body')}</span>
    </div>
  )
}
