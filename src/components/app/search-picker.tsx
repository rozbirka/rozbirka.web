import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type KeyboardEventHandler,
  type ComponentProps,
} from 'react'
import { Popover } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field } from './field'
import { SearchInput } from './input'
import { useFieldControl } from './field-context'

interface SearchPickerProps {
  label: string
  placeholder: string
  resultsLabel: string
  heading: string
  count: ReactNode
  /** Result-only menus, e.g. the compact order part picker. */
  headerHidden?: boolean
  query: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
  disabled?: boolean
  allowEmptyQuery?: boolean
  /** Escape clipping containers such as table rows while keeping the same UI. */
  floating?: boolean
  /** Match toolbar controls; form pickers keep the larger default height. */
  compact?: boolean
  /** Use a selection button, with the search field inside the open panel. */
  triggerLabel?: ReactNode
  triggerClassName?: string
  /** Optional selection affordance, e.g. a pencil for changing a customer. */
  triggerIcon?: ReactNode
  /** Fixed, short option lists can open directly on their choices. */
  searchable?: boolean
  showLabel?: boolean
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onInputKeyDown?: KeyboardEventHandler<HTMLInputElement>
  activeDescendant?: string | undefined
}

/** Shared search field and result surface for parts, customers and locations. */
export function SearchPicker({
  label,
  placeholder,
  resultsLabel,
  heading,
  count,
  headerHidden = false,
  query,
  open,
  onOpenChange,
  onQueryChange,
  disabled = false,
  allowEmptyQuery = false,
  floating = false,
  compact = false,
  triggerLabel,
  triggerClassName,
  triggerIcon,
  searchable = true,
  showLabel = false,
  required = false,
  hint,
  error,
  children,
  footer,
  onInputKeyDown,
  activeDescendant,
}: SearchPickerProps) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const restoringFocus = useRef(false)
  const dropdown = triggerLabel !== undefined
  const visible =
    open && !disabled && (allowEmptyQuery || Boolean(query.trim()))
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        onOpenChange(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [onOpenChange])
  useEffect(() => {
    if (dropdown && visible && !floating) {
      if (searchable) input.current?.focus()
      else focusSelectedOption(panel.current)
    }
  }, [dropdown, visible, floating, searchable])

  const search = (
    <SearchInput
      ref={input}
      {...(dropdown ? { id: `${id}-search`, 'aria-label': placeholder } : {})}
      aria-activedescendant={visible ? activeDescendant : undefined}
      aria-controls={visible ? id : undefined}
      aria-haspopup="dialog"
      autoComplete="off"
      className={compact ? 'h-control' : 'h-control-lg'}
      disabled={disabled}
      onChange={(event) => {
        onQueryChange(event.target.value)
        onOpenChange(true)
      }}
      onClick={() => onOpenChange(true)}
      onFocus={() => {
        if (!restoringFocus.current) onOpenChange(true)
      }}
      onKeyDown={onInputKeyDown}
      placeholder={placeholder}
      role="searchbox"
      value={query}
    />
  )

  const results = (
    <div
      aria-label={resultsLabel}
      className={cn(
        'rz-popover flex flex-col',
        floating
          ? 'rz z-60 max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)]'
          : 'absolute top-full right-0 left-0 z-40 mt-1.5 w-auto',
      )}
      data-search-picker-open={visible ? 'true' : undefined}
      id={id}
      ref={panel}
      role="dialog"
    >
      {dropdown && searchable ? (
        <div className="border-app-line shrink-0 border-b p-2">{search}</div>
      ) : null}
      {!headerHidden && (
        <div className="border-app-line flex shrink-0 flex-wrap items-center justify-between gap-2 border-b p-2">
          <p className="rz-label m-0">{heading}</p>
          <p className="rz-dim m-0 pr-1 font-mono text-caption tabular-nums">
            {count}
          </p>
        </div>
      )}
      <div
        data-search-picker-scroll
        className="min-h-0 max-h-[min(52vh,460px)] overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
      {footer ? (
        <div className="border-app-line shrink-0 border-t p-2">{footer}</div>
      ) : null}
    </div>
  )
  const control = (
    <div
      className="relative min-w-0"
      data-search-picker-open={visible ? 'true' : undefined}
      ref={root}
      onClickCapture={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[role="option"]')
        )
          (dropdown ? trigger.current : input.current)?.focus()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && visible) {
          event.preventDefault()
          event.stopPropagation()
          onOpenChange(false)
          restoringFocus.current = true
          const focusTarget = dropdown ? trigger.current : input.current
          focusTarget?.focus()
          restoringFocus.current = false
        } else if (
          dropdown &&
          !searchable &&
          visible &&
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        ) {
          event.preventDefault()
          const options = Array.from(
            panel.current?.querySelectorAll<HTMLButtonElement>(
              '[role="option"]:not(:disabled)',
            ) ?? [],
          )
          const current = options.findIndex(
            (option) => option === document.activeElement,
          )
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? options.length - 1
                : (current +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    options.length) %
                  options.length
          options[next]?.focus()
        } else if (
          event.key === 'Enter' &&
          visible &&
          event.target instanceof HTMLInputElement
        ) {
          event.preventDefault()
        } else if (
          event.key === 'ArrowDown' &&
          (event.target instanceof HTMLInputElement ||
            event.target === trigger.current)
        ) {
          event.preventDefault()
          if (!visible) onOpenChange(true)
          const option = panel.current?.querySelector<HTMLButtonElement>(
            '[role="option"]:not(:disabled)',
          )
          if (option) {
            option.focus()
          }
        }
      }}
    >
      {dropdown ? (
        <DropdownTrigger
          ref={trigger}
          aria-controls={visible ? id : undefined}
          aria-expanded={visible}
          aria-haspopup="dialog"
          className={cn(
            'rz-select flex min-w-0 items-center justify-between gap-2 pr-2.5 text-left focus:border-app-muted focus:shadow-none',
            compact ? 'h-control' : 'h-control-lg',
            triggerClassName,
          )}
          disabled={disabled}
          onClick={() => onOpenChange(!visible)}
          type="button"
        >
          <span className="min-w-0 truncate">{triggerLabel}</span>
          {triggerIcon ?? (
            <ChevronDown
              aria-hidden
              className="text-app-muted size-4 shrink-0"
            />
          )}
        </DropdownTrigger>
      ) : (
        search
      )}
      {visible ? (
        floating ? (
          <Popover.Portal>
            <Popover.Content
              asChild
              align="start"
              collisionPadding={12}
              sideOffset={6}
              onOpenAutoFocus={(event) => {
                event.preventDefault()
                if (dropdown) {
                  if (searchable) input.current?.focus()
                  else focusSelectedOption(panel.current)
                }
              }}
              onCloseAutoFocus={(event) => event.preventDefault()}
              onEscapeKeyDown={(event) => event.preventDefault()}
              onInteractOutside={(event) => {
                if (
                  event.target instanceof Node &&
                  root.current?.contains(event.target)
                )
                  event.preventDefault()
              }}
            >
              {results}
            </Popover.Content>
          </Popover.Portal>
        ) : (
          results
        )
      ) : null}
    </div>
  )
  return (
    <Field
      className="min-w-0"
      hiddenLabel={!showLabel}
      hint={hint}
      error={error}
      label={label}
      required={required}
    >
      {floating ? (
        <Popover.Root open={visible} onOpenChange={onOpenChange}>
          <Popover.Anchor asChild>{control}</Popover.Anchor>
        </Popover.Root>
      ) : (
        control
      )}
    </Field>
  )
}

