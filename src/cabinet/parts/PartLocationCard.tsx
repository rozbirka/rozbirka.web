import { Warehouse } from 'lucide-react'
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
      aside={
        canMove ? (
          <Button size="sm" onClick={onMove}>
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
            <p className="rz-caption m-0 mb-3">{t('lastPlacement')}</p>
          ) : null}
          <ul className="m-0 grid list-none gap-4 p-0">
            {placed.map((zone, index) => (
              <li
                key={zone.zoneId}
                className={index ? 'border-app-line border-t pt-4' : undefined}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <Warehouse
                    aria-hidden
                    className="text-app-muted mt-0.5 size-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-app-ink m-0 font-semibold [overflow-wrap:anywhere]">
                      {zone.warehouseName}
                    </p>
                    {zone.isSystemUnassigned ? (
                      <p className="rz-caption m-0 mt-1">
                        {t('locationWarehouseLevel')}
                      </p>
                    ) : (
                      <dl className="border-app-line m-0 mt-3 grid gap-2 border-l pl-3">
                        {(
                          [
                            ['locationZone', zone.zoneName],
                            ['locationSection', zone.sectionName],
                            ['locationShelf', zone.shelfName],
                          ] as const
                        )
                          .filter(([, name]) => Boolean(name))
                          .map(([label, name]) => (
                            <div
                              key={label}
                              className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-2"
                            >
                              <dt className="rz-caption">{t(label)}</dt>
                              <dd className="m-0 [overflow-wrap:anywhere]">
                                {name}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
