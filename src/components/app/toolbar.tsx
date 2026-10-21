import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

/** Filter row above a list. Filters apply as they change — no Apply button. */
export function Toolbar({
  children,
  trailing,
  className,
}: {
  children: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rz-toolbar', className)}>
      {children}
      {trailing === undefined ? null : (
        <div className="rz-toolbar__end flex-wrap items-center">{trailing}</div>
      )}
    </div>
  )
}

export interface ActiveFilter {
  key: string
  label: string
  onClear: () => void
}

/** What is currently narrowing the list, and how to undo it. */
export function ActiveFilters({
  filters,
  onReset,
}: {
  filters: readonly ActiveFilter[]
  onReset?: () => void
}) {
  const t = useT(appMessages)
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <button
          className="rz-chip"
          key={filter.key}
          onClick={filter.onClear}
          type="button"
        >
          {filter.label}
          <X aria-hidden className="text-app-dim size-3" />
          <span className="sr-only">{t('clearFilter')}</span>
        </button>
      ))}
      {onReset === undefined ? null : (
        <button
          className="rz-btn rz-btn--ghost rz-btn--sm"
          onClick={onReset}
          type="button"
        >
          {t('reset')}
        </button>
      )}
    </div>
  )
}
