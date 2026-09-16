import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Field, TextInput } from '@/components/app'

const colors = [
  ['Білий', '#e7e7e4'],
  ['Чорний', '#161616'],
  ['Сірий', '#828580'],
  ['Синій', '#3b60b5'],
  ['Червоний', '#bc514a'],
] as const

export function CarColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const [custom, setCustom] = useState(false)
  const isCustom =
    custom || (value !== '' && !colors.some(([name]) => name === value))
  return (
    <div className="car-color-field sm:col-span-2">
      <span className="text-app-muted text-[13.5px]">Колір</span>
      <div aria-label="Колір" className="car-color-options" role="group">
        {colors.map(([name, color]) => (
          <button
            aria-pressed={!isCustom && value === name}
            disabled={disabled}
            key={name}
            onClick={() => {
              setCustom(false)
              onChange(value === name ? '' : name)
            }}
            type="button"
          >
            <span aria-hidden style={{ backgroundColor: color }} />
            {name}
          </button>
        ))}
        <button
          aria-pressed={isCustom}
          disabled={disabled}
          onClick={() => {
            setCustom(true)
            if (!isCustom) onChange('')
          }}
          type="button"
        >
          <span aria-hidden className="car-color-other" />
          Інший
        </button>
      </div>
      {isCustom && (
        <Field label="Інший колір">
          <TextInput
            disabled={disabled}
            maxLength={50}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Наприклад, зелений металік"
            value={value}
          />
        </Field>
      )}
    </div>
  )
}

const dollars = (amount: number) =>
  `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(amount)} $`

export function CarFormSummary({
  values,
  expenses,
  busy,
}: {
  values: {
    code: string
    brand: string
    model: string
    year: string
    vin: string
    purchasePrice: string
  }
  expenses: number
  busy: boolean
}) {
  const price = Number(values.purchasePrice)
  const hasPrice =
    values.purchasePrice.trim() !== '' && Number.isFinite(price) && price >= 0
  const validYear =
    /^\d{4}$/.test(values.year) &&
    Number(values.year) >= 1900 &&
    Number(values.year) <= 2100
  const checks = [
    { label: 'Код вказано', valid: values.code.trim() !== '' },
    {
      label: 'Марка і модель заповнені',
      valid: values.brand.trim() !== '' && values.model.trim() !== '',
    },
    { label: 'Рік вказано', valid: validYear },
    { label: 'Ціна придбання вказана', valid: hasPrice },
  ]
  return (
    <aside aria-label="Перед створенням" className="car-form-summary">
      <h2>Перед створенням</h2>
      <div className="car-summary-identity">
        <strong>{values.code.trim() || 'Код авто'}</strong>
        <span>
          {[values.brand.trim(), values.model.trim()]
            .filter(Boolean)
            .join(' ') || 'Марка і модель'}
        </span>
        <span className="car-summary-vin">
          {values.vin || 'VIN не вказано'}
        </span>
      </div>
      <dl className="car-summary-totals">
        <div>
          <dt>Ціна придбання</dt>
          <dd>{hasPrice ? dollars(price) : '—'}</dd>
        </div>
        <div>
          <dt>Витрати</dt>
          <dd>{dollars(expenses)}</dd>
        </div>
        <div className="car-summary-invested">
          <dt>Інвестовано</dt>
          <dd aria-label="Інвестовано">
            {dollars((hasPrice ? price : 0) + expenses)}
          </dd>
        </div>
      </dl>
      <ul className="car-summary-checks">
        {checks.map(({ label, valid }) => (
          <li data-valid={valid} key={label}>
            <span aria-hidden>{valid && <Check />}</span>
            <span className="sr-only">
              {valid ? 'Готово: ' : 'Не заповнено: '}
            </span>
            {label}
          </li>
        ))}
      </ul>
      <Button
        aria-busy={busy}
        className="w-full"
        disabled={busy}
        type="submit"
        variant="primary"
      >
        Створити автомобіль
      </Button>
    </aside>
  )
}
