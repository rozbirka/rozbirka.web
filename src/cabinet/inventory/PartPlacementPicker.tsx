import { Button } from '@/components/app'
import { LocationSelect } from './LocationSelect'
import { useT } from '@/i18n'
import { placementMessages } from './part-placement-messages'
import type { PartPlacement, PlacementOptions } from './part-placement-state'

export function PartPlacementPicker({
  value,
  onChange,
  options,
}: {
  value: PartPlacement
  onChange: (next: PartPlacement) => void
  options: PlacementOptions
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
      <div className="rz-field">
        <p className="rz-label m-0">{t('warehouse')}</p>
        <LocationSelect
          label={t('warehouse')}
          searchLabel={t('searchWarehouses')}
          noneLabel={t('chooseWarehouse')}
          options={warehouses.map(([id, name]) => ({ id, name }))}
          value={warehouseId || null}
          onChange={(id) => {
            const warehouseId = id ?? ''
            const zoneId =
              options.zones.find(
                (zone) =>
                  zone.warehouseId === warehouseId && zone.isSystemUnassigned,
              )?.id ?? ''
            onChange({ warehouseId, zoneId, sectionId: '', shelfId: '' })
          }}
        />
      </div>
      {warehouseId ? (
        <div className="rz-field">
          <p className="rz-label m-0">{t('zone')}</p>
          <LocationSelect
            label={t('zone')}
            searchLabel={t('searchZones')}
            noneLabel={t('chooseZone')}
            allowNone={!systemZone}
            options={warehouseZones.map((zone) => ({
              id: zone.id,
              name: zone.isSystemUnassigned ? t('warehouseOnly') : zone.name,
              code: zone.isSystemUnassigned ? '' : zone.code,
            }))}
            value={value.zoneId || null}
            onChange={(id) =>
              onChange({
                ...value,
                zoneId: id ?? '',
                sectionId: '',
                shelfId: '',
              })
            }
          />
        </div>
      ) : null}
      {value.zoneId && value.zoneId !== systemZone?.id ? (
        <div className="rz-field">
          <p className="rz-label m-0">{t('section')}</p>
          <LocationSelect
            label={t('section')}
            searchLabel={t('searchSections')}
            noneLabel={t('keepInZone')}
            options={sections}
            value={value.sectionId || null}
            onChange={(id) =>
              onChange({ ...value, sectionId: id ?? '', shelfId: '' })
            }
          />
        </div>
      ) : null}
      {value.sectionId ? (
        <div className="rz-field">
          <p className="rz-label m-0">{t('shelf')}</p>
          <LocationSelect
            label={t('shelf')}
            searchLabel={t('searchShelves')}
            noneLabel={t('keepInSection')}
            options={shelves}
            value={value.shelfId || null}
            onChange={(id) => onChange({ ...value, shelfId: id ?? '' })}
          />
        </div>
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
