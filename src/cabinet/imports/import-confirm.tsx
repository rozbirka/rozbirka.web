import { Button } from '@/components/app'
import { cn } from '@/lib/utils'
import { useLocale } from '@/i18n'
import type {
  ImportMapping,
  ImportRow,
  ImportValidation,
} from '@/api/part-imports'
import { importConfirmMessages } from './import-confirm-messages'
import { issueText, valueLabel } from './import-model'
import { useCount, useImportT } from './use-import-text'

const NOTES = ['noteDuplicates', 'noteStop', 'noteLeave'] as const

function Entity({
  value,
  label,
  meta,
}: {
  value: number
  label: string
  meta: string
}) {
  const count = useCount()
  return (
    <div className="bg-app-raised px-5 pt-4.5 pb-5">
      <p
        className={cn(
          'text-[26px] leading-none font-extrabold tracking-[-0.03em]',
          value === 0 ? 'text-app-dim' : 'text-app-ink',
        )}
      >
        {count(value)}
      </p>
      <p
        className={cn(
          'mt-2 text-[14px] font-bold',
          value === 0 ? 'text-app-dim' : 'text-app-muted',
        )}
      >
        {label}
      </p>
      <p className="text-app-dim mt-1 text-[13px] leading-5 text-pretty">
        {meta}
      </p>
    </div>
  )
}

/**
 * Крок 4 — the last screen before anything exists. Everything on it comes
 * from the server's own validation of this exact selection, because that is
 * the number the commit will act on.
 */
