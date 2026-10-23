import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import {
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
} from '@/components/app/search-picker'
import { useT } from '@/i18n'
import { locationBrowserMessages } from './location-browser-messages'

interface LocationOption {
  id: string
  name: string
  code?: string
  context?: string
}

type LocationSelectProps = {
  label: string
  searchLabel: string
  noneLabel: string
  options: LocationOption[]
  disabled?: boolean
  allowNone?: boolean
} & (
  | {
      multiple?: false
      value: string | null
      onChange: (id: string | null) => void
    }
  | {
      multiple: true
      value: readonly string[]
      onChange: (ids: string[]) => void
    }
)

/** Compact location choices; filtering never changes the saved selection. */
export function LocationSelect(props: LocationSelectProps) {
  const { label, searchLabel, noneLabel, options, disabled = false } = props
  const hasEmptyOption = !props.multiple && props.allowNone !== false
  const values = props.multiple ? props.value : props.value ? [props.value] : []
  const t = useT(locationBrowserMessages)
  const id = useId()
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
  const items = hasEmptyOption
    ? [{ id: '', name: noneLabel }, ...matches]
    : matches
  const requestedIndex = items.findIndex((item) => item.id === activeId)
  const activeIndex =
    requestedIndex >= 0
      ? requestedIndex
      : hasEmptyOption && needle && matches.length
        ? 1
        : 0
  const active = needle && !matches.length ? null : items[activeIndex]
  const selected = options.filter((option) => values.includes(option.id))
  const selectedName =
    selected.length > 1
      ? t('selectedLocations', { count: selected.length })
      : selected[0]
        ? [selected[0].context, selected[0].name].filter(Boolean).join(' · ')
        : noneLabel
  const isSelected = (id: string) =>
    id ? values.includes(id) : values.length === 0
  const choose = (id: string) => {
    if (props.multiple) {
      props.onChange(
        values.includes(id)
          ? values.filter((value) => value !== id)
          : [...values, id],
      )
    } else {
      props.onChange(id || null)
    }
    setOpen(false)
    setQuery('')
  }
  useEffect(() => {
    // The shared picker portals its popup outside clipping cards. Resolve the
    // active option by its unique ID so keyboard scrolling follows the portal.
    const row = document.getElementById(`${id}-option-${activeIndex}`)
    const list = row?.closest<HTMLElement>('[data-search-picker-scroll]')
    if (!list || !row || list.clientHeight === 0) return
    const bounds = list.getBoundingClientRect()
    const item = row.getBoundingClientRect()
    // Reveal only within the popup; do not shift the surrounding drawer.
    if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top
    else if (item.bottom > bounds.bottom)
      list.scrollTop += item.bottom - bounds.bottom
  }, [open, query, active?.id, activeIndex, id])
  const changeOpen = (next: boolean) => {
    if (next === open) return
    setOpen(next)
    if (!next) setQuery('')
    setActiveId(values[0] ?? '')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        event.stopPropagation()
        changeOpen(true)
      }
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (active) choose(active.id)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
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
    <div>
      <SearchPicker
        label={searchLabel}
        placeholder={selectedName || t('nameOrCode')}
        resultsLabel={searchLabel}
        heading={label}
        count={t('shownOf', {
          shown: items.length,
          total: options.length + (hasEmptyOption ? 1 : 0),
        })}
        query={open ? query : selectedName}
        open={open}
        onOpenChange={changeOpen}
        onQueryChange={(next) => {
          setQuery(
            !open && next.startsWith(selectedName)
              ? next.slice(selectedName.length)
              : next,
          )
          setActiveId(null)
        }}
        onInputKeyDown={onKeyDown}
        activeDescendant={active ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        compact
        floating
        allowEmptyQuery
      >
        <SearchPickerOptions label={label} multiple={props.multiple === true}>
          {items.map((option, index) => (
            <SearchPickerOption
              key={option.id}
              id={`${id}-option-${index}`}
              label={option.name}
              selected={isSelected(option.id)}
              active={active?.id === option.id}
              tabIndex={-1}
              compact
              onSelect={() => choose(option.id)}
              aside={
                isSelected(option.id) ? (
                  <Check
                    aria-hidden
                    className="text-app-muted size-4 shrink-0"
                  />
                ) : null
              }
            >
              <span className="text-app-ink block break-words text-sm">
                {'context' in option && option.context ? (
                  <span className="text-app-muted">{option.context} · </span>
                ) : null}
                {option.name}
              </span>
            </SearchPickerOption>
          ))}
        </SearchPickerOptions>
        {needle && !matches.length ? (
          <p
            role="status"
            className="text-app-muted m-0 px-3 py-4 text-center text-sm"
          >
            {t('noMatches')}
          </p>
        ) : null}
      </SearchPicker>
    </div>
  )
}
