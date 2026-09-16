import { useEffect, useId, useState } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { carCatalogApi, type CarCatalogItem } from '@/api/car-catalog'
import { Button, Field, SearchInput } from '@/components/app'
import { useFieldControl } from '@/components/app/field-context'

function CatalogOptions({
  kind,
  brand,
  value,
  label,
  searchId,
  onSelect,
}: {
  kind: 'make' | 'model'
  brand: string
  value: string
  label: string
  searchId: string
  onSelect: (name: string) => void
}) {
  const [search, setSearch] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    items: CarCatalogItem[]
    error: boolean
    loading: boolean
  }>({ items: [], error: false, loading: true })
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      const makes = await carCatalogApi.getMakes(controller.signal)
      if (kind === 'make') return makes
      const make = makes.find(
        (item) => item.name.toLowerCase() === brand.toLowerCase(),
      )
      return make ? carCatalogApi.getModels(make.id, controller.signal) : []
    }
    void load()
      .then((items) => {
        if (!controller.signal.aborted)
          setState({ items, loading: false, error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ items: [], loading: false, error: true })
      })
    return () => controller.abort()
  }, [kind, brand, attempt])
  const query = search.trim()
  const filtered = state.items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <>
      <div className="car-catalog-search">
        <SearchInput
          id={searchId}
          aria-describedby={undefined}
          aria-label={kind === 'make' ? 'Пошук марки' : 'Пошук моделі'}
          placeholder={kind === 'make' ? 'Пошук марки…' : `Модель ${brand}…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div
        className="car-catalog-results"
        aria-busy={state.loading}
        aria-label={label}
        role="listbox"
      >
        {state.loading ? (
          <p role="status">Завантажуємо каталог…</p>
        ) : state.error ? (
          <div>
            <p role="alert">
              Не вдалося завантажити список. Спробуйте ще раз або введіть назву
              вручну.
            </p>
            <Button
              onClick={() => {
                setState({ items: [], loading: true, error: false })
                setAttempt((current) => current + 1)
              }}
            >
              Спробувати ще раз
            </Button>
          </div>
        ) : filtered.length ? (
          filtered.map((item) => (
            <button
              className="car-catalog-option"
              key={item.id}
              type="button"
              onClick={() => onSelect(item.name)}
            >
              <span>{item.name}</span>
              {item.name === value && <Check aria-hidden />}
            </button>
          ))
        ) : (
          <p>Не знайдено</p>
        )}
        {!state.loading && filtered.length === 0 && query && (
          <Button
            className="car-catalog-manual"
            onClick={() => onSelect(query)}
          >
            Ввести «{query}» вручну
          </Button>
        )}
      </div>
    </>
  )
}
function CatalogPicker({
  kind,
  brand,
  value,
  disabled,
  onSelect,
}: {
  kind: 'make' | 'model'
  brand: string
  value: string
  disabled: boolean
  onSelect: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const field = useFieldControl()
  const label = kind === 'make' ? 'Марка' : 'Модель'
  const listId = useId()
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          {...field}
          aria-controls={open ? listId : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={label}
          className="car-catalog-trigger"
          disabled={disabled}
          type="button"
        >
          <span data-placeholder={!value}>
            {value ||
              (kind === 'make'
                ? 'Оберіть марку'
                : brand
                  ? 'Оберіть модель'
                  : 'Спочатку оберіть марку')}
          </span>
          <ChevronDown aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="car-catalog-dropdown type-redesign"
          collisionPadding={12}
          id={listId}
          role="presentation"
          side="bottom"
          sideOffset={6}
        >
          <CatalogOptions
            kind={kind}
            brand={brand}
            value={value}
            label={label}
            searchId={`${listId}-search`}
            onSelect={(name) => {
              onSelect(name)
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
export function CarCatalogFields({
  brand,
  model,
  disabled,
  onChange,
}: {
  brand: string
  model: string
  disabled: boolean
  onChange: (value: { brand: string; model: string }) => void
}) {
  return (
    <>
      <Field label="Марка" required>
        <CatalogPicker
          kind="make"
          brand={brand}
          value={brand}
          disabled={disabled}
          onSelect={(name) =>
            onChange({ brand: name, model: name === brand ? model : '' })
          }
        />
      </Field>
      <Field label="Модель" required>
        <CatalogPicker
          kind="model"
          brand={brand}
          value={model}
          disabled={disabled || !brand}
          onSelect={(name) => onChange({ brand, model: name })}
        />
      </Field>
    </>
  )
}
