import { useMemo, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
  ChevronRight,
  Plus,
  LayoutGrid,
  Rows3,
  Package,
  Pencil,
} from 'lucide-react'
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
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-app-ink text-xl font-bold tracking-[-0.01em]">
          {t(section ? 'shelves' : 'sections')} ·{' '}
          {f.number(section ? visibleShelves.length : visibleSections.length)}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button
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
      </div>
      {printWorkspace ?? (
        <>
          <SearchInput
            className="min-h-12 text-base"
            aria-label={t(section ? 'searchShelves' : 'searchSections')}
            placeholder={t(
              section ? 'searchShelfPlaceholder' : 'searchSectionPlaceholder',
            )}
            value={query}
            onChange={(event) =>
              update({ locationSearch: event.target.value, locationPage: null })
            }
          />
          {selectionNotice}
          {canViewParts ? (
            <Link
              className="group bg-app-input text-app-ink hover:bg-app-overlay focus-visible:outline-brand flex min-h-20 w-full cursor-pointer items-center gap-3 rounded-control px-4 py-3 text-left transition-colors motion-reduce:transition-none"
              to={locationPartsHref(partsBase, zone.warehouseId, direct)}
            >
              <span className="text-app-muted hidden size-10 shrink-0 place-items-center sm:grid">
                <Package aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block break-words text-base font-bold">
                  {direct.name}
                </strong>
                <span className="text-app-muted mt-1 block text-sm leading-5">
                  {t(section ? 'sectionDirectHint' : 'zoneDirectHint')}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="text-app-muted group-hover:text-brand size-5 shrink-0"
              />
            </Link>
          ) : null}
          {section ? (
            <>
              <div
                key={`shelves:${page}:${needle}`}
                role="group"
                aria-label={t('shelfList')}
                tabIndex={0}
                className="min-w-0 max-h-[36rem] overflow-auto overscroll-contain [scrollbar-gutter:stable] [&_thead_th]:text-app-muted [&_thead_th]:font-sans [&_thead_th]:text-sm [&_thead_th]:font-semibold [&_thead_th]:tracking-normal [&_thead_th]:normal-case"
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
                            <span className="bg-app-input text-app-muted hidden size-10 shrink-0 place-items-center rounded-control sm:grid">
                              <Rows3 aria-hidden className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block break-words text-base font-bold sm:text-lg">
                                {shelf.name}
                              </strong>
                              <span className="text-app-muted mt-1 block break-all text-sm font-normal">
                                {shelf.code}
                              </span>
                            </span>
                            {onEditShelf ? (
                              <Pencil
                                aria-hidden
                                className="text-brand size-5 shrink-0"
                              />
                            ) : (
                              <ChevronRight
                                aria-hidden
                                className="text-app-muted group-hover:text-brand size-5 shrink-0"
                              />
                            )}
                          </>
                        )
                        const rowClassName =
                          'group text-app-ink focus-visible:outline-brand flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-control py-1 text-left'
                        if (onEditShelf)
                          return (
                            <Button
                              variant="quiet"
                              className={`${rowClassName} px-0 whitespace-normal`}
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
                          <span className="text-app-ink block break-words">
                            {shelf.name}
                            <span className="text-app-muted block break-all text-xs">
                              {shelf.code}
                            </span>
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
                    <p className="text-app-muted px-4 py-6 text-sm">
                      {t(needle ? 'noMatches' : 'noShelves')}
                    </p>
                  }
                />
              </div>
            </>
          ) : (
            <div
              key={`sections:${page}:${needle}`}
              role="group"
              aria-label={t('sectionList')}
              tabIndex={0}
              className="min-w-0 max-h-[36rem] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            >
              {visibleSections.length ? (
                visibleSections
                  .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                  .map((item) => (
                    <div
                      key={item.id}
                      role="group"
                      aria-label={tw('sectionGroup', { name: item.name })}
                      className="group border-app-line hover:bg-app-overlay/40 flex min-w-0 items-center gap-2 border-b py-1 pr-2 transition-colors last:border-0 motion-reduce:transition-none"
                    >
                      <Link
                        className="focus-visible:outline-brand grid min-h-20 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-control px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4"
                        to={`${base}/sections/${encodeURIComponent(item.id)}`}
                        state={{
                          zoneId: zone.id,
                          zoneQuery: params.toString(),
                        }}
                        aria-label={`${item.name}, ${item.code}`}
                      >
                        <span className="bg-app-input text-app-muted hidden size-10 shrink-0 place-items-center rounded-control sm:grid">
                          <LayoutGrid aria-hidden className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <strong className="text-app-ink block break-words text-base font-bold sm:text-lg">
                            {item.name}
                          </strong>
                          <span className="text-app-muted mt-1 block break-all text-sm">
                            {item.code} ·{' '}
                            {t('shelvesCount', {
                              count:
                                f.number(shelfCounts.get(item.id) ?? 0) ?? '0',
                            })}
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden
                          className="text-app-muted group-hover:text-brand size-5 shrink-0"
                        />
                      </Link>
                    </div>
                  ))
              ) : (
                <p className="text-app-muted px-3 py-6 text-sm">
                  {t(needle ? 'noMatches' : 'noSections')}
                </p>
              )}
            </div>
          )}
          {total > PAGE_SIZE ? (
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
          ) : null}
        </>
      )}
    </div>
  )
}
