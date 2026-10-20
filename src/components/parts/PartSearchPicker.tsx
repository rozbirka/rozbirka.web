import { useEffect, useId, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { partsApi, type PartListItem, type PartSearchItem } from '@/api/parts'
import { Button, StatusPill } from '@/components/app'
import { cn } from '@/lib/utils'
import { formatMoney, translate, useLocale, useT, type Locale } from '@/i18n'
import { partPickerMessages } from './part-picker-messages'

type PartPickerFilter = 'all' | 'available' | 'reserved'

export interface PartPickerItem extends PartListItem {
  effectiveSalePrice: number | null
}

interface PartSearchPickerProps {
  value: PartPickerItem | null
  query: string
  onQueryChange: (query: string) => void
  onSelect: (part: PartPickerItem) => void
  onClear: () => void
  disabled?: boolean
  /** The accounting currency of the prices; `null` shows bare numbers. */
  currency?: string | null
}

const filterOptions: readonly PartPickerFilter[] = [
  'all',
  'available',
  'reserved',
]
const PAGE_SIZE = 6

const price = (
  value: number | null,
  currency: string | null,
  locale: Locale,
) => (value === null ? '—' : (formatMoney(value, currency, locale) ?? '—'))

const statusPresentation = (part: PartPickerItem, locale: Locale) => {
  if (part.status === 'reserved')
    return {
      label: translate(partPickerMessages, locale, 'reserved'),
      tone: 'warn' as const,
    }
  if (part.status === 'available' || part.quantityAvailable > 0)
    return {
      label: translate(partPickerMessages, locale, 'inStock', {
        count: part.quantityAvailable,
      }),
      tone: 'ok' as const,
    }
  if (part.quantityReserved > 0)
    return {
      label: translate(partPickerMessages, locale, 'reserved'),
      tone: 'warn' as const,
    }
  return {
    label: translate(partPickerMessages, locale, 'none'),
    tone: 'danger' as const,
  }
}

const filterStatus = (filter: PartPickerFilter) =>
  filter === 'all' ? undefined : filter

const fromSearchItem = (item: PartSearchItem): PartListItem => ({
  id: item.id,
  name: item.name,
  photos: item.thumbnailUrl === null ? [] : [item.thumbnailUrl],
  quantityTotal: item.quantity,
  quantityReserved: item.quantityReserved,
  quantityAvailable: item.quantityAvailable,
  quantitySoldTotal: Math.max(
    0,
    item.quantity - item.quantityAvailable - item.quantityReserved,
  ),
  status: item.status,
  car: item.car,
  order: null,
  externalCode: item.externalCode ?? item.oemCode,
})

export function PartSearchPicker({
  value,
  query,
  onQueryChange,
  onSelect,
  onClear,
  disabled = false,
  currency = null,
}: PartSearchPickerProps) {
  const inputId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRequestRef = useRef(0)
  const countRequestRef = useRef(0)
  const priceCacheRef = useRef(new Map<string, number | null>())
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<PartPickerFilter>('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<PartPickerItem[]>([])
  const [counts, setCounts] = useState<Record<PartPickerFilter, number>>({
    all: 0,
    available: 0,
    reserved: 0,
  })
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<boolean>(false)
  const { locale } = useLocale()
  const t = useT(partPickerMessages)

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!open || !q) return
    const request = ++countRequestRef.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void partsApi
        .facets({ query: q }, ['status'], { signal: controller.signal })
        .then((facets) => {
          if (controller.signal.aborted || request !== countRequestRef.current)
            return
          const statuses = new Map(
            facets.statuses.map((item) => [item.id.toLowerCase(), item.count]),
          )
          setCounts({
            all: facets.statuses.reduce((sum, item) => sum + item.count, 0),
            available: statuses.get('available') ?? 0,
            reserved: statuses.get('reserved') ?? 0,
          })
        })
        .catch(() => undefined)
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query])

  useEffect(() => {
    const q = query.trim()
    if (!open || !q) return
    const request = ++listRequestRef.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(false)
      const status = filterStatus(filter)
      void partsApi
        .search(
          {
            query: q,
            page,
            pageSize: PAGE_SIZE,
            ...(status ? { statuses: [status] } : {}),
          },
          { signal: controller.signal },
        )
        .then(async (result) => {
          if (controller.signal.aborted || request !== listRequestRef.current)
            return
          const baseItems = result.items.map((searchItem) => {
            const item = fromSearchItem(searchItem)
            return {
              ...item,
              effectiveSalePrice: priceCacheRef.current.get(item.id) ?? null,
            }
          })
          setItems((current) => {
            if (page === 1) return baseItems
            const known = new Set(current.map((item) => item.id))
            return [
              ...current,
              ...baseItems.filter((item) => !known.has(item.id)),
            ]
          })
          setTotal(result.total)
          setTotalPages(Math.max(1, result.totalPages))

          const uncached = result.items.filter(
            (item) => !priceCacheRef.current.has(item.id),
          )
          const details = await Promise.allSettled(
            uncached.map((item) =>
              partsApi.get(item.id, { signal: controller.signal }),
            ),
          )
          if (controller.signal.aborted || request !== listRequestRef.current)
            return
          uncached.forEach((item, index) => {
            const detail = details[index]
            if (detail?.status === 'fulfilled')
              priceCacheRef.current.set(
                item.id,
                detail.value.effectiveSalePrice,
              )
          })
          setItems((current) =>
            current.map((item) =>
              priceCacheRef.current.has(item.id)
                ? {
                    ...item,
                    effectiveSalePrice:
                      priceCacheRef.current.get(item.id) ?? null,
                  }
                : item,
            ),
          )
        })
        .catch(() => {
          if (!controller.signal.aborted && request === listRequestRef.current)
            setError(true)
        })
        .finally(() => {
          if (!controller.signal.aborted && request === listRequestRef.current)
            setLoading(false)
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [filter, open, page, query])

  const shown = Math.min(items.length, total)
  const hasMore = page < totalPages

  return (
    <div className="relative" ref={rootRef}>
      <label className="sr-only" htmlFor={inputId}>
        {t('label')}
      </label>
      {/* A part picked from the list is the current selection: the one place
          the brand edge is allowed on the field. */}
      <div
        className={cn(
          'rz-search h-control-lg',
          value?.name === query && 'border-brand bg-brand-soft',
        )}
      >
        <Search aria-hidden className="pointer-events-none" />
        <input
          aria-controls={`${inputId}-results`}
          aria-expanded={open}
          autoComplete="off"
          className="max-md:text-title"
          disabled={disabled}
          id={inputId}
          onChange={(event) => {
            onQueryChange(event.target.value)
            setPage(1)
            setOpen(true)
            setItems([])
            setTotal(0)
            setTotalPages(1)
            setLoading(false)
            onClear()
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('placeholder')}
          role="searchbox"
          value={query}
        />
      </div>

      {open && query.trim() ? (
        <div
          aria-label={t('results')}
          className="rz-popover absolute top-full right-0 left-0 z-40 mt-1.5 w-auto"
          id={`${inputId}-results`}
          role="dialog"
        >
          <div className="border-app-line flex flex-wrap items-center justify-between gap-2 border-b p-2">
            <div className="rz-seg flex-wrap" role="group">
              {filterOptions
                .map((value) => ({ value, label: t(value) }))
                .map((option) => (
                  <button
                    aria-pressed={filter === option.value}
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value)
                      setPage(1)
                      setItems([])
                      setTotal(0)
                      setTotalPages(1)
                      setError(false)
                    }}
                    type="button"
                  >
                    {option.label}
                    <span className="rz-count">{counts[option.value]}</span>
                  </button>
                ))}
            </div>
            <p className="rz-dim m-0 pr-1 font-mono text-caption tabular-nums">
              {t('shownOf', { shown: String(shown), total: String(total) })}
            </p>
          </div>

          <div className="max-h-[min(52vh,460px)] overflow-y-auto overscroll-contain">
            {error && items.length === 0 ? (
              <p
                className="text-state-danger m-0 px-4 py-6 text-center"
                role="alert"
              >
                {t('loadFailed')}
              </p>
            ) : loading && items.length === 0 ? (
              <p className="rz-muted m-0 px-4 py-6 text-center" role="status">
                {t('searching')}
              </p>
            ) : items.length === 0 ? (
              <p className="rz-muted m-0 px-4 py-6 text-center">
                {t('nothing')}
              </p>
            ) : (
              <ul
                aria-label={t('found')}
                className="divide-app-line m-0 grid list-none divide-y p-0"
                role="listbox"
              >
                {items.map((part) => {
                  const presentation = statusPresentation(part, locale)
                  const car = part.car
                    ? `${part.car.make} ${part.car.model} · ${part.car.year}`
                    : t('noCar')
                  return (
                    <li key={part.id}>
                      <button
                        aria-label={t('choose', { name: part.name })}
                        className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-0 bg-transparent px-3 py-2 text-left transition-colors hover:bg-app-hover"
                        onClick={() => {
                          setOpen(false)
                          onSelect(part)
                        }}
                        role="option"
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="rz-strong truncate font-medium">
                              {part.name}
                            </span>
                            <StatusPill tone={presentation.tone}>
                              {presentation.label}
                            </StatusPill>
                          </span>
                          <span className="rz-caption block truncate">
                            {car}
                          </span>
                        </span>
                        <span className="grid justify-items-end gap-0.5 pl-2">
                          <span className="rz-num rz-strong">
                            {price(part.effectiveSalePrice, currency, locale)}
                          </span>
                          <span className="rz-dim font-mono text-caption">
                            {part.externalCode ?? '—'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {error && items.length > 0 && (
              <p
                className="text-state-danger m-0 px-4 py-3 text-center text-caption"
                role="alert"
              >
                {t('loadFailed')}
              </p>
            )}
            {hasMore && (
              <div className="border-app-line border-t p-2">
                <Button
                  aria-busy={loading}
                  disabled={loading}
                  onClick={() => setPage((current) => current + 1)}
                  size="wide"
                >
                  {loading ? t('loading') : t('showMore')}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
