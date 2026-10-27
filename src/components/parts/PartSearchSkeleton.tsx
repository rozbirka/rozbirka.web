import { Skeleton } from '@/components/app'

/** Same row geometry as the order picker: name/code, stock, quantity, price. */
export function PartSearchSkeleton({
  label,
  compact = true,
}: {
  label: string
  compact?: boolean
}) {
  return (
    <div aria-busy="true" data-part-search-loading>
      <p className="sr-only" role="status">
        {label}
      </p>
      <div aria-hidden className="divide-app-line grid divide-y">
        {['w-3/5', 'w-2/5', 'w-4/5', 'w-1/2', 'w-2/3', 'w-3/5'].map(
          (width, index) => (
            <div
              className={
                compact
                  ? 'part-search-picker__option grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3'
                  : 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2'
              }
              key={index}
            >
              <div className="grid min-w-0 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className={width} />
                  {!compact && <Skeleton className="h-5 w-24 rounded-full" />}
                </div>
                <Skeleton className="h-2 w-1/3" />
              </div>
              <div
                className={
                  compact
                    ? 'part-search-picker__aside'
                    : 'grid justify-items-end gap-2 pl-2'
                }
              >
                {compact && (
                  <span className="part-search-picker__stock">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="w-6" />
                  </span>
                )}
                <Skeleton className="part-search-picker__price w-20" />
                {!compact && <Skeleton className="h-2 w-16" />}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
