import { Button, SectionPanel } from '@/components/app'
import { cn } from '@/lib/utils'
import { Kpi } from '../redesign-kpi'
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
    <Kpi
      label={label}
      meta={meta}
      {...(value === 0 ? { tone: 'dim' as const } : {})}
      value={count(value)}
    />
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
    <div className="flex min-w-0 flex-col gap-3">
      <section aria-label={t('willBeCreated')} className="rz-card">
        <div className="rz-card__body grid gap-2">
          <p className="rz-eyebrow m-0">{t('willBeCreated')}</p>
          <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="rz-display">{count(validation.plannedParts)}</span>
            <span className="text-app-strong font-semibold">
              {t('parts', { count: validation.plannedParts })}
            </span>
            <span className="text-app-dim">{t('units', { count: units })}</span>
          </p>
        </div>

        <div className="rz-kpis border-app-line rounded-none border-x-0">
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

        <dl className="rz-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd
                className={cn(
                  'font-medium',
                  fact.value === null ? 'text-app-dim' : 'text-app-strong',
                )}
              >
                {fact.value ?? t('notSet')}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-start gap-3">
        <SectionPanel
          className="min-w-0 flex-[1_1_320px]"
          title={t('excludedTitle')}
        >
          {excluded.size === 0 ? (
            <p className="text-app-muted m-0">{t('nothingExcluded')}</p>
          ) : (
            <dl className="rz-facts px-0 py-0">
              {[...excluded].map(([reason, howMany]) => (
                <div key={reason}>
                  <dt>{reason}</dt>
                  <dd className="text-right font-mono tabular-nums">
                    {t('rows', { count: howMany })}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="rz-caption m-0 text-pretty">{t('excludedNote')}</p>
        </SectionPanel>

        <SectionPanel
          className="min-w-0 flex-[1_1_320px]"
          title={t('goodToKnow')}
        >
          <ul className="m-0 grid list-disc gap-2 pl-4">
            {NOTES.map((note) => (
              <li className="text-app-muted text-pretty" key={note}>
                {t(note)}
              </li>
            ))}
          </ul>
        </SectionPanel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button disabled={busy} onClick={onBack}>
          {t('backToReview')}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rz-caption m-0">{t('runsInBackground')}</p>
          <Button
            disabled={busy}
            onClick={onCommit}
            size="lg"
            variant="primary"
          >
            {t('startImport')}
          </Button>
        </div>
      </div>
    </div>
  )
}
