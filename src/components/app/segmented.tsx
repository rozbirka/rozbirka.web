import { cn } from '@/lib/utils'

export interface SegmentedOption<Value extends string> {
  value: Value
  label: string
  disabled?: boolean
  /** Announced instead of the label when the label alone is ambiguous. */
  srLabel?: string
}

/**
 * A small set of exclusive choices, all visible at once — a period, a
 * direction, a status filter. Rendered as radios, so arrow keys move between
 * options and a screen reader reads "2 of 3" without any extra wiring.
 */
export function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
  name,
  as = 'radio',
  selectionTone = 'neutral',
  className,
}: {
  /** Names the group for assistive technology. */
  label: string
  options: readonly SegmentedOption<Value>[]
  value: Value
  onChange: (value: Value) => void
  name: string
  /**
   * `radio` is the default. Use `toggle` where every option must stay
   * Tab-reachable — radios use roving tabindex, which some flows rely against.
   */
  as?: 'radio' | 'toggle'
  /** Adds a persistent brand outline to the selected option when requested. */
  selectionTone?: 'neutral' | 'brand'
  className?: string
}) {
  if (as === 'toggle') {
    return (
      <div
        aria-label={label}
        className={cn(
          'rz-seg flex-wrap',
          selectionTone === 'brand' && 'rz-seg--brand',
          className,
        )}
        onKeyDown={(event) => {
          const step =
            event.key === 'ArrowRight' || event.key === 'ArrowDown'
              ? 1
              : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                ? -1
                : 0
          if (step === 0) return
          event.preventDefault()
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button:not([disabled])',
            ),
          ]
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          )
          if (index === -1) return
          buttons[(index + step + buttons.length) % buttons.length]?.focus()
        }}
        role="group"
      >
        {options.map((option) => {
          const pressed = option.value === value
          return (
            <button
              aria-pressed={pressed}
              className={cn(
                'flex-1 justify-center',
                pressed &&
                  selectionTone === 'brand' &&
                  'shadow-[inset_0_0_0_1px_var(--rz-brand)]',
              )}
              key={option.value}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
              {option.srLabel === undefined ? null : (
                <span className="sr-only"> {option.srLabel}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <fieldset className={cn('rz-seg m-0 flex-wrap', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const checked = option.value === value
        return (
          <label
            className={cn(
              'rounded-rz-xs flex h-[calc(var(--rz-control-h)-6px)] flex-1 cursor-pointer items-center justify-center px-[9px] font-medium whitespace-nowrap transition-colors',
              'has-[:focus-visible]:shadow-[var(--rz-focus)]',
              option.disabled && 'cursor-not-allowed opacity-40',
              checked
                ? 'bg-app-selected text-app-strong'
                : 'text-app-muted hover:text-app-strong',
              checked &&
                selectionTone === 'brand' &&
                'shadow-[inset_0_0_0_1px_var(--rz-brand)]',
            )}
            key={option.value}
          >
            <input
              checked={checked}
              className="sr-only"
              disabled={option.disabled}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            {option.label}
            {option.srLabel === undefined ? null : (
              <span className="sr-only"> {option.srLabel}</span>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}
