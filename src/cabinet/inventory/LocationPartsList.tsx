import { useEffect, useMemo, useState } from 'react'
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
  context: 'sheet' | 'section'
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
      className="bg-app-input text-app-dim grid size-control-lg shrink-0 place-items-center overflow-hidden rounded-control"
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
        <Package className="size-4" />
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
}: Props & { owner: string; slug: string }) {
  const t = useT(locationContentsMessages)
  const tc = useT(commonMessages)
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const navigationState = useLocation().state as unknown
  const prefix = context === 'sheet' ? 'locationContents' : 'locationParts'
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
  const key = JSON.stringify([owner, filter, revision])
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <SearchInput
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
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <p className="rz-muted m-0 shrink-0 tabular-nums">
            {t('positions', { count: data.total })}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [&>div]:overflow-visible [&_thead_th]:bg-app-raised [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10">
            <DataTable
              embedded
              caption={target.name}
              rows={data.items}
              rowKey={(part) => part.id}
              columns={[
                {
                  key: 'name',
                  label: t('name'),
                  variant: 'primary',
                  cell: (part) => (
                    <Link
                      to={cabinetPath(slug, 'parts', part.id)}
                      className="flex items-center gap-3 rounded-control py-1.5 text-app-ink"
                    >
                      <LocationPartThumbnail
                        key={part.thumbnailUrl ?? ''}
                        source={part.thumbnailUrl}
                      />
                      <span className="min-w-0">
                        <strong className="rz-strong block font-semibold break-words">
                          {part.name}
                        </strong>
                        {part.car ? (
                          <span className="rz-muted mt-0.5 block text-caption">
                            {part.car.make} {part.car.model} · {part.car.year}
                          </span>
                        ) : null}
                        {part.oemCode ? (
                          <span className="rz-mono rz-caption mt-0.5 block break-all">
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
                    <span className="rz-mono rz-strong">
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
              empty={<p className="rz-muted m-0 py-5">{t('empty')}</p>}
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
