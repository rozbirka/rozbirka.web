import { useMemo, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ChevronRight, Plus, Pencil } from 'lucide-react'
import { Button, DataTable, Pagination, SearchInput } from '@/components/app'
import type {
  InventorySection,
  InventoryShelf,
  InventoryZone,
} from '@/api/inventory'
import { useFormat, useT } from '@/i18n'
import { warehouseMessages } from './warehouse-messages'
import { locationBrowserMessages } from './location-browser-messages'
import {
  locationPartsHref,
  type LocationContentsTarget,
} from './location-contents'

import './location-browser.css'

const PAGE_SIZE = 10
const matches = (query: string, name: string, code: string) =>
  !query || `${name} ${code}`.toLocaleLowerCase().includes(query)

export function LocationBrowser({
  zone,
  section,
  sections,
  shelves,
  base,
  canManage,
  canViewParts,
  partsBase,
  onAddSection,
  onAddShelf,
  headerActions,
  onEditShelf,
  selectionNotice,
  printWorkspace,
}: {
  zone: InventoryZone
  section?: InventorySection
  sections: InventorySection[]
  shelves: InventoryShelf[]
  base: string
  canManage: boolean
  canViewParts: boolean
  partsBase: string
  onAddSection: (zone: InventoryZone) => void
  onAddShelf: (section: InventorySection) => void
  headerActions?: ReactNode
  onEditShelf?: ((shelf: InventoryShelf) => void) | undefined
  selectionNotice?: ReactNode
  printWorkspace?: ReactNode
}) {
  const t = useT(locationBrowserMessages)
  const tw = useT(warehouseMessages)
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const query = params.get('locationSearch') ?? ''
  const needle = query.trim().toLocaleLowerCase()
  const visibleSections = sections.filter(
    (item) =>
      item.isActive &&
      item.zoneId === zone.id &&
      matches(needle, item.name, item.code),
  )
  const visibleShelves = shelves.filter(
    (item) =>
      item.isActive &&
      item.zoneId === zone.id &&
      item.sectionId === section?.id &&
      matches(needle, item.name, item.code),
  )
  const shelfCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const shelf of shelves) {
      if (
        !shelf.isActive ||
        shelf.zoneId !== zone.id ||
        shelf.warehouseId !== zone.warehouseId
      )
        continue
      counts.set(shelf.sectionId, (counts.get(shelf.sectionId) ?? 0) + 1)
    }
    return counts
  }, [shelves, zone.id, zone.warehouseId])
  const total = section ? visibleShelves.length : visibleSections.length
  const requestedPage = Number.parseInt(params.get('locationPage') ?? '1', 10)
  const page = Math.min(
    Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
    Math.max(1, Math.ceil(total / PAGE_SIZE)),
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
  const direct: LocationContentsTarget = section
    ? {
        kind: 'direct',
        zoneId: zone.id,
        sectionId: section.id,
        name: t('sectionDirect'),
        path: [zone.warehouseName, zone.name, section.name],
      }
    : {
        kind: 'zone-direct',
        zoneId: zone.id,
        name: t('zoneDirect'),
        path: [zone.warehouseName, zone.name],
      }

  return (
    <div className="location-browser">
      <header className="location-browser__toolbar">
        <div className="min-w-0">
          <h2
            className="location-browser__heading"
            aria-label={`${t(section ? 'shelves' : 'sections')} · ${f.number(total)}`}
          >
            {t(section ? 'shelves' : 'sections')}
            <span className="location-browser__total">{f.number(total)}</span>
          </h2>
          <p className="location-browser__lead">
            {t(
              section
                ? onEditShelf
                  ? 'chooseShelfToEdit'
                  : 'chooseShelf'
                : 'chooseSection',
            )}
          </p>
        </div>
        {printWorkspace ? null : (
          <div className="location-browser__search">
            <SearchInput
              className="min-h-11 text-sm"
              aria-label={t(section ? 'searchShelves' : 'searchSections')}
              placeholder={t('nameOrCode')}
              value={query}
              onChange={(event) =>
                update({
                  locationSearch: event.target.value,
                  locationPage: null,
                })
              }
            />
          </div>
        )}
        <div className="location-browser__actions">
          {canManage ? (
            <Button
              className="px-3 text-[13px] sm:px-4 sm:text-sm"
              variant="primary"
              onClick={() =>
                section ? onAddShelf(section) : onAddSection(zone)
              }
            >
              <Plus aria-hidden />
              {tw(section ? 'addShelf' : 'addSection')}
            </Button>
          ) : null}
          {headerActions}
        </div>
      </header>
      {printWorkspace != null ? (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">{printWorkspace}</div>
      ) : (
        <>
          {selectionNotice ? (
            <div className="px-4 pb-4 sm:px-6">{selectionNotice}</div>
          ) : null}
          {canViewParts ? (
            <div className="location-browser__direct">
              <Link
                className="location-browser__row location-browser__row--direct"
                to={locationPartsHref(partsBase, zone.warehouseId, direct)}
              >
                <span className="min-w-0">
                  <strong className="location-browser__name">
                    {direct.name}
                  </strong>
                  <span className="location-browser__hint">
                    {t(section ? 'sectionDirectHint' : 'zoneDirectHint')}
                  </span>
                </span>
                <span aria-hidden />
                <ChevronRight aria-hidden className="location-browser__arrow" />
              </Link>
            </div>
          ) : null}
          <div
            aria-hidden
            className={`location-browser__columns${section ? ' location-browser__columns--shelves' : ''}`}
          >
            <span>{t(section ? 'shelfName' : 'sections')}</span>
            {section ? null : (
              <span className="text-right">{t('shelves')}</span>
            )}
            <span />
          </div>
          {section ? (
            <div
              key={`shelves:${page}:${needle}`}
              role="group"
              aria-label={t('shelfList')}
              tabIndex={0}
              className="location-browser__list location-browser__shelves"
            >
              <DataTable
                density="compact"
                embedded
                caption={`${t('shelves')}: ${section.name}`}
                columns={[
                  {
                    key: 'name',
                    label: t('shelfName'),
                    variant: 'primary',
                    cell: (shelf) => {
                      const content = (
                        <>
                          <LocationName name={shelf.name} code={shelf.code} />
                          {onEditShelf ? (
                            <Pencil
                              aria-hidden
                              className="location-browser__arrow text-brand"
                            />
                          ) : (
                            <ChevronRight
                              aria-hidden
                              className="location-browser__arrow"
                            />
                          )}
                        </>
                      )
                      const rowClassName =
                        'location-browser__row location-browser__row--shelf'
                      if (onEditShelf)
                        return (
                          <Button
                            variant="quiet"
                            className={rowClassName}
                            aria-label={t('editShelfName', {
                              name: shelf.name,
                            })}
                            onClick={() => onEditShelf(shelf)}
                          >
                            {content}
                          </Button>
                        )
                      return canViewParts ? (
                        <Link
                          to={locationPartsHref(partsBase, zone.warehouseId, {
                            kind: 'shelf',
                            zoneId: zone.id,
                            sectionId: section.id,
                            shelfId: shelf.id,
                            name: shelf.name,
                            path: [],
                          })}
                          aria-label={t('shelfOpen', { name: shelf.name })}
                          className={rowClassName}
                        >
                          {content}
                        </Link>
                      ) : (
                        <span className={rowClassName}>
                          <LocationName name={shelf.name} code={shelf.code} />
                        </span>
                      )
                    },
                  },
                ]}
                rows={visibleShelves.slice(
                  (page - 1) * PAGE_SIZE,
                  page * PAGE_SIZE,
                )}
                rowKey={(shelf) => shelf.id}
                empty={
                  <p className="location-browser__empty">
                    {t(needle ? 'noMatches' : 'noShelves')}
                  </p>
                }
              />
            </div>
          ) : (
            <div
              key={`sections:${page}:${needle}`}
              role="group"
              aria-label={t('sectionList')}
              tabIndex={0}
              className="location-browser__list"
            >
              {visibleSections.length ? (
                visibleSections
                  .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                  .map((item) => {
                    const count = f.number(shelfCounts.get(item.id) ?? 0) ?? '0'
                    return (
                      <div
                        key={item.id}
                        role="group"
                        aria-label={tw('sectionGroup', { name: item.name })}
                        className="location-browser__section"
                      >
                        <Link
                          className="location-browser__row"
                          to={`${base}/sections/${encodeURIComponent(item.id)}`}
                          state={{
                            zoneId: zone.id,
                            zoneQuery: params.toString(),
                          }}
                          aria-label={`${item.name}, ${item.code}`}
                        >
                          <LocationName name={item.name} code={item.code} />
                          <span className="location-browser__count">
                            <span className="sr-only">
                              {t('shelvesCount', { count })}
                            </span>
                            <span aria-hidden>{count}</span>
                            <span
                              aria-hidden
                              className="location-browser__count-label"
                            >
                              {t('shelves')}
                            </span>
                          </span>
                          <ChevronRight
                            aria-hidden
                            className="location-browser__arrow"
                          />
                        </Link>
                      </div>
                    )
                  })
              ) : (
                <p className="location-browser__empty">
                  {t(needle ? 'noMatches' : 'noSections')}
                </p>
              )}
            </div>
          )}
          {total > PAGE_SIZE ? (
            <div className="location-browser__pagination">
              <Pagination
                label={t(section ? 'shelfPagination' : 'sectionPagination')}
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                totalPages={Math.ceil(total / PAGE_SIZE)}
                onPage={(next) =>
                  update({ locationPage: next === 1 ? null : String(next) })
                }
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function LocationName({ name, code }: { name: string; code: string }) {
  return (
    <span className="min-w-0">
      <strong className="location-browser__name">{name}</strong>
      <span className="location-browser__code">{code}</span>
    </span>
  )
}
