import { useEffect, useId, useRef, useState, type ComponentProps } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Tags,
} from 'lucide-react'
import {
  ActionMenu,
  Amount,
  BulkBar,
  Button,
  DataTable,
  DateValue,
  EmptyState,
  ErrorState,
  Fact,
  FactList,
  Notice,
  Pagination,
  SearchInput,
  Segmented,
  SectionPanel,
  Sheet,
  SkeletonRows,
  StatusPill,
  Toolbar,
  type DataColumn,
} from '@/components/app'
import { PartSearchPicker } from '@/components/parts/PartSearchPicker'
import type { OlxAdvert, OlxLocalAdvert } from '@/api/olx-live'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import {
  olxAdvertStatuses,
  olxAdvertTone,
  olxLiveMessages,
} from './olx-live-messages'
import { OlxPreparationPanel } from './OlxPreparationPanel'
import { olxPublicationMessages } from './olx-publication-messages'
import {
  OlxBatchMaintenanceSheet,
  type OlxBatchMaintenanceMode,
} from './OlxBatchMaintenanceSheet'
import { OlxBatchSheet, type OlxBatchPart } from './OlxBatchSheet'
import { olxBatchMessages } from './olx-batch-messages'
import { useOlxAdvertCollection } from './use-olx-advert-collection'
import { useOlxPublicationStatus } from './use-olx-publication-status'
import './olx-advert-table.css'

const filters = [
  ['all', 'allAdverts'],
  ['active', 'activeAdverts'],
  ['attention', 'advertsNeedingAttention'],
  ['waiting', 'advertsWaiting'],
  ['excluded', 'advertsExcluded'],
] as const
type AdvertFilter = (typeof filters)[number][0]
type BulkMode = OlxBatchMaintenanceMode | 'category'
type WorkspaceRow =
  | {
      key: string
      advert: OlxAdvert
      part: OlxAdvert['linkedPart']
      waiting: false
    }
  | { key: string; advert: null; part: OlxLocalAdvert; waiting: boolean }

const pageSize = 25

const needsAttention = new Set([
  'limited',
  'unconfirmed',
  'unpaid',
  'moderated',
  'blocked',
  'disabled',
  'removed_by_moderator',
])

function isAttention(row: WorkspaceRow) {
  return (
    Boolean(row.part?.error) ||
    ['rejected', 'unknown', 'delete_unknown'].includes(
      row.part?.publicationState ?? '',
    ) ||
    (row.advert != null && needsAttention.has(row.advert.status))
  )
}

function matchesFilter(row: WorkspaceRow, filter: AdvertFilter) {
  switch (filter) {
    case 'active':
      return row.advert?.status === 'active'
    case 'attention':
      return isAttention(row)
    case 'waiting':
      return row.waiting && !row.part?.excluded
    case 'excluded':
      return row.part?.excluded === true
    default:
      return true
  }
}

function rowTitle(row: WorkspaceRow) {
  const name = row.part?.partName?.trim()
  return name?.length ? name : (row.advert?.title ?? '')
}

function WorkspaceStatus({ row }: { row: WorkspaceRow }) {
  const t = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const { advert, part, waiting } = row
  const state = part?.publicationState ?? (advert ? 'linked' : 'draft')
  const status = useOlxPublicationStatus({
    state,
    observedStatus: advert?.status ?? null,
    revision: 'saved',
  })
  const excluded = part?.excluded === true
  return (
    <span data-olx-cell="status">
      <StatusPill tone={excluded || waiting ? 'neutral' : status.tone}>
        {excluded
          ? tp('partTabExcluded')
          : waiting
            ? t('advertWaiting')
            : status.label}
      </StatusPill>
    </span>
  )
}

