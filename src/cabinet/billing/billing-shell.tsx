import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The frame the three billing screens share. It is the same redesign shell the
 * rest of the cabinet wears, with the breadcrumb spelled out so «Підписка ·
 * Тарифи» and «Підписка · Платежі» read as one section.
 */
export function BillingShell({
  crumb,
  title,
  lead,
  actions,
  children,
}: {
  crumb: string
  title: string
  lead: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              {crumb}
            </p>
            <h1 className="mt-1.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              {title}
            </h1>
            <p className="text-app-muted mt-2.5 max-w-[62ch] text-[14.5px] leading-6 text-pretty">
              {lead}
            </p>
          </div>
          {actions === undefined ? null : (
            <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

/** A card of the billing screens: one surface, one heading, hairline border. */
export function BillingCard({
  title,
  aside,
  className,
  children,
}: {
  title?: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5',
        className,
      )}
    >
      {title === undefined ? null : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-app-ink text-[15px] font-bold">{title}</h2>
          {aside}
        </div>
      )}
      <div className={title === undefined ? '' : 'mt-3.5'}>{children}</div>
    </section>
  )
}

/** A control the design asks for and the API cannot back: shown, not faked. */
export function BillingDead({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <button
      className="border-app-line text-app-dim inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-[12px] border px-4 text-[13.5px] font-bold"
      disabled
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}
