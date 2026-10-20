import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FieldContext } from './field-context'

export interface FieldProps {
  label: ReactNode
  children: ReactNode
  /** Guidance shown under the control. Never part of the accessible name. */
  hint?: ReactNode
  /** Replaces the hint and marks the control invalid. */
  error?: ReactNode
  required?: boolean
  /** Visually hidden addition to the label, for names like "Кількість Бампер". */
  srLabel?: string
  /**
   * Hides the label from sight while keeping it as the control's name — for a
   * search box whose magnifier and placeholder already say what it is.
   */
  hiddenLabel?: boolean
  className?: string
}

/**
 * One labelled control. The label is explicit (`htmlFor`), so hint and error
 * text describe the control without leaking into its accessible name.
 */
export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  srLabel,
  hiddenLabel = false,
  className,
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const invalid = error !== undefined && error !== null && error !== false
  const describedBy = invalid
    ? errorId
    : hint !== undefined && hint !== null && hint !== false
      ? hintId
      : undefined

  return (
    <div className={cn('rz-field', className)}>
      <div
        className={cn('rz-label flex items-baseline', hiddenLabel && 'sr-only')}
      >
        <label htmlFor={id}>{label}</label>
        {/* Outside the label: its text content must stay the accessible name. */}
        {required ? (
          <span aria-hidden className="rz-req">
            *
          </span>
        ) : null}
      </div>
      <FieldContext.Provider
        value={{
          id,
          describedBy,
          invalid,
          ...(srLabel === undefined
            ? {}
            : {
                ariaLabel:
                  typeof label === 'string' ? `${label} ${srLabel}` : srLabel,
              }),
        }}
      >
        {children}
      </FieldContext.Provider>
      {invalid ? (
        <p className="rz-error" id={errorId}>
          {error}
        </p>
      ) : describedBy === hintId ? (
        <p className="rz-hint" data-slot="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
