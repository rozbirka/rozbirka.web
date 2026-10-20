import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Archive, ChevronRight, Pencil, Plus } from 'lucide-react'
import { ActionMenu, Button, Pagination, SearchInput } from '@/components/app'
import type { WarehouseDetail } from '@/api/inventory'
import { useT } from '@/i18n'
import {
  LocationBrowserHeader,
  LocationName,
} from '../inventory/LocationBrowser'
import { locationBrowserMessages } from '../inventory/location-browser-messages'
import { warehouseMessages } from '../inventory/warehouse-messages'

type Zone = WarehouseDetail['zones'][number]
const PAGE_SIZE = 10

export function WarehouseZoneBrowser({
  zones,
  base,
  partsBase,
  canManage,
  onAdd,
  onEdit,
  onArchive,
  headerActions,
  printWorkspace,
  unassignedHref,
}: {
  zones: Zone[]
  base: string
  partsBase: string | null
  canManage: boolean
  onAdd: () => void
  onEdit: (zone: Zone) => void
  onArchive: (zone: Zone) => void
  headerActions: ReactNode
  printWorkspace: ReactNode
  unassignedHref: string
}) {
  const t = useT(warehouseMessages)
  const tb = useT(locationBrowserMessages)
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const query = params.get('locationSearch') ?? ''
  const needle = query.trim().toLocaleLowerCase()
  const physical = zones.filter((zone) => !zone.isSystemUnassigned)
  const visible = physical.filter((zone) =>
    `${zone.name} ${zone.code}`.toLocaleLowerCase().includes(needle),
  )
  const unassigned = zones.filter((zone) => zone.isSystemUnassigned)
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

  const zoneContents = (zone: Zone, navigable = true) => {
    return (
      <>
        <LocationName
          name={zone.name}
          code={[
            zone.code,
            zone.isSystemUnassigned ? t('systemTag') : null,
            zone.isActive ? null : t('archivedZoneTag'),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        {navigable ? (
          <ChevronRight aria-hidden className="location-browser__arrow" />
        ) : (
          <span aria-hidden />
        )}
      </>
    )
  }

  return (
    <section
      aria-label={t('zonesTitle')}
      className="location-browser border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
    >
      <LocationBrowserHeader
        title={t('zonesTitle')}
        lead={tb('chooseZone')}
        search={
          printWorkspace ? null : (
            <SearchInput
              className="min-h-11 text-sm"
              aria-label={tb('searchZones')}
              placeholder={tb('nameOrCode')}
              value={query}
              onChange={(event) =>
                update({
                  locationSearch: event.target.value,
                  locationPage: null,
                })
              }
            />
          )
        }
        actions={
          <>
            {canManage ? (
              <Button
                className="px-3 text-[13px] sm:px-4 sm:text-sm"
                onClick={onAdd}
                variant="primary"
              >
                <Plus aria-hidden />
                {t('addZone')}
              </Button>
            ) : null}
            {headerActions}
          </>
        }
      />
      {printWorkspace ? (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">{printWorkspace}</div>
      ) : (
        <>
          {unassigned.length ? (
            <div className="location-browser__direct">
              {unassigned.map((zone) =>
                partsBase ? (
                  <Link
                    key={zone.id}
                    aria-label={zone.name}
                    className="location-browser__row location-browser__row--plain location-browser__row--direct"
                    to={unassignedHref}
                  >
                    {zoneContents(zone)}
                  </Link>
                ) : (
                  <div
                    key={zone.id}
                    className="location-browser__row location-browser__row--plain"
                  >
                    {zoneContents(zone, false)}
                  </div>
                ),
              )}
            </div>
          ) : null}
          <div
            aria-hidden
            className={`location-browser__columns ${canManage ? 'location-browser__columns--zone-actions' : 'location-browser__columns--plain'}`}
          >
            <span>{t('colZone')}</span>
            <span />
            {canManage ? <span /> : null}
          </div>
          <div
            role="group"
            aria-label={tb('zoneList')}
            tabIndex={0}
            className="location-browser__list"
          >
            {visible.length ? (
              visible
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((zone) => (
                  <div
                    className={`location-browser__section${canManage ? ' location-browser__zone' : ''}`}
                    key={zone.id}
                  >
                    <Link
                      aria-label={zone.name}
                      className="location-browser__row location-browser__row--plain"
                      to={`${base}/zones/${encodeURIComponent(zone.id)}`}
                    >
                      {zoneContents(zone)}
                    </Link>
                    {canManage ? (
                      <ActionMenu
                        label={tb('zoneActions', { name: zone.name })}
                        actions={[
                          {
                            key: 'edit',
                            label: t('editZone', { name: zone.name }),
                            icon: <Pencil aria-hidden />,
                            onSelect: () => onEdit(zone),
                          },
                          {
                            key: 'archive',
                            label: t('archiveZoneLabel', { name: zone.name }),
                            icon: <Archive aria-hidden />,
                            destructive: true,
                            onSelect: () => onArchive(zone),
                          },
                        ]}
                      />
                    ) : null}
                  </div>
                ))
            ) : (
              <p className="location-browser__empty">
                {needle ? tb('noMatches') : t('noZones')}
              </p>
            )}
          </div>
          {totalPages > 1 ? (
            <div className="location-browser__pagination">
              <Pagination
                label={tb('zonePagination')}
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
