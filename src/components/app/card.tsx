import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * `.rz-card` from the design system: 8px corners, one hairline, a head row with
 * the title and an aside opposite it, then the body. One card for the whole
 * cabinet — `SectionPanel` and `Panel` render the same frame.
 */
export function Card({
  title,
  aside,
  children,
  className,
  headerClassName,
  bodyClassName,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  /** Set to `p-0` for content that runs to the card's edges. */
  bodyClassName?: string
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn('rz-card min-w-0', className)}
    >
      <header className={cn('rz-card__head py-2.5', headerClassName)}>
        <h2 className="rz-h-card" id={titleId}>
          {title}
        </h2>
        {aside}
      </header>
      <div className={cn('rz-card__body', bodyClassName)}>{children}</div>
    </section>
  )
}
