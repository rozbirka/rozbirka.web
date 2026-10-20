import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Package } from 'lucide-react'
import {
  Button,
  DataTable,
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

interface Props {
  target: LocationContentsTarget
  context: 'sheet' | 'section' | 'unassigned'
  onPlace?: ((part: PartSearchItem) => void) | undefined
  refreshKey?: number
  emptyText?: string
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

function LocationPartThumbnail({ source }: { source: string | null }) {
  const [failed, setFailed] = useState(false)
  return (
    <span
      aria-hidden
      className="bg-app-input text-app-dim grid size-12 shrink-0 place-items-center overflow-hidden rounded-control"
    >
      {source && !failed ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className="size-5" />
      )}
    </span>
  )
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
  onPlace,
  refreshKey = 0,
  emptyText,
  selection,
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
  const [debounced, setDebounced] = useState(query)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<ResultState>({ key: '' })
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timeout)
  }, [query])
  const serializedFilter = JSON.stringify(
    locationPartsFilter(target, debounced, page),
  )
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
        const last = Math.max(1, Math.ceil(data.total / 10))
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
  }, [filter, key, page, prefix, query, debounced, setParams, navigationState])
  const current = state.key === key && query === debounced ? state : undefined
  const data = current?.data
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <SearchInput
        className="min-h-12 text-base"
        aria-label={t('search')}
        placeholder={t('search')}
        value={query}
        onChange={(event) =>
          setParams(
            (currentParams) => {
              const next = new URLSearchParams(currentParams)
              next.set(`${prefix}Search`, event.target.value)
              next.delete(`${prefix}Page`)
              return next
            },
            { replace: true, preventScrollReset: true, state: navigationState },
          )
        }
      />
      {selection?.actions}
      {!current ? (
        <SkeletonRows rows={3} />
      ) : current.error ? (
        <Notice tone="danger">
          {t('failed')}{' '}
          <Button onClick={() => setRevision((value) => value + 1)}>
            {tc('retry')}
          </Button>
        </Notice>
      ) : data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <p className="text-app-ink bg-app-raised border-app-line shrink-0 rounded-control border px-4 py-3 text-base font-semibold tabular-nums">
            {t('positions', { count: data.total })}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [&>div]:overflow-visible [&_thead_th]:bg-app-raised [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:font-sans [&_thead_th]:text-sm [&_thead_th]:font-semibold [&_thead_th]:tracking-normal [&_thead_th]:normal-case [&_thead_th]:text-app-muted">
            <DataTable
              embedded
              caption={target.name}
              rows={data.items}
              rowKey={(part) => part.id}
              {...(selection
                ? {
                    selection: {
                      selected: new Set(selection.parts.keys()),
                      rowLabel: (part: PartSearchItem) =>
                        t('selectPart', { name: part.name }),
                      unavailable: (part: PartSearchItem) =>
                        part.isInventoryLocked
                          ? t('placementLocked')
                          : undefined,
                      onChange: (ids: ReadonlySet<string>) => {
                        const next = new Map(selection.parts)
                        for (const id of next.keys())
                          if (!ids.has(id)) next.delete(id)
                        for (const part of data.items) {
                          if (ids.has(part.id) && !part.isInventoryLocked)
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
                    <Link
                      to={cabinetPath(slug, 'parts', part.id)}
                      className="focus-visible:outline-brand hover:text-brand flex min-h-14 items-center gap-3 rounded-control py-1"
                    >
                      <LocationPartThumbnail
                        key={part.thumbnailUrl ?? ''}
                        source={part.thumbnailUrl}
                      />
                      <span className="min-w-0">
                        <strong className="text-app-ink block break-words text-base leading-6 font-bold">
                          {part.name}
                        </strong>
                        {part.car ? (
                          <span className="text-app-muted mt-1 block text-sm">
                            {part.car.make} {part.car.model} · {part.car.year}
                          </span>
                        ) : null}
                        {part.oemCode ? (
                          <span className="text-app-muted mt-0.5 block break-all font-mono text-sm">
                            {part.oemCode}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ),
                },
                {
                  key: 'quantity',
                  label: t('quantity'),
                  align: 'end',
                  cell: (part) => (
                    <span className="text-app-ink text-base font-semibold tabular-nums">
                      {f.number(part.quantity)}
                    </span>
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
                            ? 'neutral'
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
                ...(onPlace
                  ? [
                      {
                        key: 'place',
                        label: t('place'),
                        headerHidden: true,
                        cell: (part: PartSearchItem) => (
                          <div className="grid justify-items-start gap-1.5 md:justify-items-end">
                            <Button
                              onClick={() => onPlace(part)}
                              disabled={part.isInventoryLocked}
                              aria-label={t('placePart', { name: part.name })}
                            >
                              {t('place')}
                            </Button>
                            {part.isInventoryLocked ? (
                              <span className="text-app-muted max-w-52 text-xs">
                                {t('placementLocked')}
                              </span>
                            ) : null}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              empty={
                <p className="text-app-muted py-5">
                  {context === 'unassigned' && query.trim()
                    ? t('noMatches')
                    : (emptyText ?? t('empty'))}
                </p>
              }
            />
          </div>
          {data.total > 10 ? (
            <div className="shrink-0">
              <Pagination
                page={page}
                totalPages={Math.ceil(data.total / 10)}
                total={data.total}
                pageSize={10}
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
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
