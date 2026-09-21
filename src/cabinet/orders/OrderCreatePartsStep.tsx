import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Filter, Image as ImageIcon, Plus, Trash2 } from 'lucide-react'
import { carsApi, type CarListItem } from '@/api/cars'
import { intakesApi, type IntakeListItem } from '@/api/intakes'
import { partsApi, type PartListItem } from '@/api/parts'
import {
  Button,
  Field,
  FormDialog,
  Notice,
  QuantityStepper,
  SearchInput,
  Sheet,
  TextInput,
} from '@/components/app'
import {
  addDraftItem,
  normalizeOrderPrice,
  orderDraftTotal,
  parseOrderPrice,
  remainingPartQuantity,
  removeDraftItem,
  updateDraftPrice,
  type OrderDraftItem,
} from './order-create-model'

const PAGE_SIZE = 20

const sourceLabel = (part: PartListItem) =>
  part.car
    ? `${part.car.make} ${part.car.model} · ${part.car.year}`
    : 'Приймання'

export function OrderCreatePartsStep({
  items,
  onItemsChange,
}: {
  items: OrderDraftItem[]
  onItemsChange: (items: OrderDraftItem[]) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<PartListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [editorPart, setEditorPart] = useState<PartListItem | null>(null)
  const [editorQuantity, setEditorQuantity] = useState(1)
  const [editorPrice, setEditorPrice] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'cars' | 'intakes'>('cars')
  const [sourceQuery, setSourceQuery] = useState('')
  const [cars, setCars] = useState<CarListItem[]>([])
  const [intakes, setIntakes] = useState<IntakeListItem[]>([])
  const [draftCarIds, setDraftCarIds] = useState<string[]>([])
  const [draftIntakeIds, setDraftIntakeIds] = useState<string[]>([])
  const [carIds, setCarIds] = useState<string[]>([])
  const [intakeIds, setIntakeIds] = useState<string[]>([])
  const resultButtons = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(
      () => {
        setLoading(true)
        setError(null)
        void partsApi
          .list({
            ...(query.trim() ? { q: query.trim() } : {}),
            status: 'available',
            page,
            pageSize: PAGE_SIZE,
            carIds,
            intakeIds,
            signal: controller.signal,
          })
          .then((response) => {
            if (controller.signal.aborted) return
            setResults((current) =>
              page === 1 ? response.items : [...current, ...response.items],
            )
            setTotalPages(response.totalPages)
          })
          .catch((requestError: unknown) => {
            if (controller.signal.aborted) return
            setError(
              requestError instanceof Error
                ? requestError.message
                : 'Не вдалося завантажити запчастини.',
            )
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false)
          })
      },
      query ? 250 : 0,
    )
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, page, carIds, intakeIds, reloadKey])

  useEffect(() => {
    if (!filterOpen) return
    const controller = new AbortController()
    void Promise.all([
      carsApi.list(
        { search: sourceQuery || undefined, page: 1, pageSize: 100 },
        { signal: controller.signal },
      ),
      intakesApi.list(
        { search: sourceQuery || undefined, page: 1, pageSize: 100 },
        { signal: controller.signal },
      ),
    ]).then(([carPage, intakePage]) => {
      if (controller.signal.aborted) return
      setCars(carPage.items)
      setIntakes(intakePage.items)
    })
    return () => controller.abort()
  }, [filterOpen, sourceQuery])

  const selectedCount = carIds.length + intakeIds.length
  const remaining = editorPart ? remainingPartQuantity(items, editorPart) : 0
  const selectedById = useMemo(
    () => new Map(items.map((item) => [item.part.id, item])),
    [items],
  )

  const openEditor = (part: PartListItem) => {
    const existing = selectedById.get(part.id)
    setEditorPart(part)
    setEditorQuantity(1)
    setEditorPrice(existing?.price ?? '')
  }

  const addPart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !editorPart ||
      remaining < 1 ||
      parseOrderPrice(editorPrice) === undefined
    )
      return
    onItemsChange(addDraftItem(items, editorPart, editorQuantity, editorPrice))
    setEditorPart(null)
  }

  const toggle = (values: string[], id: string) =>
    values.includes(id)
      ? values.filter((value) => value !== id)
      : [...values, id]

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Field label="Пошук запчастини">
          <SearchInput
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Назва запчастини"
            value={query}
          />
        </Field>
        <Button
          className="self-end"
          onClick={() => {
            setDraftCarIds(carIds)
            setDraftIntakeIds(intakeIds)
            setFilterOpen(true)
          }}
        >
          <Filter aria-hidden />
          Фільтр{selectedCount ? ` · ${selectedCount}` : ''}
        </Button>
      </div>

      {error ? (
        <Notice tone="danger">
          <span>{error}</span>{' '}
          <button
            className="underline"
            onClick={() => setReloadKey((key) => key + 1)}
            type="button"
          >
            Спробувати ще раз
          </button>
        </Notice>
      ) : null}

      <div className="grid gap-2" aria-busy={loading}>
        {results.map((part) => {
          const selected = selectedById.get(part.id)
          const noStockLeft = remainingPartQuantity(items, part) === 0
          return (
            <button
              aria-label={`Обрати запчастину ${part.name}`}
              className="border-app-line bg-app-input hover:border-app-line-2 grid w-full grid-cols-[3.25rem_1fr_auto] items-center gap-3 rounded-control border p-3 text-left disabled:cursor-not-allowed disabled:opacity-55"
              disabled={noStockLeft}
              key={part.id}
              onClick={() => openEditor(part)}
              ref={(node) => {
                if (node) resultButtons.current.set(part.id, node)
                else resultButtons.current.delete(part.id)
              }}
              type="button"
            >
              {part.photos[0] ? (
                <img
                  alt={part.name}
                  className="size-13 rounded-lg object-cover"
                  src={part.photos[0]}
                />
              ) : (
                <span className="bg-app-raised text-app-dim grid size-13 place-items-center rounded-lg">
                  <ImageIcon aria-hidden />
                </span>
              )}
              <span className="min-w-0">
                <strong className="block truncate text-sm text-white">
                  {part.name}
                </strong>
                <span className="text-app-dim block truncate text-xs">
                  {sourceLabel(part)}
                </span>
                <span className="text-app-muted block text-xs">
                  Доступно: {part.quantityAvailable}
                </span>
              </span>
              {selected ? (
                <span className="bg-brand/15 text-brand rounded-full px-2 py-1 text-xs font-semibold">
                  ×{selected.quantity}
                </span>
              ) : null}
            </button>
          )
        })}
        {!loading && !error && results.length === 0 ? (
          <p className="text-app-dim py-6 text-center text-sm">
            Запчастин не знайдено.
          </p>
        ) : null}
        {loading ? (
          <p className="text-app-dim py-3 text-center text-sm">Завантажуємо…</p>
        ) : null}
        {!loading && page < totalPages ? (
          <Button
            className="justify-self-center"
            onClick={() => setPage((value) => value + 1)}
          >
            Показати ще
          </Button>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="border-app-line grid gap-2 border-t pt-3">
          <p className="text-app-muted text-sm font-medium">Вибрано</p>
          {items.map((item) => (
            <p className="text-sm text-white" key={item.part.id}>
              {item.part.name} ×{item.quantity}
            </p>
          ))}
        </div>
      ) : null}

      <FormDialog
        description={
          editorPart ? `${editorPart.name} · доступно ${remaining}` : undefined
        }
        onCloseAutoFocus={() => {
          if (editorPart) resultButtons.current.get(editorPart.id)?.focus()
        }}
        onOpenChange={(open) => {
          if (!open) setEditorPart(null)
        }}
        onSubmit={addPart}
        open={editorPart !== null}
        submitDisabled={
          remaining < 1 || parseOrderPrice(editorPrice) === undefined
        }
        submitLabel="Додати"
        title="Додати запчастину"
      >
        <Field label="Кількість" required>
          <QuantityStepper
            label="Кількість"
            max={Math.max(1, remaining)}
            min={1}
            onChange={setEditorQuantity}
            value={Math.min(editorQuantity, Math.max(1, remaining))}
          />
        </Field>
        <Field label="Ціна за шт." required>
          <TextInput
            inputMode="decimal"
            onChange={(event) =>
              setEditorPrice(normalizeOrderPrice(event.target.value))
            }
            value={editorPrice}
          />
        </Field>
        {editorQuantity > 1 && parseOrderPrice(editorPrice) !== undefined ? (
          <p className="text-app-dim text-sm">
            Сума: {editorQuantity * (parseOrderPrice(editorPrice) ?? 0)} $
          </p>
        ) : null}
      </FormDialog>

      <Sheet
        footer={
          <>
            <Button
              onClick={() => {
                setDraftCarIds([])
                setDraftIntakeIds([])
              }}
            >
              Скинути
            </Button>
            <Button
              onClick={() => {
                setCarIds(draftCarIds)
                setIntakeIds(draftIntakeIds)
                setPage(1)
                setFilterOpen(false)
              }}
              variant="primary"
            >
              Застосувати · {draftCarIds.length + draftIntakeIds.length}
            </Button>
          </>
        }
        onOpenChange={setFilterOpen}
        open={filterOpen}
        title="Фільтр за джерелом"
      >
        <div className="bg-app-input grid grid-cols-2 rounded-control p-1">
          <Button
            onClick={() => setFilterTab('cars')}
            variant={filterTab === 'cars' ? 'primary' : 'quiet'}
          >
            Авто
          </Button>
          <Button
            onClick={() => setFilterTab('intakes')}
            variant={filterTab === 'intakes' ? 'primary' : 'quiet'}
          >
            Приймання
          </Button>
        </div>
        <SearchInput
          aria-label="Пошук джерела"
          onChange={(event) => setSourceQuery(event.target.value)}
          value={sourceQuery}
        />
        <div className="grid gap-1">
          {(filterTab === 'cars' ? cars : intakes).map((source) => {
            const checked =
              filterTab === 'cars'
                ? draftCarIds.includes(source.id)
                : draftIntakeIds.includes(source.id)
            const label =
              filterTab === 'cars'
                ? `${(source as CarListItem).brand} ${(source as CarListItem).model} · ${(source as CarListItem).year}`
                : ((source as IntakeListItem).name ?? 'Приймання без назви')
            return (
              <label
                className="hover:bg-white/[0.04] flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2"
                key={source.id}
              >
                <input
                  checked={checked}
                  onChange={() => {
                    if (filterTab === 'cars')
                      setDraftCarIds((values) => toggle(values, source.id))
                    else
                      setDraftIntakeIds((values) => toggle(values, source.id))
                  }}
                  type="checkbox"
                />
                <span className="text-sm text-white">{label}</span>
              </label>
            )
          })}
        </div>
      </Sheet>
    </div>
  )
}

