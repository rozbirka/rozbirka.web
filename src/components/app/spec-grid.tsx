import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Spec {
  label: string
  value: ReactNode
  /** Sits under the value: a note, a lock, a copy button. */
  note?: ReactNode
  /** Takes the full width — for values that run long: notes, codes. */
  wide?: boolean
}

/**
 * The fixed properties of a record. v2 has one fact list (`dl.rz-facts`) for
 * every record, so this renders the same rows as `FactRows`; `wide` is kept
 * for callers but no longer changes the layout.
 */
export function SpecGrid({
  specs,
  className,
}: {
  specs: readonly Spec[]
  className?: string
}) {
  return (
    <dl className={cn('rz-facts px-0', className)}>
      {specs.map((spec) => (
        <div key={spec.label}>
          <dt>{spec.label}</dt>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {spec.value}
            {spec.note}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A quiet aside inside a cell: why a value cannot be edited, where it came
 * from. Never the value itself.
 */
export function SpecNote({
  children,
  icon,
}: {
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <span className="rz-caption bg-app-neutral-soft rounded-rz-xs inline-flex items-center gap-1.5 px-1.5 py-0.5">
      {icon}
      {children}
    </span>
  )
}
