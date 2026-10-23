import { useId, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router'
import { ChevronRight, Plus, Pencil, Rows3, RotateCcw } from 'lucide-react'
import {
  ActionMenu,
  Button,
  Segmented,
  DataTable,
  Pagination,
  SearchInput,
  EmptyState,
} from '@/components/app'
import type {
  InventorySection,
  InventoryShelf,
  InventoryZone,
} from '@/api/inventory'
import { commonMessages, useFormat, useT } from '@/i18n'
import { warehouseMessages } from './warehouse-messages'
import { locationBrowserMessages } from './location-browser-messages'
import { locationPartsHref } from './location-contents'

import './location-browser.css'

const PAGE_SIZE = 15
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

export function LocationStatusFilter({ label }: { label: string }) {
  const t = useT(warehouseMessages)
  const [params, setParams] = useSearchParams()
  const state = useLocation().state as unknown
  const name = useId()
  return (
    <Segmented<'active' | 'archived'>
      label={label}
      name={`location-status-${name}`}
      value={
        params.get('locationStatus') === 'archived' ? 'archived' : 'active'
      }
      options={[
        { value: 'active', label: t('statusActive') },
        { value: 'archived', label: t('statusArchived') },
      ]}
      onChange={(value) =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current)
            if (value === 'archived') next.set('locationStatus', 'archived')
            else next.delete('locationStatus')
            next.delete('locationPage')
            return next
          },
          { replace: true, preventScrollReset: true, state },
        )
      }
    />
  )
}

