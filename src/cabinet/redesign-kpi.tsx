import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** One cell of the KPI strip: `.rz-kpi` from the design system. */
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
  tone?: 'plain' | 'ok' | 'warn' | 'danger' | 'dim'
  title?: string
}) {
  return (
    <div
      className={cn(
        'rz-kpi',
        tone === 'warn' && 'rz-kpi--warn',
        tone === 'dim' && 'rz-kpi--dim',
        // The kit has warn and dim only; ok and danger colour the figure the
        // same way with state tokens.
        tone === 'ok' && '[&_.rz-display]:text-state-ok',
        tone === 'danger' && '[&_.rz-display]:text-state-danger',
      )}
      title={title}
    >
      <p className="rz-kpi__label m-0">{label}</p>
      <p className="rz-kpi__value m-0">
        <span className="rz-display">{value}</span>
        {unit === undefined ? null : (
          <span className="rz-kpi__unit">{unit}</span>
        )}
      </p>
      <p className="rz-kpi__meta m-0 text-pretty">{meta}</p>
    </div>
  )
}

/** The strip itself: `.rz-kpis`, hairline gaps, one column on a phone. */
export function KpiStrip({ children }: { children: ReactNode }) {
  return <div className="rz-kpis">{children}</div>
}
