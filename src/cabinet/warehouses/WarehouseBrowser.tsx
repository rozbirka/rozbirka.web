import { Link, useLocation, useSearchParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { EmptyState, Pagination, SearchInput } from '@/components/app'
import type { Warehouse } from '@/api/inventory'
import { useFormat, useT } from '@/i18n'
import {
  LocationBrowserHeader,
  LocationName,
} from '../inventory/LocationBrowser'
import { overviewMessages } from '../inventory/overview-messages'
import { inventoryMessages } from '../inventory/messages'
import { locationBrowserMessages } from '../inventory/location-browser-messages'

const PAGE_SIZE = 10

export function WarehouseBrowser({
  warehouses,
  stock,
  base,
}: {
  warehouses: Warehouse[]
  stock: ReadonlyMap<string, number> | null
  base: string
}) {
  const t = useT(overviewMessages)
  const ti = useT(inventoryMessages)
  const tb = useT(locationBrowserMessages)
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

  return (
    <section
      aria-label={t('warehouses')}
      className="location-browser border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
    >
      <LocationBrowserHeader
        title={t('warehousesList')}
        lead={t('warehousesLead')}
        search={
          <SearchInput
            className="min-h-11 text-sm"
            aria-label={t('searchWarehouses')}
            placeholder={tb('nameOrCode')}
            value={query}
            onChange={(event) =>
              update({ locationSearch: event.target.value, locationPage: null })
            }
          />
        }
        actions={null}
      />
      {warehouses.length === 0 ? (
        <EmptyState
          title={t('noWarehousesTitle')}
          description={t('noWarehousesHint')}
        />
      ) : (
        <>
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
          <ul className="location-browser__list">
            {visible.length ? (
              visible
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((item) => {
                  const parts =
                    stock === null ? null : (stock.get(item.id) ?? 0)
                  return (
                    <li key={item.id} className="location-browser__section">
                      <Link
                        className="location-browser__row location-browser__row--warehouse"
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
                            <dt className="text-app-muted text-[11px] lowercase md:sr-only">
                              {t('columnParts')}
                            </dt>
                            <dd
                              className={
                                parts === null
                                  ? 'text-app-muted font-sans text-[11px]'
                                  : undefined
                              }
                            >
                              {parts === null
                                ? ti('stockUnavailable')
                                : f.number(parts)}
                            </dd>
                          </div>
                          <div className="location-browser__count">
                            <dt className="text-app-muted text-[11px] lowercase md:sr-only">
                              {t('columnZones')}
                            </dt>
                            <dd>{f.number(item.zoneCount)}</dd>
                          </div>
                        </dl>
                        <ChevronRight
                          aria-hidden
                          className="location-browser__arrow"
                        />
                      </Link>
                    </li>
                  )
                })
            ) : (
              <li className="location-browser__empty">
                {t('noWarehouseMatches')}
              </li>
            )}
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
        </>
      )}
    </section>
  )
}
