import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FactRow {
  label: string
  value: ReactNode
  /** Sits at the end of the row: a copy button, a link. */
  action?: ReactNode
}

/**
 * The facts of a record read down a single column: label on the left, value on
 * the right, a rule between them. A grid packs more onto the screen; rows are
 * what a person scans when they are looking for one specific field.
 */
export function FactRows({
  rows,
  className,
}: {
  rows: readonly FactRow[]
  className?: string
}) {
  return (
    <dl className={cn('rz-facts px-0', className)}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd className="flex flex-wrap items-center gap-3">
            {row.value}
            {row.action}
          </dd>
        </div>
      ))}
    </dl>
  )
}
