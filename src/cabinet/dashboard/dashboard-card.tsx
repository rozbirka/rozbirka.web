import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * One block of the dashboard: a title, something opposite it, and a stack of
 * rows separated by hairlines rather than by gaps. Every panel on this screen
 * has the same frame, so the screen reads as one board instead of a dozen
 * loose boxes.
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
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'border-app-line bg-app-raised overflow-hidden rounded-[20px] border',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-4 px-6 pt-5 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2
            className="text-[17px] font-bold tracking-[-0.01em] whitespace-nowrap text-white"
            id={titleId}
          >
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * The link opposite a card title. It is 14px text, so the 44px hit area the
 * cabinet keeps everywhere is restored with a transparent overlay instead of
 * padding that would push the title line out of shape.
 */
export function CardLink({
  children,
  to,
}: {
  children: ReactNode
  to: string
}) {
  return (
    <Link
      className="text-brand hover:text-brand-hover relative text-[14px] font-bold whitespace-nowrap transition-colors after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']"
      to={to}
    >
      {children}
    </Link>
  )
}

/** Opposite a title where there is nothing to link to: the period, a total. */
export function CardNote({ children }: { children: ReactNode }) {
  return (
    <span className="text-app-dim font-mono text-[12px] whitespace-nowrap">
      {children}
    </span>
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
        'border-app-line border-t px-6 py-3.5',
        tint === true && 'bg-state-warn-soft',
        hover && 'transition-colors hover:bg-white/[0.03]',
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
    <p className="border-app-line text-app-dim border-t px-6 py-5 text-[13px] text-pretty">
      {children}
    </p>
  )
}
