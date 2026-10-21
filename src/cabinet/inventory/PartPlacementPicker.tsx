import { Button, Field, SelectInput } from '@/components/app'
import { useT } from '@/i18n'
import { placementMessages } from './part-placement-messages'
import type { PartPlacement, PlacementOptions } from './part-placement-state'

export function PartPlacementPicker({
  value,
  onChange,
  options,
  compact = false,
}: {
  value: PartPlacement
  onChange: (next: PartPlacement) => void
  options: PlacementOptions
  compact?: boolean
}) {
  const t = useT(placementMessages)
  const warehouses = [
    ...new Map(
      options.zones.map((zone) => [zone.warehouseId, zone.warehouseName]),
    ).entries(),
  ]
  const warehouseId =
    value.warehouseId !== ''
      ? value.warehouseId
      : (options.zones.find((zone) => zone.id === value.zoneId)?.warehouseId ??
        '')
  const warehouseZones = options.zones.filter(
    (zone) => zone.warehouseId === warehouseId,
  )
  const sections = options.sections.filter(
    (section) => section.isActive && section.zoneId === value.zoneId,
  )
  const shelves = options.shelves.filter(
    (shelf) => shelf.isActive && shelf.sectionId === value.sectionId,
  )
  const systemZone = warehouseZones.find((zone) => zone.isSystemUnassigned)
  const id = compact ? 'batch' : 'part'

  if (options.loading)
    return (
      <p className="text-app-muted text-sm" role="status">
        {t('loading')}
      </p>
    )
  if (options.error)
    return (
      <div className="flex items-center gap-3">
        <span className="text-app-muted text-sm">{t('loadFailed')}</span>
        <Button onClick={options.retry} type="button">
          {t('retry')}
        </Button>
      </div>
    )
  if (warehouses.length === 0)
    return <p className="text-app-muted text-sm">{t('noLocations')}</p>

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('warehouse')}>
        <SelectInput
          aria-label={compact ? t('warehouse') : undefined}
          name={`${id}-warehouse`}
          value={warehouseId}
          onChange={(event) => {
            const warehouseId = event.target.value
            const zoneId =
              options.zones.find(
                (zone) =>
                  zone.warehouseId === warehouseId && zone.isSystemUnassigned,
              )?.id ?? ''
            onChange({ warehouseId, zoneId, sectionId: '', shelfId: '' })
          }}
        >
          <option value="">{t('chooseWarehouse')}</option>
          {warehouses.map(([warehouseId, name]) => (
            <option key={warehouseId} value={warehouseId}>
              {name}
            </option>
          ))}
        </SelectInput>
      </Field>
      {warehouseId ? (
        <Field label={t('zone')}>
          <SelectInput
            aria-label={compact ? t('zone') : undefined}
            name={`${id}-zone`}
            value={value.zoneId}
            onChange={(event) =>
              onChange({
                ...value,
                zoneId: event.target.value,
                sectionId: '',
                shelfId: '',
              })
            }
          >
            {!systemZone ? <option value="">{t('chooseZone')}</option> : null}
            {systemZone ? (
              <option value={systemZone.id}>{t('warehouseOnly')}</option>
            ) : null}
            {warehouseZones
              .filter((zone) => !zone.isSystemUnassigned)
              .map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
          </SelectInput>
        </Field>
      ) : null}
      {value.zoneId && value.zoneId !== systemZone?.id ? (
        <Field label={t('section')}>
          <SelectInput
            aria-label={compact ? t('section') : undefined}
            name={`${id}-section`}
            value={value.sectionId}
            onChange={(event) =>
              onChange({ ...value, sectionId: event.target.value, shelfId: '' })
            }
          >
            <option value="">{t('keepInZone')}</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : null}
      {value.sectionId ? (
        <Field label={t('shelf')}>
          <SelectInput
            aria-label={compact ? t('shelf') : undefined}
            name={`${id}-shelf`}
            value={value.shelfId}
            onChange={(event) =>
              onChange({ ...value, shelfId: event.target.value })
            }
          >
            <option value="">{t('keepInSection')}</option>
            {shelves.map((shelf) => (
              <option key={shelf.id} value={shelf.id}>
                {shelf.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : null}
      {value.zoneId &&
      value.zoneId !== systemZone?.id &&
      sections.length === 0 ? (
        <p className="text-app-muted text-sm sm:col-span-2">
          {t('noSections')}
        </p>
      ) : null}
      {value.sectionId && shelves.length === 0 ? (
        <p className="text-app-muted text-sm sm:col-span-2">{t('noShelves')}</p>
      ) : null}
    </div>
  )
}
