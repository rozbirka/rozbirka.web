import { X } from 'lucide-react'
import { Button } from './button'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

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
  const t = useT(appMessages)
  const everythingOnPage =
    pageCount !== undefined && pageCount > 0 && count >= pageCount

  return (
    <div aria-label={t('bulkRegion')} className="rz-bulk" role="region">
      <p className="text-app-ink flex items-baseline gap-1.5">
        <span className="rz-bulk__count">{count}</span>{' '}
        <span>
          {t('bulkSelected', { noun })}
          {busy === undefined ? null : t('bulkRunning')}
        </span>
      </p>

      {busy === undefined ? (
        <>
          {onSelectPage === undefined || everythingOnPage ? null : (
            <button
              className="rz-btn rz-btn--ghost rz-btn--sm"
              onClick={onSelectPage}
              type="button"
            >
              {t('selectPage')}
              {pageCount === undefined ? '' : ` (${String(pageCount)})`}
            </button>
          )}
          <div className="rz-bulk__actions items-center">
            {actions.map((action) => (
              <Button
                disabled={action.unavailable !== undefined}
                key={action.key}
                onClick={action.onRun}
                {...(action.unavailable === undefined
                  ? {}
                  : { title: action.unavailable })}
                variant={
                  action.tone === 'danger' && action.unavailable === undefined
                    ? 'danger'
                    : 'ghost'
                }
              >
                {action.label}
              </Button>
            ))}
            <Button
              aria-label={t('clearSelection')}
              onClick={onClear}
              size="icon"
            >
              <X aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <div className="rz-bulk__actions items-center">{busy}</div>
      )}
    </div>
  )
}
