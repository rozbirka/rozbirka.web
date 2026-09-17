import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface BulkAction {
  key: string
  label: string
  onRun: () => void
  /** Why the action cannot run now. Set means disabled, and the text is shown. */
  unavailable?: string | undefined
  /** Destructive actions read as destructive. */
  tone?: 'default' | 'danger'
}

/**
 * What is selected and what can be done with it. Takes the place of the filter
 * toolbar while a selection exists, so the list never carries two rows of
 * controls competing for the same space.
 */
export function BulkBar({
  count,
  noun,
  actions,
  onClear,
  onSelectPage,
  pageCount,
  busy,
}: {
  count: number
  /** Genitive plural of what is counted: "деталей", "автомобілів". */
  noun: string
  actions: readonly BulkAction[]
  onClear: () => void
  /** Selects every row of the current page — the only way to do it on mobile. */
  onSelectPage?: () => void
  pageCount?: number
  /** Progress of a running bulk operation, replacing the actions. */
  busy?: ReactNode
}) {
  const everythingOnPage =
    pageCount !== undefined && pageCount > 0 && count >= pageCount

  return (
    <div
      aria-label="Дії над обраними"
      className="border-brand/30 rounded-panel bg-brand/[0.07] flex flex-wrap items-center gap-x-4 gap-y-2.5 border p-2.5"
      role="region"
    >
      <p className="text-app-ink flex items-baseline gap-2 pl-1.5 text-sm">
        <span className="text-brand text-[19px] font-bold tabular-nums">
          {count}
        </span>{' '}
        <span>
          {noun} обрано
          {busy === undefined ? null : ' · виконуємо'}
        </span>
      </p>

      {busy === undefined ? (
        <>
          {onSelectPage === undefined || everythingOnPage ? null : (
            <button
              className="text-app-muted hover:text-app-ink min-h-11 text-[13px] underline decoration-white/25 underline-offset-4"
              onClick={onSelectPage}
              type="button"
            >
              Обрати всі на сторінці
              {pageCount === undefined ? '' : ` (${String(pageCount)})`}
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button
                disabled={action.unavailable !== undefined}
                key={action.key}
                onClick={action.onRun}
                {...(action.unavailable === undefined
                  ? {}
                  : { title: action.unavailable })}
                className={cn(
                  action.tone === 'danger' &&
                    action.unavailable === undefined &&
                    'border-state-danger/40 text-state-danger hover:bg-state-danger/10',
                )}
              >
                {action.label}
              </Button>
            ))}
            <Button aria-label="Зняти вибір" onClick={onClear} size="icon">
              <X aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <div className="ml-auto flex flex-wrap items-center gap-3">{busy}</div>
      )}
    </div>
  )
}
