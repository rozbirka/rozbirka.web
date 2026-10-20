import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Every cabinet screen opens the same way: where am I, what is this, what can
 * I do here. Actions stay on one row with the title on desktop and wrap below
 * it on narrow screens instead of shrinking.
 */
export function PageHeader({
  eyebrow,
  title,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('rz-page-head justify-between', className)}>
      <div className="min-w-0">
        {eyebrow === undefined ? null : <p className="rz-eyebrow">{eyebrow}</p>}
        <h1 className="rz-h-page mt-1">{title}</h1>
      </div>
      {actions === undefined ? null : (
        <div className="rz-btn-row">{actions}</div>
      )}
    </header>
  )
}

/**
 * Screen body: one column with a consistent rhythm. `wide` fills the window —
 * the cabinet is worked in, not read, and tables earn every pixel. `narrow`
 * keeps forms and long prose at a readable measure.
 */
export function PageBody({
  children,
  width = 'wide',
  className,
  ...props
}: ComponentProps<'section'> & { width?: 'wide' | 'narrow' }) {
  return (
    <section
      className={cn(
        'grid w-full min-w-0 gap-3',
        width === 'wide' ? 'max-w-none' : 'max-w-3xl',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}
