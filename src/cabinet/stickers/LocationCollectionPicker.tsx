import { useEffect, useState } from 'react'
import { inventoryApi } from '@/api/inventory'
import {
  Button,
  ErrorState,
  Field,
  SelectInput,
  SkeletonRows,
} from '@/components/app'
import { useT } from '@/i18n'
import { locationStickersMessages } from './location-stickers-messages'
import type { LocationCollection } from './sticker-route'

interface Option {
  id: string
  name: string
}
export function LocationCollectionPicker({
  onChoose,
  embedded = false,
}: {
  onChoose: (collection: LocationCollection) => void
  embedded?: boolean
}) {
  const t = useT(locationStickersMessages)
  const [kind, setKind] = useState<LocationCollection['kind']>('zone')
  const [warehouse, setWarehouse] = useState(''),
    [zone, setZone] = useState(''),
    [section, setSection] = useState('')
  const [options, setOptions] = useState<{
    warehouses: Option[]
    zones: Option[]
    sections: Option[]
  }>({ warehouses: [], zones: [], sections: [] })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
      'loading',
    ),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      inventoryApi.getWarehouses({ signal: controller.signal }),
      warehouse && kind !== 'zone'
        ? inventoryApi.getZones({
            warehouseId: warehouse,
            activeOnly: true,
            signal: controller.signal,
          })
        : Promise.resolve([]),
      warehouse && zone && kind === 'shelf'
        ? inventoryApi.getSections(zone, { signal: controller.signal })
        : Promise.resolve([]),
    ]).then(
      ([warehouses, zones, sections]) => {
        if (controller.signal.aborted) return
        setOptions({
          warehouses: warehouses.filter((x) => x.isActive),
          zones: zones.filter(
            (x) =>
              x.isActive &&
              !x.isSystemUnassigned &&
              x.warehouseId === warehouse,
          ),
          sections: sections.filter(
            (x) =>
              x.isActive && x.zoneId === zone && x.warehouseId === warehouse,
          ),
        })
        setStatus('ready')
      },
      () => {
        if (!controller.signal.aborted) setStatus('error')
      },
    )
    return () => controller.abort()
  }, [kind, warehouse, zone, revision])
  const parentId =
    kind === 'zone' ? warehouse : kind === 'section' ? zone : section
  const valid = Boolean(
    options.warehouses.some((x) => x.id === warehouse) &&
    (kind === 'zone' || options.zones.some((x) => x.id === zone)) &&
    (kind !== 'shelf' || options.sections.some((x) => x.id === section)),
  )
  return (
    <section
      aria-label={t('chooseCollection')}
      className={embedded ? undefined : 'rz-card'}
    >
      <div className={embedded ? 'grid gap-3' : 'rz-card__body grid gap-3'}>
        {embedded ? null : (
          <h2 className="rz-h-card">{t('chooseCollection')}</h2>
        )}
        <Field label={t('kind')}>
          <SelectInput
            value={kind}
            onChange={(event) => {
              setStatus('loading')
              setKind(event.target.value as LocationCollection['kind'])
              setZone('')
              setSection('')
            }}
          >
            <option value="zone">{t('zones')}</option>
            <option value="section">{t('sections')}</option>
            <option value="shelf">{t('shelves')}</option>
          </SelectInput>
        </Field>
        <Field label={t('warehouse')}>
          <SelectInput
            value={warehouse}
            disabled={status !== 'ready'}
            onChange={(event) => {
              setStatus('loading')
              setWarehouse(event.target.value)
              setZone('')
              setSection('')
            }}
          >
            <option value="">{t('choose')}</option>
            {options.warehouses.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        {kind !== 'zone' ? (
          <Field label={t('zone')}>
            <SelectInput
              value={zone}
              disabled={!warehouse || status !== 'ready'}
              onChange={(event) => {
                setStatus('loading')
                setZone(event.target.value)
                setSection('')
              }}
            >
              <option value="">{t('choose')}</option>
              {options.zones.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : null}
        {kind === 'shelf' ? (
          <Field label={t('section')}>
            <SelectInput
              value={section}
              disabled={!zone || status !== 'ready'}
              onChange={(event) => setSection(event.target.value)}
            >
              <option value="">{t('choose')}</option>
              {options.sections.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : null}
        {status === 'loading' ? <SkeletonRows rows={2} /> : null}
        {status === 'error' ? (
          <ErrorState
            title={t('invalid')}
            onRetry={() => {
              setStatus('loading')
              setRevision((x) => x + 1)
            }}
          />
        ) : null}
        <Button
          variant="primary"
          disabled={status !== 'ready' || !valid || !parentId}
          onClick={() => onChoose({ kind, parentId })}
        >
          {t('open')}
        </Button>
      </div>
    </section>
  )
}
