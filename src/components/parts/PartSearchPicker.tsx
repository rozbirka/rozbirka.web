import { useEffect, useRef, useState } from 'react'
import { partsApi, type PartListItem, type PartSearchItem } from '@/api/parts'
import { Button, StatusPill } from '@/components/app'
import {
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
} from '@/components/app/search-picker'
import { formatMoney, useLocale, useT, type Locale } from '@/i18n'
import { partPickerMessages } from './part-picker-messages'
import './part-search-picker.css'
import { PartSearchSkeleton } from './PartSearchSkeleton'

export interface PartPickerItem extends PartListItem {
  effectiveSalePrice: number | null
}

interface PartSearchPickerProps {
  value: Pick<PartPickerItem, 'id'> | null
  query: string
  onQueryChange: (query: string) => void
  onSelect: (part: PartPickerItem) => void
  onClear: () => void
  disabled?: boolean
  /** Compact order drawer results: code under name, stock and price alongside. */
  compact?: boolean
  /** Existing order lines cannot be added again. */
  takenPartIds?: readonly string[]
  /** The accounting currency of the prices; `null` shows bare numbers. */
  currency?: string | null
}

const PAGE_SIZE = 6

const price = (
  value: number | null,
  currency: string | null,
  locale: Locale,
) => (value === null ? '—' : (formatMoney(value, currency, locale) ?? '—'))

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
  compact = false,
  takenPartIds = [],
  currency = null,
}: PartSearchPickerProps) {
  const listRequestRef = useRef(0)
  const priceCacheRef = useRef(new Map<string, number | null>())
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<PartPickerItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<boolean>(false)
  const [attempt, setAttempt] = useState(0)
  const { locale } = useLocale()
  const t = useT(partPickerMessages)

  useEffect(() => {
    const q = query.trim()
    if (!open || !q) return
    const request = ++listRequestRef.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(false)
      void partsApi
        .search(
          {
            query: q,
            page,
            pageSize: PAGE_SIZE,
            statuses: ['available'],
          },
          { signal: controller.signal },
        )
        .then(async (result) => {
          if (controller.signal.aborted || request !== listRequestRef.current)
            return
          const availableItems = result.items.filter(
            (item) => item.quantityAvailable > 0,
          )
          const baseItems = availableItems.map((searchItem) => {
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

          const uncached = availableItems.filter(
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
  }, [open, page, query, attempt])

  const shown = Math.min(items.length, total)
  const hasMore = page < totalPages

  return (
    <SearchPicker
      compact={compact}
      headerHidden={compact}
      count={t('shownOf', { shown: String(shown), total: String(total) })}
      disabled={disabled}
      heading={t('available')}
      label={t('label')}
      onOpenChange={setOpen}
      onQueryChange={(next) => {
        onQueryChange(next)
        setPage(1)
        setItems([])
        setTotal(0)
        setTotalPages(1)
        setLoading(Boolean(next.trim()))
        setError(false)
        onClear()
      }}
      open={open}
      placeholder={t('placeholder')}
      query={query}
      resultsLabel={t('results')}
    >
      {error && items.length === 0 ? (
        <div className="grid justify-items-center gap-2 px-4 py-6">
          <p className="text-state-danger m-0 text-center" role="alert">
            {t('loadFailed')}
          </p>
          <Button
            onClick={() => {
              setError(false)
              setLoading(true)
              setAttempt((value) => value + 1)
            }}
            size="sm"
          >
            {t('retry')}
          </Button>
        </div>
      ) : loading && items.length === 0 ? (
        <PartSearchSkeleton compact={compact} label={t('searching')} />
      ) : items.length === 0 ? (
        <p className="rz-muted m-0 px-4 py-6 text-center">{t('nothing')}</p>
      ) : (
        <SearchPickerOptions label={t('found')}>
          {items.map((part) => {
            const taken = takenPartIds.includes(part.id)
            const car = part.car
              ? `${part.car.make} ${part.car.model} · ${part.car.year}`
              : compact
                ? null
                : t('noCar')
            const metadata =
              compact && part.externalCode?.trim()
                ? part.externalCode.trim()
                : car
            return (
              <SearchPickerOption
                key={part.id}
                className={compact ? 'part-search-picker__option' : undefined}
                disabled={taken || loading}
                label={t('choose', { name: part.name })}
                selected={value?.id === part.id}
                onSelect={() => {
                  setOpen(false)
                  onSelect(part)
                }}
                aside={
                  compact ? (
                    <span className="part-search-picker__aside">
                      <span className="part-search-picker__stock">
                        <StatusPill tone={taken ? 'neutral' : 'ok'}>
                          {taken ? t('inOrder') : t('available')}
                        </StatusPill>
                        <span className="part-search-picker__quantity rz-mono rz-muted">
                          {t('stockQuantity', {
                            count: part.quantityAvailable,
                          })}
                        </span>
                      </span>
                      <span className="part-search-picker__price rz-num rz-strong">
                        {price(part.effectiveSalePrice, currency, locale)}
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className="rz-num rz-strong">
                        {price(part.effectiveSalePrice, currency, locale)}
                      </span>
                      <span className="rz-dim font-mono text-caption">
                        {part.externalCode ?? '—'}
                      </span>
                    </>
                  )
                }
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        compact
                          ? 'part-search-picker__name rz-strong font-semibold'
                          : 'rz-strong truncate font-medium'
                      }
                    >
                      {part.name}
                    </span>
                    {!compact && (
                      <StatusPill tone={taken ? 'neutral' : 'ok'}>
                        {taken
                          ? t('inOrder')
                          : t('inStock', { count: part.quantityAvailable })}
                      </StatusPill>
                    )}
                  </span>
                  {compact ? (
                    metadata ? (
                      <span className="part-search-picker__meta">
                        {metadata}
                      </span>
                    ) : null
                  ) : (
                    <span className="rz-caption block truncate">{car}</span>
                  )}
                </span>
              </SearchPickerOption>
            )
          })}
        </SearchPickerOptions>
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
    </SearchPicker>
  )
}