function focusSelectedOption(panel: HTMLDivElement | null) {
  const option =
    panel?.querySelector<HTMLButtonElement>(
      '[role="option"][aria-selected="true"]:not(:disabled)',
    ) ??
    panel?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)')
  option?.focus()
}

function DropdownTrigger(props: ComponentProps<'button'>) {
  const field = useFieldControl()
  return <button {...field} {...props} />
}

export function SearchPickerOptions({
  label,
  children,
  multiple,
}: {
  label: string
  children: ReactNode
  multiple?: boolean
}) {
  return (
    <ul
      aria-label={label}
      aria-multiselectable={multiple}
      className="divide-app-line m-0 grid list-none divide-y p-0"
      role="listbox"
    >
      {children}
    </ul>
  )
}

export function SearchPickerOption({
  label,
  selected,
  onSelect,
  children,
  aside,
  disabled = false,
  id,
  active,
  tabIndex,
  compact = false,
  className,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
  aside: ReactNode
  disabled?: boolean
  id?: string
  active?: boolean
  tabIndex?: number
  compact?: boolean
  className?: string | undefined
}) {
  return (
    <li role="presentation">
      <button
        aria-label={label}
        aria-selected={selected}
        className={cn(
          'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center border-0 text-left transition-colors enabled:hover:bg-app-hover disabled:cursor-default disabled:opacity-50',
          compact ? 'min-h-control gap-2 px-2.5 py-1' : 'gap-3 px-3 py-2',
          active ? 'bg-app-hover' : 'bg-transparent',
          className,
        )}
        data-active={active}
        id={id}
        tabIndex={tabIndex}
        disabled={disabled}
        onClick={onSelect}
        role="option"
        type="button"
      >
        <span className="min-w-0">{children}</span>
        <span className="grid min-w-0 max-w-[min(48vw,20rem)] justify-items-end gap-0.5 pl-2 [&>*]:max-w-full [&>*]:break-all">
          {aside}
        </span>
      </button>
    </li>
  )
}
