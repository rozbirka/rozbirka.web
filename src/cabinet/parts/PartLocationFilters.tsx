import { useEffect, useState } from 'react'
import {
  inventoryApi,
  type InventorySection,
  type InventoryShelf,
  type InventoryZone,
  type Warehouse,
} from '@/api/inventory'
import { Button, Notice, SelectPicker } from '@/components/app'
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
    items: { id: string; name: string; code?: string }[],
    selected: string,
    label: string,
  ) => [
    ...(selected && !items.some((item) => item.id === selected)
      ? [{ value: selected, label }]
      : []),
    ...items.map((item) => ({
      value: item.id,
      label: item.name,
      ...(item.code ? { searchText: item.code } : {}),
    })),
  ]
  const failed =
    (warehouses.key === parentKey && warehouses.error) ||
    (zones.key === zoneKey && zones.error) ||
    (sections.key === sectionKey && sections.error) ||
    (shelves.key === shelfKey && shelves.error)
  return (
    <>
      <SelectPicker
        label={t('warehouse')}
        compact
        compactOptions
        value={warehouseId}
        onValueChange={(value) => onChange('warehouse', value || null)}
        options={[
          { value: '', label: t('warehouseAll') },
          ...parentOptions(
            warehouseOptions,
            warehouseId,
            t('selectedWarehouse'),
          ),
        ]}
      />
      <SelectPicker
        label={t('zone')}
        compact
        compactOptions
        value={zoneId}
        disabled={!warehouseId}
        onValueChange={(value) => onChange('zone', value || null)}
        options={[
          { value: '', label: t('zoneAll') },
          ...parentOptions(zoneOptions, zoneId, t('selectedZone')),
        ]}
      />
      {warehouseId && zoneId ? (
        <SelectPicker
          label={t('section')}
          compact
          compactOptions
          value={withoutSection ? WITHOUT_LOCATION : sectionId}
          onValueChange={(value) => onChange('section', value || null)}
          options={[
            { value: '', label: t('sectionAll') },
            { value: WITHOUT_LOCATION, label: t('withoutSection') },
            ...parentOptions(sectionOptions, sectionId, t('selectedSection')),
          ]}
        />
      ) : null}
      {warehouseId && zoneId && sectionId && !withoutSection ? (
        <SelectPicker
          label={t('shelf')}
          compact
          compactOptions
          value={withoutShelf ? WITHOUT_LOCATION : shelfId}
          onValueChange={(value) => onChange('shelf', value || null)}
          options={[
            { value: '', label: t('shelfAll') },
            { value: WITHOUT_LOCATION, label: t('withoutShelf') },
            ...parentOptions(shelfOptions, shelfId, t('selectedShelf')),
          ]}
        />
      ) : null}
      {failed ? (
        <Notice
          action={
            <Button onClick={() => setAttempt((value) => value + 1)} size="sm">
              {tc('retry')}
            </Button>
          }
          tone="warn"
        >
          {t('locationOptionsFailed')}
        </Notice>
      ) : null}
    </>
  )
}
