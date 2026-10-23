import { orderItemPrice, type OrderDraftItem } from './order-draft-items'
import { useEffect, useRef } from 'react'
import { Check, Pencil, Undo2, X } from 'lucide-react'
import { Button, Field, QuantityStepper } from '@/components/app'
import { PartSearchPicker } from '@/components/parts/PartSearchPicker'
import { useLocale, useT, type SupportedCurrency } from '@/i18n'
import { amountPrecisionError } from '../currency/amount-precision'
import { MoneyInput } from '../currency/price-currency'
import { money } from './order-money'
import { orderFormMessages } from './order-form-messages'
import './new-order-items.css'

/** Search stays above the working set; quantity and confirmed price live in each row. */
export function NewOrderItems({
  items,
  onChange,
  currency,
  priceHint,
  inputCurrency,
  disabled,
  pricesDisabled,
  query,
  onQueryChange,
}: {
  items: OrderDraftItem[]
  onChange: (items: OrderDraftItem[]) => void
  currency: SupportedCurrency | null
  priceHint: string | undefined
  inputCurrency: SupportedCurrency | null | 'none'
  disabled: boolean
  pricesDisabled: boolean
  query: string
  onQueryChange: (query: string) => void
}) {
  const t = useT(orderFormMessages)
  const { locale } = useLocale()
  const search = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLLIElement>())
  const focusId = useRef<string | null>(null)
  const focusSearch = useRef(false)
  const focusEditId = useRef<string | null>(null)
  useEffect(() => {
    if (focusSearch.current) {
      search.current?.querySelector<HTMLInputElement>('input')?.focus()
      focusSearch.current = false
    }
  }, [items.length])
  useEffect(() => {
    if (focusEditId.current) {
      cards.current
        .get(focusEditId.current)
        ?.querySelector<HTMLButtonElement>('[data-edit-price]')
        ?.focus()
      focusEditId.current = null
    }
    if (!focusId.current) return
    const card = cards.current.get(focusId.current)
    const price = card?.querySelector<HTMLInputElement>(
      'input[inputmode="decimal"]',
    )
    const input =
      price ??
      card?.querySelector<HTMLInputElement>('input[inputmode="numeric"]')
    input?.focus()
    focusId.current = null
  })
  const update = (
    id: string,
    patch: Partial<
      Pick<OrderDraftItem, 'quantity' | 'unitPrice' | 'priceBeforeEdit'>
    >,
  ) => {
    if ('priceBeforeEdit' in patch && patch.priceBeforeEdit === undefined)
      focusEditId.current = id
    onChange(
      items.map((item) => (item.part.id === id ? { ...item, ...patch } : item)),
    )
  }
  return (
    <div className="new-order-items grid min-w-0 gap-4">
      <div className="grid gap-2" ref={search}>
        <PartSearchPicker
          compact
          currency={currency}
          disabled={disabled}
          query={query}
          onQueryChange={onQueryChange}
          value={null}
          onClear={() => undefined}
          takenPartIds={items.map((item) => item.part.id)}
          onSelect={(part) => {
            if (
              items.some((item) => item.part.id === part.id) ||
              part.quantityAvailable < 1
            )
              return
            onChange([
              ...items,
              {
                part,
                quantity: 1,
                unitPrice:
                  part.effectiveSalePrice === null
                    ? ''
                    : String(part.effectiveSalePrice),
                ...(part.effectiveSalePrice === null
                  ? { priceBeforeEdit: '' }
                  : {}),
              },
            ])
            onQueryChange('')
            focusId.current = part.id
          }}
        />
        <p className="new-order-items__availability">
          <Check aria-hidden />
          {t('availableOnly')}
        </p>
      </div>
      <div className="grid min-w-0 gap-1.5">
        <span className="rz-label">
          {items.length
            ? t('itemsLabel', {
                count: items.reduce((sum, item) => sum + item.quantity, 0),
              })
            : t('itemsTitle')}
        </span>
        {items.length > 0 ? (
          <ul
            aria-label={t('orderItems')}
            className="new-order-items__list m-0 min-w-0 list-none p-0"
          >
            {items.map((item) => {
              const price = orderItemPrice(item.unitPrice)
              const priceError =
                price === null
                  ? undefined
                  : !Number.isFinite(price) || price < 0
                    ? t('invalidPrice')
                    : amountPrecisionError(price, currency, locale)
              const stockError =
                item.quantity > item.part.quantityAvailable ||
                item.part.quantityAvailable < 1
              const editing = item.priceBeforeEdit !== undefined
              const cancelPrice = () =>
                update(item.part.id, {
                  unitPrice: item.priceBeforeEdit!,
                  priceBeforeEdit: undefined,
                })
              return (
                <li
                  key={item.part.id}
                  ref={(element) => {
                    if (element) cards.current.set(item.part.id, element)
                    else cards.current.delete(item.part.id)
                  }}
                  className="min-w-0"
                >
                  <fieldset
                    aria-label={item.part.name}
                    data-order-price-edit={editing ? '' : undefined}
                    onKeyDown={(event) => {
                      if (editing && event.key === 'Escape') {
                        event.preventDefault()
                        event.stopPropagation()
                        cancelPrice()
                      }
                    }}
                    disabled={disabled}
                    className="new-order-item"
                  >
                    <div className="new-order-item__name min-w-0">
                      <p className="rz-strong m-0 break-words font-semibold">
                        {item.part.name}
                      </p>
                      {item.part.externalCode ? (
                        <p className="new-order-item__meta">
                          {item.part.externalCode}
                        </p>
                      ) : null}
                    </div>
                    <Field
                      className="new-order-item__quantity"
                      label={t('quantity')}
                      hiddenLabel
                      srLabel={item.part.name}
                      error={
                        stockError
                          ? t('stockChanged', {
                              count: item.part.quantityAvailable,
                            })
                          : undefined
                      }
                    >
                      <QuantityStepper
                        label={t('quantity')}
                        min={1}
                        max={item.part.quantityAvailable}
                        value={item.quantity}
                        onChange={(quantity) =>
                          update(item.part.id, { quantity })
                        }
                      />
                    </Field>
                    <div className="new-order-item__price">
                      {editing ? (
                        <div className="new-order-item__editor">
                          <Field
                            className="min-w-0"
                            hiddenLabel
                            label={t('unitPrice')}
                            srLabel={item.part.name}
                            error={priceError}
                          >
                            <MoneyInput
                              aria-description={priceHint}
                              className="new-order-item__input"
                              currency={inputCurrency}
                              disabled={disabled || pricesDisabled}
                              numeric
                              value={item.unitPrice}
                              placeholder={t('enterPrice')}
                              onChange={(event) =>
                                update(item.part.id, {
                                  unitPrice: event.target.value,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  if (price !== null && !priceError)
                                    update(item.part.id, {
                                      priceBeforeEdit: undefined,
                                    })
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  cancelPrice()
                                }
                              }}
                            />
                          </Field>
                          <Button
                            className="new-order-item__icon"
                            aria-label={t('savePrice', {
                              name: item.part.name,
                            })}
                            disabled={
                              disabled ||
                              pricesDisabled ||
                              price === null ||
                              !!priceError
                            }
                            size="icon"
                            variant="quiet"
                            onClick={() =>
                              update(item.part.id, {
                                priceBeforeEdit: undefined,
                              })
                            }
                          >
                            <Check aria-hidden />
                          </Button>
                        </div>
                      ) : (
                        <div className="new-order-item__value">
                          <span className="new-order-item__amount">
                            <span className="rz-num rz-strong">
                              {price === null
                                ? '—'
                                : money(
                                    item.quantity * price,
                                    currency,
                                    locale,
                                  )}
                            </span>
                            {price !== null && item.quantity > 1 ? (
                              <span className="new-order-item__breakdown">
                                {t('unitPriceBreakdown', {
                                  count: item.quantity,
                                  price: money(price, currency, locale),
                                })}
                              </span>
                            ) : null}
                          </span>
                          <Button
                            data-edit-price
                            className="new-order-item__icon"
                            aria-label={t('editPrice', {
                              name: item.part.name,
                            })}
                            disabled={disabled || pricesDisabled}
                            size="icon"
                            variant="quiet"
                            onClick={() => {
                              update(item.part.id, {
                                priceBeforeEdit: item.unitPrice,
                              })
                              focusId.current = item.part.id
                            }}
                          >
                            <Pencil aria-hidden />
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button
                      className="new-order-item__action text-app-dim"
                      aria-label={t(editing ? 'cancelPrice' : 'removeItem', {
                        name: item.part.name,
                      })}
                      disabled={disabled}
                      size="icon"
                      variant="quiet"
                      onClick={() => {
                        if (editing) {
                          cancelPrice()
                          return
                        }
                        const next = items.filter(
                          (row) => row.part.id !== item.part.id,
                        )
                        onChange(next)
                        focusId.current = next[0]?.part.id ?? null
                        if (!next.length) {
                          focusSearch.current = true
                          onQueryChange('')
                        }
                      }}
                    >
                      {editing ? <Undo2 aria-hidden /> : <X aria-hidden />}
                    </Button>
                  </fieldset>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="new-order-items__empty">{t('emptyItems')}</p>
        )}
      </div>
    </div>
  )
}
