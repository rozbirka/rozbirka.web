import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { Check } from 'lucide-react'
import { TextInput } from '@/components/app'
import {
  currencyName,
  searchCurrencies,
  useLocale,
  useT,
  type SupportedCurrency,
} from '@/i18n'
import { cn } from '@/lib/utils'
import { currencyMessages } from './messages'

/**
 * The ten accounting currencies with search by ISO code or localized name.
 * Built like the cabinet's other search pickers (SettlementPicker): a text
 * input with `role="combobox"` and the list inside the field, so a long list
 * pushes the form instead of covering it. ↑↓ move, Enter picks, Esc closes
 * and keeps focus in the field.
 */
export function CurrencyCombobox({
  value,
  onChange,
  disabled = false,
  inputRef,
  autoOpen = false,
}: {
  value: SupportedCurrency | null
  onChange: (currency: SupportedCurrency) => void
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  /** Open the list on mount (when the user just asked to change). */
  autoOpen?: boolean
}) {
  const t = useT(currencyMessages)
  const { locale } = useLocale()
  const listId = useId()
  const optionId = (code: string) => `${listId}-${code}`
  const [open, setOpen] = useState(autoOpen)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const options = searchCurrencies(query, locale)
  const activeCode = open ? options[active]?.code : undefined

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  const openList = () => {
    if (open) return
    setQuery('')
    const index =
      value === null
        ? -1
        : searchCurrencies('', locale).findIndex((item) => item.code === value)
    setActive(Math.max(0, index))
    setOpen(true)
  }

  const choose = (code: SupportedCurrency) => {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  const display =
    value === null ? '' : `${value} · ${currencyName(value, locale)}`

  return (
    <div className="grid gap-2" ref={boxRef}>
      <TextInput
        aria-activedescendant={
          activeCode === undefined ? undefined : optionId(activeCode)
        }
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onClick={openList}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (open) {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
              setQuery('')
            }
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              openList()
              return
            }
            if (options.length === 0) return
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActive(
              (index) => (index + step + options.length) % options.length,
            )
            return
          }
          if (event.key === 'Enter' && open) {
            event.preventDefault()
            const option = options[active]
            if (option !== undefined) choose(option.code)
            return
          }
          if (event.key === 'Tab' && open) setOpen(false)
        }}
        placeholder={open ? t('search') : t('placeholder')}
        ref={inputRef}
        role="combobox"
        spellCheck={false}
        value={open ? query : display}
      />

      {open ? (
        options.length === 0 ? (
          <p
            className="border-app-line-2 bg-app-overlay text-app-muted rounded-[14px] border px-3.5 py-4 text-[13px] leading-5 text-pretty"
            role="status"
          >
            {t('noMatch', { query: query.trim() })}
          </p>
        ) : (
          <ul
            className="border-app-line-2 bg-app-overlay max-h-[264px] overflow-auto rounded-[14px] border shadow-2xl"
            id={listId}
            role="listbox"
          >
            {options.map((option, index) => {
              const selected = option.code === value
              return (
                <li
                  aria-selected={selected}
                  className={cn(
                    'border-app-line flex min-h-11 cursor-pointer items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0 hover:bg-white/[0.055]',
                    index === active && 'bg-white/[0.07]',
                  )}
                  id={optionId(option.code)}
                  key={option.code}
                  onClick={() => choose(option.code)}
                  // Keep focus in the input so Esc and typing still work.
                  onMouseDown={(event) => event.preventDefault()}
                  role="option"
                >
                  <span className="text-app-ink w-11 shrink-0 font-mono text-[13px] font-bold">
                    {option.code}
                  </span>
                  <span className="text-app-muted min-w-0 flex-1 text-[14px] text-pretty">
                    {option.names[locale]}
                  </span>
                  {selected ? (
                    <Check aria-hidden className="text-brand size-4 shrink-0" />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )
      ) : null}
    </div>
  )
}
