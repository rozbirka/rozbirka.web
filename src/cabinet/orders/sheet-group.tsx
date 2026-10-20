import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One group of a sheet or dialog body (scheme 1b): a 13px title, optionally
 * led by its mono number in brand text («01 Джерело»), the controls, then a
 * caption under them. No rule between groups — the body's gap separates them.
 */
export function SheetGroup({
  n,
  title,
  aside,
  hint,
  children,
  className,
}: {
  /** The mono step number the reference prints before the title. */
  n?: string
  title?: ReactNode
  /** Sits opposite the title: a count, a small action. */
  aside?: ReactNode
  /** One caption under the controls. */
  hint?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <section
      {...(title === undefined ? {} : { 'aria-labelledby': titleId })}
      className={cn('grid min-w-0 content-start gap-2.5', className)}
    >
      {title === undefined && aside === undefined ? null : (
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {title === undefined ? null : (
            <h3 className="rz-h-card flex items-baseline gap-2" id={titleId}>
              {n === undefined ? null : (
                <span className="text-brand-text font-mono text-caption">
                  {n}
                </span>
              )}
              {title}
            </h3>
          )}
          {aside}
        </div>
      )}
      {children}
      {hint === undefined || hint === null || hint === '' ? null : (
        <p className="rz-caption m-0 text-pretty">{hint}</p>
      )}
    </section>
  )
}

/**
 * A bordered list of rows inside a sheet (`item` rows of the reference):
 * 44px rows split by hairlines, the first without one.
 */
export function SheetList({
  label,
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'border-app-line m-0 grid min-h-fit list-none overflow-hidden rounded-rz-md border bg-(--rz-sheet-field) p-0',
        '[&>li]:border-app-line [&>li]:flex [&>li]:min-h-11 [&>li]:items-center [&>li]:gap-3 [&>li]:border-t [&>li]:px-3 [&>li]:py-2 [&>li:first-child]:border-t-0',
        className,
      )}
    >
      {children}
    </ul>
  )
}
