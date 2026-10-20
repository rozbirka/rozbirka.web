import type { ReactNode } from 'react'
import { Card } from '@/components/app'

export function Step({
  number,
  title,
  hint,
  aside,
  children,
}: {
  number: string
  title: string
  hint?: string
  /** Sits opposite the title — a legend, a count. */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      title={title}
      aside={
        <div className="flex items-center gap-2">
          <span aria-hidden className="rz-caption rz-mono">
            {number}
          </span>
          {aside}
        </div>
      }
    >
      {hint === undefined ? null : <p className="rz-hint mb-3">{hint}</p>}
      {children}
    </Card>
  )
}
