import { cn } from '@/lib/utils'

export interface PillOption {
  value: string
  label: string
}

/**
 * A small set of mutually exclusive choices, shown as pills in a tray. Radio
 * semantics, so the whole group is one stop in the tab order and arrow keys
 * move between the options — a row of buttons would make every choice its own
 * stop and never announce which one is current.
 */
export function PillGroup({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly PillOption[]
  value: string
  onChange: (value: string) => void
  /** Names the group for assistive technology, e.g. "Статус автомобілів". */
  label: string
  className?: string
}) {
  return (
    <div
      aria-label={label}
      className={cn('rz-seg shrink-0', className)}
      role="radiogroup"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            aria-checked={active}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
