import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFieldControl } from './field-context'

/**
 * A small whole number set by thumb: how many of this part, how many days.
 * The figure is still typed when that is faster — the buttons are for the
 * common case of one or two, not a replacement for the keyboard.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  label,
  className,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** Names the whole control, e.g. "Кількість деталей". */
  label: string
  className?: string
}) {
  const field = useFieldControl()
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  return (
    <div
      className={cn(
        'border-app-line-2 bg-app-input rounded-control flex w-fit items-center gap-0.5 border p-1',
        className,
      )}
    >
      <button
        aria-label="Менше"
        className="text-app-muted hover:text-app-ink focus-visible:outline-brand grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        type="button"
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <input
        {...field}
        // Inside a `Field` the visible label already names the control; the
        // prop is the fallback for a stepper standing on its own.
        {...(field.id === undefined ? { 'aria-label': label } : {})}
        className="w-14 bg-transparent text-center font-mono text-[17px] text-white tabular-nums outline-none"
        inputMode="numeric"
        onChange={(event) => {
          const next = Number(event.target.value.replace(/\D/g, ''))
          onChange(Number.isFinite(next) ? clamp(next) : min)
        }}
        value={value}
      />
      <button
        aria-label="Більше"
        className="text-app-muted hover:text-app-ink focus-visible:outline-brand grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        type="button"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  )
}