export function ImportConfirmStep({
  validation,
  mapping,
  sourceLabel,
  rows,
  selected,
  onBack,
  onCommit,
  busy,
}: {
  validation: ImportValidation
  sourceLabel?: string
  mapping: ImportMapping | null
  rows: readonly ImportRow[]
  selected: readonly string[]
  onBack: () => void
  onCommit: () => void
  busy: boolean
}) {
  const { locale } = useLocale()
  const t = useImportT(importConfirmMessages)
  const count = useCount()
  const picked = new Set(selected)
  const units = rows
    .filter((row) => picked.has(row.rowId))
    .reduce((sum, row) => {
      const quantity = Number(row.draft?.values['Quantity'] ?? '')
      return sum + (Number.isFinite(quantity) ? quantity : 0)
    }, 0)

  const constant = (target: string) =>
    mapping?.rules.find((rule) => rule.target === target)?.constant ?? null
  const fromColumn = (target: string) =>
    (mapping?.rules.find((rule) => rule.target === target)?.sources.length ??
      0) > 0
  const said = (target: string, whenColumn: string) =>
    fromColumn(target)
      ? whenColumn
      : constant(target) === null
        ? null
        : (valueLabel(constant(target)!, locale) ?? constant(target)!)

  // What was left behind, grouped by the reason it was left behind.
  const excluded = new Map<string, number>()
  for (const row of rows) {
    if (picked.has(row.rowId)) continue
    const first = row.draft?.issues[0]
    const reason =
      first === undefined ? t('removedManually') : issueText(first.code, locale)
    excluded.set(reason, (excluded.get(reason) ?? 0) + 1)
  }

  const facts = [
    {
      label: t('origin'),
      value:
        sourceLabel ??
        (mapping?.source?.type === 'newBatch'
          ? t('newBatch', { name: mapping.source.batchName })
          : mapping?.source?.type === 'car'
            ? t('car', { id: mapping.source.carId })
            : mapping?.source?.type === 'batch'
              ? t('batch', { id: mapping.source.intakeId })
              : t('sourceNeedsCheck')),
    },
    {
      label: t('zone'),
      value: said('InventoryZoneId', t('fromFileColumn')),
    },
    {
      label: t('condition'),
      value: said('Condition', t('fromFileColumn')),
    },
    {
      label: t('scenario'),
      value:
        constant('Strategy') === 'Reserved'
          ? validation.orderGrouping === 'one-order-per-reserved-row'
            ? t('scenarioReservedPerRow')
            : t('scenarioReserved')
          : t('scenarioAvailable'),
    },
    {
      label: t('photos'),
      value:
        validation.plannedPhotos === 0
          ? t('photosNone')
          : t('photosByLink', { count: validation.plannedPhotos }),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <section
        aria-label={t('willBeCreated')}
        className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
      >
        <div className="px-6 pt-6 pb-5 sm:px-8">
          <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
            {t('willBeCreated')}
          </p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[44px] leading-none font-extrabold tracking-[-0.03em] text-white">
              {count(validation.plannedParts)}
            </span>
            <span className="text-app-muted text-[17px] font-bold">
              {t('parts', { count: validation.plannedParts })}
            </span>
            <span className="text-app-dim text-[14px]">
              {t('units', { count: units })}
            </span>
          </p>
        </div>

        <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-px border-y">
          <Entity
            label={t('intakes')}
            meta={
              validation.plannedIntakes === 0
                ? t('noNewIntake')
                : t('newIntake')
            }
            value={validation.plannedIntakes}
          />
          <Entity
            label={t('zones')}
            meta={
              validation.plannedZones === 0
                ? t('zonesExist')
                : t('zonesFromFile')
            }
            value={validation.plannedZones}
          />
          <Entity
            label={t('orders')}
            meta={
              constant('Strategy') === 'Reserved'
                ? validation.maxOrderGroupSize === undefined
                  ? t('reservedScenario')
                  : t('perOrder', {
                      size: count(validation.maxOrderGroupSize),
                    })
                : t('availableScenario')
            }
            value={validation.plannedOrders}
          />
          <Entity
            label={t('customers')}
            meta={
              validation.plannedCustomers === 0
                ? t('noNewCustomers')
                : t('customersFromFile')
            }
            value={validation.plannedCustomers}
          />
        </div>

        <dl className="divide-app-line divide-y">
          {facts.map((fact) => (
            <div
              className="flex flex-wrap items-baseline justify-between gap-4 px-6 py-3.5 sm:px-8"
              key={fact.label}
            >
              <dt className="text-app-muted text-[14px]">{fact.label}</dt>
              <dd
                className={cn(
                  'text-[14.5px] font-medium',
                  fact.value === null ? 'text-app-dim' : 'text-app-ink',
                )}
              >
                {fact.value ?? t('notSet')}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-start gap-3.5">
        <section
          aria-label={t('excludedTitle')}
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[18px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">
            {t('excludedTitle')}
          </h2>
          {excluded.size === 0 ? (
            <p className="text-app-muted mt-3 text-[14px]">
              {t('nothingExcluded')}
            </p>
          ) : (
            <dl className="mt-3.5 grid gap-2.5">
              {[...excluded].map(([reason, howMany]) => (
                <div
                  className="flex flex-wrap items-baseline justify-between gap-3"
                  key={reason}
                >
                  <dt className="text-app-muted min-w-0 flex-1 text-[13.5px]">
                    {reason}
                  </dt>
                  <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                    {t('rows', { count: howMany })}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-app-dim mt-4 text-[13px] leading-5 text-pretty">
            {t('excludedNote')}
          </p>
        </section>

        <section
          aria-label={t('goodToKnow')}
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[18px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">
            {t('goodToKnow')}
          </h2>
          <ul className="mt-3.5 grid gap-2.5">
            {NOTES.map((note) => (
              <li
                className="text-app-muted text-[13.5px] leading-6 text-pretty"
                key={note}
              >
                {t(note)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <Button disabled={busy} onClick={onBack}>
          {t('backToReview')}
        </Button>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-app-dim text-[13px]">{t('runsInBackground')}</p>
          <Button
            className="h-11.5 px-6 text-[15px] font-bold"
            disabled={busy}
            onClick={onCommit}
            variant="primary"
          >
            {t('startImport')}
          </Button>
        </div>
      </div>
    </div>
  )
}
