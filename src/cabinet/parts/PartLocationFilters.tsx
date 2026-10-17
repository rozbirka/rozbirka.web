import { useEffect, useState } from 'react'
import {
  inventoryApi,
  type InventorySection,
  type InventoryShelf,
  type InventoryZone,
  type Warehouse,
} from '@/api/inventory'
import { Button, Notice, SelectInput } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { partsListMessages } from './parts-list-messages'

export const WITHOUT_LOCATION = '__without__'

/** Options are scoped to the opened parent; failed reads never clear URL filters. */
export function PartLocationFilters({
  owner,
  enabled,
  warehouseId,
  zoneId,
  sectionId,
  shelfId,
  withoutSection,
  withoutShelf,
  fallbackWarehouses = [],
  fallbackZones = [],
  onChange,
}: {
  owner: string
  enabled: boolean
  warehouseId: string
  zoneId: string
  sectionId: string
  shelfId: string
  withoutSection: boolean
  withoutShelf: boolean
  fallbackWarehouses?: { id: string; name: string }[]
  fallbackZones?: { id: string; name: string }[]
  onChange: (
    level: 'warehouse' | 'zone' | 'section' | 'shelf',
    value: string | null,
  ) => void
}) {
  const t = useT(partsListMessages)
  const tc = useT(commonMessages)
  const [attempt, setAttempt] = useState(0)
  const [warehouses, setWarehouses] = useState<{
    key: string
    items: Warehouse[]
    error: boolean
  }>({ key: '', items: [], error: false })
  const [zones, setZones] = useState<{
    key: string
    items: InventoryZone[]
    error: boolean
  }>({ key: '', items: [], error: false })
  const [sections, setSections] = useState<{
    key: string
    items: InventorySection[]
    error: boolean
  }>({ key: '', items: [], error: false })
  const [shelves, setShelves] = useState<{
    key: string
    items: InventoryShelf[]
    error: boolean
  }>({ key: '', items: [], error: false })
  const parentKey = `${owner}:${enabled}:${attempt}`
  const zoneKey = `${parentKey}:${warehouseId}`
  const sectionKey = `${zoneKey}:${zoneId}`
  const shelfKey = `${sectionKey}:${sectionId}:${withoutSection}`
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void inventoryApi.getWarehouses({ signal: controller.signal }).then(
      (items) => {
        if (!controller.signal.aborted)
          setWarehouses({
            key: parentKey,
            items: items.filter((item) => item.isActive),
            error: false,
          })
      },
      () => {
        if (!controller.signal.aborted)
          setWarehouses({ key: parentKey, items: [], error: true })
      },
    )
    return () => controller.abort()
  }, [enabled, parentKey])
  useEffect(() => {
    if (!enabled || !warehouseId) return
    const controller = new AbortController()
    void inventoryApi
      .getZones({ warehouseId, activeOnly: true, signal: controller.signal })
      .then(
        (items) => {
          if (!controller.signal.aborted)
            setZones({
              key: zoneKey,
              items: items.filter(
                (item) => item.warehouseId === warehouseId && item.isActive,
              ),
              error: false,
            })
        },
        () => {
          if (!controller.signal.aborted)
            setZones({ key: zoneKey, items: [], error: true })
        },
      )
    return () => controller.abort()
  }, [enabled, warehouseId, zoneKey])
  useEffect(() => {
    if (!enabled || !zoneId) return
    const controller = new AbortController()
    void inventoryApi.getSections(zoneId, { signal: controller.signal }).then(
      (items) => {
        if (!controller.signal.aborted)
          setSections({
            key: sectionKey,
            items: items.filter(
              (item) => item.zoneId === zoneId && item.isActive,
            ),
            error: false,
          })
      },
      () => {
        if (!controller.signal.aborted)
          setSections({ key: sectionKey, items: [], error: true })
      },
    )
    return () => controller.abort()
  }, [enabled, zoneId, sectionKey])
  useEffect(() => {
    if (!enabled || !zoneId || !sectionId || withoutSection) return
    const controller = new AbortController()
    void inventoryApi
      .getShelves(zoneId, { signal: controller.signal }, sectionId)
      .then(
        (items) => {
          if (!controller.signal.aborted)
            setShelves({
              key: shelfKey,
              items: items.filter(
                (item) =>
                  item.zoneId === zoneId &&
                  item.sectionId === sectionId &&
                  item.isActive,
              ),
              error: false,
            })
        },
        () => {
          if (!controller.signal.aborted)
            setShelves({ key: shelfKey, items: [], error: true })
        },
      )
    return () => controller.abort()
  }, [enabled, zoneId, sectionId, withoutSection, shelfKey])
  const visibleSections = sections.key === sectionKey ? sections.items : []
  const visibleShelves = shelves.key === shelfKey ? shelves.items : []
  const sectionOptions = visibleSections.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
  }))
  const shelfOptions = visibleShelves.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
  }))
  if (sectionId && !sectionOptions.some((item) => item.id === sectionId))
    sectionOptions.push({ id: sectionId, name: t('selectedSection'), code: '' })
  if (shelfId && !shelfOptions.some((item) => item.id === shelfId))
    shelfOptions.push({ id: shelfId, name: t('selectedShelf'), code: '' })
  const warehouseOptions =
    enabled && warehouses.key === parentKey && !warehouses.error
      ? warehouses.items
      : fallbackWarehouses
  const zoneOptions =
    enabled && zones.key === zoneKey && !zones.error
      ? zones.items
      : fallbackZones
  const parentOptions = (
    items: { id: string; name: string }[],
    selected: string,
    label: string,
  ) => (
    <>
      {selected && !items.some((item) => item.id === selected) ? (
        <option value={selected}>{label}</option>
      ) : null}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </>
  )
  const failed =
    (warehouses.key === parentKey && warehouses.error) ||
    (zones.key === zoneKey && zones.error) ||
    (sections.key === sectionKey && sections.error) ||
    (shelves.key === shelfKey && shelves.error)
  return (
    <>
      <SelectInput
        aria-label={t('warehouse')}
        name="warehouse"
        value={warehouseId}
        onChange={(event) => onChange('warehouse', event.target.value || null)}
      >
        <option value="">{t('warehouseAll')}</option>
        {parentOptions(warehouseOptions, warehouseId, t('selectedWarehouse'))}
      </SelectInput>
      <SelectInput
        aria-label={t('zone')}
        name="zone"
        value={zoneId}
        disabled={!warehouseId}
        title={warehouseId ? undefined : t('chooseWarehouseFirst')}
        onChange={(event) => onChange('zone', event.target.value || null)}
      >
        <option value="">{t('zoneAll')}</option>
        {parentOptions(zoneOptions, zoneId, t('selectedZone'))}
      </SelectInput>
      {warehouseId && zoneId ? (
        <div className="motion-safe:animate-[location-filter-reveal_180ms_ease-out]">
          <SelectInput
            aria-label={t('section')}
            name="section"
            value={withoutSection ? WITHOUT_LOCATION : sectionId}
            onChange={(event) =>
              onChange('section', event.target.value || null)
            }
          >
            <option value="">└ {t('sectionAll')}</option>
            <option value={WITHOUT_LOCATION}>{t('withoutSection')}</option>
            {parentOptions(sectionOptions, sectionId, t('selectedSection'))}
          </SelectInput>
        </div>
      ) : null}
      {warehouseId && zoneId && sectionId && !withoutSection ? (
        <div className="motion-safe:animate-[location-filter-reveal_180ms_ease-out]">
          <SelectInput
            aria-label={t('shelf')}
            name="shelf"
            value={withoutShelf ? WITHOUT_LOCATION : shelfId}
            onChange={(event) => onChange('shelf', event.target.value || null)}
          >
            <option value="">└ {t('shelfAll')}</option>
            <option value={WITHOUT_LOCATION}>{t('withoutShelf')}</option>
            {parentOptions(shelfOptions, shelfId, t('selectedShelf'))}
          </SelectInput>
        </div>
      ) : null}
      {failed ? (
        <Notice tone="warn">
          {t('locationOptionsFailed')}{' '}
          <Button onClick={() => setAttempt((value) => value + 1)}>
            {tc('retry')}
          </Button>
        </Notice>
      ) : null}
    </>
  )
}
