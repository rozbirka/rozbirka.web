import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { Button, SearchInput } from '@/components/app'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { locationBrowserMessages } from './location-browser-messages'

interface LocationOption {
  id: string
  name: string
  code?: string
  context?: string
}

/** A single location choice; filtering never changes the saved selection. */
export function LocationSelect({
  label,
  searchLabel,
  noneLabel,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string
  searchLabel: string
  noneLabel: string
  value: string | null
  onChange: (id: string | null) => void
  options: LocationOption[]
  disabled?: boolean
}) {
  const t = useT(locationBrowserMessages)
  const id = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const needle = query.trim().toLocaleLowerCase()
  const matches = options.filter(
    (option) =>
      !needle ||
      [option.name, option.code, option.context].some((text) =>
        text?.toLocaleLowerCase().includes(needle),
      ),
  )
  const items = [{ id: '', name: noneLabel }, ...matches]
  const requestedIndex = items.findIndex((item) => item.id === activeId)
  const activeIndex =
    requestedIndex >= 0 ? requestedIndex : needle && matches.length ? 1 : 0
  const active = needle && !matches.length ? null : items[activeIndex]
  const selected = options.find((option) => option.id === value)
  const selectedName = selected
    ? [selected.context, selected.name].filter(Boolean).join(' · ')
    : noneLabel
  const choose = (id: string) => {
    onChange(id || null)
    setOpen(false)
  }
  useEffect(() => {
    const list = listRef.current
    const row = list?.querySelector<HTMLElement>('[data-active="true"]')
    if (!list || !row || list.clientHeight === 0) return
    const bounds = list.getBoundingClientRect()
    const item = row.getBoundingClientRect()
    // Reveal only within the popup; do not shift the surrounding drawer.
    if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top
    else if (item.bottom > bounds.bottom)
      list.scrollTop += item.bottom - bounds.bottom
  }, [open, query, active?.id])
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (active) choose(active.id)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (activeIndex +
              (event.key === 'ArrowDown' ? 1 : -1) +
              items.length) %
            items.length
    setActiveId(items[next]?.id ?? '')
  }
  return (
    <Popover.Root
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setQuery('')
        setActiveId(value ?? '')
      }}
    >
      <Popover.Trigger asChild>
        <Button
          disabled={disabled}
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          aria-label={`${label}: ${selectedName}`}
          className="bg-app-input text-app-ink h-auto min-h-control-lg w-full justify-between gap-3 py-1 text-left whitespace-normal"
        >
          <span className="min-w-0 break-words">{selectedName}</span>
          <ChevronDown aria-hidden className="text-app-dim size-3.5 shrink-0" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          role="presentation"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="rz-popover z-[60] flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] flex-col"
        >
          <div className="border-app-line shrink-0 border-b p-2">
            <SearchInput
              autoFocus
              role="combobox"
              aria-label={searchLabel}
              aria-controls={`${id}-list`}
              aria-expanded={open}
              aria-autocomplete="list"
              aria-activedescendant={
                active ? `${id}-option-${activeIndex}` : undefined
              }
              placeholder={t('nameOrCode')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveId(null)
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="grid min-h-0 max-h-64 gap-px overflow-y-auto overscroll-contain p-1"
          >
            {items.map((option, index) => (
              <button
                key={option.id}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={(value ?? '') === option.id}
                tabIndex={-1}
                data-active={active?.id === option.id}
                onClick={() => choose(option.id)}
                className={cn(
                  'rz-menu__item h-auto min-h-[30px] w-full justify-between gap-3 py-1.5',
                  active?.id === option.id && 'bg-app-active',
                )}
              >
                <span className="min-w-0 break-words">
                  <span className="block font-semibold">{option.name}</span>
                  {'code' in option && option.code ? (
                    <span className="rz-mono rz-caption block">
                      {option.code}
                    </span>
                  ) : null}
                  {'context' in option && option.context ? (
                    <span className="rz-caption block">{option.context}</span>
                  ) : null}
                </span>
                {(value ?? '') === option.id ? (
                  <Check
                    aria-hidden
                    className="text-brand-text size-4 shrink-0"
                  />
                ) : null}
              </button>
            ))}
          </div>
          {needle && !matches.length ? (
            <p
              role="status"
              className="rz-muted border-app-line m-0 border-t px-3 py-2.5"
            >
              {t('noMatches')}
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
