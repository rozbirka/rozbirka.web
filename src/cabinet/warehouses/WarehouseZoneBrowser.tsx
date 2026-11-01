import { Link, useLocation, useSearchParams, useNavigate } from 'react-router'
import {
  Archive,
  ChevronRight,
  LayoutGrid,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  DataTable,
  EmptyState,
  Pagination,
} from '@/components/app'
import type { WarehouseDetail } from '@/api/inventory'
import { commonMessages, useT } from '@/i18n'
import {
  LocationBrowserHeader,
  LocationName,
  LocationStatusFilter,
} from '../inventory/LocationBrowser'
import { locationBrowserMessages } from '../inventory/location-browser-messages'
import { warehouseMessages } from '../inventory/warehouse-messages'

type Zone = WarehouseDetail['zones'][number]
const PAGE_SIZE = 15

export function WarehouseZoneBrowser({
  zones,
  base,
  partsBase,
  canManage,
  onAdd,
  onEdit,
  onArchive,
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
  unassignedHref: string
  onRestore?: (zone: Zone) => void
  pending?: boolean
}) {
  const navigate = useNavigate()
  const tc = useT(commonMessages)
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

  const zoneContents = (zone: Zone) => {
    return (
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
                label: t('editZone'),
                icon: <Pencil aria-hidden />,
                onSelect: () => onEdit(zone),
              },
              {
                key: 'archive',
                label: t('archiveZoneLabel'),
                icon: <Archive aria-hidden />,
                destructive: true,
                onSelect: () => onArchive(zone),
              },
            ]
      }
    />
  )
  const noZones = physical.length === 0 && !archivedOnly

  return (
    <>
      <section
        aria-label={t('zonesTitle')}
        className="location-browser rz-card"
      >
        <LocationBrowserHeader
          title={t('zonesTitle')}
          lead={noZones || archivedOnly ? undefined : tb('chooseZone')}
          actions={
            <>
              <LocationStatusFilter label={t('statusZones')} />
              {canManage && !archivedOnly ? (
                <Button onClick={onAdd}>
                  <Plus aria-hidden />
                  {t('addZone')}
                </Button>
              ) : null}
            </>
          }
        />
        <>
          {unassigned.length > 0 || !noZones ? (
            <div
              role="group"
              aria-label={tb('zoneList')}
              tabIndex={0}
              className="location-browser__list"
            >
              <DataTable
                embedded
                caption={t('zonesTitle')}
                rows={[
                  ...unassigned,
                  ...visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
                ]}
                rowKey={(zone) => zone.id}
                {...(!archivedOnly && (unassigned.length === 0 || partsBase)
                  ? {
                      onRowClick: (zone: Zone) => {
                        if (zone.isSystemUnassigned) {
                          if (partsBase) void navigate(unassignedHref)
                        } else
                          void navigate(
                            `${base}/zones/${encodeURIComponent(zone.id)}`,
                          )
                      },
                    }
                  : {})}
                columns={[
                  {
                    key: 'name',
                    label: t('colZone'),
                    variant: 'primary',
                    cell: (zone) =>
                      archivedOnly ||
                      (zone.isSystemUnassigned && !partsBase) ? (
                        zoneContents(zone)
                      ) : (
                        <Link
                          aria-label={zone.name}
                          className="location-browser__link"
                          onClick={(event) => event.stopPropagation()}
                          to={
                            zone.isSystemUnassigned
                              ? unassignedHref
                              : `${base}/zones/${encodeURIComponent(zone.id)}`
                          }
                        >
                          {zoneContents(zone)}
                        </Link>
                      ),
                  },
                  {
                    key: 'open',
                    label: tc('actions'),
                    headerHidden: true,
                    align: 'end',
                    cell: (zone) =>
                      !archivedOnly &&
                      (!zone.isSystemUnassigned || partsBase) ? (
                        <ChevronRight
                          aria-hidden
                          className="location-browser__arrow"
                        />
                      ) : null,
                  },
                  ...(canManage
                    ? [
                        {
                          key: 'actions',
                          label: tc('actions'),
                          headerHidden: true,
                          align: 'end' as const,
                          cell: (zone: Zone) =>
                            zone.isSystemUnassigned ? null : (
                              <span
                                onClick={(event) => event.stopPropagation()}
                              >
                                {zoneMenu(zone)}
                              </span>
                            ),
                        },
                      ]
                    : []),
                ]}
                empty={
                  <p className="location-browser__empty">
                    {needle
                      ? tb('noMatches')
                      : t(archivedOnly ? 'noArchivedZones' : 'noZones')}
                  </p>
                }
              />
              {needle && visible.length === 0 && unassigned.length > 0 ? (
                <p className="location-browser__empty">{tb('noMatches')}</p>
              ) : null}
            </div>
          ) : null}
          {visible.length > 0 ? (
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
