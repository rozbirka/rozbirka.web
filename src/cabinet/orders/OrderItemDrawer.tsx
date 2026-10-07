import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import {
  Button,
  Field,
  Notice,
  QuantityStepper,
  Sheet,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { partsApi, type PartListItem } from '@/api/parts'
import { inventoryApi, type PartInventoryZone } from '@/api/inventory'
import { normalizeApiProblem } from '@/api/errors'
import { orderCardMessages } from './order-cards-messages'
import { useLocale, type SupportedCurrency } from '@/i18n'
import { MoneyInput } from '../currency/price-currency'
import { amountPrecisionError } from '../currency/amount-precision'
import type { FirstPriceGuard } from '../currency/use-accounting-currency'
import { usePriceSlots } from '../currency/use-price-slots'
import { money } from './order-money'

const SEARCH_DEBOUNCE_MS = 250
const PAGE_SIZE = 8

interface Candidate extends PartListItem {
  /** What the part sells for, read from its own card. */
  price: number | null
  oemCode: string | null
  /** The plate the car wears, which is how a yard names it out loud. */
  carCode: string | null
  /** Where it physically lies, so the row says what to go and fetch. */
  place: string | null
}

const origin = (part: Candidate, noCar: string) =>
  part.car === null
    ? noCar
    : [
        `${part.car.make} ${part.car.model} ${String(part.car.year)}`,
        part.carCode,
      ]
        .filter(Boolean)
        .join(' · ')

/** A zone reads as warehouse and shelf, the way the label on it is written. */
const placeOf = (zones: PartInventoryZone[]): string | null => {
  if (!Array.isArray(zones)) return null
  const zone = zones.find((item) => !item.isSystemUnassigned) ?? zones[0]
  if (zone === undefined || zone.isSystemUnassigned === true) return null
  return [zone.warehouseName, zone.zoneCode ?? zone.zoneName]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Picking a part for an order, over the order rather than instead of it.
 *
 * The route stays — a link to `/items/new` still works — but it now opens this
 * drawer on top of the card, so the list of what is already on the order
 * remains readable while a part is chosen. That list is also what greys out a
 * part already on the order instead of letting it be added twice.
 */
interface OrderItemDrawerProps {
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (
    item: {
      partId: string
      quantity: number
      unitPrice: number
    },
    /** The currency accepted after a «Save in EUR» conflict, if any. */
    accepted?: SupportedCurrency | null,
  ) => void
  open: boolean
  /** First-price pattern of the order's accounting currency. */
  guard: FirstPriceGuard
  orderNumber: number
  /** What the order is worth now, so the footer can say what it will become. */
  orderTotal: number | null
  takenPartIds: readonly string[]
}

export function OrderItemDrawer(props: OrderItemDrawerProps) {
  if (!props.open) return null
  return <OpenOrderItemDrawer {...props} />
}

function OpenOrderItemDrawer({
  busy,
  error,
  guard,
  onOpenChange,
  onSubmit,
  open,
  orderNumber,
  orderTotal,
  takenPartIds,
}: OrderItemDrawerProps) {
  const t = useT(orderCardMessages)
  const tc = useT(commonMessages)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Candidate[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  const taken = useMemo(() => new Set(takenPartIds), [takenPartIds])

  useEffect(() => {
    if (!open || !query.trim()) return
    const controller = new AbortController()
    requestRef.current = controller
    const timer = setTimeout(() => {
      void partsApi
        .list({
          q: query.trim(),
          page: 1,
          pageSize: PAGE_SIZE,
          status: 'available',
          signal: controller.signal,
        })
        .then(async (page) => {
          if (controller.signal.aborted) return
          const available = page.items.filter(
            (item) => item.quantityAvailable > 0,
          )
          // The list carries no price; a part's own card does. Only the page on
          // screen is asked, so the drawer stays one request per visible row.
          const [details, zones] = await Promise.all([
            Promise.allSettled(
              available.map((item) =>
                partsApi.get(item.id, { signal: controller.signal }),
              ),
            ),
            // Where a part lies is its own record; the row is the one place a
            // picker reads it, so it is asked for the visible page only.
            Promise.allSettled(
              available.map((item) =>
                inventoryApi.getPartZones(item.id, {
                  signal: controller.signal,
                }),
              ),
            ),
          ])
          if (controller.signal.aborted) return
          setItems(
            available.map((item, index) => {
              const detail = details[index]
              const zone = zones[index]
              return {
                ...item,
                price:
                  detail?.status === 'fulfilled'
                    ? detail.value.effectiveSalePrice
                    : null,
                oemCode:
                  detail?.status === 'fulfilled'
                    ? detail.value.oemCode
                    : (item.externalCode ?? null),
                carCode:
                  detail?.status === 'fulfilled' ? detail.value.carCode : null,
                place:
                  zone?.status === 'fulfilled' ? placeOf(zone.value) : null,
              }
            }),
          )
          setLoadError(null)
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setItems([])
            setLoadError(normalizeApiProblem(reason).message)
          }
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [open, query, attempt])

  const picked = items?.find((item) => item.id === pickedId) ?? null
  const unitPrice =
    price === null
      ? (picked?.price ?? null)
      : Number(price.replace(/\s/g, '').replace(',', '.'))
  const { locale } = useLocale()
  const currency = guard.currency
  // Core refuses a price finer than the accounting currency allows.
  const pricePrecision =
    price !== null && unitPrice !== null && Number.isFinite(unitPrice)
      ? amountPrecisionError(unitPrice, currency, locale)
      : null
  const valid =
    picked !== null &&
    unitPrice !== null &&
    Number.isFinite(unitPrice) &&
    unitPrice >= 0 &&
    pricePrecision === null &&
    quantity > 0 &&
    quantity <= picked.quantityAvailable &&
    !taken.has(picked.id)
  const lineTotal = valid ? (unitPrice ?? 0) * quantity : 0
  const submit = (accepted?: SupportedCurrency | null) => {
    if (!valid || picked === null || priceSlots.disabled) return
    const item = { partId: picked.id, quantity, unitPrice: unitPrice ?? 0 }
    if (accepted === undefined) onSubmit(item)
    else onSubmit(item, accepted)
  }
  const priceSlots = usePriceSlots(guard, {
    values: picked === null ? [] : [unitPrice],
    onAccept: (accepted) => submit(accepted),
  })

  const reset = () => {
    setPickedId(null)
    setQuantity(1)
    setPrice(null)
  }

  const changeQuery = (value: string) => {
    requestRef.current?.abort()
    setQuery(value)
    setItems(null)
    setLoadError(null)
    reset()
  }

  return (
    <Sheet
      eyebrow={t('drawerEyebrow', { number: String(orderNumber) })}
      footer={
        <>
          <p className="text-app-muted min-w-0 flex-1 text-[13px]">
            {valid
              ? t('totalWillBe', {
                  amount: money(
                    (orderTotal ?? 0) + lineTotal,
                    currency,
                    locale,
                  ),
                })
              : t('totalNow', { amount: money(orderTotal, currency, locale) })}
          </p>
          <Button
            disabled={busy}
            onClick={() => {
              changeQuery('')
              onOpenChange(false)
            }}
          >
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !valid || priceSlots.disabled}
            onClick={() => submit()}
            variant="primary"
          >
            {t('addToOrder')}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        if (!next) changeQuery('')
        onOpenChange(next)
      }}
      open={open}
      title={t('addItem')}
    >
      {error === null ? null : <Notice tone="danger">{error}</Notice>}

      <Field hiddenLabel label={t('searchPart')}>
        <span className="relative block">
          <Search
            aria-hidden
            className="text-app-dim pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <TextInput
            aria-controls={listId}
            autoComplete="off"
            className="h-[46px] rounded-[11px] pr-12 pl-10"
            ref={inputRef}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            value={query}
          />
          {query ? (
            <button
              type="button"
              aria-label={t('clearSearch')}
              className="text-app-muted hover:text-app-ink focus-visible:outline-brand absolute top-0 right-0 flex size-[46px] cursor-pointer items-center justify-center rounded-[11px] focus-visible:outline-2"
              onClick={() => {
                changeQuery('')
                inputRef.current?.focus()
              }}
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </span>
      </Field>

      <div
        className="border-app-line bg-app-raised overflow-hidden rounded-[14px] border"
        id={listId}
      >
        {!query.trim() ? (
          <div
            className="text-app-muted px-4 py-8 text-center text-[13px]"
            role="status"
          >
            <p className="text-app-ink font-semibold">{t('searchPrompt')}</p>
            <p className="mt-1">{t('searchScope')}</p>
          </div>
        ) : loadError !== null ? (
          <div className="space-y-3 p-4">
            <Notice tone="danger">{loadError}</Notice>
            <Button
              onClick={() => {
                setLoadError(null)
                setItems(null)
                setAttempt((value) => value + 1)
              }}
            >
              {t('retrySearch')}
            </Button>
          </div>
        ) : items === null ? (
          <div className="p-4">
            <SkeletonRows label={t('searching')} rows={4} />
          </div>
        ) : items.length === 0 ? (
          <p
            className="text-app-muted px-4 py-6 text-center text-[13px]"
            role="status"
          >
            {t('nothingFound')}
          </p>
        ) : (
          <ul aria-label={t('foundParts')}>
            {items.map((item) => {
              const already = taken.has(item.id)
              const out = item.quantityAvailable <= 0
              const disabled = already || out
              const active = item.id === pickedId
              return (
                <li key={item.id}>
                  <button
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-3 text-left transition-colors',
                      active
                        ? 'bg-brand/[0.07] shadow-[inset_3px_0_0_var(--color-brand)]'
                        : disabled
                          ? 'cursor-default'
                          : 'hover:bg-white/[0.04]',
                    )}
                    disabled={disabled}
                    onClick={() => {
                      setPickedId(item.id)
                      setQuantity(1)
                      setPrice(null)
                    }}
                    type="button"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-[14px] font-bold tracking-[-0.01em] text-pretty',
                          disabled ? 'text-app-dim' : 'text-white',
                        )}
                      >
                        {item.name}
                      </span>
                      <span className="text-app-muted mt-1 block font-mono text-[11px] leading-[1.5]">
                        {[item.oemCode, origin(item, t('noCar')), item.place]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          'block font-mono text-[13px]',
                          disabled ? 'text-app-dim' : 'text-app-ink',
                        )}
                      >
                        {money(item.price, currency, locale)}
                      </span>
                      <span
                        className={cn(
                          'mt-1 block text-[11px] font-bold whitespace-nowrap',
                          already
                            ? 'text-app-muted'
                            : out
                              ? 'text-state-danger'
                              : 'text-state-ok',
                        )}
                      >
                        {already
                          ? t('inOrder')
                          : out
                            ? t('outOfStock')
                            : t('inStock', { count: item.quantityAvailable })}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {picked === null ? null : (
        <div className="border-app-line bg-app-raised grid gap-3.5 rounded-[14px] border px-[18px] py-4">
          <div>
            <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              {t('selected')}
            </p>
            <p className="mt-2 text-[16px] font-bold tracking-[-0.01em] text-pretty text-white">
              {picked.name}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3.5">
            <Field label={t('quantity')}>
              <QuantityStepper
                label={t('itemQuantity')}
                max={picked.quantityAvailable}
                min={1}
                onChange={setQuantity}
                value={quantity}
              />
            </Field>
            <Field
              className="flex-[1_1_140px]"
              error={pricePrecision ?? undefined}
              hint={priceSlots.hint}
              label={t('unitPrice')}
            >
              <MoneyInput
                className="font-mono"
                currency={priceSlots.currency}
                disabled={priceSlots.disabled}
                inputMode="decimal"
                onChange={(event) => setPrice(event.target.value)}
                value={price ?? String(picked.price ?? '')}
              />
            </Field>
            <p className="text-right">
              <span className="text-app-muted block text-[12px] font-semibold">
                {t('lineSum')}
              </span>
              <span className="mt-2.5 block font-mono text-[17px] whitespace-nowrap text-white tabular-nums">
                {money(lineTotal, currency, locale)}
              </span>
            </p>
          </div>
          {priceSlots.note}
          {priceSlots.saveNotes}
          <p className="text-app-dim text-[12px]">
            {t('stockNote', {
              count: picked.quantityAvailable,
              number: String(orderNumber),
            })}
          </p>
        </div>
      )}
    </Sheet>
  )
}
