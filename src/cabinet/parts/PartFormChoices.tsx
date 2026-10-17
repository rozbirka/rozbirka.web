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
    <section
      aria-label={title}
      className="border-app-line bg-app-raised rounded-[14px] border px-4 pt-3.5 pb-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
          {title}
        </h4>
        <Button
          className="min-h-8 px-2.5 text-[12px]"
          onClick={onRemove}
          type="button"
          variant="quiet"
        >
          <X aria-hidden className="size-3" />
          {t('remove')}
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
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

      {problem === null ? null : (
        <Notice className="mt-3" tone="danger">
          {problem}
        </Notice>
      )}
    </section>
  )
}

/**
 * What each condition means for a buyer. The label alone is a guess; the line
 * under it is what stops "задовільний" and "на запчастини" being used
 * interchangeably.
 */
const CONDITION_HINTS: Record<
  string,
  { hint: 'hintGood' | 'hintFair' | 'hintScrap'; tone: string }
> = {
  good: { hint: 'hintGood', tone: 'border-state-ok bg-state-ok' },
  fair: { hint: 'hintFair', tone: 'border-state-warn bg-state-warn' },
  scrap: { hint: 'hintScrap', tone: 'border-state-danger bg-state-danger' },
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
        'rounded-control flex min-h-[92px] flex-col items-start gap-2 border px-3.5 py-3 text-left transition-colors',
        picked
          ? 'border-app-line-2 bg-white/[0.06]'
          : 'border-app-line hover:border-app-line-2',
      )}
      onClick={onPick}
      role="radio"
      type="button"
    >
      <span className="flex w-full items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]',
            picked ? meaning?.tone.split(' ')[0] : 'border-white/20',
          )}
        >
          <span
            className={cn(
              'size-[7px] rounded-full',
              picked ? meaning?.tone.split(' ')[1] : '',
            )}
          />
        </span>
        <span
          className={cn(
            'text-[14px] font-bold whitespace-nowrap',
            picked ? 'text-white' : 'text-app-ink',
          )}
        >
          {label}
        </span>
      </span>
      <span
        className="text-app-dim text-[12px] leading-[1.4] text-pretty"
        id={hintId}
      >
        {meaning ? t(meaning.hint) : null}
      </span>
    </button>
  )
}
