import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Field, Notice, QuantityStepper, Sheet } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { partsApi } from '@/api/parts'
import {
  PartSearchPicker,
  type PartPickerItem,
} from '@/components/parts/PartSearchPicker'
import { normalizeApiProblem } from '@/api/errors'
import { orderCardMessages } from './order-cards-messages'
import { useLocale, type SupportedCurrency } from '@/i18n'
import { MoneyInput } from '../currency/price-currency'
import { amountPrecisionError } from '../currency/amount-precision'
import type { FirstPriceGuard } from '../currency/use-accounting-currency'
import { usePriceSlots } from '../currency/use-price-slots'
import { money } from './order-money'
import { SheetGroup } from './sheet-group'

type SelectedPart = Pick<
  PartPickerItem,
  'id' | 'name' | 'quantityAvailable' | 'effectiveSalePrice'
>

/**
 * Picking a part for an order, over the order rather than instead of it.
 *
 * The route stays — a link to `/items/new` still works — but it now opens this
 * drawer on top of the card, so the list of what is already on the order
 * remains readable while a part is chosen. That list is also what greys out a
 * part already on the order instead of letting it be added twice.
 */
/** What the drawer keeps across the trip to the currency setting. */
export interface OrderItemDraft {
  query: string
  pickedId: string | null
  quantity: number
  price: string | null
}

interface OrderItemDrawerProps {
  /** Restored after choosing the accounting currency (see `form-draft.ts`). */
  draft?: OrderItemDraft | null
  /** Store the typed item right before leaving for the currency setting. */
  onKeepDraft?: (draft: OrderItemDraft) => void
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
  draft = null,
  onKeepDraft,
}: OrderItemDrawerProps) {
  const t = useT(orderCardMessages)
  const tc = useT(commonMessages)
  const [query, setQuery] = useState(() => draft?.query ?? '')
  const [picked, setPicked] = useState<SelectedPart | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(() => draft?.quantity ?? 1)
  const [price, setPrice] = useState<string | null>(() => draft?.price ?? null)
  const requestRef = useRef<AbortController | null>(null)

  const taken = useMemo(() => new Set(takenPartIds), [takenPartIds])

  // Restore the selected part after the trip to accounting-currency settings.
  // Fetch its card directly; the search dropdown can stay closed.
  useEffect(() => {
    if (!draft?.pickedId) return
    const controller = new AbortController()
    requestRef.current = controller
    void partsApi.get(draft.pickedId, { signal: controller.signal }).then(
      (part) => {
        if (!controller.signal.aborted) setPicked(part)
      },
      (failure: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(normalizeApiProblem(failure).message)
      },
    )
    return () => controller.abort()
  }, [draft?.pickedId])

  const unitPrice =
    price === null
      ? (picked?.effectiveSalePrice ?? null)
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
    ...(onKeepDraft
      ? {
          draftKept: true,
          onLeave: () =>
            onKeepDraft({
              query,
              pickedId: picked?.id ?? null,
              quantity,
              price,
            }),
        }
      : {}),
  })

  const reset = () => {
    requestRef.current?.abort()
    setPicked(null)
    setLoadError(null)
    setQuantity(1)
    setPrice(null)
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    reset()
  }

  return (
    <Sheet
      eyebrow={t('drawerEyebrow', { number: String(orderNumber) })}
      footer={
        <>
          <p className="rz-muted m-0 min-w-0 flex-1">
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

      <PartSearchPicker
        currency={currency}
        disabled={busy}
        onClear={reset}
        onQueryChange={setQuery}
        onSelect={(part) => {
          requestRef.current?.abort()
          setPicked(part)
          setQuery(part.name)
          setQuantity(1)
          setPrice(null)
          setLoadError(null)
        }}
        query={query}
        takenPartIds={takenPartIds}
        value={picked}
      />
      {loadError ? <Notice tone="danger">{loadError}</Notice> : null}

      {picked === null ? null : (
        <SheetGroup
          className="border-app-line gap-4 rounded-rz-md border bg-(--rz-sheet-field) p-4"
          title={t('selected')}
        >
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
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
              className="min-w-0"
              error={pricePrecision ?? undefined}
              hint={priceSlots.hint}
              label={t('unitPrice')}
            >
              <MoneyInput
                currency={priceSlots.currency}
                disabled={priceSlots.disabled}
                inputMode="decimal"
                numeric
                onChange={(event) => setPrice(event.target.value)}
                value={price ?? String(picked.effectiveSalePrice ?? '')}
              />
            </Field>
          </div>
          {priceSlots.note}
          <div className="border-app-line grid gap-2 border-t pt-3">
            <dl className="m-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="rz-muted">{t('lineSum')}</dt>
              <dd className="m-0 min-w-0">
                <output
                  aria-label={t('lineSum')}
                  className="rz-num rz-strong text-title break-all font-semibold"
                >
                  {money(lineTotal, currency, locale)}
                </output>
              </dd>
            </dl>
            <p className="rz-caption m-0 text-pretty">
              {t('stockNote', {
                count: picked.quantityAvailable,
                number: String(orderNumber),
              })}
            </p>
          </div>
          {priceSlots.saveNotes}
        </SheetGroup>
      )}
    </Sheet>
  )
}
