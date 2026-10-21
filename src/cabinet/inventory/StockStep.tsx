import { useId, type ReactNode } from 'react'

/**
 * One numbered step of a placement: a `.rz-card` whose head reads
 * "01 · Склад" with the hint under it, as module 12 draws it. The number
 * stays outside the heading, so the step is still named by its title alone.
 */
export function Step({
  number,
  title,
  hint,
  aside,
  children,
}: {
  number: string
  title: string
  hint?: string | undefined
  /** Sits opposite the title — a legend, a count. */
  aside?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rz-card min-w-0">
      <header className="rz-card__head py-2.5">
        <div className="grid min-w-0 gap-0.5">
          <div className="rz-h-card flex flex-wrap items-baseline gap-1">
            <span aria-hidden>{number}</span>
            <span aria-hidden>·</span>
            <h2 className="rz-h-card" id={titleId}>
              {title}
            </h2>
          </div>
          {hint === undefined ? null : (
            <p className="rz-caption m-0 text-pretty">{hint}</p>
          )}
        </div>
        {aside}
      </header>
      <div className="rz-card__body grid gap-3">{children}</div>
    </section>
  )
}
