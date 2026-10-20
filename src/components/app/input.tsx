import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFieldControl } from './field-context'

/**
 * Text controls from the design system kit (`.rz-input`, `.rz-select`,
 * `.rz-textarea`, `.rz-search`). Height follows `--rz-control-h-lg`; on a
 * coarse pointer the tokens lift it to the 44px touch target, and inputs keep
 * 16px there so iOS does not zoom.
 */
const mobileType = 'max-md:text-title'

export function TextInput({
  className,
  numeric = false,
  ...props
}: ComponentProps<'input'> & { numeric?: boolean }) {
  const field = useFieldControl()
  return (
    <input
      {...field}
      {...props}
      className={cn(
        'rz-input',
        numeric && 'rz-input--num',
        mobileType,
        className,
      )}
    />
  )
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  const field = useFieldControl()
  return (
    <textarea
      {...field}
      {...props}
      className={cn('rz-textarea', mobileType, className)}
    />
  )
}

export function SelectInput({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  const field = useFieldControl()
  return (
    <div className="rz-select-wrap">
      <select
        {...field}
        {...props}
        className={cn('rz-select', mobileType, className)}
      >
        {children}
      </select>
    </div>
  )
}

/** Search box with a leading icon; the icon never steals the click. */
export function SearchInput({ className, ...props }: ComponentProps<'input'>) {
  const field = useFieldControl()
  return (
    <div className={cn('rz-search w-full', className)}>
      <Search aria-hidden className="pointer-events-none" />
      <input {...field} type="search" {...props} className={mobileType} />
    </div>
  )
}
