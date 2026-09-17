import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** One cell of the hairline strip that opens every cash screen. */
export function Kpi({
  label,
  value,
  unit,
  meta,
  tone,
  title,
}: {
  label: string
  value: ReactNode
  unit?: string
  meta: ReactNode
  tone?: 'plain' | 'warn' | 'dim'
  title?: string
}) {
  return (
    <div className="bg-app-raised px-6 pt-5.5 pb-6" title={title}>
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-[30px] leading-none font-extrabold tracking-[-0.03em]',
            tone === 'warn' && 'text-state-warn',
            tone === 'dim' && 'text-app-dim',
            (tone === undefined || tone === 'plain') && 'text-app-ink',
          )}
        >
          {value}
        </span>
        {unit === undefined ? null : (
          <span className="text-app-muted font-mono text-[13px] font-medium">
            {unit}
          </span>
        )}
      </p>
      <p className="text-app-dim mt-3.5 text-[13px] leading-5 text-pretty">
        {meta}
      </p>
    </div>
  )
}

/** The strip itself: hairline gaps, one row on a phone. */
export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-px overflow-hidden rounded-[20px] border">
      {children}
    </div>
  )
}
