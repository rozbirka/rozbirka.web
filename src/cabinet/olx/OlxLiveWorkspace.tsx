import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react'
import {
  Amount,
  Button,
  Card,
  DataTable,
  DateValue,
  EmptyState,
  ErrorState,
  Fact,
  FactList,
  SearchInput,
  Segmented,
  Sheet,
  SkeletonRows,
  StatusPill,
  Toolbar,
  type DataColumn,
} from '@/components/app'
import { PartSearchPicker } from '@/components/parts/PartSearchPicker'
import {
  olxLiveApi,
  type OlxAdvert,
  type OlxAdvertPage,
  type OlxLivePublication,
} from '@/api/olx-live'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import {
  olxAdvertStatuses,
  olxAdvertTone,
  olxLiveMessages,
} from './olx-live-messages'
import { OlxPreparationPanel } from './OlxPreparationPanel'
import { olxPublicationMessages } from './olx-publication-messages'

type AdvertFilter = 'all' | 'active' | 'attention'

const needsAttention = new Set([
  'limited',
  'unconfirmed',
  'unpaid',
  'moderated',
  'blocked',
  'disabled',
  'removed_by_moderator',
])

export function OlxLiveWorkspace({
  canReadParts,
  canEditParts = false,
  partsHref,
  reconcileHref,
  currency = null,
}: {
  canReadParts: boolean
  canEditParts?: boolean
  partsHref?: string
  reconcileHref?: string
  currency?: string | null
}) {
  const t = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const { number } = useFormat()
  const searchId = useId()
  const filterName = useId()
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    page: number
    attempt: number
    value: OlxAdvertPage | null
  } | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AdvertFilter>('all')
  const [preparing, setPreparing] = useState(false)
  const [selectedAdvert, setSelectedAdvert] = useState<OlxAdvert | null>(null)
  const [partId, setPartId] = useState<string | null>(null)
  const [partQuery, setPartQuery] = useState('')
  const [editorBusy, setEditorBusy] = useState(false)
  const [editorActions, setEditorActions] = useState<HTMLDivElement | null>(
    null,
  )
  const prepareTrigger = useRef<HTMLButtonElement>(null)
  const advertTriggers = useRef(new Map<string, HTMLButtonElement>())
  const returnToAdvert = useRef<string | null>(null)
  const partSearch = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)
  const current =
    result?.page === page && result.attempt === attempt
      ? result.value
      : undefined
  const activeAdvert = selectedAdvert
    ? (current?.items.find((item) => item.id === selectedAdvert.id) ??
      selectedAdvert)
    : null
  const activePartId = canReadParts
    ? (activeAdvert?.linkedPart?.partId ?? null)
    : null
  const activeAdvertStatus = olxAdvertStatuses.find(
    (status) => status === activeAdvert?.status,
  )
  const isAdvertOpen = activeAdvert !== null
  const editorPartId = activeAdvert ? activePartId : partId
  const activePartHref =
    activePartId && partsHref
      ? `${partsHref}/${encodeURIComponent(activePartId)}`
      : null

  const onPublicationChange = useCallback((publication: OlxLivePublication) => {
    const { advertId, observedStatus, checkedAt } = publication
    if (!advertId || !observedStatus || !checkedAt) return
    setResult((entry) => {
      if (
        !entry?.value ||
        !(Date.parse(checkedAt) >= Date.parse(entry.value.checkedAt))
      )
        return entry
      const items = entry.value.items.map((item) =>
        item.id === advertId && item.status !== observedStatus
          ? { ...item, status: observedStatus }
          : item,
      )
      return { ...entry, value: { ...entry.value, items } }
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    inFlight.current = true
    void olxLiveApi
      .adverts(page, { signal: controller.signal })
      .then(
        (value) => {
          if (!controller.signal.aborted) setResult({ page, attempt, value })
        },
        () => {
          if (!controller.signal.aborted)
            setResult({ page, attempt, value: null })
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) inFlight.current = false
      })
    return () => controller.abort()
  }, [page, attempt])

  useEffect(() => {
    if (preparing && partId === null) {
      partSearch.current?.querySelector('input')?.focus()
    }
  }, [preparing, partId])

  const refresh = () => {
    if (!inFlight.current) {
      inFlight.current = true
      setAttempt((x) => x + 1)
    }
  }

  function openAdvert(advert: OlxAdvert) {
    returnToAdvert.current = advert.id
    setSelectedAdvert(advert)
  }

  const searchText = search.trim().toLocaleLowerCase(locale)
  const advertNumberPrefix = t('advertNumber', { id: '' })
    .trim()
    .toLocaleLowerCase(locale)
  const advertNumber = (
    searchText.startsWith(advertNumberPrefix)
      ? searchText.slice(advertNumberPrefix.length)
      : searchText
  ).replace(/[\s#]/g, '')
  const visible =
    current?.items.filter((advert) => {
      if (filter === 'active' && advert.status !== 'active') return false
      if (filter === 'attention' && !needsAttention.has(advert.status))
        return false
      const partName = advert.linkedPart?.partName ?? ''
      return (
        !searchText ||
        advert.title.toLocaleLowerCase(locale).includes(searchText) ||
        partName.toLocaleLowerCase(locale).includes(searchText) ||
        (Boolean(advertNumber) &&
          advert.id.toLocaleLowerCase(locale).includes(advertNumber))
      )
    }) ?? []
  const filtering = Boolean(searchText) || filter !== 'all'
  const loadedCount = current?.items.length ?? 0

  const columns: DataColumn<OlxAdvert>[] = [
    {
      key: 'detail',
      label: t('advertDetail'),
      variant: 'primary',
      cell: (advert) => {
        const partName = advert.linkedPart?.partName?.trim() ?? ''
        return (
          <button
            ref={(element) => {
              if (element) advertTriggers.current.set(advert.id, element)
              else advertTriggers.current.delete(advert.id)
            }}
            type="button"
            aria-haspopup="dialog"
            className="text-app-strong hover:text-brand-text block min-w-0 cursor-pointer py-2 text-left [overflow-wrap:anywhere] whitespace-normal"
            onClick={(event) => {
              event.stopPropagation()
              openAdvert(advert)
            }}
          >
            {partName.length === 0 ? advert.title : partName}
            {partName && partName !== advert.title && (
              <span className="rz-caption block">{advert.title}</span>
            )}
          </button>
        )
      },
    },
    {
      key: 'listing',
      label: t('advertListing'),
      cell: (advert) => {
        const label = t('advertNumber', { id: advert.id })
        return advert.url ? (
          <a
            className="text-brand-text rounded-rz-xs font-mono whitespace-nowrap hover:underline focus-visible:shadow-[var(--rz-focus)] focus-visible:outline-none"
            href={advert.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {label}
          </a>
        ) : (
          <span className="font-mono whitespace-nowrap">{label}</span>
        )
      },
    },
    {
      key: 'status',
      label: t('advertStatus'),
      cell: (advert) => {
        const status = olxAdvertStatuses.find(
          (value) => value === advert.status,
        )
        return (
          <StatusPill
            tone={olxAdvertTone(advert.status)}
            className="h-auto min-h-5 py-0.5 [overflow-wrap:anywhere] whitespace-normal before:shrink-0"
          >
            {status ? t(status) : t('unknown', { status: advert.status })}
          </StatusPill>
        )
      },
    },
    {
      key: 'price',
      label: t('price'),
      align: 'end',
      cell: (advert) => (
        <Amount
          value={advert.price}
          currency={advert.currency ?? null}
          currencyDisplay="code"
        />
      ),
    },
  ]

  return (
    <div className="grid min-w-0 gap-3">
      <Toolbar
        trailing={
          <>
            <Button
              size="icon"
              aria-label={t('refresh')}
              title={t('refresh')}
              onClick={refresh}
              disabled={current === undefined}
            >
              <RefreshCw aria-hidden />
            </Button>
            {canReadParts && (
              <Button
                ref={prepareTrigger}
                aria-haspopup="dialog"
                onClick={() => setPreparing(true)}
              >
                <Plus aria-hidden />
                {t('openPreparation')}
              </Button>
            )}
          </>
        }
      >
        <label className="sr-only" htmlFor={searchId}>
          {t('advertSearch')}
        </label>
        <SearchInput
          id={searchId}
          className="max-sm:max-w-none sm:max-w-80"
          placeholder={t('advertSearchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Segmented
          label={t('advertStatus')}
          name={filterName}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('allAdverts') },
            { value: 'active', label: t('activeAdverts') },
            { value: 'attention', label: t('advertsNeedingAttention') },
          ]}
        />
      </Toolbar>

      {current === undefined ? (
        <SkeletonRows rows={3} variant="content" />
      ) : current === null ? (
        <ErrorState
          title={t('loadError')}
          description={t('readError')}
          onRetry={refresh}
        />
      ) : (
        <DataTable
          caption={t('adverts')}
          columns={columns}
          rows={visible}
          rowKey={(advert) => advert.id}
          activeKey={activeAdvert?.id ?? null}
          onRowClick={openAdvert}
          empty={
            current.items.length === 0 ? (
              <EmptyState
                className="rounded-none border-0"
                title={t('empty')}
                description={t('emptyHint')}
              />
            ) : (
              <EmptyState
                className="rounded-none border-0"
                title={t('advertNoMatches')}
              />
            )
          }
          footer={
            <div className="rz-pager">
              <span className="font-mono" role="status">
                {filtering
                  ? t('advertFilteredCount', {
                      shown: number(visible.length) ?? visible.length,
                      loaded: number(loadedCount) ?? loadedCount,
                    })
                  : t('advertPageCount', {
                      loaded: number(loadedCount) ?? loadedCount,
                    })}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2">
                {t('checkedAt')} <DateValue value={current.checkedAt} />
              </span>
              <nav
                className="rz-pager__nav"
                aria-label={t('advertsPagination')}
              >
                <span className="whitespace-nowrap">
                  {t('page', { page: number(page) ?? page })}
                </span>
                <Button
                  size="icon"
                  aria-label={t('previous')}
                  disabled={page === 1}
                  onClick={() => setPage((x) => x - 1)}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <Button
                  size="icon"
                  aria-label={t('next')}
                  disabled={!current.hasMore}
                  onClick={() => setPage((x) => x + 1)}
                >
                  <ChevronRight aria-hidden />
                </Button>
              </nav>
            </div>
          }
        />
      )}

      {(canReadParts || isAdvertOpen) && (
        <Sheet
          open={preparing || isAdvertOpen}
          size="lg"
          className={
            editorPartId !== null || isAdvertOpen
              ? ''
              : 'max-sm:min-h-[min(38rem,92dvh)]'
          }
          title={
            activeAdvert
              ? tp('listingTitle')
              : partId
                ? tp('title')
                : t('prepare')
          }
          description={
            activeAdvert?.linkedPart?.partName ??
            activeAdvert?.title ??
            (partId ? undefined : t('prepareHint'))
          }
          pending={editorBusy}
          footer={
            editorPartId !== null || isAdvertOpen ? (
              <>
                <Button
                  variant="quiet"
                  aria-label={activeAdvert ? tc('close') : t('prepare')}
                  disabled={editorBusy}
                  onClick={() => {
                    if (activeAdvert) setSelectedAdvert(null)
                    else setPartId(null)
                  }}
                >
                  {!activeAdvert && <ArrowLeft aria-hidden />}
                  {tc(activeAdvert ? 'close' : 'back')}
                </Button>
                <div ref={setEditorActions} className="contents" />
                {!editorPartId && activeAdvert?.url && (
                  <Button asChild variant="primary">
                    <a
                      href={activeAdvert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink aria-hidden />
                      {tp('open')}
                    </a>
                  </Button>
                )}
              </>
            ) : undefined
          }
          onOpenChange={(open) => {
            setPreparing(open)
            if (!open) {
              setSelectedAdvert(null)
              setPartId(null)
              setPartQuery('')
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const trigger = returnToAdvert.current
              ? advertTriggers.current.get(returnToAdvert.current)
              : prepareTrigger.current
            returnToAdvert.current = null
            trigger?.focus()
          }}
        >
          {editorPartId ? (
            <OlxPreparationPanel
              key={editorPartId}
              id={editorPartId}
              canEdit={canEditParts}
              actionsTarget={editorActions}
              partHref={activePartHref}
              expectedAdvertId={activeAdvert?.id ?? null}
              latestAdvert={
                activeAdvert && current
                  ? {
                      id: activeAdvert.id,
                      status: activeAdvert.status,
                      checkedAt: current.checkedAt,
                    }
                  : null
              }
              onPublicationChange={onPublicationChange}
              onMutationBusy={setEditorBusy}
            />
          ) : activeAdvert ? (
            <Card
              title={activeAdvert.title}
              aside={
                <StatusPill tone={olxAdvertTone(activeAdvert.status)}>
                  {activeAdvertStatus
                    ? t(activeAdvertStatus)
                    : t('unknown', { status: activeAdvert.status })}
                </StatusPill>
              }
            >
              <div className="grid gap-3">
                <FactList columns={2}>
                  <Fact label={tp('advert')}>
                    {t('advertNumber', { id: activeAdvert.id })}
                  </Fact>
                  <Fact label={t('price')}>
                    <Amount
                      value={activeAdvert.price}
                      currency={activeAdvert.currency ?? null}
                      currencyDisplay="code"
                    />
                  </Fact>
                </FactList>
                <p className="text-app-muted m-0">
                  {tp(
                    activeAdvert.linkedPart
                      ? 'listingNoPartAccess'
                      : 'listingLinkFirst',
                  )}
                </p>
                {!activeAdvert.linkedPart && canReadParts && reconcileHref && (
                  <div>
                    <Button asChild>
                      <Link to={reconcileHref}>{tp('listingLinkPart')}</Link>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <div ref={partSearch} className="min-w-0">
              <PartSearchPicker
                compact
                currency={currency}
                value={null}
                query={partQuery}
                onQueryChange={setPartQuery}
                onSelect={(part) => setPartId(part.id)}
                onClear={() => undefined}
              />
            </div>
          )}
        </Sheet>
      )}
    </div>
  )
}
