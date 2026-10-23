import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { appMessages } from './app-messages'
import {
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
} from './search-picker'

export interface SelectPickerOption {
  value: string
  label: string
  description?: string
  searchText?: string
  count?: number
  disabled?: boolean
}

/** A single selection using the shared order-search surface and rows. */
export function SelectPicker({
  label,
  options,
  value,
  onValueChange,
  placeholder = '',
  prefix = '',
  heading = label,
  resultsLabel = label,
  searchPlaceholder,
  searchable = true,
  emptyLabel,
  disabled = false,
  busy = false,
  compact = false,
  compactOptions = false,
  showLabel = false,
  required = false,
  hint,
  error,
  className,
}: {
  label: string
  options: readonly SelectPickerOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  prefix?: string
  heading?: string
  resultsLabel?: string
  searchPlaceholder?: string
  searchable?: boolean
  emptyLabel?: string
  disabled?: boolean
  busy?: boolean
  compact?: boolean
  compactOptions?: boolean
  showLabel?: boolean
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  className?: string
}) {
  const t = useT(appMessages)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const needle = searchable ? query.trim().toLocaleLowerCase() : ''
  const matches = options.filter((option) =>
    [option.label, option.description, option.searchText]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle),
  )
  const selected = options.find((option) => option.value === value)
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery('')
  }
  return (
    <div aria-busy={busy} className={cn('min-w-0', className)}>
      <SearchPicker
        label={label}
        placeholder={searchPlaceholder ?? t('searchOptions')}
        resultsLabel={resultsLabel}
        heading={heading}
        count={t('pickerResultsCount', {
          shown: matches.length,
          total: options.length,
        })}
        triggerLabel={`${prefix}${selected?.label ?? placeholder}`}
        searchable={searchable}
        query={query}
        open={open}
        onOpenChange={changeOpen}
        onQueryChange={setQuery}
        disabled={disabled || busy}
        compact={compact}
        showLabel={showLabel}
        required={required}
        hint={hint}
        error={error}
        allowEmptyQuery
        floating
      >
        <SearchPickerOptions label={resultsLabel}>
          {matches.map((option) => (
            <SearchPickerOption
              key={option.value}
              label={option.label}
              selected={option.value === value}
              disabled={option.disabled ?? false}
              compact={compactOptions}
              onSelect={() => {
                changeOpen(false)
                if (option.value !== value) onValueChange(option.value)
              }}
              aside={
                <span className="flex items-center gap-2">
                  {option.count === undefined ? null : (
                    <span className="rz-dim font-mono text-caption tabular-nums">
                      {option.count}
                    </span>
                  )}
                  {option.value === value ? (
                    <Check aria-hidden className="text-app-muted size-4" />
                  ) : null}
                </span>
              }
            >
              <span className="rz-strong block break-words font-medium">
                {option.label}
              </span>
              {option.description ? (
                <span className="rz-muted block break-words text-caption">
                  {option.description}
                </span>
              ) : null}
            </SearchPickerOption>
          ))}
        </SearchPickerOptions>
        {matches.length === 0 ? (
          <p role="status" className="rz-muted m-0 px-4 py-6 text-center">
            {emptyLabel ?? t('noMatchingOptions')}
          </p>
        ) : null}
      </SearchPicker>
    </div>
  )
}
