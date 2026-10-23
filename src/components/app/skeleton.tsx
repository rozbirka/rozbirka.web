import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('rz-skel', className)} />
}

/** Form controls retain their space while their values are being fetched. */
export function SkeletonFields({
  count = 6,
  label,
}: {
  count?: number
  label?: string
}) {
  return (
    <div
      aria-busy="true"
      className={cn('grid min-w-0 gap-4', count > 1 && 'sm:grid-cols-2')}
    >
      {label === undefined ? null : (
        <p className="sr-only" role="status">
          {label}
        </p>
      )}
      {Array.from({ length: count }, (_, index) => (
        <div aria-hidden className="grid min-w-0 gap-2" key={index}>
          <Skeleton className="w-2/5" />
          <Skeleton className="h-control w-full" />
        </div>
      ))}
    </div>
  )
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
  columnWidths,
  details = false,
  thumbnails = false,
  embedded = false,
  announce = true,
  variant = 'lines',
}: {
  rows?: number
  columns?: number
  label?: string
  /** Column tracks for the optional `content` variant. */
  columnWidths?: readonly string[]
  details?: boolean
  thumbnails?: boolean
  embedded?: boolean
  announce?: boolean
  /** Continuous row bars or a sketch of individual table cells. */
  variant?: 'content' | 'lines'
}) {
  const t = useT(appMessages)
  const lines = variant === 'lines'
  const tracks = lines
    ? ['1fr']
    : (columnWidths ?? Array.from({ length: columns }, () => '1fr'))
  return (
    <div
      aria-busy="true"
      className={cn('grid min-w-0', !embedded && 'rz-table-wrap')}
      style={
        {
          '--skeleton-columns': tracks
            .map((track) => `minmax(0, ${track})`)
            .join(' '),
        } as CSSProperties
      }
    >
      {announce ? (
        <p className="sr-only" role="status">
          {label ?? t('loadingData')}
        </p>
      ) : null}
      {Array.from({ length: rows }, (_, row) => (
        <div
          className={cn(
            'grid min-w-0 grid-cols-1 items-center gap-4 sm:[grid-template-columns:var(--skeleton-columns)]',
            lines ? 'h-row px-3' : 'min-h-row px-4 py-3',
            row > 0 && 'border-app-line border-t',
          )}
          key={`skeleton-row-${String(row)}`}
        >
          {tracks.map((_, column) => (
            <div
              className={cn(
                'min-w-0 items-center gap-3',
                column === 0 ? 'flex' : 'hidden sm:flex',
              )}
              key={`skeleton-cell-${String(column)}`}
            >
              {thumbnails && !lines && column === 0 ? (
                <Skeleton className="size-10 shrink-0" />
              ) : null}
              <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton
                  className={cn(
                    lines ? 'w-full' : widths[(row + column) % widths.length],
                  )}
                />
                {details && !lines && column === 0 ? (
                  <Skeleton className="h-2 w-1/3" />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
