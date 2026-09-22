import { useEffect, useId, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { partsApi, type PartListItem } from '@/api/parts'
import { cn } from '@/lib/utils'

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
}

const filterOptions: { value: PartPickerFilter; label: string }[] = [
  { value: 'all', label: 'Усі' },
  { value: 'available', label: 'В наявності' },
  { value: 'reserved', label: 'Резерв' },
]
const PAGE_SIZE = 6

const price = (value: number | null) =>
  value === null
    ? '—'
    : `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value)} $`

const statusPresentation = (part: PartPickerItem) => {
  if (part.status === 'reserved')
    return {
      label: 'Резерв',
      className: 'border-state-warn/35 bg-state-warn-soft text-state-warn',
    }
  if (part.status === 'available' || part.quantityAvailable > 0)
    return {
      label: `${part.quantityAvailable} в наявності`,
      className: 'border-state-ok/35 bg-state-ok-soft text-state-ok',
    }
  if (part.quantityReserved > 0)
    return {
      label: 'Резерв',
      className: 'border-state-warn/35 bg-state-warn-soft text-state-warn',
    }
  return {
    label: 'Немає',
    className: 'border-state-danger/35 bg-state-danger-soft text-state-danger',
  }
}

const filterStatus = (filter: PartPickerFilter) =>
  filter === 'all' ? undefined : filter

