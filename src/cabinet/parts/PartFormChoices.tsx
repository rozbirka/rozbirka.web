import { useId, useState } from 'react'
import { X } from 'lucide-react'
import { Button, Field, Notice, TextInput } from '@/components/app'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/i18n'
import { VehicleCatalogPicker } from '../cars/CarsScreen'
import { partFormMessages } from './part-form-messages'
import { rowProblem, type CompatibilityRow } from './compatibility-rows'

/** One optional vehicle in the compatibility list. */
export function CompatibilityRowCard({
  index,
  onChange,
  onRemove,
  row,
}: {
  index: number
  onChange: (patch: Partial<CompatibilityRow>) => void
  onRemove: () => void
  row: CompatibilityRow
}) {
  // The picker keeps the make's own id so it can list that make's models.
  const [makeId, setMakeId] = useState<number | null>(null)
  const t = useT(partFormMessages)
  const { locale } = useLocale()
  const problem = rowProblem(row, locale)
  const title = t('vehicleN', { n: index })
  return (
    <section aria-label={title} className="rz-inset grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="rz-eyebrow m-0">{title}</h4>
        <Button onClick={onRemove} size="sm" type="button" variant="quiet">
          <X aria-hidden />
          {t('remove')}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <VehicleCatalogPicker
          disabled={false}
          label={t('make')}
          onSelect={(option) => {
            setMakeId(option.id)
            onChange({ brand: option.name, model: '' })
          }}
          type="make"
          value={row.brand}
        />
        <VehicleCatalogPicker
          disabled={row.brand === ''}
          label={t('model')}
          makeId={makeId}
          makeName={row.brand}
          onSelect={(option) => {
            onChange({ model: option.name })
          }}
          type="model"
          value={row.model}
        />
        <Field label={t('year')}>
          <TextInput
            inputMode="numeric"
            onChange={(event) => {
              onChange({ year: event.target.value })
            }}
            value={row.year}
          />
        </Field>
      </div>

      {problem === null ? null : <Notice tone="danger">{problem}</Notice>}
    </section>
  )
}

/**
 * What each condition means for a buyer. The label alone is a guess; the line
 * under it is what stops "задовільний" and "на запчастини" being used
 * interchangeably.
 */
const CONDITION_HINTS: Record<string, 'hintGood' | 'hintFair' | 'hintScrap'> = {
  good: 'hintGood',
  fair: 'hintFair',
  scrap: 'hintScrap',
}

export function ConditionTile({
  label,
  onPick,
  picked,
  value,
}: {
  label: string
  onPick: () => void
  picked: boolean
  value: string
}) {
  const t = useT(partFormMessages)
  const meaning = CONDITION_HINTS[value]
  const hintId = useId()
  return (
    <button
      aria-checked={picked}
      aria-describedby={hintId}
      aria-label={label}
      className={cn(
        'rz-choice-card w-full bg-transparent text-left',
        picked && 'border-brand bg-brand-soft',
      )}
      onClick={onPick}
      role="radio"
      type="button"
    >
      <span
        aria-hidden
        className={cn('rz-radio mt-0.5', picked && 'border-brand')}
      >
        {picked ? <span className="bg-brand size-1.5 rounded-full" /> : null}
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="font-semibold text-app-strong">{label}</span>
        <span className="rz-caption text-pretty" id={hintId}>
          {meaning ? t(meaning) : null}
        </span>
      </span>
    </button>
  )
}
