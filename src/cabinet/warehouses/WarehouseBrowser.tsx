import { Link, useLocation, useSearchParams } from 'react-router'
import { ChevronRight, Plus, SearchX, Warehouse } from 'lucide-react'
import { Button, EmptyState, Pagination, StateScreen } from '@/components/app'
import type { Warehouse as WarehouseRecord } from '@/api/inventory'
import { useFormat, useT } from '@/i18n'
import {
  LocationBrowserHeader,
  LocationName,
} from '../inventory/LocationBrowser'
import { overviewMessages } from '../inventory/overview-messages'
import { inventoryMessages } from '../inventory/messages'

const PAGE_SIZE = 10

export function WarehouseBrowser({
  warehouses,
  stock,
  base,
  onAdd,
}: {
  warehouses: WarehouseRecord[]
  stock: ReadonlyMap<string, number> | null
  base: string
  /** Offered from the empty state; absent without the permission. */
  onAdd?: (() => void) | undefined
}) {
  const t = useT(overviewMessages)
  const ti = useT(inventoryMessages)
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const query = params.get('locationSearch') ?? ''
  const needle = query.trim().toLocaleLowerCase()
  const visible = warehouses.filter((item) =>
    `${item.name} ${item.code}`.toLocaleLowerCase().includes(needle),
  )
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const requestedPage = Number.parseInt(params.get('locationPage') ?? '1', 10)
  const page = Math.min(
    Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
    totalPages,
  )
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true, preventScrollReset: true, state: navigationState },
    )

  if (warehouses.length === 0)
    return (
      <EmptyState
        icon={<Warehouse aria-hidden />}
        title={t('noWarehousesTitle')}
        description={t('noWarehousesHint')}
        {...(onAdd
          ? {
              actions: (
                <Button onClick={onAdd} variant="primary">
                  <Plus aria-hidden />
                  {t('addWarehouse')}
                </Button>
              ),
            }
          : {})}
      />
    )

  if (visible.length === 0)
    return (
      <StateScreen
        icon={<SearchX aria-hidden />}
        label={t('warehouses')}
        title={t('noWarehouseMatches')}
        className="min-h-[240px]"
      />
    )

  return (
    <section aria-label={t('warehouses')} className="location-browser rz-card">
      <LocationBrowserHeader
        title={t('warehousesList')}
        lead={t('warehousesLead')}
        actions={null}
      />
      <div
        aria-hidden
        className="location-browser__columns location-browser__columns--warehouse"
      >
        <span>{t('columnWarehouse')}</span>
        <div className="location-browser__warehouse-counts text-right">
          <span>{t('columnParts')}</span>
          <span>{t('columnZones')}</span>
        </div>
        <span />
      </div>
      <ul className="location-browser__list m-0 list-none p-0">
        {visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => {
          const parts = stock === null ? null : (stock.get(item.id) ?? 0)
          return (
            <li key={item.id} className="location-browser__section">
              <Link
                className={`location-browser__row location-browser__row--warehouse${item.isActive ? '' : ' location-browser__row--muted'}`}
                to={`${base}/${encodeURIComponent(item.id)}`}
                aria-label={t('openWarehouseLabel', {
                  name: item.name,
                })}
              >
                <LocationName
                  name={item.name}
                  code={[
                    item.code,
                    item.isSystemDefault ? t('defaultTag') : null,
                    item.isActive ? null : t('archivedTag'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <dl className="location-browser__warehouse-counts">
                  <div className="location-browser__count">
                    <dt className="md:sr-only">{t('columnParts')}</dt>
                    <dd
                      className={
                        parts === null
                          ? 'text-app-dim font-sans text-caption'
                          : undefined
                      }
                    >
                      {parts === null
                        ? ti('stockUnavailable')
                        : f.number(parts)}
                    </dd>
                  </div>
                  <div className="location-browser__count">
                    <dt className="md:sr-only">{t('columnZones')}</dt>
                    <dd>{f.number(item.zoneCount)}</dd>
                  </div>
                </dl>
                <ChevronRight aria-hidden className="location-browser__arrow" />
              </Link>
            </li>
          )
        })}
      </ul>
      {totalPages > 1 ? (
        <div className="location-browser__pagination">
          <Pagination
            label={t('warehousePagination')}
            page={page}
            pageSize={PAGE_SIZE}
            total={visible.length}
            totalPages={totalPages}
            onPage={(next) =>
              update({ locationPage: next === 1 ? null : String(next) })
            }
          />
        </div>
      ) : null}
    </section>
  )
}
