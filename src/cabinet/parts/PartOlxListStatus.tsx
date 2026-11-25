import { TriangleAlert } from 'lucide-react'
import type { PartOlxStatus } from '@/api/parts'
import { StatusPill } from '@/components/app'
import { usePartOlxPresentation } from './use-part-olx-presentation'

export function PartOlxListStatus({ status }: { status: PartOlxStatus }) {
  const { label, tone, reason, attention } = usePartOlxPresentation(status)
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <StatusPill
        className="h-auto min-h-5 max-w-full whitespace-normal"
        tone={tone}
      >
        <span className="font-mono">OLX</span> · {label}
        {attention && (
          <TriangleAlert aria-hidden className="text-state-warn size-3" />
        )}
      </StatusPill>
      {reason && (
        <span className="rz-caption max-w-full break-words">{reason}</span>
      )}
    </div>
  )
}