export function LocationBrowser({
  zone,
  section,
  sections,
  shelves,
  sectionShelfCounts,
  base,
  canManage,
  canViewParts,
  partsBase,
  onAddSection,
  onAddShelf,
  headerActions,
  statusFilter,
  onEditShelf,
  selectionNotice,
  printWorkspace,
  archivedOnly = false,
  onRestoreSection,
  pending = false,
}: {
  zone: InventoryZone
  section?: InventorySection
  sections: InventorySection[]
  shelves: InventoryShelf[]
  /** Active shelves per section, counted over the full collection. */
  sectionShelfCounts: ReadonlyMap<string, number>
  base: string
  canManage: boolean
  canViewParts: boolean
  partsBase: string
  onAddSection: (zone: InventoryZone) => void
  onAddShelf: (section: InventorySection) => void
  headerActions?: ReactNode
  statusFilter?: ReactNode
  onEditShelf?: ((shelf: InventoryShelf) => void) | undefined
  selectionNotice?: ReactNode
  printWorkspace?: ReactNode
  archivedOnly?: boolean
  onRestoreSection?: (section: InventorySection) => void
  pending?: boolean
}) {
  const navigate = useNavigate()
  const tc = useT(commonMessages)
  const t = useT(locationBrowserMessages)
  const f = useFormat()
  const countId = useId()
  const tw = useT(warehouseMessages)
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const query = params.get('locationSearch') ?? ''
  const needle = query.trim().toLocaleLowerCase()
  const visibleSections = sections.filter(
    (item) =>
      item.isActive === !archivedOnly &&
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
    : sections.filter(
        (item) => item.isActive === !archivedOnly && item.zoneId === zone.id,
      ).length
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

  const itemHref = (item: InventorySection | InventoryShelf) =>
    section
      ? locationPartsHref(partsBase, zone.warehouseId, {
          kind: 'shelf',
          zoneId: zone.id,
          sectionId: section.id,
          shelfId: item.id,
          name: item.name,
          path: [],
        })
      : `${base}/sections/${encodeURIComponent(item.id)}`
  const openItem = (item: InventorySection | InventoryShelf) => {
    if (section && onEditShelf) onEditShelf(item as InventoryShelf)
    else if (!section || canViewParts)
      void navigate(itemHref(item), {
        state: section
          ? undefined
          : { zoneId: zone.id, zoneQuery: params.toString() },
      })
  }

  return (
    <div
      className={[
        'location-browser',
        printWorkspace == null && 'location-browser--navigation',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <LocationBrowserHeader
        title={t(section ? 'shelves' : 'sections')}
        count={printWorkspace ? undefined : allCount}
        lead={
          printWorkspace || archivedOnly
            ? undefined
            : section
              ? t(onEditShelf ? 'chooseShelfToEdit' : 'chooseShelf')
              : allCount > 0
                ? t('chooseSection')
                : undefined
        }
        actions={
          <>
            {statusFilter}
            {canManage && !archivedOnly && (allCount > 0 || needle) ? (
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
        <EmptyState
          className="location-browser__placeholder"
          icon={<Rows3 aria-hidden />}
          tone={archivedOnly ? 'neutral' : 'brand'}
          title={
            archivedOnly
              ? tw('noArchivedSections')
              : t(section ? 'noShelves' : 'noSections')
          }
          {...(!archivedOnly
            ? {
                description: t(section ? 'noShelvesHint' : 'noSectionsHint'),
              }
            : {})}
          {...(!archivedOnly && canManage
            ? {
                actions: (
                  <Button
                    onClick={() =>
                      section ? onAddShelf(section) : onAddSection(zone)
                    }
                    variant="primary"
                  >
                    <Plus aria-hidden />
                    {tw(section ? 'addShelf' : 'addSection')}
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
            key={`${section ? 'shelves' : 'sections'}:${page}:${needle}`}
            role="group"
            aria-label={t(section ? 'shelfList' : 'sectionList')}
            tabIndex={0}
            className="location-browser__list"
          >
            <DataTable<InventorySection | InventoryShelf>
              embedded
              caption={
                section ? `${t('shelves')}: ${section.name}` : t('sections')
              }
              rows={(section ? visibleShelves : visibleSections).slice(
                (page - 1) * PAGE_SIZE,
                page * PAGE_SIZE,
              )}
              rowKey={(item) => item.id}
              {...(!archivedOnly && (!section || onEditShelf || canViewParts)
                ? { onRowClick: openItem }
                : {})}
              columns={[
                {
                  key: 'name',
                  label: t(section ? 'shelfName' : 'name'),
                  variant: 'primary',
                  cell: (item) => {
                    const content = (
                      <LocationName name={item.name} code={item.code} />
                    )
                    if (
                      archivedOnly ||
                      (section && !onEditShelf && !canViewParts)
                    )
                      return content
                    if (section && onEditShelf)
                      return (
                        <Button
                          variant="quiet"
                          className="location-browser__link"
                          aria-label={t('editShelfName', { name: item.name })}
                          onClick={(event) => {
                            event.stopPropagation()
                            onEditShelf(item as InventoryShelf)
                          }}
                        >
                          {content}
                        </Button>
                      )
                    return (
                      <Link
                        className="location-browser__link"
                        to={itemHref(item)}
                        state={
                          section
                            ? undefined
                            : { zoneId: zone.id, zoneQuery: params.toString() }
                        }
                        aria-label={
                          section
                            ? t('shelfOpen', { name: item.name })
                            : `${item.name}, ${item.code}`
                        }
                        aria-describedby={
                          section ? undefined : `${countId}-${item.id}-shelves`
                        }
                        onClick={(event) => event.stopPropagation()}
                      >
                        {content}
                      </Link>
                    )
                  },
                },
                ...(!section && !archivedOnly
                  ? [
                      {
                        key: 'shelves',
                        label: t('shelvesColumn'),
                        align: 'end' as const,
                        cell: (item: InventorySection | InventoryShelf) => {
                          const count = sectionShelfCounts.get(item.id)
                          const label =
                            count === undefined ? '—' : f.number(count)
                          return (
                            <>
                              <span
                                id={`${countId}-${item.id}-shelves`}
                                className="sr-only"
                              >{`${t('shelvesColumn')}: ${label}`}</span>
                              <span className="rz-mono">{label}</span>
                            </>
                          )
                        },
                      },
                    ]
                  : []),
                {
                  key: 'open',
                  label: tc('actions'),
                  headerHidden: true,
                  align: 'end',
                  cell: () =>
                    archivedOnly ||
                    (section &&
                      !onEditShelf &&
                      !canViewParts) ? null : section && onEditShelf ? (
                      <Pencil
                        aria-hidden
                        className="location-browser__arrow text-brand"
                      />
                    ) : (
                      <ChevronRight
                        aria-hidden
                        className="location-browser__arrow"
                      />
                    ),
                },
                ...(archivedOnly && canManage && onRestoreSection
                  ? [
                      {
                        key: 'actions',
                        label: tc('actions'),
                        headerHidden: true,
                        align: 'end' as const,
                        cell: (item: InventorySection | InventoryShelf) => (
                          <span onClick={(event) => event.stopPropagation()}>
                            <ActionMenu
                              label={tw('sectionActionsLabel', {
                                name: item.name,
                              })}
                              actions={[
                                {
                                  key: 'restore',
                                  label: tw('restoreLocation'),
                                  icon: <RotateCcw aria-hidden />,
                                  disabled: pending,
                                  onSelect: () => onRestoreSection(item),
                                },
                              ]}
                            />
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
              empty={
                <p className="location-browser__empty">
                  {needle
                    ? t('noMatches')
                    : archivedOnly
                      ? tw('noArchivedSections')
                      : t(section ? 'noShelves' : 'noSections')}
                </p>
              }
            />
          </div>
          {total > 0 ? (
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
