import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { CircleCheck } from 'lucide-react'
import {
  Button,
  DataTable,
  EmptyState,
  Notice,
  Pagination,
  SearchInput,
  SkeletonRows,
  StatusPill,
} from '@/components/app'
import { partsApi, type PartSearchItem } from '@/api/parts'
import type { Page } from '@/api/contracts'
import { commonMessages, useFormat, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { locationContentsMessages } from './location-contents-messages'
import {
  locationPartsFilter,
  type LocationContentsTarget,
} from './location-contents'
import './location-parts.css'
import {
  hasPlacementStock,
  warehouseStockStatuses,
} from '../warehouses/placement-availability'

interface Props {
  target: LocationContentsTarget
  context: 'sheet' | 'section' | 'unassigned'
  refreshKey?: number
  emptyText?: string
  /** The card title; the target's own name when absent. */
  title?: string
  /** A caption at the far end of the search toolbar. */
  searchHint?: ReactNode
  selection?:
    | {
        parts: ReadonlyMap<string, PartSearchItem>
        onChange: (parts: ReadonlyMap<string, PartSearchItem>) => void
        actions: ReactNode
      }
    | undefined
}
interface ResultState {
  key: string
  data?: Page<PartSearchItem>
  error?: boolean
}

export function LocationPartsList(props: Props) {
  const { status, targetTenant, snapshot } = useCabinet()
  const t = useT(locationContentsMessages)
  if (
    status !== 'ready' ||
    !targetTenant ||
    !snapshot?.permissions.has('parts.view')
  )
    return <Notice>{t('forbidden')}</Notice>
  const owner = `${snapshot.userId}:${snapshot.tenantId}:${snapshot.generation}`
  return (
    <OwnedLocationPartsList
      key={`${owner}:${JSON.stringify(props.target)}:${props.context}`}
      {...props}
      owner={owner}
      slug={targetTenant.slug}
    />
  )
}

function OwnedLocationPartsList({
  target,
  context,
  owner,
  slug,
  refreshKey = 0,
  emptyText,
  selection,
  title,
  searchHint,
}: Props & { owner: string; slug: string }) {
  const t = useT(locationContentsMessages)
  const tc = useT(commonMessages)
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const prefix =
    context === 'sheet'
      ? 'locationContents'
      : context === 'unassigned'
        ? 'unassigned'
        : 'locationParts'
  const query = params.get(`${prefix}Search`) ?? ''
  const requestedPage = Number.parseInt(params.get(`${prefix}Page`) ?? '1', 10)
  const page = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1)
  const pageSize = context === 'unassigned' ? 20 : 10
  const [debounced, setDebounced] = useState(query)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<ResultState>({ key: '' })
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timeout)
  }, [query])
  const serializedFilter = JSON.stringify({
    ...locationPartsFilter(target, debounced, page, pageSize),
    ...(context === 'unassigned' ? { statuses: warehouseStockStatuses } : {}),
  })
  const filter = useMemo(
    () =>
      JSON.parse(serializedFilter) as ReturnType<typeof locationPartsFilter>,
    [serializedFilter],
  )
  const key = JSON.stringify([owner, filter, revision, refreshKey])
  useEffect(() => {
    if (query !== debounced) return
    const controller = new AbortController()
    void partsApi.search(filter, { signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted) return
        const last = Math.max(1, Math.ceil(data.total / pageSize))
        if (page > last) {
          setParams(
            (current) => {
              const next = new URLSearchParams(current)
              next.set(`${prefix}Page`, String(last))
              return next
            },
            { replace: true, preventScrollReset: true, state: navigationState },
          )
          return
        }
        setState({ key, data })
      },
      () => {
        if (!controller.signal.aborted) setState({ key, error: true })
      },
    )
    return () => controller.abort()
  }, [
    filter,
    key,
    page,
    pageSize,
    prefix,
    query,
    debounced,
    setParams,
    navigationState,
  ])
  const current = state.key === key && query === debounced ? state : undefined
  const data = current?.data
  const items =
    data?.items.filter(
      (part) => context !== 'unassigned' || hasPlacementStock(part),
    ) ?? []
  const placementBlock = (part: PartSearchItem) =>
    !hasPlacementStock(part)
      ? t('placementNoStock')
      : part.isInventoryLocked
        ? t('placementLocked')
        : undefined
  const setQuery = (value: string) =>
    setParams(
      (currentParams) => {
        const next = new URLSearchParams(currentParams)
        next.set(`${prefix}Search`, value)
        next.delete(`${prefix}Page`)
        return next
      },
      { replace: true, preventScrollReset: true, state: navigationState },
    )
  /* Nothing to place at all: the list gives way to one calm state, without a
     search that could only ever find nothing. */
  const settledEmpty =
    context === 'unassigned' &&
    data?.total === 0 &&
    query.trim() === '' &&
    page === 1
  return (
    <div
      className={`grid min-w-0 content-start gap-[14px]${context === 'unassigned' ? ' location-parts--unassigned' : ''}`}
    >
      {selection?.actions}
      <div className="rz-toolbar" hidden={settledEmpty} role="search">
        <SearchInput
          className="flex-[0_1_320px]"
          aria-label={t('search')}
          placeholder={t('search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searchHint ? (
          <span className="rz-toolbar__end rz-caption">{searchHint}</span>
        ) : null}
      </div>
      {!current ? (
        <SkeletonRows rows={3} />
      ) : current.error ? (
        <Notice tone="danger">
          {t('failed')}{' '}
          <Button onClick={() => setRevision((value) => value + 1)}>
            {tc('retry')}
          </Button>
        </Notice>
      ) : settledEmpty ? (
        <EmptyState
          icon={<CircleCheck aria-hidden />}
          title={emptyText ?? t('empty')}
        />
      ) : data ? (
        <section
          aria-label={title ?? target.name}
          className="rz-card location-parts__card"
        >
          <header className="rz-card__head">
            <h2 className="rz-h-card flex flex-wrap items-baseline gap-1">
              {title ?? target.name}
              <span className="rz-dim rz-mono font-normal">
                {title
                  ? f.number(data.total)
                  : t('positions', { count: data.total })}
              </span>
            </h2>
          </header>
          <div
            className={`location-parts__table${context === 'unassigned' && items.length === pageSize ? ' location-parts__table--full' : ''}`}
          >
            <DataTable
              embedded
              caption={target.name}
              rows={items}
              rowKey={(part) => part.id}
              {...(selection
                ? {
                    selection: {
                      selected: new Set(selection.parts.keys()),
                      rowLabel: (part: PartSearchItem) =>
                        t('selectPart', { name: part.name }),
                      unavailable: placementBlock,
                      selectOnRowClick: context === 'unassigned',
                      onChange: (ids: ReadonlySet<string>) => {
                        const next = new Map(selection.parts)
                        for (const id of next.keys())
                          if (!ids.has(id)) next.delete(id)
                        for (const part of items) {
                          if (ids.has(part.id) && !placementBlock(part))
                            next.set(part.id, part)
                        }
                        selection.onChange(next)
                      },
                    },
                  }
                : {})}
              columns={[
                {
                  key: 'name',
                  label: t('name'),
                  variant: 'primary',
                  cell: (part) => (
                    <span className="rz-cell-main">
                      <Link
                        to={cabinetPath(slug, 'parts', part.id)}
                        title={
                          context === 'unassigned'
                            ? [part.name, part.oemCode]
                                .filter(Boolean)
                                .join(' · ')
                            : undefined
                        }
                        className="text-app-strong hover:text-brand-text"
                      >
                        {part.name}
                      </Link>
                      {part.oemCode ? (
                        <span className="rz-mono rz-dim">{part.oemCode}</span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  key: 'quantity',
                  label: t('quantity'),
                  align: 'end',
                  cell: (part) => (
                    <span className="rz-mono">{f.number(part.quantity)}</span>
                  ),
                },
                {
                  key: 'status',
                  label: t('status'),
                  cell: (part) => (
                    <StatusPill
                      tone={
                        part.status === 'reserved'
                          ? 'warn'
                          : part.status === 'sold'
                            ? 'danger'
                            : 'ok'
                      }
                    >
                      {t(
                        part.status === 'reserved'
                          ? 'reserved'
                          : part.status === 'sold'
                            ? 'sold'
                            : 'available',
                      )}
                    </StatusPill>
                  ),
                },
              ]}
              empty={
                <p className="text-app-muted m-0 px-[var(--rz-card-p)] py-5">
                  {context === 'unassigned' && query.trim()
                    ? t('noMatches')
                    : (emptyText ?? t('empty'))}
                </p>
              }
              footer={
                data.total > pageSize || context === 'unassigned' ? (
                  <div
                    className={
                      context === 'unassigned'
                        ? 'location-parts__pager'
                        : 'border-app-line border-t px-[var(--rz-card-p)] py-2.5'
                    }
                  >
                    <Pagination
                      page={page}
                      totalPages={Math.max(1, Math.ceil(data.total / pageSize))}
                      total={data.total}
                      pageSize={pageSize}
                      label={t('pages')}
                      onPage={(nextPage) =>
                        setParams(
                          (currentParams) => {
                            const next = new URLSearchParams(currentParams)
                            next.set(`${prefix}Page`, String(nextPage))
                            return next
                          },
                          {
                            replace: true,
                            preventScrollReset: true,
                            state: navigationState,
                          },
                        )
                      }
                    />
                  </div>
                ) : undefined
              }
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
