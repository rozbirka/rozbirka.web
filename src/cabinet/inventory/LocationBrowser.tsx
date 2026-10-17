import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ChevronRight, Plus, LayoutGrid, Rows3, Package } from 'lucide-react'
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

function LocationCount({ count }: { count: number | null | undefined }) {
  const t = useT(locationBrowserMessages)
  const f = useFormat()
  return (
    <span
      className="flex min-w-14 shrink-0 flex-col items-end gap-0.5"
      role="group"
      aria-label={t('positionCount', { count: count ?? '—' })}
    >
      <span className="text-app-ink text-lg leading-6 font-bold tabular-nums">
        {count == null ? '—' : f.number(count)}
      </span>
      <span className="text-app-muted text-xs font-medium">
        {t('positionsLabel')}
      </span>
    </span>
  )
}

const PAGE_SIZE = 10
const matches = (query: string, name: string, code: string) =>
  !query || `${name} ${code}`.toLocaleLowerCase().includes(query)

export function LocationBrowser({
  zone,
  section,
  sections,
  shelves,
  directCount,
  base,
  canManage,
  canViewParts,
  partsBase,
  onAddSection,
  onAddShelf,
  sectionActions,
  shelfActions,
}: {
  zone: InventoryZone
  section?: InventorySection
  sections: InventorySection[]
  shelves: InventoryShelf[]
  directCount: number | null
  base: string
  canManage: boolean
  canViewParts: boolean
  partsBase: string
  onAddSection: (zone: InventoryZone) => void
  onAddShelf: (section: InventorySection) => void
  sectionActions: (section: InventorySection) => ReactNode
  shelfActions: (shelf: InventoryShelf) => ReactNode
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
        <div className="flex items-center gap-2">
          {section ? sectionActions(section) : null}
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
        </div>
      </div>
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
      {canViewParts && directCount !== 0 ? (
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
          <LocationCount count={directCount} />
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
                  cell: (shelf) =>
                    canViewParts ? (
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
                        className="group text-app-ink focus-visible:outline-brand flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-control py-1 text-left"
                      >
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
                        <ChevronRight
                          aria-hidden
                          className="text-app-muted group-hover:text-brand size-5 shrink-0"
                        />
                      </Link>
                    ) : (
                      <span className="text-app-ink block break-words">
                        {shelf.name}
                        <span className="text-app-muted block break-all text-xs">
                          {shelf.code}
                        </span>
                      </span>
                    ),
                },
                {
                  key: 'parts',
                  label: t('parts'),
                  align: 'end',
                  cell: (shelf) => (
                    <span className="text-app-ink text-lg font-bold tabular-nums">
                      {shelf.partCount == null
                        ? '—'
                        : f.number(shelf.partCount)}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: t('actions'),
                  align: 'end',
                  headerHidden: true,
                  cell: shelfActions,
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
                    state={{ zoneId: zone.id, zoneQuery: params.toString() }}
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
                        {item.code}
                      </span>
                      <span className="text-app-muted mt-1 block text-sm tabular-nums sm:hidden">
                        {t('positionCount', { count: item.partCount ?? '—' })}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="text-app-muted group-hover:text-brand size-5 shrink-0"
                    />
                  </Link>
                  {canViewParts ? (
                    <Link
                      to={locationPartsHref(partsBase, zone.warehouseId, {
                        kind: 'section',
                        zoneId: zone.id,
                        sectionId: item.id,
                        name: item.name,
                        path: [],
                      })}
                      aria-label={t('sectionParts', { name: item.name })}
                      className="focus-visible:outline-brand hover:bg-app-input hidden min-h-14 shrink-0 items-center rounded-control px-3 sm:flex"
                    >
                      <LocationCount count={item.partCount} />
                    </Link>
                  ) : (
                    <span className="hidden sm:block">
                      <LocationCount count={item.partCount} />
                    </span>
                  )}
                  {sectionActions(item)}
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
    </div>
  )
}
