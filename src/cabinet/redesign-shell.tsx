import type { ReactNode } from 'react'

/**
 * The frame every redesigned screen wears: a sticky bar that keeps the
 * breadcrumb and the page actions in reach while the content scrolls, and a
 * column centred at 1240px under it. Both come straight from the design —
 * before this the actions rode along with the title and the column ran the
 * full width of the window, which pulled the eye apart on a wide monitor.
 */
export function RedesignShell({
  crumb,
  actions,
  children,
}: {
  crumb: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <p className="text-app-dim min-w-0 font-mono text-[11px] tracking-[0.14em] uppercase">
          {crumb}
        </p>
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center justify-end gap-2.5 sm:flex-nowrap">
            {actions}
          </div>
        )}
      </div>
      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 pt-10 pb-16 sm:px-6 md:px-8 lg:px-12">
        {children}
      </div>
    </div>
  )
}

/** The page title of a redesigned screen: 46px headline over a 15px lead. */
export function RedesignTitle({
  title,
  lead,
  aside,
}: {
  title: ReactNode
  lead?: ReactNode
  /** Sits beside the headline — a status pill, a counter. */
  aside?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[34px] leading-[1] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
          {title}
        </h1>
        {aside}
      </div>
      {lead === undefined ? null : (
        <p className="text-app-muted mt-3 max-w-[62ch] text-[15px] leading-6 text-pretty">
          {lead}
        </p>
      )}
    </div>
  )
}
