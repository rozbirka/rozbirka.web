import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ChevronRight, Plus, Pencil, Rows3 } from 'lucide-react'
import {
  Button,
  DataTable,
  Pagination,
  SearchInput,
  StateScreen,
} from '@/components/app'
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

/**
 * The head row of a location card: title with its count, a hint under it and
 * the card's own actions opposite (`.rz-card__head` in the v2 reference).
 */
export function LocationBrowserHeader({
  title,
  count,
  lead,
  actions,
}: {
  title: string
  /** Shown dim beside the title: "Секції 3". */
  count?: ReactNode
  lead?: string | undefined
  actions: ReactNode
}) {
  return (
    <header className="location-browser__toolbar">
      <div className="min-w-0">
        <div className="location-browser__heading">
          <h2 className="rz-h-card">{title}</h2>
          {count === undefined || count === null ? null : (
            <span className="location-browser__count-total rz-mono">
              {count}
            </span>
          )}
        </div>
        {lead ? <p className="location-browser__lead">{lead}</p> : null}
      </div>
      <div className="location-browser__actions">{actions}</div>
    </header>
  )
}

/**
 * The page toolbar search that filters the location list below it. The query
 * lives in the URL (`locationSearch`), so the list and the search can sit in
 * different places on the page and still agree.
 */
export function LocationSearch({
  label,
  placeholder,
  end,
}: {
  label: string
  placeholder: string
  /** A caption at the far end of the toolbar. */
  end?: ReactNode
}) {
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  return (
    <div className="rz-toolbar" role="search">
      <SearchInput
        aria-label={label}
        className="flex-[0_1_320px]"
        placeholder={placeholder}
        value={params.get('locationSearch') ?? ''}
        onChange={(event) =>
          setParams(
            (current) => {
              const next = new URLSearchParams(current)
              if (event.target.value)
                next.set('locationSearch', event.target.value)
              else next.delete('locationSearch')
              next.delete('locationPage')
              return next
            },
            { replace: true, preventScrollReset: true, state: navigationState },
          )
        }
      />
      {end ? <span className="rz-toolbar__end rz-caption">{end}</span> : null}
    </div>
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
  /** Everything the card holds, before the search narrows it. */
  const allCount = section
    ? shelves.filter(
        (item) =>
          item.isActive &&
          item.zoneId === zone.id &&
          item.sectionId === section.id,
      ).length
    : sections.filter((item) => item.isActive && item.zoneId === zone.id).length
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
        count={printWorkspace ? undefined : allCount}
        lead={
          section
            ? t(onEditShelf ? 'chooseShelfToEdit' : 'chooseShelf')
            : undefined
        }
        actions={
          <>
            {canManage && (section || allCount > 0 || needle) ? (
              <Button
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
        <div className="p-[var(--rz-card-p)]">{printWorkspace}</div>
      ) : allCount === 0 && !needle ? (
        <StateScreen
          className="location-browser__placeholder"
          icon={<Rows3 aria-hidden />}
          title={t(section ? 'noShelves' : 'noSections')}
          {...(!section
            ? {
                tone: 'brand' as const,
                className: 'location-browser__placeholder min-h-[360px]',
              }
            : {})}
          {...(!section && canManage
            ? {
                actions: (
                  <Button onClick={() => onAddSection(zone)} variant="primary">
                    <Plus aria-hidden />
                    {tw('addSection')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <>
          {selectionNotice ? (
            <div className="px-[var(--rz-card-p)] pt-3 pb-1">
              {selectionNotice}
            </div>
          ) : null}
          <div
            aria-hidden
            className="location-browser__columns location-browser__columns--plain"
          >
            <span>{t('name')}</span>
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

/** A location's name with its mono code on the same line. */
export function LocationName({ name, code }: { name: string; code: string }) {
  return (
    <span className="location-browser__label">
      <strong className="location-browser__name">{name}</strong>
      {code ? <span className="location-browser__code">{code}</span> : null}
    </span>
  )
}
