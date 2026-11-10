import { messages, reasons } from './tracking-sync-messages'
import { Notice } from '@/components/app'
import { useT } from '@/i18n'

export function TrackingRetryNotice({
  state,
  actionLabel,
}: {
  actionLabel?: string
  state: {
    trackingPaused?: boolean
    trackingFailures?: number
    syncProblem?: string | null
  }
}) {
  const t = useT(messages)
  if (!state.trackingPaused) return null
  return (
    <Notice tone="warn">
      {t('stopped')} {t(reasons[state.syncProblem ?? ''] ?? 'failed')}{' '}
      {t('count', { count: state.trackingFailures ?? 0 })}{' '}
      {t('resume', { action: actionLabel ?? t('action') })}
    </Notice>
  )
}
