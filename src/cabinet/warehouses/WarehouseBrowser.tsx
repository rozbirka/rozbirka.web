import { Link, useLocation, useSearchParams, useNavigate } from 'react-router'
import { ChevronRight, Plus, SearchX, Warehouse } from 'lucide-react'
import {
  Button,
  DataTable,
  EmptyState,
  Pagination,
  StateScreen,
} from '@/components/app'
import type { Warehouse as WarehouseRecord } from '@/api/inventory'
import { commonMessages, useFormat, useT } from '@/i18n'
import {
  LocationBrowserHeader,
  LocationName,
} from '../inventory/LocationBrowser'
import { overviewMessages } from '../inventory/overview-messages'
import { inventoryMessages } from '../inventory/messages'

const PAGE_SIZE = 15

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
  const navigate = useNavigate()
  const tc = useT(commonMessages)
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
      <DataTable
        embedded
        caption={t('warehousesList')}
        rows={visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
        rowKey={(item) => item.id}
        onRowClick={(item) =>
          void navigate(`${base}/${encodeURIComponent(item.id)}`)
        }
        columns={[
          {
            key: 'name',
            label: t('columnWarehouse'),
            variant: 'primary',
            cell: (item) => (
              <Link
                className="location-browser__link"
                to={`${base}/${encodeURIComponent(item.id)}`}
                onClick={(event) => event.stopPropagation()}
                aria-label={t('openWarehouseLabel', { name: item.name })}
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
              </Link>
            ),
          },
          {
            key: 'parts',
            label: t('columnParts'),
            align: 'end',
            cell: (item) =>
              stock === null
                ? ti('stockUnavailable')
                : f.number(stock.get(item.id) ?? 0),
          },
          {
            key: 'zones',
            label: t('columnZones'),
            align: 'end',
            cell: (item) => f.number(item.zoneCount),
          },
          {
            key: 'open',
            label: tc('actions'),
            headerHidden: true,
            align: 'end',
            cell: () => (
              <ChevronRight aria-hidden className="location-browser__arrow" />
            ),
          },
        ]}
      />
      {visible.length > 0 ? (
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
