import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFieldControl } from './field-context'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

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
  const t = useT(appMessages)
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  return (
    <div className={cn('rz-stepper w-fit', className)}>
      <button
        aria-label={t('less')}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        type="button"
      >
        <Minus aria-hidden />
      </button>
      <input
        {...field}
        // Inside a `Field` the visible label already names the control; the
        // prop is the fallback for a stepper standing on its own.
        {...(field.id === undefined ? { 'aria-label': label } : {})}
        inputMode="numeric"
        onChange={(event) => {
          const next = Number(event.target.value.replace(/\D/g, ''))
          onChange(Number.isFinite(next) ? clamp(next) : min)
        }}
        value={value}
      />
      <button
        aria-label={t('more')}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        type="button"
      >
        <Plus aria-hidden />
      </button>
    </div>
  )
}
