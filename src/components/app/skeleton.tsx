import { cn } from '@/lib/utils'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('rz-skel', className)} />
}

const widths = ['w-3/5', 'w-2/5', 'w-1/3', 'w-1/2']

/**
 * Placeholder for a loading list. Announced once as a status, not per row —
 * a screen reader should hear "завантажуємо", not thirty empty cells.
 */
export function SkeletonRows({
  rows = 5,
  columns = 4,
  label,
}: {
  rows?: number
  columns?: number
  label?: string
}) {
  const t = useT(appMessages)
  return (
    <div className="rz-table-wrap grid">
      <p className="sr-only" role="status">
        {label ?? t('loadingData')}
      </p>
      {Array.from({ length: rows }, (_, row) => (
        <div
          className={cn(
            'h-row flex items-center gap-4 px-3',
            row > 0 && 'border-app-line border-t',
          )}
          key={`skeleton-row-${String(row)}`}
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              className={cn('flex-1', widths[(row + column) % widths.length])}
              key={`skeleton-cell-${String(column)}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
