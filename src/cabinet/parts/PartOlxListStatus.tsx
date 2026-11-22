import { TriangleAlert } from 'lucide-react'
import type { PartOlxStatus } from '@/api/parts'
import type { StatusTone } from '@/components/app'
import { useFormat, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { olxLiveMessages } from '../olx/olx-live-messages'
import { useOlxPublicationStatus } from '../olx/use-olx-publication-status'

const statusDot: Record<StatusTone, string> = {
  neutral: 'border-current',
  ok: 'border-state-ok bg-state-ok',
  info: 'border-state-info bg-state-info',
  warn: 'border-state-warn bg-state-warn',
  danger: 'border-state-danger bg-state-danger',
}

export function PartOlxListStatus({ status }: { status: PartOlxStatus }) {
  const fmt = useFormat()
  const t = useT(olxLiveMessages)
  const presentation = useOlxPublicationStatus(status)
  const checkedAt = status.checkedAt ? fmt.dateTime(status.checkedAt) : null
  const description = checkedAt
    ? `${presentation.label} · ${t('checked', { date: checkedAt })}`
    : presentation.label
  const { tone } = presentation
  return (
    <span
      className={cn(
        'rounded-rz-xs border-app-line-2 text-micro inline-flex h-5 w-fit items-center gap-1.5 border px-1.5 font-mono font-semibold whitespace-nowrap',
        tone === 'neutral' ? 'text-app-dim' : 'text-app-strong',
      )}
      title={`OLX · ${description}`}
    >
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full border', statusDot[tone])}
      />
      OLX
      {status.needsAttention && (
        <TriangleAlert aria-hidden className="text-state-warn size-3" />
      )}
      <span className="sr-only">
        {' '}
        · {description}
        {status.needsAttention ? ` · ${t('attention')}` : ''}
      </span>
    </span>
  )
}
