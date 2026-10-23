import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { customersApi, type CustomerSearchItem } from '@/api/customers'
import { normalizeApiProblem } from '@/api/errors'
import { Button, SkeletonRows } from '@/components/app'
import {
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
} from '@/components/app/search-picker'
import { useT } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { customerPickerMessages } from './customer-picker-messages'
import './customer-search-picker.css'

const PAGE_SIZE = 6

interface CustomerSearchPickerProps {
  query: string
  onQueryChange: (query: string) => void
  onSelect: (customer: CustomerSearchItem) => void
  selectedId: string | null
  /** Opt in to an explicit committed selection; typing a replacement keeps it. */
  selectedName?: string
  /** Expanded committed selection used by the new-order drawer. */
  selectionAppearance?: 'field' | 'card'
  onClear?: () => void
  currentId?: string | null
  disabled?: boolean
  /** The existing customer drawer offers recent customers on opening. */
  initialOpen?: boolean
  showLabel?: boolean
  hint?: ReactNode
  label?: string
  required?: boolean
  onCreate?: (() => void) | undefined
  createLabel?: string
}

export function CustomerSearchPicker({
  query,
  onQueryChange,
  onSelect,
  selectedId,
  selectedName,
  selectionAppearance = 'field',
  onClear,
  currentId,
  disabled = false,
  initialOpen = false,
  showLabel = false,
  hint,
  label,
  required = false,
  onCreate,
  createLabel,
}: CustomerSearchPickerProps) {
  const t = useT(customerPickerMessages)
  const [selectedDetails, setSelectedDetails] =
    useState<CustomerSearchItem | null>(null)
  const [open, setOpen] = useState(initialOpen)
  const root = useRef<HTMLDivElement>(null)
  const focusSearch = useRef(false)
  const focusSelection = useRef(false)
  const hasSelection = Boolean(selectedId && selectedName && onClear)
  const selectedCard = hasSelection && selectionAppearance === 'card'
  const details = selectedDetails?.id === selectedId ? selectedDetails : null
  const allowEmptyQuery = initialOpen || hasSelection
  useEffect(() => {
    if (focusSearch.current && !hasSelection) {
      const input = root.current?.querySelector<HTMLInputElement>(
        'input[role="searchbox"]',
      )
      input?.focus()
      focusSearch.current = false
    }
    if (focusSelection.current && hasSelection && !open) {
      root.current
        ?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
        ?.focus()
      focusSelection.current = false
    }
  })
  const [items, setItems] = useState<CustomerSearchItem[]>([])
  const [loading, setLoading] = useState(initialOpen)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)
  const matchesQuery = loadedQuery === query.trim()
  const visible =
    open && !disabled && (allowEmptyQuery || Boolean(query.trim()))
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (hasSelection && next !== open) {
      if (next) {
        setItems([])
        setLoading(true)
        setError(null)
        setLoadedQuery(null)
        setLimit(PAGE_SIZE)
        onQueryChange('')
      } else onQueryChange(selectedName!)
    }
  }
  const createAction = onCreate ? (
    <Button
      disabled={disabled}
      className="w-fit"
      onClick={() => {
        setOpen(false)
        onCreate()
      }}
      size="sm"
    >
      <Plus aria-hidden />
      {createLabel ?? t('create')}
    </Button>
  ) : null

  useEffect(() => {
    if (!open || disabled || (!allowEmptyQuery && !query.trim())) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const term = query.trim()
      const options = { signal: controller.signal }
      // The search endpoint requires q; opening or clearing the picker uses
      // the active customer list instead of sending an invalid empty query.
      const request = term
        ? customersApi.search(term, options)
        : customersApi
            .list({ page: 1, pageSize: 20 }, options)
            .then((page) => page.items)
      void request
        .then((result) => {
          if (!controller.signal.aborted) {
            setItems(result)
            setError(null)
            setLoadedQuery(query.trim())
            setLoading(false)
          }
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted) {
            setError(normalizeApiProblem(failure).message)
            setLoadedQuery(query.trim())
            setLoading(false)
          }
        })
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [disabled, allowEmptyQuery, open, query])

  return (
    <div className="grid min-w-0 gap-2" ref={root}>
      {hasSelection ? (
        <span className="sr-only" role="status" aria-label={t('selected')}>
          {selectedName}
        </span>
      ) : null}
      <div
        className={
          hasSelection
            ? `customer-picker__control customer-picker__control--selected${selectedCard ? ' customer-picker__control--card' : ''}`
            : undefined
        }
      >
        <SearchPicker
          allowEmptyQuery={allowEmptyQuery}
          {...(hasSelection
            ? {
                triggerLabel: selectedCard ? (
                  <span className="customer-picker__selection">
                    <span className="rz-avatar rz-avatar--round" aria-hidden>
                      {selectedName!
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((name) => name[0])
                        .join('')}
                    </span>
                    <span className="customer-picker__identity">
                      <span>{selectedName}</span>
                      {details ? (
                        <span className="customer-picker__meta">
                          {[
                            details.phone ? formatPhone(details.phone) : null,
                            t('orders', { count: details.ordersCount }),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </span>
                  </span>
                ) : (
                  selectedName!
                ),
                triggerIcon: selectedCard ? (
                  <span className="rz-caption shrink-0">
                    {t('changeShort')}
                  </span>
                ) : (
                  <Pencil
                    aria-hidden
                    className="text-app-dim size-4 shrink-0"
                  />
                ),
              }
            : {})}
          count={t('shownOf', {
            shown: matchesQuery ? Math.min(limit, items.length) : 0,
            total: matchesQuery ? items.length : 0,
          })}
          disabled={disabled}
          heading={t('heading')}
          hint={hint}
          label={hasSelection ? t('change') : (label ?? t('label'))}
          onOpenChange={changeOpen}
          onQueryChange={(next) => {
            setItems([])
            setLoading(true)
            setError(null)
            setLimit(PAGE_SIZE)
            onQueryChange(next)
          }}
          open={open}
          placeholder={t('placeholder')}
          query={query}
          resultsLabel={t('results')}
          showLabel={showLabel && !hasSelection}
          required={required}
        >
          {error && matchesQuery ? (
            <p
              className="text-state-danger m-0 px-4 py-6 text-center"
              role="alert"
            >
              {error}
            </p>
          ) : loading || !matchesQuery ? (
            <SkeletonRows embedded label={t('searching')} rows={3} />
          ) : items.length === 0 ? (
            <p className="rz-muted m-0 px-4 py-6 text-center">{t('nothing')}</p>
          ) : (
            <SearchPickerOptions label={t('found')}>
              {items.slice(0, limit).map((customer) => (
                <SearchPickerOption
                  key={customer.id}
                  aside={
                    <>
                      <span className="rz-num rz-strong break-all">
                        {customer.phone
                          ? formatPhone(customer.phone)
                          : t('noPhone')}
                      </span>
                      {customer.id === currentId ? (
                        <span className="rz-dim text-caption">
                          {t('current')}
                        </span>
                      ) : null}
                    </>
                  }
                  label={t('choose', { name: customer.name })}
                  selected={selectedId === customer.id}
                  onSelect={() => {
                    setOpen(false)
                    focusSelection.current = true
                    setSelectedDetails(customer)
                    onSelect(customer)
                  }}
                >
                  <span className="rz-strong block truncate font-medium">
                    {customer.name}
                  </span>
                  <span className="rz-caption block truncate">
                    {t('orders', { count: customer.ordersCount })}
                  </span>
                </SearchPickerOption>
              ))}
            </SearchPickerOptions>
          )}
          {!loading && !error && matchesQuery && limit < items.length ? (
            <div className="border-app-line border-t p-2">
              <Button
                onClick={() => setLimit((value) => value + PAGE_SIZE)}
                size="wide"
              >
                {t('showMore')}
              </Button>
            </div>
          ) : null}
        </SearchPicker>
        {hasSelection ? (
          <Button
            className="customer-picker__clear"
            disabled={disabled}
            aria-label={t('clear', { name: selectedName! })}
            onClick={() => {
              setOpen(false)
              onClear?.()
              onQueryChange('')
              focusSearch.current = true
            }}
            size="icon"
            variant="quiet"
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      {!visible && !hasSelection ? createAction : null}
    </div>
  )
}