export function PartSearchPicker({
  value,
  query,
  onQueryChange,
  onSelect,
  onClear,
  disabled = false,
}: PartSearchPickerProps) {
  const inputId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRequestRef = useRef(0)
  const countRequestRef = useRef(0)
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
  const [error, setError] = useState<string | null>(null)

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
      void Promise.allSettled(
        filterOptions.map((option) => {
          const status = filterStatus(option.value)
          return partsApi.list({
            q,
            page: 1,
            pageSize: 1,
            ...(status ? { status } : {}),
            signal: controller.signal,
          })
        }),
      ).then((results) => {
        if (controller.signal.aborted || request !== countRequestRef.current)
          return
        setCounts((current) => {
          const next = { ...current }
          results.forEach((result, index) => {
            const option = filterOptions[index]
            if (result.status === 'fulfilled' && option)
              next[option.value] = result.value.total
          })
          return next
        })
      })
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
      setError(null)
      const status = filterStatus(filter)
      void partsApi
        .list({
          q,
          page,
          pageSize: PAGE_SIZE,
          ...(status ? { status } : {}),
          signal: controller.signal,
        })
        .then(async (result) => {
          if (controller.signal.aborted || request !== listRequestRef.current)
            return
          const baseItems = result.items.map((item) => ({
            ...item,
            effectiveSalePrice: null,
          }))
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

          const details = await Promise.allSettled(
            result.items.map((item) =>
              partsApi.get(item.id, { signal: controller.signal }),
            ),
          )
          if (controller.signal.aborted || request !== listRequestRef.current)
            return
          const prices = new Map(
            baseItems.map((item, index) => {
              const detail = details[index]
              return [
                item.id,
                detail?.status === 'fulfilled'
                  ? detail.value.effectiveSalePrice
                  : null,
              ] as const
            }),
          )
          setItems((current) =>
            current.map((item) =>
              prices.has(item.id)
                ? { ...item, effectiveSalePrice: prices.get(item.id) ?? null }
                : item,
            ),
          )
        })
        .catch(() => {
          if (!controller.signal.aborted && request === listRequestRef.current)
            setError('Не вдалося завантажити запчастини.')
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
        Пошук запчастини
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="text-app-dim pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
        />
        <input
          aria-controls={`${inputId}-results`}
          aria-expanded={open}
          autoComplete="off"
          className={cn(
            'bg-app-input text-app-ink placeholder:text-app-dim border-app-line-2 h-14 w-full rounded-[16px] border pr-4 pl-12 text-[15px] outline-none transition-colors hover:border-white/20 focus-visible:border-brand',
            value?.name === query && 'border-brand/40',
          )}
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
          placeholder="Назва, артикул або QR-код"
          role="searchbox"
          value={query}
        />
      </div>

      {open && query.trim() ? (
        <div
          aria-label="Результати пошуку запчастин"
          className="border-app-line bg-app-raised absolute top-[calc(100%+8px)] right-0 left-0 z-40 overflow-hidden rounded-[18px] border shadow-2xl"
          id={`${inputId}-results`}
          role="dialog"
        >
          <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  aria-pressed={filter === option.value}
                  className={cn(
                    'flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                    option.value === 'all' &&
                      (filter === option.value
                        ? 'border-app-line-2 bg-white/[0.09] text-white'
                        : 'border-app-line-2 text-app-muted hover:bg-white/[0.04]'),
                    option.value === 'available' &&
                      (filter === option.value
                        ? 'border-state-ok/35 bg-state-ok-soft text-state-ok'
                        : 'border-state-ok/25 text-state-ok hover:bg-state-ok-soft/50'),
                    option.value === 'reserved' &&
                      (filter === option.value
                        ? 'border-state-warn/35 bg-state-warn-soft text-state-warn'
                        : 'border-state-warn/25 text-state-warn hover:bg-state-warn-soft/50'),
                  )}
                  key={option.value}
                  onClick={() => {
                    setFilter(option.value)
                    setPage(1)
                    setItems([])
                    setTotal(0)
                    setTotalPages(1)
                    setError(null)
                  }}
                  type="button"
                >
                  {option.label}
                  <span className="text-app-dim font-mono text-xs">
                    {counts[option.value]}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-app-dim font-mono text-xs tabular-nums">
              {shown} з {total}
            </p>
          </div>

          <div className="max-h-[min(52vh,460px)] overflow-y-auto overscroll-contain">
            {error && items.length === 0 ? (
              <p
                className="text-state-danger px-5 py-8 text-center text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : loading && items.length === 0 ? (
              <p
                className="text-app-muted px-5 py-8 text-center text-sm"
                role="status"
              >
                Шукаємо запчастини…
              </p>
            ) : items.length === 0 ? (
              <p className="text-app-muted px-5 py-8 text-center text-sm">
                Нічого не знайдено
              </p>
            ) : (
              <ul
                aria-label="Знайдені запчастини"
                className="divide-app-line grid divide-y"
                role="listbox"
              >
                {items.map((part) => {
                  const presentation = statusPresentation(part)
                  const car = part.car
                    ? `${part.car.make} ${part.car.model} · ${part.car.year}`
                    : 'Без привʼязки до автомобіля'
                  return (
                    <li key={part.id}>
                      <button
                        aria-label={`Обрати запчастину ${part.name}`}
                        className="hover:bg-white/[0.035] grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors"
                        onClick={() => {
                          setOpen(false)
                          onSelect(part)
                        }}
                        role="option"
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[15px] font-bold text-white">
                              {part.name}
                            </span>
                            <span
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-semibold',
                                presentation.className,
                              )}
                            >
                              {presentation.label}
                            </span>
                          </span>
                          <span className="text-app-muted mt-1 block truncate text-[13px]">
                            {car}
                          </span>
                        </span>
                        <span className="grid justify-items-end gap-1 pl-2">
                          <span className="font-mono text-[15px] font-bold text-white tabular-nums">
                            {price(part.effectiveSalePrice)}
                          </span>
                          <span className="text-app-dim font-mono text-xs">
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
                className="text-state-danger px-4 py-3 text-center text-xs"
                role="alert"
              >
                {error}
              </p>
            )}
            {hasMore && (
              <div className="border-app-line border-t p-3">
                <button
                  aria-busy={loading}
                  className="border-app-line-2 text-brand hover:bg-brand/5 min-h-11 w-full rounded-[10px] border text-sm font-semibold disabled:opacity-55"
                  disabled={loading}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  {loading ? 'Завантажуємо…' : 'Показати ще'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
