import { Fragment, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The frame of a cabinet screen, as the design system draws it
 * (docs/design-system/v2/components/Navigation.dc.html): a sticky 44px topbar
 * with the breadcrumb on the left and the page actions on the right, then
 * `.rz-page` under it.
 */
export function RedesignShell({
  crumb,
  actions,
  banner,
  peek,
  width = 'list',
  children,
}: {
  crumb: ReactNode
  actions?: ReactNode
  /** Full-width `.rz-banner` under the topbar (read-only, billing…). */
  banner?: ReactNode
  /** `.rz-peek` beside the page (master-detail); the page and it share `.rz-split`. */
  peek?: ReactNode
  /** `record` caps width; `workspace` fills the viewport for a scrollable working list. */
  width?: 'list' | 'record' | 'workspace'
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'grid content-start',
        width === 'workspace' && 'rz-workspace',
      )}
    >
      <div className="rz-topbar min-h-topbar h-auto flex-wrap justify-between gap-y-1.5 py-1.5">
        <div className="rz-crumbs m-0">{crumb}</div>
        {actions === undefined ? null : (
          <div className="rz-topbar__actions flex-wrap items-center">
            {actions}
          </div>
        )}
      </div>
      {banner}
      {peek === undefined || peek === null ? (
        <div className={cn('rz-page', width === 'record' && 'max-w-[1240px]')}>
          {children}
        </div>
      ) : (
        <div className="rz-split">
          <div
            className={cn('rz-page', width === 'record' && 'max-w-[1240px]')}
          >
            {children}
          </div>
          {peek}
        </div>
      )}
    </div>
  )
}

/**
 * A breadcrumb trail as v2 draws it: earlier parts muted, chevrons between,
 * the last part strong with `aria-current="page"`.
 */
export function Crumbs({
  items,
  label,
}: {
  items: readonly ReactNode[]
  /** Names the trail for assistive technology. */
  label?: string
}) {
  return (
    <nav aria-label={label} className="rz-crumbs">
      {items.map((item, index) => {
        const last = index === items.length - 1
        return (
          <Fragment key={index}>
            {index > 0 ? (
              <ChevronRight aria-hidden className="size-3 shrink-0" />
            ) : null}
            {last ? <span aria-current="page">{item}</span> : item}
          </Fragment>
        )
      })}
    </nav>
  )
}

/** The page title: `.rz-h-page` (20px) with a muted lead under it. */
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
      <div className="rz-page-head items-center">
        <h1 className="rz-h-page">{title}</h1>
        {aside}
      </div>
      {lead === undefined ? null : (
        <p className="text-app-muted mt-1 max-w-[72ch] text-pretty">{lead}</p>
      )}
    </div>
  )
}
