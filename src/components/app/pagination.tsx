import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import { SelectInput } from './input'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'
import { commonMessages } from '@/i18n/common-messages'

export interface PaginationProps {
  page: number
  totalPages: number
  total?: number
  pageSize?: number
  pageSizes?: readonly number[]
  onPage: (page: number) => void
  onPageSize?: (pageSize: number) => void
  label?: string
}

/**
 * Range first, controls second: "1–30 з 1 248" answers where you are, which the
 * bare prev/next buttons never did.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizes = [30, 50, 100],
  onPage,
  onPageSize,
  label,
}: PaginationProps) {
  const t = useT(appMessages)
  const tc = useT(commonMessages)
  const from =
    total === undefined || pageSize === undefined || total === 0
      ? undefined
      : (page - 1) * pageSize + 1
  const to =
    from === undefined || total === undefined || pageSize === undefined
      ? undefined
      : Math.min(page * pageSize, total)

  return (
    <nav
      aria-label={label ?? t('pagination')}
      className="border-app-line bg-app-raised flex flex-wrap items-center justify-between gap-3 border-t px-3.5 py-2.5"
    >
      <p className="text-app-dim text-[13.5px] tabular-nums">
        {from === undefined || to === undefined
          ? t('pageOf', { page: String(page), total: String(totalPages) })
          : t('rangeOf', {
              from: String(from),
              to: String(to),
              total: String(total),
            })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label={t('previousPage')}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft aria-hidden />
          {tc('back')}
        </Button>
        <Button
          aria-label={t('nextPage')}
          disabled={totalPages === 0 || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          {tc('next')}
          <ChevronRight aria-hidden />
        </Button>
        {onPageSize === undefined || pageSize === undefined ? null : (
          <SelectInput
            aria-label={t('pageSize')}
            className="w-auto min-w-32"
            onChange={(event) => onPageSize(Number(event.target.value))}
            value={pageSize}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {t('perPage', { size: String(size) })}
              </option>
            ))}
          </SelectInput>
        )}
      </div>
    </nav>
  )
}
