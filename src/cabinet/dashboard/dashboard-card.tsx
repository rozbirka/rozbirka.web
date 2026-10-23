import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, Card } from '@/components/app'
import { cn } from '@/lib/utils'

/**
 * One block of the dashboard: `.rz-card` with its `__head` (title, and
 * something opposite it), then a stack of rows separated by hairlines rather
 * than by gaps. Every panel on this screen has the same frame, so the screen
 * reads as one board instead of a dozen loose boxes.
 */
export function DashboardCard({
  title,
  aside,
  children,
  className,
}: {
  title: string
  /** Opposite the title: a link to the full list, or the period it covers. */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      aside={aside}
      bodyClassName="p-0 divide-y divide-app-line"
      {...(className === undefined ? {} : { className })}
      title={title}
    >
      {children}
    </Card>
  )
}

/**
 * The link opposite a card title: the card head's small secondary button
 * (`.rz-btn--sm`). On a coarse pointer it grows to the control height, so the
 * 44px hit area the cabinet keeps everywhere still holds.
 */
export function CardLink({
  children,
  to,
}: {
  children: ReactNode
  to: string
}) {
  return (
    <Button asChild className="pointer-coarse:h-control" size="sm">
      <Link to={to}>{children}</Link>
    </Button>
  )
}

/** Opposite a title where there is nothing to link to: the period, a total. */
export function CardNote({ children }: { children: ReactNode }) {
  return (
    <span className="rz-caption rz-mono whitespace-nowrap">{children}</span>
  )
}

/** One hairline-separated row of a card. */
export function CardRow({
  children,
  className,
  hover = false,
  tint,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  /** A row that wants attention — the first task of the day. */
  tint?: boolean
}) {
  return (
    <div
      className={cn(
        'px-(--rz-card-p) py-2.5',
        tint === true && 'bg-state-warn-soft',
        hover && 'hover:bg-app-hover transition-colors',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Said in place of rows when a card has nothing to show. */
export function CardEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rz-dim m-0 px-(--rz-card-p) py-4 text-pretty">{children}</p>
  )
}