export function OrderCreatePricesStep({
  items,
  onItemsChange,
  onAddMore,
}: {
  items: OrderDraftItem[]
  onItemsChange: (items: OrderDraftItem[]) => void
  onAddMore: () => void
}) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article
          className="border-app-line bg-app-input grid gap-3 rounded-control border p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          key={item.part.id}
        >
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">
              {item.part.name}
            </h3>
            <p className="text-app-dim text-xs">{sourceLabel(item.part)}</p>
            <p className="text-app-muted mt-1 text-sm tabular-nums">
              {item.quantity} шт.
            </p>
          </div>
          <Field label="Ціна за одиницю" srLabel={item.part.name} required>
            <TextInput
              inputMode="decimal"
              onChange={(event) =>
                onItemsChange(
                  updateDraftPrice(items, item.part.id, event.target.value),
                )
              }
              value={item.price}
            />
          </Field>
          <Button
            aria-label={`Прибрати ${item.part.name}`}
            onClick={() => onItemsChange(removeDraftItem(items, item.part.id))}
            size="icon"
            variant="quiet"
          >
            <Trash2 aria-hidden />
          </Button>
        </article>
      ))}

      <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <Button onClick={onAddMore}>
          <Plus aria-hidden />
          Додати ще запчастину
        </Button>
        <p className="text-base font-semibold text-white tabular-nums">
          Разом: {orderDraftTotal(items)} $
        </p>
      </div>
    </div>
  )
}
