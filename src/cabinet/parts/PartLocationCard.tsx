import { Move } from 'lucide-react'
import type { PartInventoryZone } from '@/api/inventory'
import { Button, Card, Notice, SkeletonRows } from '@/components/app'
import { useT } from '@/i18n'
import { commonMessages } from '@/i18n/common-messages'
import { partDetailMessages } from './part-detail-messages'

export function PartLocationCard({
  zones,
  allowed,
  failed,
  inStock,
  canMove,
  onMove,
  onRetry,
}: {
  zones: PartInventoryZone[] | null
  allowed: boolean
  failed: boolean
  inStock: boolean
  canMove: boolean
  onMove: () => void
  onRetry: () => void
}) {
  const t = useT(partDetailMessages)
  const tc = useT(commonMessages)
  const placed = zones ?? []
  return (
    <Card
      title={t('placement')}
      bodyClassName={allowed && !failed && placed.length > 0 ? 'p-0' : ''}
      aside={
        canMove ? (
          <Button size="sm" onClick={onMove}>
            <Move aria-hidden />
            {t('move')}
          </Button>
        ) : undefined
      }
    >
      {!allowed ? (
        <p className="text-app-dim m-0">{t('placementNeedsModule')}</p>
      ) : failed ? (
        <Notice tone="danger" role="alert">
          <p className="m-0">{t('placementFailed')}</p>
          <Button className="mt-2" onClick={onRetry}>
            {tc('retry')}
          </Button>
        </Notice>
      ) : zones === null ? (
        <SkeletonRows rows={2} embedded label={t('loadingShort')} />
      ) : placed.length === 0 ? (
        <p className="text-app-dim m-0">{t('notPlaced')}</p>
      ) : (
        <>
          {!inStock ? (
            <p className="rz-caption m-0 px-4 pt-3">{t('lastPlacement')}</p>
          ) : null}
          <ul className="m-0 grid list-none p-0">
            {placed.map((zone, index) => (
              <li
                key={zone.zoneId}
                className={index ? 'border-app-line border-t' : undefined}
              >
                <dl className="rz-facts">
                  {(
                    [
                      ['locationWarehouse', zone.warehouseName],
                      ['locationZone', zone.zoneName],
                      ['locationSection', zone.sectionName],
                      ['locationShelf', zone.shelfName],
                    ] as const
                  )
                    .filter(
                      ([label, name]) =>
                        Boolean(name) &&
                        (!zone.isSystemUnassigned ||
                          label === 'locationWarehouse'),
                    )
                    .map(([label, name]) => (
                      <div key={label}>
                        <dt>{t(label)}</dt>
                        <dd>{name}</dd>
                      </div>
                    ))}
                </dl>
                {zone.isSystemUnassigned ? (
                  <p className="rz-caption m-0 px-4 pb-3">
                    {t('locationWarehouseLevel')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
