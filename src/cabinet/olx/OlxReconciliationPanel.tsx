import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Link2, RefreshCw } from 'lucide-react'
import { normalizeApiProblem } from '@/api/errors'
import { olxLiveApi, type OlxAdvert } from '@/api/olx-live'
import {
  Amount,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DateValue,
  EmptyState,
  ErrorState,
  Notice,
  PanelFooter,
  RecordIdentity,
  SkeletonRows,
  StatusPill,
  SearchInput,
  Segmented,
  Sheet,
  Toolbar,
} from '@/components/app'
import { PartSearchPicker } from '@/components/parts/PartSearchPicker'
import { useFormat, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { RedesignTitle } from '../redesign-shell'
import { tenantRequestScope } from '../tenant-request-scope'
import { filterOlxAdverts } from './olx-advert-search'
import {
  olxAdvertStatuses,
  olxAdvertTone,
  olxLiveMessages,
} from './olx-live-messages'
import { olxReconciliationMessages } from './olx-reconciliation-messages'
import { readOlxAdvertCollection } from './use-olx-advert-collection'

const filters = ['all', 'unlinked', 'linked'] as const
type Filter = (typeof filters)[number]
type Action = 'link' | 'complete'
type Message = keyof typeof olxReconciliationMessages.uk
const desktopLayout = '(min-width: 64rem)'

function subscribeToLayout(change: () => void) {
  const media = window.matchMedia?.(desktopLayout)
  media?.addEventListener('change', change)
  return () => media?.removeEventListener('change', change)
}

function usesDesktopLayout() {
  return window.matchMedia?.(desktopLayout).matches ?? true
}

export function OlxReconciliationPanel({
  accountId,
  initialCompletedAt,
  canManage,
  canReadParts,
  canWrite,
  tabs,
  showHeader = true,
  onCompleted,
}: {
  accountId: string
  initialCompletedAt: string | null
  canManage: boolean
  canReadParts: boolean
  canWrite: boolean
  tabs: ReactNode
  showHeader?: boolean
  onCompleted?: (completedAt: string) => void
}) {
  const t = useT(olxReconciliationMessages)
  const tl = useT(olxLiveMessages)
  const { number } = useFormat()
  const { targetTenant } = useCabinet()
  const desktop = useSyncExternalStore(
    subscribeToLayout,
    usesDesktopLayout,
    () => true,
  )
  const [request, setRequest] = useState({ page: 1, all: false })
  const [result, setResult] = useState<{
    request: typeof request
    items: OlxAdvert[]
    hasMore: boolean
    failed: boolean
  } | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [advertId, setAdvertId] = useState<string | null>(null)
  const [partQuery, setPartQuery] = useState('')
  const [part, setPart] = useState<{ id: string; name: string } | null>(null)
  const [confirm, setConfirm] = useState<Action | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkedNotice, setLinkedNotice] = useState(false)
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set())
  const [completedAt, setCompletedAt] = useState(initialCompletedAt)
  const mutation = useRef<AbortController | null>(null)
  const listStart = useRef<HTMLDivElement>(null)
  const partPanel = useRef<HTMLDivElement>(null)
  const completedNotice = useRef<HTMLDivElement>(null)
  const dialogTrigger = useRef<HTMLButtonElement | null>(null)
  const advertTrigger = useRef<HTMLButtonElement | null>(null)
  const loaded = result?.request === request
  const items = result?.items ?? []
  const selected = items.find(
    (item) => item.id === advertId && !item.linkedPart,
  )
  const canLink = canReadParts && canWrite
  const visible = filterOlxAdverts(items, search).filter(
    (item) =>
      filter === 'all' || (filter === 'linked') === Boolean(item.linkedPart),
  )

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    void readOlxAdvertCollection(request, accountId, false, signal).then(
      (page) => {
        if (signal.aborted) return
        setResult((previous) => {
          const adverts = new Map(
            (request.page === 1 ? [] : (previous?.items ?? [])).map((item) => [
              item.id,
              item,
            ]),
          )
          for (const advert of page.adverts) adverts.set(advert.id, advert)
          return {
            request,
            items: [...adverts.values()],
            hasMore: page.hasMore,
            failed: false,
          }
        })
      },
      () => {
        if (!signal.aborted)
          setResult((previous) => ({
            request,
            items: previous?.items ?? [],
            hasMore: previous?.hasMore ?? false,
            failed: true,
          }))
      },
    )
    return () => controller.abort()
  }, [request, accountId])

  useEffect(() => () => mutation.current?.abort(), [])

  useEffect(() => {
    if (advertId && desktop) partPanel.current?.focus()
  }, [advertId, desktop])

  function chooseAdvert(id: string | null) {
    setAdvertId(id)
    setPart(null)
    setPartQuery('')
    setLinkedNotice(false)
  }

  function refresh(page: number, all = false) {
    if (page === 1) chooseAdvert(null)
    setRequest({ page, all })
  }

  function markReviewed(id: string) {
    setReviewed((current) =>
      current.has(id) ? current : new Set(current).add(id),
    )
  }

  function recordLink(advert: OlxAdvert, matched: NonNullable<typeof part>) {
    setResult(
      (current) =>
        current && {
          ...current,
          items: current.items.map((item) =>
            item.id === advert.id
              ? {
                  ...item,
                  linkedPart: { partId: matched.id, partName: matched.name },
                }
              : item,
          ),
        },
    )
    markReviewed(advert.id)
    chooseAdvert(null)
    setLinkedNotice(true)
  }

  async function submit() {
    if (mutation.current || !confirm) return
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    mutation.current = controller
    setBusy(true)
    setError(null)
    try {
      if (confirm === 'complete' && canManage) {
        const result = await olxLiveApi.completeReconciliation(accountId, {
          signal,
        })
        if (signal.aborted) return
        setCompletedAt(result.completedAt)
        onCompleted?.(result.completedAt)
      } else if (confirm === 'link' && canLink && selected && part) {
        const publication = await olxLiveApi.publication(part.id, { signal })
        if (signal.aborted) return
        if (!publication.canLinkExisting) {
          setError('selectAnother')
          return
        }
        try {
          await olxLiveApi.link(
            part.id,
            selected.id,
            publication.revision ?? null,
            {
              signal,
              expectedAccountId: accountId,
            },
          )
        } catch (problem) {
          if (signal.aborted) return
          const { kind } = normalizeApiProblem(problem)
          if (kind !== 'network' && kind !== 'timeout') throw problem
          const recovered = await olxLiveApi.publication(part.id, { signal })
          if (recovered.advertId !== selected.id) throw problem
        }
        if (signal.aborted) return
        recordLink(selected, part)
      }
      setConfirm(null)
    } catch (problem) {
      if (signal.aborted) return
      const code = normalizeApiProblem(problem).code
      setError(
        code === 'OLX_CONNECTION_CHANGED' || code === 'OLX_RECONNECT_REQUIRED'
          ? 'accountChanged'
          : confirm === 'complete'
            ? 'completeError'
            : code === 'OLX_ADVERT_ALREADY_LINKED'
              ? 'advertUsed'
              : code === 'OLX_ALREADY_CREATED' || code === 'OLX_DRAFT_CHANGED'
                ? 'selectAnother'
                : 'linkError',
      )
    } finally {
      mutation.current = null
      if (!signal.aborted) setBusy(false)
    }
  }

  const linked = items.filter((item) => item.linkedPart).length
  const accountTotalKnown = loaded && !result.failed && !result.hasMore
  const progress = accountTotalKnown
    ? t('accountCount', {
        reviewed:
          number(items.filter((item) => reviewed.has(item.id)).length) ?? '',
        total: number(items.length) ?? '',
        linked: number(linked) ?? '',
      })
    : t('count', {
        loaded: number(items.length) ?? '',
        linked: number(linked) ?? '',
      })
  const selectedLabel = selected
    ? t('advert', { id: selected.id, title: selected.title })
    : null
  const pickPart =
    selected && canLink ? (
      <PartSearchPicker
        key={selected.id}
        value={part}
        query={partQuery}
        onQueryChange={setPartQuery}
        onSelect={setPart}
        onClear={() => setPart(null)}
        currency={targetTenant?.accountingCurrency ?? null}
        disabled={busy}
        includeUnavailable
        disableOlxSubmissions
        inline
      />
    ) : null
  const pairActions = selected && canLink && (
    <>
      <Button
        variant="quiet"
        disabled={busy}
        onClick={() => {
          markReviewed(selected.id)
          const next = visible
            .slice(visible.indexOf(selected) + 1)
            .find((item) => !item.linkedPart)
          chooseAdvert(next?.id ?? null)
          if (desktop && !next) listStart.current?.focus()
        }}
      >
        {t('skip')}
      </Button>
      <Button
        variant="primary"
        disabled={!part || busy || !loaded}
        onClick={(event) => {
          dialogTrigger.current = event.currentTarget
          setError(null)
          setConfirm('link')
        }}
      >
        <Link2 aria-hidden /> {t('link')}
      </Button>
    </>
  )

  return (
    <div className="grid min-w-0 gap-3.5">
      {showHeader && (
        <RedesignTitle
          title="OLX"
          aside={
            result && (
              <span className="rz-caption" role="status">
                {progress}
              </span>
            )
          }
        />
      )}
      {tabs}
      {completedAt ? (
        <div ref={completedNotice} tabIndex={-1}>
          <Notice tone="ok">
            <span>{t('completed')}</span> <DateValue value={completedAt} />
          </Notice>
        </div>
      ) : (
        <Notice
          action={
            canManage ? (
              <div className="self-start max-sm:basis-full max-sm:pl-6">
                <Button
                  size="sm"
                  disabled={!loaded || result.failed}
                  onClick={(event) => {
                    dialogTrigger.current = event.currentTarget
                    setError(null)
                    setConfirm('complete')
                  }}
                >
                  {t('complete')}
                </Button>
              </div>
            ) : undefined
          }
          block
        >
          <p className="m-0 font-semibold">{t('title')}</p>
          <p className="m-0 mt-1 max-w-[96ch] text-pretty">{t('intro')}</p>
          {!canManage && (
            <p className="rz-caption m-0 mt-2">{t('manageRequired')}</p>
          )}
        </Notice>
      )}
      {!canLink && (
        <Notice>
          {t(canReadParts ? 'writeRequired' : 'viewPartsRequired')}
        </Notice>
      )}
      {linkedNotice && <Notice tone="ok">{t('linkSuccess')}</Notice>}

      <div ref={listStart} tabIndex={-1}>
        <Toolbar>
          <SearchInput
            aria-label={t('search')}
            className="w-full sm:max-w-80"
            placeholder={t('search')}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value)
              chooseAdvert(null)
            }}
          />
          <Segmented
            as="toggle"
            name="olx-link-filter"
            label={t('linkColumn')}
            options={filters.map((value) => ({ value, label: t(value) }))}
            value={filter}
            onChange={(value) => {
              setFilter(value)
              chooseAdvert(null)
            }}
          />
        </Toolbar>
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,23.75rem)]">
        <Card
          title={
            <>
              {t('advertsTitle')}{' '}
              <span className="rz-caption font-normal">
                {accountTotalKnown
                  ? t('accountUnlinked', {
                      count: number(items.length - linked) ?? '',
                    })
                  : items.length > 0
                    ? number(items.length)
                    : null}
              </span>
            </>
          }
          bodyClassName="p-0"
        >
          {visible.length > 0 && (
            <DataTable
              caption={t('advertsTitle')}
              columns={[
                {
                  key: 'advert',
                  label: t('advertColumn'),
                  variant: 'primary',
                  cell: (item) => {
                    const identity = (
                      <RecordIdentity
                        title={item.title}
                        subtitle={
                          <span className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="font-mono">№ {item.id}</span>
                            {item.price != null && (
                              <Amount
                                value={item.price}
                                currency={item.currency ?? null}
                              />
                            )}
                          </span>
                        }
                      />
                    )
                    return item.linkedPart || !canLink ? (
                      identity
                    ) : (
                      <button
                        aria-pressed={selected?.id === item.id}
                        aria-haspopup={desktop ? undefined : 'dialog'}
                        className="hover:text-app-accent w-full min-w-0 py-2 text-left"
                        disabled={busy || !loaded}
                        onClick={(event) => {
                          advertTrigger.current = event.currentTarget
                          chooseAdvert(item.id)
                        }}
                        type="button"
                      >
                        {identity}
                      </button>
                    )
                  },
                },
                {
                  key: 'status',
                  label: t('statusColumn'),
                  cell: (item) => {
                    const status = olxAdvertStatuses.find(
                      (value) => value === item.status,
                    )
                    return (
                      <StatusPill tone={olxAdvertTone(item.status)}>
                        {status
                          ? tl(status)
                          : tl('unknown', { status: item.status })}
                      </StatusPill>
                    )
                  },
                },
                {
                  key: 'link',
                  label: t('linkColumn'),
                  cell: (item) => (
                    <div className="grid gap-0.5 py-2">
                      <div>
                        <StatusPill tone={item.linkedPart ? 'ok' : 'neutral'}>
                          {t(item.linkedPart ? 'linkedStatus' : 'unlinked')}
                        </StatusPill>
                      </div>
                      {item.linkedPart?.partName && (
                        <span className="rz-caption break-words">
                          {item.linkedPart.partName}
                        </span>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={visible}
              rowKey={(item) => item.id}
              activeKey={selected?.id ?? null}
              rowClassName={(item) =>
                item.linkedPart ? 'opacity-70' : undefined
              }
              embedded
            />
          )}
          {!loaded ? (
            <div className="rz-card__body">
              <SkeletonRows rows={3} label={tl('loading')} />
            </div>
          ) : result.failed ? (
            <ErrorState
              title={t('loadError')}
              description={t('loadHint')}
              onRetry={() => refresh(request.page, request.all)}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title={t(
                accountTotalKnown && items.length === 0
                  ? 'empty'
                  : accountTotalKnown
                    ? 'noMatchesAll'
                    : 'noMatches',
              )}
            />
          ) : null}
          {result && (
            <PanelFooter
              leading={result.hasMore ? t('searchScope') : undefined}
            >
              <Button
                disabled={!loaded || busy}
                size="sm"
                onClick={() => refresh(1, request.all || accountTotalKnown)}
              >
                <RefreshCw aria-hidden /> {tl('refresh')}
              </Button>
              {result.hasMore && !result.failed && (
                <>
                  <Button
                    disabled={!loaded || busy}
                    size="sm"
                    onClick={() => refresh(request.page + 1)}
                  >
                    {t('loadMore')}
                  </Button>
                  <Button
                    disabled={!loaded || busy}
                    size="sm"
                    onClick={() => refresh(1, true)}
                  >
                    {tl('advertLoadAll')}
                  </Button>
                </>
              )}
            </PanelFooter>
          )}
        </Card>
        {desktop ? (
          <div className="grid min-w-0 gap-3.5" ref={partPanel} tabIndex={-1}>
            <Card
              title={
                <span className="grid gap-1">
                  {t('matchingPart')}
                  {selectedLabel && (
                    <span className="rz-caption font-normal">
                      {selectedLabel}
                    </span>
                  )}
                </span>
              }
              bodyClassName={pickPart ? 'p-0' : 'rz-muted'}
            >
              {pickPart ?? t('chooseFirst')}
            </Card>
            {pairActions && (
              <div className="rz-card">
                <div className="rz-card__body grid gap-3">
                  <p className="rz-caption m-0">{t('skipHint')}</p>
                  <div className="flex flex-wrap gap-2">{pairActions}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Sheet
            open={Boolean(pickPart)}
            title={t('matchingPart')}
            description={selectedLabel}
            bodyClassName="px-0 pt-1"
            footer={pairActions}
            pending={busy}
            onOpenChange={(open) => {
              if (!open && confirm === null) chooseAdvert(null)
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const trigger = advertTrigger.current
              ;(trigger?.isConnected ? trigger : listStart.current)?.focus()
            }}
          >
            {pickPart}
            <p className="rz-caption mx-4 my-0">{t('skipHint')}</p>
          </Sheet>
        )}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={t(confirm === 'complete' ? 'completeTitle' : 'linkTitle')}
        consequence={
          confirm === 'complete'
            ? t('consequence')
            : selected && part
              ? t('pair', {
                  advert: t('advert', {
                    id: selected.id,
                    title: selected.title,
                  }),
                  part: part.name,
                })
              : ''
        }
        effects={
          confirm === 'complete'
            ? accountTotalKnown
              ? [progress]
              : [t('moreToReview')]
            : [t('linkContent'), t('keepContact'), t('keepInactive')]
        }
        confirmLabel={t(confirm === 'complete' ? 'complete' : 'link')}
        destructive={false}
        pending={busy}
        error={error ? t(error) : null}
        onConfirm={() => void submit()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (dialogTrigger.current?.isConnected) dialogTrigger.current.focus()
          else if (linkedNotice) listStart.current?.focus()
          else if (completedAt) completedNotice.current?.focus()
        }}
      />
    </div>
  )
}
