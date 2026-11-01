import { Fragment, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The frame of a record / settings screen as `Record.dc.html` draws it: the
 * sticky `.rz-topbar` with the breadcrumb trail (ancestors › current page) and
 * the page actions, an optional module banner under it, then `.rz-page` held
 * to the 1240px record measure.
 *
 * `crumb` is the localised trail the screens already carry
 * («Налаштування · Підписка · Тарифи»); its last part is the current page.
 */
export function RecordShell({
  crumb,
  actions,
  banner,
  labelledBy,
  children,
}: {
  crumb: string
  actions?: ReactNode
  /** `.rz-banner--*` that belongs to the whole module, under the topbar. */
  banner?: ReactNode
  /** Names the page region after its heading. */
  labelledBy?: string
  children: ReactNode
}) {
  const parts = crumb.split(' · ')
  const current = parts.pop() ?? crumb
  return (
    <div className="grid content-start">
      <div className="rz-topbar min-h-topbar h-auto flex-wrap gap-y-1.5 py-1.5">
        <p className="rz-crumbs m-0 flex-wrap">
          {parts.map((part) => (
            <Fragment key={part}>
              <span className="text-app-muted">{part}</span>
              <ChevronRight aria-hidden className="size-3 shrink-0" />
            </Fragment>
          ))}
          <span aria-current="page">{current}</span>
        </p>
        {actions === undefined ? null : (
          <div className="rz-topbar__actions flex-wrap items-center">
            {actions}
          </div>
        )}
      </div>
      {banner}
      <section aria-labelledby={labelledBy} className="rz-page max-w-[1240px]">
        {children}
      </section>
    </div>
  )
}

/** `.rz-page-head`: the 20px title, chips beside it, a muted lead under it. */
export function RecordHead({
  title,
  lead,
  chips,
  titleId,
}: {
  title: ReactNode
  lead?: ReactNode
  chips?: ReactNode
  titleId?: string
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="rz-page-head items-center">
        <h1 className="rz-h-page" id={titleId}>
          {title}
        </h1>
        {chips}
      </div>
      {lead === undefined ? null : (
        <p className="rz-muted m-0 max-w-[72ch] text-pretty">{lead}</p>
      )}
    </div>
  )
}

/**
 * The record layout of `Record.dc.html`: a main column and a narrower aside
 * that drops under it when the page is too tight for both.
 */
export function RecordColumns({
  main,
  aside,
  compactAside = false,
}: {
  main: ReactNode
  aside?: ReactNode
  compactAside?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-start gap-4">
      <div className="grid min-w-0 flex-[1_1_480px] gap-4">{main}</div>
      {aside === undefined ? null : (
        <aside
          className={cn(
            'grid min-w-0 flex-[1_1_280px] gap-4 max-md:max-w-none',
            compactAside ? 'max-w-[340px]' : 'max-w-[380px]',
          )}
        >
          {aside}
        </aside>
      )}
    </div>
  )
}

/**
 * The three billing screens share one frame: the record shell, the page head
 * with header actions for subscription, plans and payments.
 */
export function BillingShell({
  crumb,
  title,
  chips,
  actions,
  banner,
  children,
}: {
  crumb: string
  title: string
  /** Status pills: on their own row under the title, as the module page has. */
  chips?: ReactNode
  actions?: ReactNode
  banner?: ReactNode
  children: ReactNode
}) {
  return (
    <RecordShell actions={actions} banner={banner} crumb={crumb}>
      <div className="grid min-w-0 gap-1.5">
        <RecordHead title={title} />
        {chips === undefined ? null : (
          <div className="flex flex-wrap items-center gap-2">{chips}</div>
        )}
      </div>
      {children}
    </RecordShell>
  )
}

/** A card of the billing screens: `.rz-card` with a head row and a body. */
export function BillingCard({
  title,
  aside,
  className,
  bodyClassName,
  footer,
  children,
}: {
  title: string
  aside?: ReactNode
  className?: string
  /** `p-0` for a table that runs to the card's edges. */
  bodyClassName?: string
  /** A caption row under the body (`.rz-card__foot`). */
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={cn('rz-card min-w-0', className)}>
      <header className="rz-card__head py-2.5">
        <h2 className="rz-h-card">{title}</h2>
        {aside}
      </header>
      <div className={cn('rz-card__body grid gap-3', bodyClassName)}>
        {children}
      </div>
      {footer === undefined ? null : (
        <div className="rz-card__foot">
          <p className="rz-caption m-0 text-pretty">{footer}</p>
        </div>
      )}
    </section>
  )
}