export function OlxLiveWorkspace({
  canReadParts,
  canEditParts = false,
  canSeeDiagnostics = false,
  accountId,
  canWrite = false,
  partsHref,
  reconcileHref,
  onOpenPart,
  onJobStarted,
  currency = null,
}: {
  canReadParts: boolean
  canEditParts?: boolean
  canSeeDiagnostics?: boolean
  accountId?: string
  canWrite?: boolean
  partsHref?: string
  reconcileHref?: string
  onOpenPart?: (partId: string) => void
  onJobStarted?: ComponentProps<typeof OlxBatchSheet>['onJobStarted']
  currency?: string | null
}) {
  const t = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const tb = useT(olxBatchMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const { number } = useFormat()
  const searchId = useId()
  const filterName = useId()
  const { request, current, setRequest, recordPublication } =
    useOlxAdvertCollection(accountId, canReadParts)
  const [accountPage, setAccountPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AdvertFilter>('all')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [batch, setBatch] = useState<{
    mode: BulkMode
    parts: OlxBatchPart[]
    trigger: HTMLElement | null
  } | null>(null)
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
  const searchInput = useRef<HTMLInputElement>(null)
  const activeAdvert = selectedAdvert
    ? (current?.adverts.find((item) => item.id === selectedAdvert.id) ??
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

  useEffect(() => {
    if (preparing && partId === null) {
      partSearch.current?.querySelector('input')?.focus()
    }
  }, [preparing, partId])

  const refresh = () => {
    setPicked(new Set())
    setRequest((value) => ({ ...value }))
  }

  function openRow(row: WorkspaceRow) {
    if (row.advert) {
      returnToAdvert.current = row.key
      setSelectedAdvert(row.advert)
    } else {
      onOpenPart?.(row.part.partId)
    }
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
  const linkedIds = new Set(
    current?.adverts.map((item) => item.linkedPart?.partId),
  )
  const rows: WorkspaceRow[] = [
    ...(current?.adverts.map((advert) => ({
      key: `advert:${advert.id}`,
      advert,
      part: advert.linkedPart,
      waiting: false as const,
    })) ?? []),
    ...(current?.local
      .filter((part) => !linkedIds.has(part.partId))
      .map((part) => ({
        key: `part:${part.partId}`,
        advert: null,
        part,
        waiting: part.requiresData === true,
      })) ?? []),
  ]
  const matching = rows.filter(
    (row) =>
      !searchText ||
      [row.advert?.title, row.part?.partName, row.part?.oemCode].some((text) =>
        text?.toLocaleLowerCase(locale).includes(searchText),
      ) ||
      (row.advert !== null &&
        advertNumber.length > 0 &&
        row.advert.id.toLocaleLowerCase(locale).includes(advertNumber)),
  )
  const filtered = matching.filter((row) => matchesFilter(row, filter))
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const displayedPage = Math.min(accountPage, totalPages)
  const visible = request.all
    ? filtered.slice((displayedPage - 1) * pageSize, displayedPage * pageSize)
    : filtered
  const wholeAccount = Boolean(
    current && !current.localFailed && !current.hasMore && request.page === 1,
  )
  const filtering = Boolean(searchText) || filter !== 'all'
  const canBatch =
    canReadParts &&
    (canEditParts || canWrite) &&
    Boolean(accountId && partsHref)
  const selectedRows = visible.filter((row) => picked.has(row.key))

  function showPage(page: number) {
    setPicked(new Set())
    if (request.all) setAccountPage(page)
    else setRequest({ page, all: false })
  }

  function showAccount(all: boolean) {
    setPicked(new Set())
    setAccountPage(1)
    setRequest({ page: 1, all })
  }

  function returnBatchFocus() {
    if (batch?.trigger?.isConnected) batch.trigger.focus()
    else searchInput.current?.focus()
  }

  function batchParts(mode: BulkMode, source: WorkspaceRow[]) {
    return source.flatMap((row): OlxBatchPart[] => {
      if (!row.part?.partId) return []
      if (
        mode === 'category' &&
        (row.advert ||
          row.part.excluded ||
          !['draft', 'rejected'].includes(row.part.publicationState ?? 'draft'))
      )
        return []
      if (mode === 'remove' && row.advert?.status !== 'active') return []
      if (mode === 'exclude' && row.part.excluded) return []
      if (mode === 'include' && !row.part.excluded) return []
      return [
        {
          id: row.part.partId,
          name: rowTitle(row),
          ...(row.advert ? { expectedAdvertId: row.advert.id } : {}),
        },
      ]
    })
  }

  function openBatch(mode: BulkMode, parts: OlxBatchPart[]) {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setBatch({ mode, parts, trigger })
  }

  const batchActions = [
    {
      mode: 'exclude',
      label: tb('excludeBatch'),
      icon: <EyeOff aria-hidden />,
    },
    { mode: 'category', label: tb('assign'), icon: <Tags aria-hidden /> },
    {
      mode: 'remove',
      label: tb('withdrawBatch'),
      icon: <EyeOff aria-hidden />,
    },
    { mode: 'include', label: tb('includeBatch'), icon: <Eye aria-hidden /> },
  ] as const

  function availableBatchActions(source: WorkspaceRow[]) {
    return batchActions.flatMap(({ mode, label, icon }) => {
      if (
        !canBatch ||
        (mode !== 'remove' && !canEditParts) ||
        (mode === 'category' && !onJobStarted) ||
        (mode === 'remove' && !canWrite)
      )
        return []
      const parts = batchParts(mode, source)
      return parts.length
        ? [
            {
              key: mode,
              label:
                parts.length === source.length
                  ? label
                  : `${label} (${number(parts.length) ?? parts.length})`,
              icon,
              parts,
            },
          ]
        : []
    })
  }

  const selectedActions = availableBatchActions(selectedRows)
  const selectable = new Set(
    visible
      .filter((row) => availableBatchActions([row]).length > 0)
      .map((row) => row.key),
  )
  const columns: DataColumn<WorkspaceRow>[] = [
    {
      key: 'detail',
      label: t('advertDetail'),
      variant: 'primary',
      cell: (row) => {
        const title = rowTitle(row)
        return (
          <span className="rz-cell-main py-2 md:py-0">
            {!row.advert && partsHref ? (
              <Link
                className="text-app-strong hover:text-brand-text"
                to={`${partsHref}/${encodeURIComponent(row.part.partId)}/olx`}
                onClick={(event) => event.stopPropagation()}
              >
                {title}
              </Link>
            ) : (
              <button
                ref={(element) => {
                  if (element) advertTriggers.current.set(row.key, element)
                  else advertTriggers.current.delete(row.key)
                }}
                type="button"
                aria-haspopup="dialog"
                className="text-app-strong hover:text-brand-text cursor-pointer text-left"
                onClick={(event) => {
                  event.stopPropagation()
                  openRow(row)
                }}
              >
                {title}
              </button>
            )}
            {row.part?.oemCode && (
              <span className="rz-mono">{row.part.oemCode}</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'listing',
      label: t('advertListing'),
      cell: ({ advert }) => {
        if (!advert) return <span data-olx-cell="number">—</span>
        const label = t('advertNumber', { id: advert.id })
        return advert.url ? (
          <a
            data-olx-cell="number"
            className="text-brand-text rounded-rz-xs font-mono whitespace-nowrap hover:underline focus-visible:shadow-[var(--rz-focus)] focus-visible:outline-none"
            href={advert.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {label}
          </a>
        ) : (
          <span data-olx-cell="number" className="font-mono whitespace-nowrap">
            {label}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: t('advertStatus'),
      cell: (row) => <WorkspaceStatus row={row} />,
    },
    {
      key: 'price',
      label: t('price'),
      align: 'end',
      cell: (row) => (
        <span data-olx-cell="price">
          <Amount
            value={row.advert ? row.advert.price : row.part.price}
            currency={
              (row.advert ? row.advert.currency : row.part.currency) ?? null
            }
            currencyDisplay="code"
          />
        </span>
      ),
    },
    ...(canReadParts
      ? [
          {
            key: 'stock',
            label: t('advertStock'),
            align: 'end' as const,
            cell: (row: WorkspaceRow) => (
              <span data-olx-cell="stock" className="font-mono">
                {number(row.part?.quantityAvailable) ?? '—'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'actions',
      label: t('advertOpenDetails'),
      headerHidden: true,
      align: 'end',
      cell: (row) => (
        <div
          data-olx-cell="actions"
          onClick={(event) => event.stopPropagation()}
        >
          <ActionMenu
            label={t('advertRowActions', { title: rowTitle(row) })}
            actions={[
              {
                key: 'open',
                label: t('advertOpenDetails'),
                onSelect: () => openRow(row),
              },
              ...availableBatchActions([row]).map(
                ({ key, label, icon, parts }) => ({
                  key,
                  label,
                  icon,
                  onSelect: () => openBatch(key, parts),
                  destructive: key === 'remove',
                }),
              ),
            ]}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="grid min-w-0 gap-3">
      {selectedRows.length > 0 ? (
        <BulkBar
          count={selectedRows.length}
          noun={t('advertsSelectedNoun')}
          actions={selectedActions.map(({ key, label, parts }) => ({
            key,
            label,
            onRun: () => openBatch(key, parts),
            tone: key === 'remove' ? 'danger' : 'default',
          }))}
          onClear={() => {
            setPicked(new Set())
            requestAnimationFrame(() => searchInput.current?.focus())
          }}
          onSelectPage={() => setPicked(selectable)}
          pageCount={selectable.size}
        />
      ) : (
        <>
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
              ref={searchInput}
              id={searchId}
              className="max-sm:max-w-none sm:max-w-80"
              placeholder={t('advertSearchPlaceholder')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setAccountPage(1)
              }}
            />
          </Toolbar>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <Segmented
              label={t('advertStatus')}
              name={filterName}
              value={filter}
              onChange={(value) => {
                setFilter(value)
                setAccountPage(1)
              }}
              options={filters
                .filter(
                  ([value]) =>
                    (value !== 'waiting' && value !== 'excluded') ||
                    (accountId && canReadParts),
                )
                .map(([value, key]) => {
                  const count = matching.filter((row) =>
                    matchesFilter(row, value),
                  ).length
                  return {
                    value,
                    label:
                      wholeAccount && accountId && value !== 'all'
                        ? `${t(key)} · ${number(count) ?? count}`
                        : t(key),
                  }
                })}
            />
            {request.all ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => showAccount(false)}
              >
                {t('advertPageView')}
              </Button>
            ) : (
              current &&
              !wholeAccount && (
                <Button size="sm" onClick={() => showAccount(true)}>
                  {t('advertLoadAll')}
                </Button>
              )
            )}
          </div>
          {filtering && current && !wholeAccount && (
            <p className="rz-caption m-0">{t('advertSearchScope')}</p>
          )}
        </>
      )}

      {current?.localFailed && (
        <Notice
          tone="warn"
          action={
            <Button size="sm" onClick={refresh}>
              {t('retry')}
            </Button>
          }
        >
          {t('advertLocalError')}
        </Notice>
      )}

      {current === undefined ? (
        <SkeletonRows
          rows={3}
          variant="content"
          label={request.all ? t('advertLoadingAll') : t('loading')}
        />
      ) : current === null ? (
        <ErrorState
          title={t(request.all ? 'advertIndexError' : 'loadError')}
          description={t('readError')}
          onRetry={refresh}
        />
      ) : (
        <DataTable
          caption={t('adverts')}
          columns={columns}
          rows={visible}
          rowKey={(row) => row.key}
          rowClassName={() => 'olx-advert-row'}
          activeKey={activeAdvert ? `advert:${activeAdvert.id}` : null}
          onRowClick={openRow}
          {...(canBatch
            ? {
                selection: {
                  selected: picked,
                  onChange: setPicked,
                  rowLabel: (row: WorkspaceRow) =>
                    t('advertSelect', { title: rowTitle(row) }),
                  unavailable: (row: WorkspaceRow) =>
                    selectable.has(row.key)
                      ? undefined
                      : row.part?.partId
                        ? t('advertNoRowActions')
                        : tp('listingLinkFirst'),
                  selectOnRowClick: true,
                },
              }
            : {})}
          empty={
            rows.length === 0 && wholeAccount ? (
              <EmptyState
                className="rounded-none border-0"
                title={t('empty')}
                description={t('emptyHint')}
                actions={
                  partsHref && canReadParts ? (
                    <Button asChild variant="primary">
                      <Link to={partsHref}>{t('advertOpenParts')}</Link>
                    </Button>
                  ) : null
                }
              />
            ) : (
              <EmptyState
                className="rounded-none border-0"
                title={t(
                  wholeAccount ? 'advertNoAccountMatches' : 'advertNoMatches',
                )}
              />
            )
          }
          footer={
            <>
              <div className="rz-pager">
                <span className="font-mono" role="status">
                  {request.all
                    ? t('advertFullCount', {
                        shown: number(filtered.length) ?? filtered.length,
                        total: number(rows.length) ?? rows.length,
                      })
                    : filtering
                      ? t('advertFilteredCount', {
                          shown: number(visible.length) ?? visible.length,
                          loaded: number(rows.length) ?? rows.length,
                        })
                      : t('advertPageCount', {
                          loaded: number(rows.length) ?? rows.length,
                        })}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {t('checkedAt')} <DateValue value={current.checkedAt} />
                </span>
                {!request.all && (
                  <nav
                    className="rz-pager__nav"
                    aria-label={t('advertsPagination')}
                  >
                    <span className="whitespace-nowrap">
                      {t('page', {
                        page: number(request.page) ?? request.page,
                      })}
                    </span>
                    <Button
                      size="icon"
                      aria-label={t('previous')}
                      disabled={request.page === 1}
                      onClick={() => showPage(request.page - 1)}
                    >
                      <ChevronLeft aria-hidden />
                    </Button>
                    <Button
                      size="icon"
                      aria-label={t('next')}
                      disabled={!current.hasMore}
                      onClick={() => showPage(request.page + 1)}
                    >
                      <ChevronRight aria-hidden />
                    </Button>
                  </nav>
                )}
              </div>
              {request.all && totalPages > 1 && (
                <Pagination
                  page={displayedPage}
                  totalPages={totalPages}
                  total={filtered.length}
                  pageSize={pageSize}
                  onPage={showPage}
                  label={t('advertsPagination')}
                />
              )}
            </>
          }
        />
      )}

      {batch &&
        partsHref &&
        accountId &&
        (batch.mode === 'category' ? (
          onJobStarted && (
            <OlxBatchSheet
              initialMode="category"
              parts={batch.parts}
              expectedAccountId={accountId}
              partsHref={partsHref}
              onChanged={refresh}
              onJobStarted={onJobStarted}
              onClose={() => setBatch(null)}
              returnFocus={returnBatchFocus}
            />
          )
        ) : (
          <OlxBatchMaintenanceSheet
            mode={batch.mode}
            parts={batch.parts}
            expectedAccountId={accountId}
            partsHref={partsHref}
            onChanged={refresh}
            onClose={() => setBatch(null)}
            returnFocus={returnBatchFocus}
          />
        ))}

      {(canReadParts || isAdvertOpen) && (
        <Sheet
          open={preparing || isAdvertOpen}
          size={isAdvertOpen ? 'md' : 'lg'}
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
              canSeeDiagnostics={canSeeDiagnostics}
              actionsTarget={editorActions}
              partHref={activePartHref}
              {...(accountId ? { expectedAccountId: accountId } : {})}
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
              onPublicationChange={recordPublication}
              onMutationBusy={setEditorBusy}
            />
          ) : activeAdvert ? (
            <SectionPanel
              title={tp('statusSection')}
              headingLevel={3}
              variant="plain"
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
            </SectionPanel>
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
