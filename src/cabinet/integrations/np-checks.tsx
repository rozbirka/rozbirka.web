import { Check, Dot, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NpCheckState = 'ok' | 'pending' | 'fail' | 'none'

export interface NpCheck {
  label: string
  /** The finding in words; the mark only repeats it. */
  value: string
  state: NpCheckState
}

/**
 * A short list of checks as module 46 draws it: a round mark, the label and
 * the finding on the right — the wizard progress, the rights card and the
 * recovery result all use the same rows.
 */
export function NpChecks({
  items,
  label,
  variant = 'plain',
}: {
  items: readonly NpCheck[]
  label?: string
  variant?: 'plain' | 'inset'
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'm-0 grid list-none p-0',
        variant === 'inset' &&
          'border-app-line overflow-hidden rounded-rz-sm border bg-(--rz-sheet-field)',
      )}
    >
      {items.map((item) => (
        <li
          aria-current={item.state === 'pending' ? 'step' : undefined}
          className={cn(
            'border-app-line flex min-h-10 items-center gap-2.5 border-t py-2 first:border-t-0',
            variant === 'inset' && 'px-3',
          )}
          key={item.label}
        >
          <span
            aria-hidden
            className={cn(
              'rz-timeline__icon shrink-0',
              item.state === 'ok'
                ? 'bg-state-ok text-(--rz-on-brand)'
                : item.state === 'fail'
                  ? 'border-state-danger text-state-danger border bg-transparent'
                  : 'text-app-dim bg-transparent shadow-[inset_0_0_0_1px_var(--rz-border-strong)]',
            )}
          >
            {item.state === 'ok' ? (
              <Check />
            ) : item.state === 'fail' ? (
              <X />
            ) : item.state === 'pending' ? (
              <Dot />
            ) : null}
          </span>
          <span className="rz-strong min-w-0 flex-1 text-pretty">
            {item.label}
          </span>
          {item.value === '' ? null : (
            <span
              className={cn(
                // Real values (a full name, «Дубляни (Львів.обл.,Жовків.р-н)»)
                // are longer than the mock's: cap the finding at half the row
                // and let it wrap so the label keeps its width.
                'ml-auto max-w-1/2 min-w-0 text-right font-mono text-caption wrap-anywhere',
                item.state === 'ok'
                  ? 'text-state-ok'
                  : item.state === 'fail'
                    ? 'text-state-danger'
                    : 'text-app-muted',
              )}
            >
              {item.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
