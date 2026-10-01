import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { RedesignShell, RedesignTitle } from '../redesign-shell'

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
    <RedesignShell actions={actions} crumb={crumb}>
      <RedesignTitle lead={lead} title={title} />
      {children}
    </RedesignShell>
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
