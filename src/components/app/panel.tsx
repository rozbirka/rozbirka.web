import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Neutral surface for grouped content: cards, filter bars, summaries. */
export function Panel({
  children,
  className,
  padded = true,
  ...props
}: ComponentProps<'div'> & { padded?: boolean }) {
  return (
    <div
      className={cn('rz-card', padded && 'rz-card__body', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** A single number with its label. Digits stay in one column across cards. */
export function StatCard({
  label,
  value,
  delta,
  tone = 'neutral',
  accent = false,
}: {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  tone?: 'up' | 'down' | 'neutral'
  accent?: boolean
}) {
  return (
    <Panel padded={false}>
      <div
        className={cn(
          'rz-kpi',
          accent && 'shadow-[inset_2px_0_0_var(--rz-brand)]',
        )}
      >
        <p className="rz-kpi__label">{label}</p>
        <p className="rz-display">{value}</p>
        {delta === undefined ? null : (
          <p
            className={cn(
              'rz-kpi__meta font-mono',
              tone === 'up' && 'text-state-ok',
              tone === 'down' && 'text-state-danger',
              tone === 'neutral' && 'text-app-dim',
            )}
          >
            {delta}
          </p>
        )}
      </div>
    </Panel>
  )
}

/** Inline summary numbers above a list: total, available, reserved. */
export function StatStrip({
  items,
}: {
  items: readonly { label: string; value: ReactNode }[]
}) {
  return (
    <dl className="rz-totals">
      {items.map((item) => (
        <div className="flex items-baseline gap-1.5" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
