import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
  Archive,
  ChevronRight,
  LayoutGrid,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { ActionMenu, Button, EmptyState, Pagination } from '@/components/app'
import type { WarehouseDetail } from '@/api/inventory'
import { useT } from '@/i18n'
import {
  LocationBrowserHeader,
  LocationName,
  LocationStatusFilter,
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
  onRestore,
  pending = false,
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
  onRestore?: (zone: Zone) => void
  pending?: boolean
}) {
  const t = useT(warehouseMessages)
  const tb = useT(locationBrowserMessages)
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const archivedOnly = params.get('locationStatus') === 'archived'
  const query = params.get('locationSearch') ?? ''
  const needle = query.trim().toLocaleLowerCase()
  const physical = zones.filter(
    (zone) => !zone.isSystemUnassigned && zone.isActive === !archivedOnly,
  )
  const visible = physical.filter((zone) =>
    `${zone.name} ${zone.code}`.toLocaleLowerCase().includes(needle),
  )
  const unassigned = archivedOnly
    ? []
    : zones.filter((zone) => zone.isSystemUnassigned)
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

  const zoneMenu = (zone: Zone) => (
    <ActionMenu
      label={tb('zoneActions', { name: zone.name })}
      actions={
        archivedOnly
          ? onRestore
            ? [
                {
                  key: 'restore',
                  label: t('restoreLocation'),
                  icon: <RotateCcw aria-hidden />,
                  disabled: pending,
                  onSelect: () => onRestore(zone),
                },
              ]
            : []
          : [
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
            ]
      }
    />
  )
  const noZones = physical.length === 0 && !printWorkspace && !archivedOnly

  return (
    <>
      <section
        aria-label={t('zonesTitle')}
        className="location-browser rz-card"
      >
        <LocationBrowserHeader
          title={t('zonesTitle')}
          lead={
            noZones || printWorkspace || archivedOnly
              ? undefined
              : tb('chooseZone')
          }
          actions={
            <>
              {!printWorkspace ? (
                <LocationStatusFilter label={t('statusZones')} />
              ) : null}
              {canManage && !archivedOnly ? (
                <Button onClick={onAdd}>
                  <Plus aria-hidden />
                  {t('addZone')}
                </Button>
              ) : null}
              {archivedOnly ? null : headerActions}
            </>
          }
        />
        {printWorkspace ? (
          <div className="p-[var(--rz-card-p)]">{printWorkspace}</div>
        ) : (
          <>
            <div
              aria-hidden
              className={`location-browser__columns ${canManage ? 'location-browser__columns--zone-actions' : 'location-browser__columns--plain'}`}
            >
              <span>{t('colZone')}</span>
              <span />
              {canManage ? <span /> : null}
            </div>
            {unassigned.length ? (
              <div className="location-browser__direct">
                {unassigned.map((zone) => {
                  const row = partsBase ? (
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
                  )
                  return canManage ? (
                    <div
                      className="location-browser__section location-browser__zone"
                      key={zone.id}
                    >
                      {row}
                      <span aria-hidden />
                    </div>
                  ) : (
                    row
                  )
                })}
              </div>
            ) : null}
            {noZones ? null : (
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
                        {archivedOnly ? (
                          <div className="location-browser__row location-browser__row--plain">
                            {zoneContents(zone, false)}
                          </div>
                        ) : (
                          <Link
                            aria-label={zone.name}
                            className={`location-browser__row location-browser__row--plain${zone.isActive ? '' : ' location-browser__row--muted'}`}
                            to={`${base}/zones/${encodeURIComponent(zone.id)}`}
                          >
                            {zoneContents(zone)}
                          </Link>
                        )}
                        {canManage ? zoneMenu(zone) : null}
                      </div>
                    ))
                ) : (
                  <p className="location-browser__empty">
                    {needle
                      ? tb('noMatches')
                      : t(archivedOnly ? 'noArchivedZones' : 'noZones')}
                  </p>
                )}
              </div>
            )}
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
      {noZones ? (
        <EmptyState
          icon={<LayoutGrid aria-hidden />}
          title={t('noZones')}
          {...(canManage
            ? {
                actions: (
                  <Button onClick={onAdd} variant="primary">
                    <Plus aria-hidden />
                    {t('addZone')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : null}
    </>
  )
}
