import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ChevronRight, Plus, Pencil } from 'lucide-react'
import { Button, DataTable, Pagination, SearchInput } from '@/components/app'
import type {
  InventorySection,
  InventoryShelf,
  InventoryZone,
} from '@/api/inventory'
import { useT } from '@/i18n'
import { warehouseMessages } from './warehouse-messages'
import { locationBrowserMessages } from './location-browser-messages'
import { locationPartsHref } from './location-contents'

import './location-browser.css'

const PAGE_SIZE = 10
const matches = (query: string, name: string, code: string) =>
  !query || `${name} ${code}`.toLocaleLowerCase().includes(query)

export function LocationBrowserHeader({
  title,
  lead,
  search,
  actions,
}: {
  title: string
  lead: string
  search?: ReactNode
  actions: ReactNode
}) {
  return (
    <header className="location-browser__toolbar">
      <div className="min-w-0">
        <h2 className="location-browser__heading">{title}</h2>
        <p className="location-browser__lead">{lead}</p>
      </div>
      {search ? <div className="location-browser__search">{search}</div> : null}
      <div className="location-browser__actions">{actions}</div>
    </header>
  )
}

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

  return (
    <div className="location-browser">
      <LocationBrowserHeader
        title={t(section ? 'shelves' : 'sections')}
        lead={t(
          section
            ? onEditShelf
              ? 'chooseShelfToEdit'
              : 'chooseShelf'
            : 'chooseSection',
        )}
        search={
          printWorkspace ? null : (
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
          )
        }
        actions={
          <>
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
          </>
        }
      />
      {printWorkspace != null ? (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">{printWorkspace}</div>
      ) : (
        <>
          {selectionNotice ? (
            <div className="px-4 pb-4 sm:px-6">{selectionNotice}</div>
          ) : null}
          <div
            aria-hidden
            className="location-browser__columns location-browser__columns--plain"
          >
            <span>{t(section ? 'shelfName' : 'sections')}</span>
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
                        'location-browser__row location-browser__row--plain'
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
                    return (
                      <div
                        key={item.id}
                        role="group"
                        aria-label={tw('sectionGroup', { name: item.name })}
                        className="location-browser__section"
                      >
                        <Link
                          className="location-browser__row location-browser__row--plain"
                          to={`${base}/sections/${encodeURIComponent(item.id)}`}
                          state={{
                            zoneId: zone.id,
                            zoneQuery: params.toString(),
                          }}
                          aria-label={`${item.name}, ${item.code}`}
                        >
                          <LocationName name={item.name} code={item.code} />
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

export function LocationName({ name, code }: { name: string; code: string }) {
  return (
    <span className="min-w-0">
      <strong className="location-browser__name">{name}</strong>
      <span className="location-browser__code">{code}</span>
    </span>
  )
}
