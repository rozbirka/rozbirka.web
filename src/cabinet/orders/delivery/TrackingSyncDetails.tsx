import { ChevronDown } from 'lucide-react'
import { FactRows } from '@/components/app'
import { useFormat, useT } from '@/i18n'
import { messages, reasons } from './tracking-sync-messages'

export interface TrackingSyncState {
  trackingPending?: boolean
  trackingCompleted?: boolean
  trackingPaused?: boolean
  trackingEnabled?: boolean
  trackingLastSuccessAt?: string | null
  trackingLastErrorAt?: string | null
  trackingLastError?: string | null
  nextTrackingAttemptAt?: string | null
}

export function TrackingSyncDetails({ state }: { state: TrackingSyncState }) {
  const t = useT(messages)
  const format = useFormat()
  if (
    state.trackingPending === undefined &&
    state.trackingCompleted === undefined
  )
    return null
  const next =
    state.trackingEnabled === false
      ? t('disabled')
      : state.trackingPaused
        ? t('paused')
        : state.trackingPending
          ? t('pending')
          : state.trackingCompleted
            ? t('completed')
            : (format.dateTime(state.nextTrackingAttemptAt) ?? t('soon'))
  return (
    <details className="border-app-line group border-t pt-2">
      <summary className="rz-muted flex min-h-control cursor-pointer list-none items-center justify-between gap-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        {t('title')}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <FactRows
        rows={[
          {
            label: t('success'),
            value: format.dateTime(state.trackingLastSuccessAt) ?? t('never'),
          },
          {
            label: t('error'),
            value: state.trackingLastError ? (
              <span>
                {t(reasons[state.trackingLastError] ?? 'failed')}
                {state.trackingLastErrorAt
                  ? ` · ${format.dateTime(state.trackingLastErrorAt) ?? ''}`
                  : ''}
              </span>
            ) : (
              t('none')
            ),
          },
          { label: t('next'), value: next },
        ]}
      />
    </details>
  )
}
