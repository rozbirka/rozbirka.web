import { useId, type ReactNode } from 'react'

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
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="border-app-line bg-app-raised rounded-[18px] border px-6 pt-[22px] pb-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2.5">
          <span aria-hidden className="text-app-dim font-mono text-[11px]">
            {number}
          </span>
          <h2
            className="text-[17px] font-bold tracking-[-0.01em] text-white"
            id={titleId}
          >
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {hint === undefined ? null : (
        <p className="text-app-muted mt-1.5 text-[14px]">{hint}</p>
      )}
      <div className="mt-4.5">{children}</div>
    </section>
  )
}
