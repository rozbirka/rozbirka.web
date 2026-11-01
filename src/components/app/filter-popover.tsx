import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * One filter of the toolbar: a dashed `.rz-filter` button that turns solid
 * once a value is set, and a `.rz-popover` under it holding the choices.
 * Choices apply as they are made, so the popover has no Apply button.
 */
export function FilterPopover({
  label,
  placeholder,
  setKey,
  setValue,
  children,
}: {
  /** Names the popover for assistive technology. */
  label: string
  /** The button's text while nothing is chosen: "Марка: будь-яка". */
  placeholder: string
  /** Once set, the button reads "<key>: <value>". */
  setKey?: string | undefined
  setValue?: string | undefined
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const isSet = setKey !== undefined && setValue !== undefined
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn('rz-filter', isSet && 'rz-filter--set')}
          type="button"
        >
          {isSet ? (
            <>
              <span className="rz-filter__key">{setKey}:</span> {setValue}
            </>
          ) : (
            placeholder
          )}
          <ChevronDown aria-hidden className="text-app-dim size-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          className="rz rz-popover z-50 max-w-[calc(100vw-1.5rem)]"
          align="start"
          collisionPadding={12}
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * One value of a filter, with how many records carry it. The count is the
 * point: it says whether the click is worth making before it is made.
 */
export function FilterOption({
  label,
  count,
  active,
  onSelect,
}: {
  label: string
  count?: number | undefined
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'rz-menu__item w-full justify-between',
        active && 'bg-app-selected font-semibold text-app-strong',
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="min-w-0 truncate">{label}</span>
      {count === undefined ? null : (
        <span className="text-app-dim font-mono text-caption tabular-nums">
          {count}
        </span>
      )}
    </button>
  )
}
