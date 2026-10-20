import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Pause,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FormDialog,
  Notice,
  SearchInput,
  Sheet,
  SkeletonRows,
  StateScreen,
  StatusPill,
  TextArea,
  TextInput,
} from '@/components/app'
import {
  inventoryApi,
  type InventoryAuditEvent,
  type InventoryPartResult,
  type InventoryScan,
  type InventorySession,
  type InventorySessionResults,
  type InventoryZone,
  type InventorySection,
  type InventoryShelf,
  type PartInventoryZone,
  type Warehouse,
  type WarehouseDetail,
} from '@/api/inventory'
import { partsApi, type PartDetail, type PartHistory } from '@/api/parts'
import { historyDetails, historyLabel, unitLabel } from '../parts/part-labels'
import { teamApi } from '@/api/team'
import { normalizeApiProblem } from '@/api/errors'
import { cn } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import { useAccountingCurrency } from '../currency/use-accounting-currency'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { commonMessages, formatNumber, useT } from '@/i18n'
import { auditChange, auditTitle, type AuditKey } from './audit-labels'
import { auditMessages } from './audit-messages'
import { useInventoryFormat } from './inventory-format'
import { journalMessages } from './journal-messages'
import { inventoryMessages } from './messages'
import { newSessionMessages } from './new-session-messages'
import { overviewMessages } from './overview-messages'
import { placementMessages } from './placement-messages'
import { resultsMessages } from './results-messages'
import { sessionMessages } from './session-messages'
import { LocationSelect } from './LocationSelect'
import { LocationBrowser } from './LocationBrowser'
import { LocationLabelsPage } from './LocationLabelPrinter'
import { locationPartsHref } from './location-contents'
import { locationBrowserMessages } from './location-browser-messages'
import { warehouseMessages } from './warehouse-messages'
import { inventoryCodeFromName } from './inventory-code'
import { ZoneEditorSheet, type ZoneDraft } from './ZoneEditorSheet'

type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: T }

/** How many journal rows to show before the reader asks for more. */
const JOURNAL_PAGE = 25

function useLoad<T>(loader: (signal: AbortSignal) => Promise<T>, key: string) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LoadState<T>>({ kind: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    void loader(controller.signal).then(
      (data) => !controller.signal.aborted && setState({ kind: 'ready', data }),
      () => !controller.signal.aborted && setState({ kind: 'error' }),
    )
    return () => controller.abort()
  }, [key, loader, revision])
  const reload = useCallback(() => {
    setState({ kind: 'loading' })
    setRevision((value) => value + 1)
  }, [])
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  return useMemo(() => ({ state, reload, refresh }), [refresh, reload, state])
}

function Resource<T>({
  state,
  retry,
  children,
  errorContent,
  framed = true,
}: {
  state: LoadState<T>
  errorContent?: ReactNode
  /** Off inside a drawer: the host draws the frame. */
  framed?: boolean
  retry: () => void
  children: (data: T) => ReactNode
}) {
  const t = useT(inventoryMessages)
  if (state.kind === 'loading')
    return framed ? (
      <div className="rz-page">
        <SkeletonRows label={t('loading')} />
      </div>
    ) : (
      <SkeletonRows label={t('loading')} />
    )
  if (state.kind === 'error') {
    const failed = (
      <>
        <StateScreen
          actions={
            <Button onClick={retry}>
              <RefreshCw aria-hidden />
              {t('retry')}
            </Button>
          }
          icon={<AlertTriangle aria-hidden />}
          role="alert"
          title={t('loadFailed')}
          tone="danger"
        />
        {errorContent}
      </>
    )
    return framed ? <div className="rz-page">{failed}</div> : failed
  }
  return children(state.data)
}

export function InventoryScreen({
  definition: _definition,
}: CabinetModuleScreenProps) {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const route = segments[0] === 'app' ? segments.slice(2) : segments
  const partId = route[0] === 'parts' ? route[1] : undefined
  if (partId && route[2] === 'inventory') {
    return <PartPlacementView partId={partId} />
  }
  const tail = route[0] === 'inventory' ? route.slice(1) : []
  if (tail[0] === 'warehouses' && tail[1]) return <WarehouseView id={tail[1]} />
  if (tail[0] === 'zones' && tail[1])
    return <LocationView key={`zone:${tail[1]}`} id={tail[1]} kind="zone" />
  if (tail[0] === 'sections' && tail[1])
    return (
      <LocationView key={`section:${tail[1]}`} id={tail[1]} kind="section" />
    )
  if (tail[0] === 'sessions' && tail[1] === 'new') return <NewSessionView />
  if (tail[0] === 'sessions' && tail[1] && tail[2] === 'results')
    return <ResultsView id={tail[1]} />
  if (tail[0] === 'sessions' && tail[1] && tail[2] === 'audit')
    return <AuditView id={tail[1]} />
  if (tail[0] === 'sessions' && tail[1] && tail[2] === 'journal' && tail[3])
    return <JournalView id={tail[1]} zoneId={tail[3]} />
  if (tail[0] === 'sessions' && tail[1]) return <SessionView id={tail[1]} />
  return <Overview />
}

function useInventoryBase() {
  const { targetTenant } = useCabinet()
  return targetTenant ? cabinetPath(targetTenant.slug, 'inventory') : '/'
}

function usePermission(permission: string) {
  const { snapshot } = useCabinet()
  return snapshot?.permissions.has(permission) ?? false
}

/** Which sessions the overview is showing. */
const OVERVIEW_SEGMENTS = [
  { value: 'active' as const, label: 'segmentActive' as const },
  { value: 'done' as const, label: 'segmentDone' as const },
  { value: 'draft' as const, label: 'segmentDraft' as const },
]

type OverviewSegment = (typeof OVERVIEW_SEGMENTS)[number]['value']

const segmentOf = (status: InventorySession['status']): OverviewSegment =>
  status === 'draft'
    ? 'draft'
    : status === 'completed' || status === 'cancelled'
      ? 'done'
      : 'active'

/** How many days back the "checked recently" figure looks. */
const RECENT_DAYS = 30

interface OverviewData {
  warehouses: Warehouse[]
  sessions: InventorySession[]
  zones: InventoryZone[]
  /** Parts per warehouse, when the viewer may read the parts module. */
  byWarehouse: Map<string, number> | null
  /** The cut-off for "checked recently", taken once when the data loads. */
  since: number
}

function Overview() {
  const t = useT(overviewMessages)
  const ti = useT(inventoryMessages)
  const { date, day, sessionStatus, locale } = useInventoryFormat()
  const base = useInventoryBase()
  const navigate = useNavigate()
  const canManage = usePermission('inventory.manage')
  const canZones = usePermission('inventory.zones.manage')
  const canSeeParts = usePermission('parts.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<OverviewData> => {
      const [warehouses, sessions, zones, byWarehouse] = await Promise.all([
        inventoryApi.getWarehouses({ signal }),
        inventoryApi.getSessions({ signal }).then(
          (list) => list,
          () => [],
        ),
        inventoryApi.getZones({ activeOnly: true, signal }).then(
          (list) => list,
          () => [],
        ),
        canSeeParts
          ? partsApi.facets({}, ['warehouse'], { signal }).then(
              (facets) =>
                new Map(facets.warehouses.map((item) => [item.id, item.count])),
              () => null,
            )
          : Promise.resolve(null),
      ])
      return {
        warehouses,
        sessions,
        zones,
        byWarehouse,
        since: Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000,
      }
    },
    [canSeeParts],
  )
  const resource = useLoad(loader, 'inventory-overview')
  const [segment, setSegment] = useState<OverviewSegment>('active')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', code: '' })
  const [creating, setCreating] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  const createWarehouse = async () => {
    const name = draft.name.trim()
    const code = draft.code.trim()
    if (!name || !code) return
    setCreating(true)
    try {
      setOperationError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await inventoryApi.createWarehouse(
        { name, code },
        { signal: scope.signal },
      )
      setAdding(false)
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ warehouses, sessions, zones, byWarehouse, since }: OverviewData) => {
        const zonesOf = (item: InventorySession) =>
          [...new Set(item.zones.map((zone) => zone.zoneCode))].join(', ')
        const houseOf = (item: InventorySession) =>
          item.zones[0]?.warehouseName ?? '—'
        const doneZones = (item: InventorySession) =>
          item.zones.filter((zone) => zone.status === 'completed').length
        const closedAt = (item: InventorySession) =>
          item.completedAt ?? item.cancelledAt ?? item.createdAt
        const counts: Record<OverviewSegment, number> = {
          active: 0,
          done: 0,
          draft: 0,
        }
        for (const item of sessions) counts[segmentOf(item.status)] += 1
        const needle = query.trim().toLowerCase()
        const rows = sessions
          .filter((item) => segmentOf(item.status) === segment)
          .filter(
            (item) =>
              needle === '' ||
              `${item.number} ${houseOf(item)} ${zonesOf(item)}`
                .toLowerCase()
                .includes(needle),
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

        const completedSessions = sessions
          .filter((item) => item.status === 'completed')
          .sort((left, right) => closedAt(right).localeCompare(closedAt(left)))
        const last = completedSessions[0] ?? null
        const accuracy =
          last === null || last.preview.includedPartCount === 0
            ? null
            : Math.round(
                ((last.preview.includedPartCount -
                  last.preview.conflictingPartCount) /
                  last.preview.includedPartCount) *
                  1000,
              ) / 10
        const checkedZones = sessions
          .filter((item) => new Date(closedAt(item)).getTime() >= since)
          .reduce((sum, item) => sum + doneZones(item), 0)
        const countable = zones.filter((zone) => !zone.isSystemUnassigned)
        const running = sessions.filter(
          (item) => segmentOf(item.status) === 'active',
        )
        const openDiffs = running.reduce(
          (sum, item) => sum + item.preview.conflictingPartCount,
          0,
        )
        /* The last time each warehouse was counted, and whether one is
           running there right now. */
        const checkOf = (warehouseId: string) => {
          if (
            running.some((item) =>
              item.zones.some((zone) => zone.warehouseId === warehouseId),
            )
          )
            return t('checkRunning')
          const done = completedSessions.find((item) =>
            item.zones.some((zone) => zone.warehouseId === warehouseId),
          )
          return done === undefined
            ? t('neverChecked')
            : t('checkedOn', { date: day(done.completedAt) })
        }
        const stock = byWarehouse
        const stockTotal =
          stock === null
            ? 0
            : [...stock.values()].reduce((sum, value) => sum + value, 0)

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <p className="rz-crumbs m-0">
                <span>{ti('crumbWarehouse')}</span>
                <ChevronRight aria-hidden className="size-3" />
                <span aria-current="page">{ti('crumbInventory')}</span>
              </p>
              {canManage ? (
                <div className="rz-topbar__actions flex-wrap items-center">
                  <Button asChild variant="primary">
                    <Link to={`${base}/sessions/new`}>{ti('newSession')}</Link>
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <div className="rz-page-head">
                  <h1 className="rz-h-page">{ti('crumbInventory')}</h1>
                </div>
                <p className="rz-muted m-0 mt-1">
                  {last === null
                    ? t('noCompletedYet')
                    : t('lastCompleted', {
                        date: day(last.completedAt),
                        count: last.preview.conflictingPartCount,
                      })}
                </p>
              </div>

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              <div className="rz-kpis">
                <WarehouseStat
                  label={t('statActive')}
                  meta={
                    running.length === 0
                      ? t('nobodyCounting')
                      : [...new Set(running.map((item) => houseOf(item)))].join(
                          ', ',
                        )
                  }
                  tone={running.length > 0 ? 'warn' : 'plain'}
                  unit=""
                  value={String(running.length)}
                />
                <WarehouseStat
                  label={t('statZones')}
                  meta={t('lastDays', { count: RECENT_DAYS })}
                  unit={
                    countable.length === 0
                      ? t('zonesUnit')
                      : t('ofTotal', { count: countable.length })
                  }
                  value={String(checkedZones)}
                />
                <WarehouseStat
                  label={ti('discrepancies')}
                  meta={t('inRunning')}
                  tone={openDiffs > 0 ? 'danger' : 'plain'}
                  unit={ti('positionsUnit')}
                  value={String(openDiffs)}
                />
                <WarehouseStat
                  label={t('statAccuracy')}
                  meta={
                    last === null
                      ? t('noCompletedShort')
                      : t('lastSession', { number: last.number })
                  }
                  tone={accuracy === null ? 'plain' : 'ok'}
                  unit="%"
                  value={
                    accuracy === null
                      ? '—'
                      : (formatNumber(accuracy, locale, {
                          maximumFractionDigits: 1,
                        }) ?? '—')
                  }
                />
              </div>

              <div className="rz-toolbar" role="search">
                <SearchInput
                  aria-label={t('searchLabel')}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  value={query}
                />
                <div
                  aria-label={t('segmentsLabel')}
                  className="rz-seg flex-wrap"
                  role="radiogroup"
                >
                  {OVERVIEW_SEGMENTS.map((option) => (
                    <button
                      aria-checked={option.value === segment}
                      key={option.value}
                      onClick={() => setSegment(option.value)}
                      role="radio"
                      type="button"
                    >
                      {t(option.label)}{' '}
                      <span className="rz-mono text-app-dim text-micro">
                        {counts[option.value]}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="rz-toolbar__end rz-dim m-0">
                  {t('rowsSummary', { count: rows.length })}
                </p>
              </div>

              <section aria-label={t('sessionsLabel')}>
                <DataTable
                  caption={t('sessionsLabel')}
                  rows={rows}
                  rowKey={(item) => item.id}
                  onRowClick={(item) =>
                    void navigate(`${base}/sessions/${item.id}`)
                  }
                  empty={
                    <p className="rz-muted m-0 px-4 py-8 text-center">
                      {sessions.length === 0
                        ? t('noSessions')
                        : t('noFiltered')}
                    </p>
                  }
                  columns={[
                    {
                      key: 'session',
                      label: t('colSession'),
                      variant: 'primary',
                      cell: (item) => (
                        <span className="grid min-w-0 py-1.5">
                          <Link
                            className="text-app-strong"
                            onClick={(event) => event.stopPropagation()}
                            to={`${base}/sessions/${item.id}`}
                          >
                            {item.number}
                          </Link>
                          <span className="rz-caption font-normal">
                            {ti('created', { date: date(item.createdAt) })}
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: 'scope',
                      label: t('colWarehouseZones'),
                      cell: (item) =>
                        `${houseOf(item)}${zonesOf(item) === '' ? '' : ` · ${zonesOf(item)}`}`,
                    },
                    {
                      key: 'progress',
                      label: t('colProgress'),
                      cell: (item) => {
                        const total = item.zones.length
                        const done = doneZones(item)
                        const percent =
                          total === 0 ? 0 : Math.round((done / total) * 100)
                        return (
                          <span className="grid min-w-28 gap-1">
                            <span
                              aria-hidden
                              className={cn(
                                'rz-meter',
                                percent < 100 && 'rz-meter--warn',
                              )}
                            >
                              <span style={{ width: `${String(percent)}%` }} />
                            </span>
                            <span className="rz-mono rz-caption">
                              {ti('zonesProgress', { done, count: total })}
                            </span>
                          </span>
                        )
                      },
                    },
                    {
                      key: 'diffs',
                      label: ti('discrepancies'),
                      align: 'end',
                      cell: (item) => (
                        <span
                          className={cn(
                            item.status === 'draft'
                              ? 'text-app-dim'
                              : item.preview.conflictingPartCount === 0
                                ? 'text-state-ok'
                                : 'text-state-danger',
                          )}
                        >
                          {item.status === 'draft'
                            ? '—'
                            : item.preview.conflictingPartCount}
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      label: t('colStatus'),
                      cell: (item) => {
                        const [label, tone] = sessionStatus(item.status)
                        return <StatusPill tone={tone}>{label}</StatusPill>
                      },
                    },
                  ]}
                />
              </section>

              <section aria-label={t('warehouses')} className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="rz-h-title">{t('warehouses')}</h2>
                  {canZones ? (
                    <Button
                      onClick={() => {
                        setDraft({ name: '', code: '' })
                        setAdding(true)
                      }}
                    >
                      <Plus aria-hidden />
                      {t('addWarehouse')}
                    </Button>
                  ) : null}
                </div>
                {warehouses.length === 0 ? (
                  <EmptyState
                    description={t('noWarehousesHint')}
                    title={t('noWarehousesTitle')}
                  />
                ) : (
                  <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3 p-0">
                    {warehouses.map((item) => {
                      const parts = stock?.get(item.id) ?? null
                      const share =
                        parts === null || stockTotal === 0
                          ? 0
                          : Math.round((parts / stockTotal) * 100)
                      return (
                        <li key={item.id}>
                          <Link
                            className="rz-card rz-card__body block h-full text-app-ink transition-colors hover:border-app-line-2"
                            to={`${base}/warehouses/${item.id}`}
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="rz-strong font-semibold">
                                {item.name}
                              </span>
                              <span className="rz-mono rz-caption">
                                {ti('zones', { count: item.zoneCount })}
                              </span>
                            </span>
                            <span className="rz-muted mt-0.5 block text-caption">
                              {[
                                t('warehouseCode', { code: item.code }),
                                item.isSystemDefault ? t('defaultTag') : null,
                                item.isActive ? null : t('archivedTag'),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            <span aria-hidden className="rz-meter mt-3">
                              <span style={{ width: `${String(share)}%` }} />
                            </span>
                            <span className="rz-muted mt-2 flex items-baseline justify-between gap-3 text-caption">
                              <span>
                                {parts === null
                                  ? ti('stockUnavailable')
                                  : t('shareOfYard', { share })}
                              </span>
                              <span className="rz-mono">
                                {parts === null
                                  ? '—'
                                  : t('positionsShort', { count: parts })}
                              </span>
                            </span>
                            <span className="border-app-line rz-dim mt-3 block border-t pt-3 text-caption">
                              {checkOf(item.id)}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>

            <WarehouseEditorSheet
              open={adding}
              draft={draft}
              onChange={setDraft}
              onClose={() => setAdding(false)}
              onSubmit={() => void createWarehouse()}
              pending={creating}
              error={operationError}
            />
          </div>
        )
      }}
    </Resource>
  )
}

function WarehouseEditorSheet({
  open,
  draft,
  onChange,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  open: boolean
  draft: { name: string; code: string }
  onChange: (draft: { name: string; code: string }) => void
  onClose: () => void
  onSubmit: () => void
  pending: boolean
  error: string | null
}) {
  const t = useT(overviewMessages)
  const tc = useT(commonMessages)
  const formId = useId()
  return (
    <Sheet
      open={open}
      title={t('newWarehouseTitle')}
      description={t('newWarehouseHint')}
      onOpenChange={(next) => {
        if (!next && !pending) onClose()
      }}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} type="button">
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending || !draft.name.trim() || !draft.code.trim()}
            form={formId}
            type="submit"
            variant="primary"
          >
            {t('addWarehouse')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        aria-busy={pending}
        className="grid content-start gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!pending && draft.name.trim() && draft.code.trim()) onSubmit()
        }}
      >
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <NameAndCode draft={draft} onChange={onChange} />
      </form>
    </Sheet>
  )
}

/** One zone of the warehouse, as the detail endpoint returns it. */
type WarehouseZone = WarehouseDetail['zones'][number]

/** What the parts module knows about this warehouse's stock. */
interface WarehouseStock {
  /** Parts per zone, counted under this warehouse's filter. */
  byZone: Map<string, number>
  total: number | null
  differing: number | null
}

interface WarehouseData {
  warehouse: WarehouseDetail
  sessions: InventorySession[]
  stock: WarehouseStock
  people: { userId: string; name: string }[]
}

const EMPTY_STOCK: WarehouseStock = {
  byZone: new Map(),
  total: null,
  differing: null,
}

/**
 * How much of the yard sits in this warehouse. The parts module owns these
 * numbers, so a viewer without `parts.view` simply sees none of them rather
 * than a failed request.
 */
async function loadWarehouseStock(
  warehouseId: string,
  signal: AbortSignal,
): Promise<WarehouseStock> {
  try {
    const [facets, all, differing] = await Promise.all([
      partsApi.facets({ warehouseIds: [warehouseId] }, ['zone'], { signal }),
      partsApi.search({ warehouseIds: [warehouseId], pageSize: 1 }, { signal }),
      partsApi.search(
        { warehouseIds: [warehouseId], hasDiscrepancy: true, pageSize: 1 },
        { signal },
      ),
    ])
    return {
      byZone: new Map(facets.zones.map((zone) => [zone.id, zone.count])),
      total: all.total,
      differing: differing.total,
    }
  } catch {
    return EMPTY_STOCK
  }
}

function WarehouseView({ id }: { id: string }) {
  const t = useT(warehouseMessages)
  const ti = useT(inventoryMessages)
  const tc = useT(commonMessages)
  const { date, day } = useInventoryFormat()
  const { currency: inventoryCurrency } = useAccountingCurrency()
  const base = useInventoryBase()
  const { targetTenant } = useCabinet()
  const navigate = useNavigate()
  const [labelParams] = useSearchParams()
  const labelsOpen = labelParams.get('labels') === '1'
  const labelTriggerRef = useRef<HTMLButtonElement>(null)
  const canManage = usePermission('inventory.zones.manage')
  const canSession = usePermission('inventory.manage')
  const canSeeParts = usePermission('parts.view')
  const canSeeTeam = usePermission('team.view')
  const partsBase = targetTenant
    ? cabinetPath(targetTenant.slug, 'parts')
    : null
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<WarehouseData> => {
      const [warehouse, sessions, stock, people] = await Promise.all([
        inventoryApi.getWarehouse(id, { signal }),
        inventoryApi.getSessions({ signal }).then(
          (list) => list,
          () => [],
        ),
        canSeeParts
          ? loadWarehouseStock(id, signal)
          : Promise.resolve(EMPTY_STOCK),
        canSeeTeam
          ? teamApi.listMembers({ signal }).then(
              (members) =>
                members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                })),
              () => [],
            )
          : Promise.resolve([]),
      ])
      return { warehouse, sessions, stock, people }
    },
    [canSeeParts, canSeeTeam, id],
  )
  const resource = useLoad(loader, id)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Which write is asking for input: at most one dialog is open at a time. */
  const [editingWarehouse, setEditingWarehouse] = useState(false)
  const [archivingWarehouse, setArchivingWarehouse] = useState(false)
  const [addingZone, setAddingZone] = useState(false)
  const [editingZone, setEditingZone] = useState<WarehouseZone | null>(null)
  const [archivingZone, setArchivingZone] = useState<WarehouseZone | null>(null)
  const [draft, setDraft] = useState({ name: '', code: '' })

  const run = async (write: (signal: AbortSignal) => Promise<void>) => {
    setBusy(true)
    try {
      setOperationError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await write(scope.signal)
      return true
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const createZone = async (input: ZoneDraft) => {
    const { name, code } = input
    if (!name || !code) return
    const ok = await run((signal) =>
      inventoryApi
        .createZone({ warehouseId: id, name, code }, { signal })
        .then(() => undefined),
    )
    if (!ok) return
    setAddingZone(false)
    resource.reload()
  }
  const saveWarehouse = async (warehouse: WarehouseDetail) => {
    const name = draft.name.trim()
    const code = draft.code.trim()
    if (!name || !code) return
    const ok = await run((signal) =>
      inventoryApi
        .updateWarehouse(
          id,
          { name, code, isActive: warehouse.isActive },
          { signal },
        )
        .then(() => undefined),
    )
    if (!ok) return
    setEditingWarehouse(false)
    resource.reload()
  }
  const archiveWarehouse = async () => {
    const ok = await run((signal) =>
      inventoryApi.archiveWarehouse(id, { signal }),
    )
    if (!ok) return
    setArchivingWarehouse(false)
    void navigate(base, { replace: true })
  }
  const saveZone = async (zone: WarehouseZone, input: ZoneDraft) => {
    const { name, code } = input
    if (!name || !code) return
    const ok = await run((signal) =>
      inventoryApi
        .updateZone(
          zone.id,
          { name, code, isActive: zone.isActive },
          { signal },
        )
        .then(() => undefined),
    )
    if (!ok) return
    setEditingZone(null)
    resource.reload()
  }
  const archiveZone = async (zone: WarehouseZone) => {
    const ok = await run((signal) =>
      inventoryApi.archiveZone(zone.id, { signal }),
    )
    if (!ok) return
    setArchivingZone(null)
    resource.reload()
  }
  const startAddingZone = () => {
    setOperationError(null)
    setDraft({ name: '', code: '' })
    setAddingZone(true)
  }

  return (
    <Resource
      retry={resource.reload}
      state={resource.state}
      errorContent={
        labelsOpen ? (
          <LocationLabelsPage
            target={{ kind: 'zone', parentId: id, parentName: '' }}
            inventoryBase={base}
            returnFocusRef={labelTriggerRef}
          />
        ) : null
      }
    >
      {({ warehouse, sessions, stock, people }: WarehouseData) => {
        const nameOf = (userId?: string | null) =>
          userId == null
            ? null
            : (people.find((person) => person.userId === userId)?.name ?? null)
        const zones = warehouse.zones
        /** The zones a person actually fills — the catch-all is not one. */
        const real = zones.filter((zone) => !zone.isSystemUnassigned)
        const partsIn = (zoneId: string) => stock.byZone.get(zoneId) ?? 0
        const filled = real.filter((zone) => partsIn(zone.id) > 0).length
        const occupancy =
          stock.total === null || real.length === 0
            ? null
            : Math.round((filled / real.length) * 100)

        const mine = sessions.filter((item) =>
          item.zones.some((zone) => zone.warehouseId === warehouse.id),
        )
        const active =
          mine.find(
            (item) => item.status === 'inProgress' || item.status === 'review',
          ) ??
          mine.find((item) => item.status === 'draft') ??
          null
        const closedAt = (item: InventorySession) =>
          item.completedAt ?? item.cancelledAt ?? item.createdAt
        const history = mine
          .filter(
            (item) =>
              item.status === 'completed' || item.status === 'cancelled',
          )
          .sort((left, right) => closedAt(right).localeCompare(closedAt(left)))
          .slice(0, 5)
        /** When this zone was last counted, or that a count is running now. */
        const checkOf = (zoneId: string) => {
          if (active?.zones.some((zone) => zone.zoneId === zoneId) === true)
            return { label: t('zoneRunning'), tone: 'text-state-warn' }
          const last = history.find(
            (item) =>
              item.status === 'completed' &&
              item.zones.some((zone) => zone.zoneId === zoneId),
          )
          return last === undefined
            ? { label: t('zoneNeverChecked'), tone: 'text-app-dim' }
            : { label: day(last.completedAt), tone: 'text-app-muted' }
        }
        const zonesOf = (item: InventorySession) =>
          [...new Set(item.zones.map((zone) => zone.zoneName))].join(', ')
        const countedZones =
          active === null
            ? 0
            : active.zones.filter((zone) => zone.status === 'completed').length

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <Link className="rz-btn rz-btn--ghost" to={base}>
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {ti('backToInventory')}
                </Link>
                <p className="rz-crumbs m-0 hidden sm:flex">
                  <span>{ti('crumbWarehouse')}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span>{ti('crumbWarehouses')}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span className="text-app-muted truncate">
                    {warehouse.name}
                  </span>
                </p>
              </div>
              <div className="rz-topbar__actions flex-wrap items-center">
                {canManage ? (
                  <Button
                    onClick={() => {
                      setDraft({ name: warehouse.name, code: warehouse.code })
                      setEditingWarehouse(true)
                    }}
                  >
                    <Pencil aria-hidden />
                    {t('edit')}
                  </Button>
                ) : null}
                {canSession ? (
                  <Button asChild variant="primary">
                    <Link to={`${base}/sessions/new`}>{ti('newSession')}</Link>
                  </Button>
                ) : null}
                <ActionMenu
                  triggerRef={labelTriggerRef}
                  actions={[
                    {
                      key: 'print',
                      label: t('printZones'),
                      icon: <Printer aria-hidden />,
                      onSelect: () =>
                        void navigate(
                          `${base}/warehouses/${encodeURIComponent(id)}?labels=1`,
                        ),
                    },
                    {
                      key: 'export',
                      label: t('exportStock'),
                      icon: <Download aria-hidden />,
                      disabled: true,
                      title: t('exportUnavailable'),
                      onSelect: () => undefined,
                    },
                    ...(canManage && !warehouse.isSystemDefault
                      ? [
                          {
                            key: 'archive',
                            label: t('archiveWarehouse'),
                            icon: <Archive aria-hidden />,
                            destructive: true as const,
                            onSelect: () => setArchivingWarehouse(true),
                          },
                        ]
                      : []),
                  ]}
                  label={t('moreActions')}
                />
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <div className="rz-page-head items-center">
                  <h1 className="rz-h-page">{warehouse.name}</h1>
                  {warehouse.isActive ? (
                    <StatusPill tone="ok">{t('active')}</StatusPill>
                  ) : (
                    <StatusPill tone="neutral">{t('archived')}</StatusPill>
                  )}
                </div>
                <p className="rz-muted m-0 mt-1">
                  {[
                    t('code', { code: warehouse.code }),
                    ti('zones', { count: real.length }),
                    stock.total === null
                      ? null
                      : ti('positions', { count: stock.total }),
                    t('unassigned', { count: warehouse.unassignedPartCount }),
                    warehouse.isSystemDefault ? t('defaultWarehouse') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              <div className="rz-kpis">
                <WarehouseStat
                  label={t('statPositions')}
                  meta={`${ti('zones', { count: real.length })} · ${t('unassigned', { count: warehouse.unassignedPartCount })}`}
                  unit={ti('positionsUnit')}
                  value={stock.total == null ? '—' : String(stock.total)}
                />
                <WarehouseStat
                  label={t('statFilled')}
                  meta={
                    occupancy === null
                      ? t('needsPartsView')
                      : t('filledMeta', { filled, count: real.length })
                  }
                  tone={
                    occupancy !== null && occupancy >= 80 ? 'warn' : 'plain'
                  }
                  unit="%"
                  value={occupancy == null ? '—' : String(occupancy)}
                />
                <WarehouseStat
                  label={t('statValue')}
                  meta={t('valueNotCounted')}
                  unit={inventoryCurrency ?? ''}
                  value="—"
                />
                <WarehouseStat
                  label={ti('discrepancies')}
                  meta={t('openDiffs')}
                  tone={
                    stock.differing !== null && stock.differing > 0
                      ? 'danger'
                      : 'plain'
                  }
                  unit={ti('positionsUnit')}
                  value={
                    stock.differing == null ? '—' : String(stock.differing)
                  }
                />
              </div>

              <div className="grid min-w-0 gap-3">
                <Card
                  aside={
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage ? (
                        <Button onClick={startAddingZone} variant="primary">
                          <Plus aria-hidden />
                          {t('addZone')}
                        </Button>
                      ) : null}
                    </div>
                  }
                  bodyClassName={labelsOpen ? '' : 'p-0'}
                  className="min-w-0"
                  title={t('zonesTitle')}
                >
                  {labelsOpen ? (
                    <LocationLabelsPage
                      target={{
                        kind: 'zone',
                        parentId: id,
                        parentName: warehouse.name,
                      }}
                      inventoryBase={base}
                      returnFocusRef={labelTriggerRef}
                    />
                  ) : (
                    <DataTable
                      embedded
                      caption={t('zonesTitle')}
                      rows={zones}
                      rowKey={(zone) => zone.id}
                      empty={
                        <p className="rz-muted m-0 px-4 py-6">{t('noZones')}</p>
                      }
                      columns={[
                        {
                          key: 'zone',
                          label: t('colZone'),
                          variant: 'primary',
                          cell: (zone) => (
                            <div className="min-w-0 py-1.5">
                              {zone.isSystemUnassigned && partsBase === null ? (
                                <span className="rz-strong font-semibold">
                                  {zone.name}
                                </span>
                              ) : (
                                <Link
                                  className="text-app-strong inline-flex items-center gap-1.5 font-semibold"
                                  to={
                                    zone.isSystemUnassigned
                                      ? `${partsBase}?zone=${encodeURIComponent(zone.id)}`
                                      : `${base}/zones/${encodeURIComponent(zone.id)}`
                                  }
                                >
                                  {zone.name}
                                  {!zone.isSystemUnassigned ? (
                                    <ChevronRight
                                      aria-hidden
                                      className="text-app-dim size-3.5 shrink-0"
                                    />
                                  ) : null}
                                </Link>
                              )}
                              <p className="rz-caption m-0 font-normal">
                                {[
                                  zone.code,
                                  zone.isSystemUnassigned
                                    ? t('systemTag')
                                    : null,
                                  zone.isActive ? null : t('archivedZoneTag'),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          ),
                        },
                        {
                          key: 'positions',
                          label: t('colPositions'),
                          align: 'end',
                          cell: (zone) =>
                            stock.total === null ? '—' : partsIn(zone.id),
                        },
                        {
                          key: 'fill',
                          label: t('colFill'),
                          cell: (zone) => {
                            /** How much of the warehouse's stock lies in this zone. */
                            const share =
                              stock.total === null || stock.total === 0
                                ? 0
                                : Math.round(
                                    (partsIn(zone.id) / stock.total) * 100,
                                  )
                            return (
                              <span className="grid min-w-28 gap-1">
                                <span aria-hidden className="rz-meter">
                                  <span
                                    style={{ width: `${String(share)}%` }}
                                  />
                                </span>
                                <span className="rz-mono rz-caption">
                                  {stock.total === null
                                    ? ti('stockUnavailable')
                                    : t('shareOfWarehouse', { share })}
                                </span>
                              </span>
                            )
                          },
                        },
                        {
                          key: 'checked',
                          label: t('colChecked'),
                          align: 'end',
                          cell: (zone) => {
                            const check = checkOf(zone.id)
                            return (
                              <span className={cn('font-sans', check.tone)}>
                                {check.label}
                              </span>
                            )
                          },
                        },
                        ...(canManage
                          ? [
                              {
                                key: 'actions',
                                label: t('colActions'),
                                align: 'end' as const,
                                cell: (zone: WarehouseZone) => (
                                  <span className="inline-flex gap-1">
                                    <Button
                                      aria-label={t('editZone', {
                                        name: zone.name,
                                      })}
                                      disabled={zone.isSystemUnassigned}
                                      onClick={() => {
                                        setOperationError(null)
                                        setEditingZone(zone)
                                      }}
                                      size="icon"
                                      title={
                                        zone.isSystemUnassigned
                                          ? t('systemNoEdit')
                                          : undefined
                                      }
                                      variant="quiet"
                                    >
                                      <Pencil aria-hidden />
                                    </Button>
                                    <Button
                                      aria-label={t('archiveZoneLabel', {
                                        name: zone.name,
                                      })}
                                      disabled={zone.isSystemUnassigned}
                                      onClick={() => setArchivingZone(zone)}
                                      size="icon"
                                      title={
                                        zone.isSystemUnassigned
                                          ? t('systemNoArchive')
                                          : undefined
                                      }
                                      variant="quiet"
                                    >
                                      <Archive aria-hidden />
                                    </Button>
                                  </span>
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  )}
                </Card>

                <div className="grid min-w-0 gap-3 lg:grid-cols-2 lg:items-start">
                  <section
                    aria-label={t('activeSession')}
                    className="rz-card rz-card__body"
                  >
                    <h2 className="rz-h-card">{t('activeSession')}</h2>
                    {active === null ? (
                      <>
                        <p className="rz-h-title mt-3">{t('noCheck')}</p>
                        <p className="text-app-muted mt-1 text-body">
                          {t('lastCount', {
                            date:
                              history[0] === undefined
                                ? t('lastCountNever')
                                : day(closedAt(history[0])),
                          })}
                        </p>
                        {canSession ? (
                          <Button
                            asChild
                            className="rz-btn--lg mt-4 w-full"
                            variant="primary"
                          >
                            <Link to={`${base}/sessions/new`}>
                              {t('startSession')}
                            </Link>
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="rz-h-title mt-3">
                          {active.number} · {zonesOf(active)}
                        </p>
                        <p className="text-app-muted mt-1 text-body">
                          {active.startedAt == null
                            ? ti('created', { date: date(active.createdAt) })
                            : ti('started', { date: date(active.startedAt) })}
                          {nameOf(active.startedBy ?? active.createdBy) === null
                            ? null
                            : ` · ${String(nameOf(active.startedBy ?? active.createdBy))}`}
                        </p>
                        <span
                          aria-hidden
                          className="rz-meter rz-meter--warn mt-4"
                        >
                          <span
                            className="block"
                            style={{
                              width: `${String(
                                active.zones.length === 0
                                  ? 0
                                  : Math.round(
                                      (countedZones / active.zones.length) *
                                        100,
                                    ),
                              )}%`,
                            }}
                          />
                        </span>
                        <p className="text-app-muted mt-2.5 flex justify-between gap-3 font-mono text-caption">
                          <span>
                            {ti('zonesProgress', {
                              done: countedZones,
                              count: active.zones.length,
                            })}
                          </span>
                          <span>
                            {ti('conflicts', {
                              count: active.preview.conflictingPartCount,
                            })}
                          </span>
                        </p>
                        <Button
                          asChild
                          className="rz-btn--lg mt-4 w-full"
                          variant="primary"
                        >
                          <Link to={`${base}/sessions/${active.id}`}>
                            {t('continueSession')}
                          </Link>
                        </Button>
                      </>
                    )}
                  </section>

                  <Card
                    aside={
                      <Link className="font-medium" to={base}>
                        {t('all')}
                      </Link>
                    }
                    bodyClassName="p-0"
                    title={t('historyTitle')}
                  >
                    {history.length === 0 ? (
                      <p className="rz-muted m-0 px-4 pt-3 pb-4">
                        {t('noHistory')}
                      </p>
                    ) : (
                      <ul className="grid">
                        {history.map((item) => {
                          const conflicts = item.preview.conflictingPartCount
                          return (
                            <li
                              className="border-app-line flex items-center gap-4 border-t px-4 py-3.5"
                              key={item.id}
                            >
                              <div className="min-w-0 flex-1">
                                <Link
                                  className="text-body font-semibold text-app-strong hover:underline"
                                  to={`${base}/sessions/${item.id}`}
                                >
                                  {item.number} · {zonesOf(item)}
                                </Link>
                                <p className="text-app-muted mt-0.5 text-caption">
                                  {[
                                    day(closedAt(item)),
                                    nameOf(item.completedBy ?? item.createdBy),
                                    item.status === 'cancelled'
                                      ? t('cancelledTag')
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              </div>
                              <p
                                className={cn(
                                  'font-mono text-body whitespace-nowrap tabular-nums',
                                  conflicts === 0
                                    ? 'text-state-ok'
                                    : 'text-state-danger',
                                )}
                              >
                                {conflicts}
                                <span className="sr-only">
                                  {' '}
                                  {ti('conflictsWord', { count: conflicts })}
                                </span>
                              </p>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Card>
                </div>
              </div>
            </div>

            <FormDialog
              description={t('editWarehouseHint')}
              onOpenChange={(next) => {
                if (!next) setEditingWarehouse(false)
              }}
              onSubmit={(event) => {
                event.preventDefault()
                void saveWarehouse(warehouse)
              }}
              open={editingWarehouse}
              pending={busy}
              submitDisabled={
                draft.name.trim() === '' || draft.code.trim() === ''
              }
              submitLabel={tc('save')}
              title={t('editWarehouseTitle')}
            >
              <NameAndCode
                draft={draft}
                initialCode={warehouse.code}
                onChange={setDraft}
              />
            </FormDialog>

            {addingZone ? (
              <ZoneEditorSheet
                eyebrow={warehouse.name}
                error={operationError}
                onClose={() => setAddingZone(false)}
                onSubmit={(input) => void createZone(input)}
                pending={busy}
              />
            ) : null}

            {editingZone === null ? null : (
              <ZoneEditorSheet
                description={t('editZoneHint', {
                  zone: editingZone.name,
                  warehouse: warehouse.name,
                })}
                eyebrow={warehouse.name}
                error={operationError}
                initial={{ name: editingZone.name, code: editingZone.code }}
                key={editingZone.id}
                onClose={() => setEditingZone(null)}
                onSubmit={(input) => void saveZone(editingZone, input)}
                pending={busy}
              />
            )}

            <ConfirmDialog
              confirmLabel={t('archiveWarehouse')}
              consequence={t('archiveWarehouseConsequence', {
                name: warehouse.name,
              })}
              destructive
              onConfirm={() => void archiveWarehouse()}
              onOpenChange={(next) => {
                if (!next) setArchivingWarehouse(false)
              }}
              open={archivingWarehouse}
              pending={busy}
              title={t('archiveWarehouseTitle')}
            />

            <ConfirmDialog
              confirmLabel={t('archiveZone')}
              consequence={
                archivingZone === null
                  ? ''
                  : t('archiveZoneConsequence', { name: archivingZone.name })
              }
              destructive
              onConfirm={() => {
                if (archivingZone !== null) void archiveZone(archivingZone)
              }}
              onOpenChange={(next) => {
                if (!next) setArchivingZone(null)
              }}
              open={archivingZone !== null}
              pending={busy}
              title={t('archiveZoneTitle')}
            />
          </div>
        )
      }}
    </Resource>
  )
}

function LocationView({ id, kind }: { id: string; kind: 'zone' | 'section' }) {
  const t = useT(warehouseMessages)
  const ti = useT(inventoryMessages)
  const base = useInventoryBase()
  const location = useLocation()
  const labelsOpen = new URLSearchParams(location.search).get('labels') === '1'
  const { targetTenant } = useCabinet()
  const canViewParts = usePermission('parts.view')
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const section =
        kind === 'section'
          ? await inventoryApi.getSection(id, { signal })
          : null
      if (section && section.id !== id) throw new Error('Section unavailable')
      const zone = await inventoryApi.getZone(section?.zoneId ?? id, { signal })
      if (
        (section &&
          (zone.id !== section.zoneId ||
            zone.warehouseId !== section.warehouseId)) ||
        (!section && zone.id !== id)
      )
        throw new Error('Zone unavailable')
      return { zone, section }
    },
    [id, kind],
  )
  const resource = useLoad(loader, id)
  return (
    <Resource
      state={resource.state}
      retry={resource.reload}
      errorContent={
        labelsOpen ? (
          <LocationLabelsPage
            target={{
              kind: kind === 'section' ? 'shelf' : 'section',
              parentId: id,
              parentName: '',
            }}
            inventoryBase={base}
          />
        ) : null
      }
    >
      {({ zone, section }) => {
        const state = location.state as {
          zoneId?: unknown
          zoneSearch?: unknown
          zoneQuery?: unknown
        } | null
        const zoneSearch =
          state?.zoneId === zone.id && typeof state.zoneSearch === 'string'
            ? state.zoneSearch
            : ''
        const returnQuery =
          state?.zoneId === zone.id && typeof state.zoneQuery === 'string'
            ? state.zoneQuery
              ? `?${state.zoneQuery}`
              : ''
            : zoneSearch
              ? `?${new URLSearchParams({ locationSearch: zoneSearch }).toString()}`
              : ''
        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  className="rz-btn rz-btn--ghost shrink-0"
                  to={
                    section
                      ? `${base}/zones/${zone.id}${returnQuery}`
                      : `${base}/warehouses/${zone.warehouseId}`
                  }
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t(section ? 'backToZone' : 'backToWarehouse')}
                </Link>
                <p className="rz-crumbs m-0 hidden sm:flex">
                  <span>{ti('crumbWarehouse')}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span className="truncate">{zone.warehouseName}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  {section ? (
                    <>
                      <span className="truncate">{zone.name}</span>
                      <ChevronRight aria-hidden className="size-3" />
                    </>
                  ) : null}
                  <span aria-current="page">
                    {t(section ? 'sectionType' : 'zoneType')}
                  </span>
                </p>
              </div>
              {canViewParts && targetTenant ? (
                <Button asChild>
                  <Link
                    to={locationPartsHref(
                      cabinetPath(targetTenant.slug, 'parts'),
                      zone.warehouseId,
                      section
                        ? {
                            kind: 'section',
                            zoneId: zone.id,
                            sectionId: section.id,
                            name: section.name,
                            path: [],
                          }
                        : {
                            kind: 'zone',
                            zoneId: zone.id,
                            name: zone.name,
                            path: [],
                          },
                    )}
                  >
                    {t(section ? 'allSectionParts' : 'allZoneParts')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="rz-page">
              <header className="min-w-0">
                <h1 className="rz-h-page break-words">
                  {section?.name ?? zone.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <StatusPill
                    tone={
                      zone.isActive && section?.isActive !== false
                        ? 'ok'
                        : 'neutral'
                    }
                  >
                    {t(
                      zone.isActive && section?.isActive !== false
                        ? 'zoneActive'
                        : 'zoneArchived',
                    )}
                  </StatusPill>
                  <p className="rz-mono rz-muted m-0 min-w-0 break-all">
                    {t('code', { code: section?.code ?? zone.code })}
                  </p>
                </div>
              </header>
              {zone.isActive &&
              section?.isActive !== false &&
              !zone.isSystemUnassigned ? (
                <>
                  <ZoneLocations
                    zone={zone}
                    {...(section ? { section } : {})}
                    onStructureChange={resource.refresh}
                  />
                </>
              ) : (
                <>
                  <Notice>
                    {t(
                      zone.isSystemUnassigned
                        ? 'systemZoneStructure'
                        : 'archivedZoneStructure',
                    )}
                  </Notice>
                  {labelsOpen && !zone.isSystemUnassigned ? (
                    <div className="rz-card rz-card__body">
                      <LocationLabelsPage
                        target={{
                          kind: section ? 'shelf' : 'section',
                          parentId: section?.id ?? zone.id,
                          parentName: section?.name ?? zone.name,
                        }}
                        inventoryBase={base}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )
      }}
    </Resource>
  )
}

function ZoneLocations({
  zone,
  section,
  onStructureChange,
}: {
  zone: InventoryZone
  section?: InventorySection
  onStructureChange: () => void
}) {
  const base = useInventoryBase()
  const navigate = useNavigate()
  const location = useLocation()
  const labelsOpen = new URLSearchParams(location.search).get('labels') === '1'
  const labelTriggerRef = useRef<HTMLButtonElement>(null)
  const warehouseId = zone.warehouseId
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const t = useT(warehouseMessages)
  const tc = useT(commonMessages)
  const tb = useT(locationBrowserMessages)
  const formId = useId()
  const canManage = usePermission('inventory.zones.manage')
  const canViewParts = usePermission('parts.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const [shelves, sections] = await Promise.all([
        inventoryApi.getShelves(
          zone.id,
          { signal, includePartCounts: false },
          section?.id,
        ),
        section
          ? Promise.resolve([section])
          : inventoryApi.getSections(zone.id, {
              signal,
              includePartCounts: false,
            }),
      ])
      return {
        shelves: shelves.filter(
          (item) =>
            item.warehouseId === warehouseId &&
            item.zoneId === zone.id &&
            (!section || item.sectionId === section.id),
        ),
        sections: sections.filter(
          (item) => item.warehouseId === warehouseId && item.zoneId === zone.id,
        ),
      }
    },
    [warehouseId, zone.id, section],
  )
  const resource = useLoad(loader, `${zone.id}:${section?.id ?? ''}`)
  const [addingTo, setAddingTo] = useState<InventorySection | null>(null)
  const [addingSectionTo, setAddingSectionTo] = useState<WarehouseZone | null>(
    null,
  )
  const [editingSection, setEditingSection] = useState<InventorySection | null>(
    null,
  )
  const [archivingSection, setArchivingSection] =
    useState<InventorySection | null>(null)
  const [editing, setEditing] = useState<InventoryShelf | null>(null)
  const [choosingShelf, setChoosingShelf] = useState(false)
  const [draft, setDraft] = useState({ name: '', code: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedShelves =
    resource.state.kind === 'ready' ? resource.state.data.shelves : []
  const loadedSections =
    resource.state.kind === 'ready' ? resource.state.data.sections : []
  const sectionShelfCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (resource.state.kind !== 'ready') return counts
    for (const item of resource.state.data.sections) {
      if (item.isActive) counts.set(item.id, 0)
    }
    for (const shelf of resource.state.data.shelves) {
      if (shelf.isActive && counts.has(shelf.sectionId))
        counts.set(shelf.sectionId, (counts.get(shelf.sectionId) ?? 0) + 1)
    }
    return counts
  }, [resource.state])

  const write = async (action: (signal: AbortSignal) => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await action(scope.signal)
      if (scope.signal.aborted || !mounted.current) return false
      resource.reload()
      onStructureChange()
      return true
    } catch (cause) {
      setError(normalizeApiProblem(cause).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const name = draft.name.trim()
    const code = draft.code.trim()
    if (!name || !code) return
    let createdSectionId: string | undefined
    const ok = addingSectionTo
      ? await write(async (signal) => {
          const created = await inventoryApi.createSection(
            { zoneId: addingSectionTo.id, name, code },
            { signal },
          )
          if (!signal.aborted) createdSectionId = created?.id
        })
      : editingSection
        ? await write((signal) =>
            inventoryApi.updateSection(
              editingSection.id,
              { name, code, isActive: editingSection.isActive },
              { signal },
            ),
          )
        : addingTo
          ? await write((signal) =>
              inventoryApi.createShelf(
                { zoneId: addingTo.zoneId, sectionId: addingTo.id, name, code },
                { signal },
              ),
            )
          : editing
            ? await write((signal) =>
                inventoryApi.updateShelf(
                  editing.id,
                  { name, code, isActive: editing.isActive },
                  { signal },
                ),
              )
            : false
    if (ok) {
      if (createdSectionId)
        void navigate(`${base}/sections/${createdSectionId}`, {
          state: {
            zoneId: zone.id,
            zoneQuery: new URLSearchParams(location.search).toString(),
          },
        })
      setEditingSection(null)
      setAddingTo(null)
      setAddingSectionTo(null)
      setEditing(null)
    }
  }

  const startAddingShelf = (section: InventorySection) => {
    setError(null)
    setDraft({ name: '', code: '' })
    setAddingTo(section)
  }

  return (
    <section
      aria-label={t(section ? 'shelfType' : 'sectionType')}
      className="rz-card min-w-0"
    >
      {error ? (
        <div className="rz-card__body">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      {resource.state.kind === 'loading' ? (
        <div className="rz-card__body">
          <SkeletonRows rows={3} />
        </div>
      ) : null}
      {resource.state.kind === 'error' ? (
        <Button className="m-4" onClick={resource.reload} variant="ghost">
          {tc('retry')}
        </Button>
      ) : null}
      {resource.state.kind === 'ready' ? (
        <LocationBrowser
          zone={zone}
          {...(section ? { section } : {})}
          base={base}
          sections={loadedSections}
          shelves={loadedShelves}
          canManage={canManage}
          canViewParts={canViewParts}
          partsBase={base.replace(/\/inventory$/, '/parts')}
          onAddSection={(zone) => {
            setError(null)
            setDraft({ name: '', code: '' })
            setAddingSectionTo(zone)
          }}
          onAddShelf={startAddingShelf}
          onEditShelf={
            choosingShelf && canManage
              ? (shelf) => {
                  setChoosingShelf(false)
                  setError(null)
                  setDraft({ name: shelf.name, code: shelf.code })
                  setEditing(shelf)
                }
              : undefined
          }
          selectionNotice={
            choosingShelf ? (
              <Notice
                block
                className="items-center gap-3"
                action={
                  <Button onClick={() => setChoosingShelf(false)}>
                    {tc('cancel')}
                  </Button>
                }
              >
                {tb('chooseShelfToEdit')}
              </Notice>
            ) : null
          }
          printWorkspace={
            labelsOpen ? (
              <LocationLabelsPage
                flush
                sectionShelfCounts={sectionShelfCounts}
                target={{
                  kind: section ? 'shelf' : 'section',
                  parentId: section?.id ?? zone.id,
                  parentName: section?.name ?? zone.name,
                }}
                inventoryBase={base}
                returnFocusRef={labelTriggerRef}
              />
            ) : null
          }
          headerActions={
            <ActionMenu
              triggerRef={labelTriggerRef}
              label={
                section
                  ? t('sectionActions', { name: section.name })
                  : tb('zoneActions', { name: zone.name })
              }
              actions={[
                {
                  key: 'print',
                  label: tb(section ? 'printShelves' : 'printSections'),
                  icon: <Printer aria-hidden />,
                  onSelect: () => {
                    setChoosingShelf(false)
                    const params = new URLSearchParams(location.search)
                    params.set('labels', '1')
                    void navigate(
                      { search: `?${params}` },
                      {
                        state: location.state as unknown,
                        preventScrollReset: true,
                      },
                    )
                  },
                },
                ...(canManage && section
                  ? [
                      {
                        key: 'edit',
                        label: t('editSection'),
                        icon: <Pencil aria-hidden />,
                        onSelect: () => {
                          setError(null)
                          setDraft({ name: section.name, code: section.code })
                          setEditingSection(section)
                        },
                      },
                      {
                        key: 'edit-shelf',
                        label: t('editShelf'),
                        icon: <Pencil aria-hidden />,
                        disabled: !loadedShelves.some(
                          (shelf) => shelf.isActive,
                        ),
                        onSelect: () => {
                          setChoosingShelf(true)
                        },
                      },
                      {
                        key: 'archive',
                        label: t('archiveSection'),
                        icon: <Archive aria-hidden />,
                        destructive: true,
                        onSelect: () => setArchivingSection(section),
                      },
                    ]
                  : []),
              ]}
            />
          }
        />
      ) : null}
      <Sheet
        open={
          addingTo !== null ||
          editing !== null ||
          addingSectionTo !== null ||
          editingSection !== null
        }
        title={
          addingSectionTo
            ? t('newSectionTitle')
            : editingSection
              ? t('editSection')
              : addingTo
                ? t('newShelfTitle')
                : t('editShelf')
        }
        eyebrow={
          addingSectionTo?.name ??
          editingSection?.zoneName ??
          addingTo?.name ??
          editing?.zoneName
        }
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditingSection(null)
            setAddingTo(null)
            setAddingSectionTo(null)
            setEditing(null)
          }
        }}
        footer={
          <>
            <Button
              disabled={busy}
              onClick={() => {
                setEditingSection(null)
                setAddingTo(null)
                setAddingSectionTo(null)
                setEditing(null)
              }}
              type="button"
            >
              {tc('cancel')}
            </Button>
            <Button
              aria-busy={busy}
              disabled={busy || !draft.name.trim() || !draft.code.trim()}
              form={formId}
              type="submit"
              variant="primary"
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <form
          className="grid content-start gap-3"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <NameAndCode
            draft={draft}
            initialCode={editingSection?.code ?? editing?.code}
            onChange={setDraft}
          />
        </form>
      </Sheet>
      <ConfirmDialog
        open={archivingSection !== null}
        title={t('archiveSection')}
        confirmLabel={t('archiveSection')}
        consequence={t('archiveSectionHint')}
        destructive
        pending={busy}
        onOpenChange={(open) => {
          if (!open && !busy) setArchivingSection(null)
        }}
        onConfirm={() => {
          if (archivingSection)
            void write((signal) =>
              inventoryApi.archiveSection(archivingSection.id, { signal }),
            ).then((ok) => {
              if (ok) setArchivingSection(null)
            })
        }}
      />
    </section>
  )
}

/** Name and code fields shared by warehouses, zones, sections, and shelves. */
function NameAndCode({
  draft,
  initialCode,
  onChange,
}: {
  draft: { name: string; code: string }
  initialCode?: string | undefined
  onChange: (draft: { name: string; code: string }) => void
}) {
  const t = useT(warehouseMessages)
  return (
    <>
      <Field label={t('name')} required>
        <TextInput
          onChange={(event) => {
            const name = event.target.value
            const code =
              draft.code === '' ||
              draft.code === initialCode ||
              draft.code === inventoryCodeFromName(draft.name)
                ? inventoryCodeFromName(name)
                : draft.code
            onChange({ name, code })
          }}
          value={draft.name}
        />
      </Field>
      <Field hint={t('codeHint')} label={t('codeLabel')} required>
        <TextInput
          className="font-mono"
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
          value={draft.code}
        />
      </Field>
    </>
  )
}

/** One figure of the warehouse strip: `.rz-kpi` from the design system. */
function WarehouseStat({
  label,
  value,
  unit,
  meta,
  tone = 'plain',
}: {
  label: string
  value: string
  unit: string
  meta: string
  tone?: 'plain' | 'ok' | 'warn' | 'danger'
}) {
  return (
    <div className={cn('rz-kpi', tone === 'warn' && 'rz-kpi--warn')}>
      <p className="rz-kpi__label m-0">{label}</p>
      <p className="rz-kpi__value m-0">
        <span
          className={cn(
            'rz-display',
            tone === 'ok' && 'text-state-ok',
            tone === 'danger' && 'text-state-danger',
          )}
        >
          {value}
        </span>
        <span className="rz-kpi__unit">{unit}</span>
      </p>
      <p className="rz-kpi__meta m-0">{meta}</p>
    </div>
  )
}

/** How the session picks its zones. */
const SESSION_TYPES = [
  {
    value: 'full' as const,
    label: 'typeFull' as const,
    hint: 'typeFullHint' as const,
    available: true,
  },
  {
    value: 'zones' as const,
    label: 'typeZones' as const,
    hint: 'typeZonesHint' as const,
    available: true,
  },
  {
    value: 'sample' as const,
    label: 'typeSample' as const,
    hint: 'typeSampleHint' as const,
    available: false,
  },
]

type SessionType = (typeof SESSION_TYPES)[number]['value']

interface NewSessionData {
  warehouses: Warehouse[]
  zones: InventoryZone[]
  /** Parts per zone, when the viewer may read the parts module. */
  byZone: Map<string, number> | null
  people: { userId: string; name: string }[]
}

function NewSessionView() {
  const t = useT(newSessionMessages)
  const ti = useT(inventoryMessages)
  const base = useInventoryBase()
  const navigate = useNavigate()
  const canManage = usePermission('inventory.manage')
  const canSeeParts = usePermission('parts.view')
  const canSeeTeam = usePermission('team.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<NewSessionData> => {
      const [warehouses, zones, byZone, people] = await Promise.all([
        inventoryApi.getWarehouses({ signal }),
        inventoryApi.getZones({ activeOnly: true, signal }),
        canSeeParts
          ? partsApi.facets({}, ['zone'], { signal }).then(
              (facets) =>
                new Map(facets.zones.map((zone) => [zone.id, zone.count])),
              () => null,
            )
          : Promise.resolve(null),
        canSeeTeam
          ? teamApi.listMembers({ signal }).then(
              (members) =>
                members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                })),
              () => [],
            )
          : Promise.resolve([]),
      ])
      return { warehouses, zones, byZone, people }
    },
    [canSeeParts, canSeeTeam],
  )
  const resource = useLoad(loader, 'new-session')
  const [type, setType] = useState<SessionType>('zones')
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState<'draft' | 'start' | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)

  const create = async (zoneIds: readonly string[], start: boolean) => {
    if (!canManage || zoneIds.length === 0) return
    setBusy(start ? 'start' : 'draft')
    setOperationError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      const session = await inventoryApi.createSession([...zoneIds], {
        signal: scope.signal,
      })
      if (start) {
        await inventoryApi.startSession(session.id, { signal: scope.signal })
      }
      void navigate(`${base}/sessions/${session.id}`, { replace: true })
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ warehouses, zones, byZone, people }: NewSessionData) => {
        const countable = zones.filter(
          (zone) => zone.isActive && !zone.isSystemUnassigned,
        )
        /* A yard whose warehouse list came back empty still has zones, and
           every zone names its warehouse. */
        const houses: { id: string; name: string }[] =
          warehouses.length > 0
            ? warehouses.map((item) => ({ id: item.id, name: item.name }))
            : [
                ...new Map(
                  countable.map((zone) => [
                    zone.warehouseId,
                    { id: zone.warehouseId, name: zone.warehouseName },
                  ]),
                ).values(),
              ]
        const house = warehouseId ?? houses[0]?.id ?? null
        const inHouse = countable.filter((zone) => zone.warehouseId === house)
        const selected =
          type === 'full'
            ? inHouse.map((zone) => zone.id)
            : picked.filter((id) => inHouse.some((zone) => zone.id === id))
        const partsIn = (zoneId: string) => byZone?.get(zoneId) ?? null
        const partsTotal = selected.reduce(
          (sum, id) => sum + (partsIn(id) ?? 0),
          0,
        )
        const houseName =
          houses.find((item) => item.id === house)?.name ??
          t('fallbackWarehouse')
        const typeName = type === 'full' ? t('summaryFull') : t('summaryZones')
        const ready = selected.length > 0 && canManage

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <Link className="rz-btn rz-btn--ghost" to={base}>
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {ti('backToInventory')}
                </Link>
                <p className="rz-crumbs m-0 hidden sm:flex">
                  <span>{ti('crumbWarehouse')}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span aria-current="page">{ti('crumbInventory')}</span>
                </p>
              </div>
              <div className="rz-topbar__actions flex-wrap items-center">
                <Button
                  disabled={!ready || busy !== null}
                  onClick={() => void create(selected, false)}
                >
                  {busy === 'draft' ? t('saving') : t('saveDraft')}
                </Button>
                <Button
                  disabled={!ready || busy !== null}
                  onClick={() => void create(selected, true)}
                  variant="primary"
                >
                  {busy === 'start' ? t('starting') : t('start')}
                </Button>
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <h1 className="rz-h-page">{t('title')}</h1>
                <p className="rz-muted m-0 mt-1">{t('intro')}</p>
              </div>

              {!canManage ? (
                <Notice tone="danger">{t('noPermission')}</Notice>
              ) : null}
              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              <div className="flex flex-wrap items-start gap-4">
                <div className="flex min-w-0 flex-[2_1_34rem] flex-col gap-3">
                  <Step hint={t('typeHint')} number="01" title={t('typeTitle')}>
                    <div
                      aria-label={t('typeTitle')}
                      className="flex flex-wrap gap-2"
                      role="radiogroup"
                    >
                      {SESSION_TYPES.map((option) => {
                        const active = option.value === type
                        return (
                          <button
                            aria-checked={active}
                            className={cn(
                              'rz-choice-card grid flex-[1_1_10rem] gap-0.5 bg-transparent text-left',
                              active && 'border-brand bg-brand-soft',
                              option.available
                                ? 'hover:bg-app-hover'
                                : 'cursor-not-allowed opacity-50',
                            )}
                            disabled={!option.available}
                            key={option.value}
                            onClick={() => setType(option.value)}
                            role="radio"
                            title={
                              option.available
                                ? undefined
                                : t('sampleUnavailable')
                            }
                            type="button"
                          >
                            <span
                              className={cn(
                                'block font-semibold',
                                active ? 'text-app-strong' : 'text-app-ink',
                              )}
                            >
                              {t(option.label)}
                            </span>
                            <span className="rz-muted block text-caption">
                              {t(option.hint)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </Step>

                  <Step
                    hint={
                      type === 'full' ? t('zonesHintFull') : t('zonesHintPick')
                    }
                    number="02"
                    title={t('zonesTitle')}
                  >
                    {houses.length > 1 ? (
                      <div
                        aria-label={t('warehouse')}
                        className="rz-seg mb-3 flex-wrap"
                        role="radiogroup"
                      >
                        {houses.map((item) => {
                          const active = item.id === house
                          return (
                            <button
                              aria-checked={active}
                              key={item.id}
                              onClick={() => {
                                setWarehouseId(item.id)
                                setPicked([])
                              }}
                              role="radio"
                              type="button"
                            >
                              {item.name}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                    <ul className="m-0 grid list-none gap-1.5 p-0">
                      {inHouse.length === 0 ? (
                        <li className="rz-muted">{t('noActiveZones')}</li>
                      ) : null}
                      {inHouse.map((zone) => {
                        const on = selected.includes(zone.id)
                        const count = partsIn(zone.id)
                        return (
                          <li key={zone.id}>
                            <label
                              className={cn(
                                'border-app-line flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-control border px-3 py-2',
                                on && 'bg-app-row-selected',
                                type === 'full'
                                  ? 'cursor-not-allowed'
                                  : 'cursor-pointer hover:bg-app-hover',
                              )}
                            >
                              <input
                                checked={on}
                                className="rz-check"
                                disabled={type === 'full' || !canManage}
                                onChange={() =>
                                  setPicked((value) =>
                                    value.includes(zone.id)
                                      ? value.filter((id) => id !== zone.id)
                                      : [...value, zone.id],
                                  )
                                }
                                type="checkbox"
                              />
                              <span className="min-w-0 flex-[1_1_8rem]">
                                <span
                                  className={cn(
                                    'block font-semibold',
                                    type === 'full'
                                      ? 'text-app-muted'
                                      : 'text-app-strong',
                                  )}
                                >
                                  {zone.name}
                                </span>
                                <span className="rz-muted block text-caption">
                                  {zone.code} · {zone.warehouseName}
                                </span>
                              </span>
                              {/* Narrow screens give the count its own line
                                  rather than squeezing the zone's name. */}
                              <span className="rz-mono rz-muted w-full pl-6.5 sm:w-auto sm:pl-0">
                                {count === null
                                  ? '—'
                                  : ti('positions', { count })}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </Step>

                  <Step
                    hint={t('peopleHint')}
                    number="03"
                    title={t('peopleTitle')}
                  >
                    {people.length === 0 ? (
                      <p className="rz-muted m-0">
                        {canSeeTeam ? t('noPeople') : t('teamHidden')}
                      </p>
                    ) : (
                      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                        {people.map((person) => (
                          <li key={person.userId}>
                            <span
                              className="rz-chip h-control-lg cursor-default gap-2 pr-2.5 pl-1 text-body"
                              title={t('personHint')}
                            >
                              <span
                                aria-hidden
                                className="rz-avatar rz-avatar--round"
                              >
                                {initials(person.name)}
                              </span>
                              {person.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Step>

                  <Step number="04" title={t('rulesTitle')}>
                    <ul className="m-0 grid list-none gap-1.5 p-0">
                      <Toggle
                        hint={t('lockHint')}
                        label={t('lockLabel')}
                        on
                        why={t('lockWhy')}
                      />
                      <Toggle
                        hint={t('blindHint')}
                        label={t('blindLabel')}
                        on={false}
                        why={t('blindWhy')}
                      />
                      <Toggle
                        hint={t('photoHint')}
                        label={t('photoLabel')}
                        on={false}
                        why={t('photoWhy')}
                      />
                    </ul>
                    <div className="mt-3">
                      <Field hint={t('commentHint')} label={t('commentLabel')}>
                        <TextArea
                          disabled
                          name="comment"
                          placeholder={t('commentPlaceholder')}
                          rows={2}
                        />
                      </Field>
                    </div>
                  </Step>
                </div>

                <section
                  aria-label={t('scopeTitle')}
                  className="rz-card flex min-w-0 flex-[1_1_18rem] flex-col self-start"
                >
                  <div className="rz-card__head py-2.5">
                    <h2 className="rz-h-card">{t('scopeTitle')}</h2>
                  </div>
                  <div className="rz-card__body flex flex-col">
                    <div className="rz-inset">
                      <p className="rz-strong m-0 font-semibold">
                        {houseName} · {typeName}
                      </p>
                      <p className="rz-muted m-0 mt-1">
                        {selected.length === 0
                          ? t('noZonesPicked')
                          : inHouse
                              .filter((zone) => selected.includes(zone.id))
                              .map((zone) => zone.name)
                              .join(', ')}
                      </p>
                    </div>
                    <dl className="rz-facts mt-2 px-0">
                      <div>
                        <dt>{t('zonesCount')}</dt>
                        <dd className="rz-num">
                          {selected.length === 0 ? '—' : selected.length}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('positionsCount')}</dt>
                        <dd className="rz-num">
                          {byZone === null || selected.length === 0
                            ? '—'
                            : partsTotal}
                        </dd>
                      </div>
                      <div>
                        <dt title={t('peopleNotAssigned')}>
                          {t('peopleCount')}
                        </dt>
                        <dd className="rz-num text-app-dim">—</dd>
                      </div>
                      <div>
                        <dt
                          className="text-app-strong font-semibold"
                          title={t('durationNotEstimated')}
                        >
                          {t('estimate')}
                        </dt>
                        <dd className="rz-num text-app-dim">—</dd>
                      </div>
                    </dl>
                    <Button
                      className="rz-btn--lg mt-4 w-full"
                      disabled={!ready || busy !== null}
                      onClick={() => void create(selected, true)}
                      variant="primary"
                    >
                      {busy === 'start' ? t('starting') : t('start')}
                    </Button>
                    <p className="rz-caption m-0 mt-3">
                      {selected.length === 0 ? t('pickOne') : t('afterStart')}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )
      }}
    </Resource>
  )
}

/** One numbered step of the form, with its own explanation. */
function Step({
  number,
  title,
  hint,
  aside,
  children,
}: {
  number: string
  title: string
  hint?: string
  /** Sits opposite the title — a legend, a count. */
  aside?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rz-card">
      <div className="rz-card__head py-2.5">
        <div className="flex items-baseline gap-2">
          <span aria-hidden className="rz-mono rz-dim text-micro">
            {number}
          </span>
          <h2 className="rz-h-card" id={titleId}>
            {title}
          </h2>
        </div>
        {aside}
        {hint === undefined ? null : (
          <p className="rz-caption m-0 w-full">{hint}</p>
        )}
      </div>
      <div className="rz-card__body">{children}</div>
    </section>
  )
}

/**
 * A rule of the count as a switch. Every switch here is fixed — the server has
 * no setting behind it — so each says on itself why it cannot be moved.
 */
function Toggle({
  label,
  hint,
  on,
  why,
}: {
  label: string
  hint: string
  on: boolean
  why: string
}) {
  const t = useT(newSessionMessages)
  return (
    <li className="rz-inset flex items-center gap-3 px-3 py-2.5" title={why}>
      <span className="min-w-0 flex-1">
        <span className="rz-strong block font-semibold">{label}</span>
        <span className="rz-muted block text-caption">
          {hint} {why}.
        </span>
      </span>
      <input
        aria-hidden
        checked={on}
        className="rz-switch shrink-0"
        disabled
        readOnly
        tabIndex={-1}
        type="checkbox"
      />
      <span className="sr-only">{on ? t('toggleOn') : t('toggleOff')}</span>
    </li>
  )
}

/** Which side of the count the session table is showing. */
const SESSION_FILTERS = [
  { value: 'all', label: 'filterAll' },
  { value: 'diff', label: 'filterDiff' },
  { value: 'same', label: 'filterSame' },
] as const

type SessionFilter = (typeof SESSION_FILTERS)[number]['value']

interface SessionData {
  session: InventorySession
  /** A draft has nothing counted yet, so it has no results to read. */
  results: InventorySessionResults | null
  /** Every zone's scans in one stream, newest first. */
  scans: InventoryScan[]
  people: { userId: string; name: string }[]
}

/** Two initials for the worker chip; a single word gives one. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

function SessionView({ id }: { id: string }) {
  const t = useT(sessionMessages)
  const tj = useT(journalMessages)
  const ti = useT(inventoryMessages)
  const { date, sessionStatus, timeOfDay } = useInventoryFormat()
  const navigate = useNavigate()
  const base = useInventoryBase()
  const canManage = usePermission('inventory.manage')
  const canSeeTeam = usePermission('team.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<SessionData> => {
      const session = await inventoryApi.getSession(id, { signal })
      const [results, scanLists, people] = await Promise.all([
        session.status === 'draft'
          ? Promise.resolve(null)
          : inventoryApi.getResults(id, { signal }).then(
              (data) => data,
              () => null,
            ),
        Promise.all(
          session.zones.map((zone) =>
            inventoryApi.getScans(id, zone.zoneId, { signal }).then(
              (list) => list,
              () => [],
            ),
          ),
        ),
        canSeeTeam
          ? teamApi.listMembers({ signal }).then(
              (members) =>
                members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                })),
              () => [],
            )
          : Promise.resolve([]),
      ])
      const scans = scanLists
        .flat()
        .sort((left, right) => right.scannedAt.localeCompare(left.scannedAt))
      return { session, results, scans, people }
    },
    [canSeeTeam, id],
  )
  const resource = useLoad(loader, id)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [filter, setFilter] = useState<SessionFilter>('all')
  /** The action waiting for a confirmation, and the reason a cancel needs. */
  const [asking, setAsking] = useState<'start' | 'complete' | 'reopen' | null>(
    null,
  )
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const isInProgress =
    resource.state.kind === 'ready' &&
    resource.state.data.session.status === 'inProgress'
  useEffect(() => {
    if (!isInProgress) return
    const timer = window.setInterval(
      () => document.visibilityState === 'visible' && resource.refresh(),
      10_000,
    )
    return () => window.clearInterval(timer)
  }, [isInProgress, resource])

  const act = async (action: 'start' | 'complete' | 'reopen' | 'cancel') => {
    if (acting) return
    setActing(true)
    try {
      setOperationError(null)
      const scope = requireLatestMutation({ quota: false })
      const options = { signal: scope.signal }
      if (action === 'start') await inventoryApi.startSession(id, options)
      if (action === 'complete') await inventoryApi.completeSession(id, options)
      if (action === 'reopen') await inventoryApi.reopenSession(id, options)
      if (action === 'cancel') {
        await inventoryApi.cancelSession(id, reason.trim(), options)
      }
      setAsking(null)
      setCancelling(false)
      setReason('')
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setActing(false)
    }
  }

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ session, results, scans, people }: SessionData) => {
        const [label, tone] = sessionStatus(session.status)
        const nameOf = (userId?: string | null) =>
          userId == null
            ? null
            : (people.find((person) => person.userId === userId)?.name ?? null)
        const zoneName = (zoneId: string) =>
          session.zones.find((zone) => zone.zoneId === zoneId)?.zoneCode ?? '—'
        const done = session.zones.filter(
          (zone) => zone.status === 'completed',
        ).length
        const percent =
          session.zones.length === 0
            ? 0
            : Math.round((done / session.zones.length) * 100)
        const parts = results?.parts ?? []
        const matched = parts.filter((part) => part.delta === 0).length
        const differing = parts.length - matched
        const counts: Record<SessionFilter, number> = {
          all: parts.length,
          diff: differing,
          same: matched,
        }
        const rows = parts.filter((part) =>
          filter === 'all'
            ? true
            : filter === 'diff'
              ? part.delta !== 0
              : part.delta === 0,
        )
        /** Who actually scanned, with when they started and how much. */
        const workers = [
          ...scans
            .filter((scan) => scan.voidedAt == null)
            .reduce((map, scan) => {
              const current = map.get(scan.scannedBy)
              map.set(scan.scannedBy, {
                count: (current?.count ?? 0) + 1,
                since:
                  current === undefined ||
                  scan.scannedAt.localeCompare(current.since) < 0
                    ? scan.scannedAt
                    : current.since,
              })
              return map
            }, new Map<string, { count: number; since: string }>())
            .entries(),
        ].sort(([, left], [, right]) => right.count - left.count)
        const counters = workers
          .map(([userId]) => nameOf(userId))
          .filter((name): name is string => name !== null)

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <Link className="rz-btn rz-btn--ghost" to={base}>
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {ti('backToInventory')}
                </Link>
                <p className="rz-crumbs m-0 hidden sm:flex">
                  <span>{ti('crumbInventory')}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span aria-current="page">{session.number}</span>
                </p>
              </div>
              <div className="rz-topbar__actions flex-wrap items-center">
                {session.status === 'draft' ? null : (
                  <Button asChild variant="quiet">
                    <Link to={`${base}/sessions/${id}/results`}>
                      {t('results')}
                    </Link>
                  </Button>
                )}
                {/* Counting happens in the mobile app; the cabinet watches it. */}
                <Button disabled title={t('scanUnavailable')} variant="primary">
                  {t('scan')}
                </Button>
                <ActionMenu
                  actions={[
                    {
                      key: 'audit',
                      label: t('audit'),
                      icon: <ClipboardList aria-hidden />,
                      onSelect: () =>
                        void navigate(`${base}/sessions/${id}/audit`),
                    },
                    {
                      key: 'refresh',
                      label: t('refresh'),
                      icon: <RefreshCw aria-hidden />,
                      onSelect: resource.reload,
                    },
                    {
                      key: 'pause',
                      label: t('pause'),
                      icon: <Pause aria-hidden />,
                      disabled: true,
                      title: t('pauseUnavailable'),
                      onSelect: () => undefined,
                    },
                    ...(canManage &&
                    session.status !== 'completed' &&
                    session.status !== 'cancelled'
                      ? [
                          {
                            key: 'cancel',
                            label: t('cancelSession'),
                            icon: <Archive aria-hidden />,
                            destructive: true as const,
                            onSelect: () => {
                              setReason('')
                              setCancelling(true)
                            },
                          },
                        ]
                      : []),
                  ]}
                  label={t('moreActions')}
                />
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <div className="rz-page-head items-center">
                  <h1 className="rz-h-page">{session.number}</h1>
                  <StatusPill tone={tone}>{label}</StatusPill>
                </div>
                <p className="rz-muted m-0 mt-1">
                  {[
                    session.zones[0]?.warehouseName ?? null,
                    session.zones.length === 0
                      ? null
                      : ti('zones', { count: session.zones.length }),
                    session.startedAt == null
                      ? t('createdLower', { date: date(session.createdAt) })
                      : t('startedLower', { date: date(session.startedAt) }),
                    counters.length > 0 ? counters.join(', ') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              <div className="flex flex-wrap-reverse items-start gap-4">
                <div className="flex min-w-0 flex-[2_1_34rem] flex-col gap-3">
                  <Card
                    aside={
                      <div
                        aria-label={t('filterLabel')}
                        className="rz-seg flex-wrap"
                        role="radiogroup"
                      >
                        {SESSION_FILTERS.map((option) => (
                          <button
                            aria-checked={option.value === filter}
                            key={option.value}
                            onClick={() => setFilter(option.value)}
                            role="radio"
                            type="button"
                          >
                            {t(option.label)}{' '}
                            <span className="rz-mono text-app-dim text-micro">
                              {counts[option.value]}
                            </span>
                          </button>
                        ))}
                      </div>
                    }
                    bodyClassName="p-0"
                    className="min-w-0"
                    title={t('positionsTitle')}
                  >
                    <DataTable
                      embedded
                      caption={t('positionsTitle')}
                      rows={rows}
                      rowKey={(part) => part.partId}
                      empty={
                        <p className="rz-muted m-0 px-4 py-6">
                          {results === null
                            ? t('notStarted')
                            : parts.length === 0
                              ? t('noPositions')
                              : t('noFiltered')}
                        </p>
                      }
                      columns={[
                        {
                          key: 'position',
                          label: t('colPosition'),
                          variant: 'primary',
                          cell: (part) => (
                            <span className="grid min-w-0 py-1.5">
                              <span className="truncate">{part.partName}</span>
                              {part.hasCoverageWarning ? (
                                <span className="text-state-warn text-caption font-normal">
                                  {t('coverageWarning')}
                                </span>
                              ) : null}
                            </span>
                          ),
                        },
                        {
                          key: 'code',
                          label: t('colCode'),
                          cell: (part) => (
                            <span className="rz-mono">{part.partQrCode}</span>
                          ),
                        },
                        {
                          key: 'expected',
                          label: t('colExpected'),
                          align: 'end',
                          cell: (part) => part.expectedQuantity,
                        },
                        {
                          key: 'actual',
                          label: t('colActual'),
                          align: 'end',
                          cell: (part) => (
                            <span
                              className={cn(
                                part.delta > 0 && 'text-state-warn',
                                part.delta < 0 && 'text-state-danger',
                              )}
                            >
                              {part.actualQuantity}
                            </span>
                          ),
                        },
                        {
                          key: 'delta',
                          label: t('colDelta'),
                          align: 'end',
                          cell: (part) => (
                            <StatusPill
                              tone={
                                part.delta === 0
                                  ? 'ok'
                                  : part.delta > 0
                                    ? 'warn'
                                    : 'danger'
                              }
                            >
                              {part.delta > 0
                                ? `+${String(part.delta)}`
                                : String(part.delta)}
                            </StatusPill>
                          ),
                        },
                      ]}
                    />
                  </Card>

                  <Card
                    bodyClassName="p-0"
                    className="min-w-0"
                    title={t('recentScans')}
                  >
                    <DataTable
                      embedded
                      caption={t('recentScans')}
                      rows={scans.slice(0, 8)}
                      rowKey={(scan) => scan.id}
                      empty={
                        <p className="rz-muted m-0 px-4 pt-3 pb-4">
                          {t('noScans')}
                        </p>
                      }
                      columns={[
                        {
                          key: 'part',
                          label: t('colPosition'),
                          variant: 'primary',
                          cell: (scan) => scan.partName,
                        },
                        {
                          key: 'time',
                          label: tj('colTime'),
                          cell: (scan) => (
                            <span className="rz-mono">
                              {timeOfDay(scan.scannedAt)}
                            </span>
                          ),
                        },
                        {
                          key: 'zone',
                          label: t('zones'),
                          cell: (scan) => (
                            <Link
                              className="rz-mono"
                              to={`${base}/sessions/${id}/journal/${scan.zoneId}`}
                            >
                              {zoneName(scan.zoneId)}
                            </Link>
                          ),
                        },
                        {
                          key: 'who',
                          label: tj('colWho'),
                          cell: (scan) => nameOf(scan.scannedBy) ?? '—',
                        },
                        {
                          key: 'count',
                          label: tj('colScan'),
                          align: 'end',
                          cell: (scan) => (
                            <span
                              className={cn(
                                scan.voidedAt != null
                                  ? 'text-state-danger line-through'
                                  : scan.unexpected
                                    ? 'text-state-warn'
                                    : 'text-app-muted',
                              )}
                            >
                              {scan.zonePartCount}
                            </span>
                          ),
                        },
                      ]}
                    />
                  </Card>
                </div>

                <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-3">
                  <section
                    aria-label={t('progress')}
                    className="rz-card rz-card__body"
                  >
                    <h2 className="rz-h-card">{t('progress')}</h2>
                    <p className="m-0 mt-3 flex items-baseline gap-2.5">
                      <span className="rz-display">{percent}%</span>
                      <span className="rz-mono rz-muted">
                        {ti('zonesProgress', {
                          done,
                          count: session.zones.length,
                        })}
                      </span>
                    </p>
                    <span
                      aria-hidden
                      className={cn(
                        'rz-meter mt-3',
                        percent < 100 && 'rz-meter--warn',
                      )}
                    >
                      <span style={{ width: `${String(percent)}%` }} />
                    </span>
                    <dl className="rz-facts mt-3 px-0">
                      <div>
                        <dt>{t('matched')}</dt>
                        <dd className="rz-num text-state-ok">
                          {results === null ? '—' : matched}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('differing')}</dt>
                        <dd className="rz-num text-state-danger">
                          {results === null ? '—' : differing}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('zonesLeft')}</dt>
                        <dd className="rz-num text-app-strong">
                          {session.zones.length - done}
                        </dd>
                      </div>
                    </dl>
                    {canManage ? (
                      <div className="mt-3 grid gap-2">
                        {session.status === 'draft' ? (
                          <Button
                            className="rz-btn--lg w-full"
                            disabled={acting}
                            onClick={() => setAsking('start')}
                            variant="primary"
                          >
                            {t('start')}
                          </Button>
                        ) : null}
                        {session.status === 'inProgress' ? (
                          <Button
                            className="rz-btn--lg w-full"
                            disabled
                            title={t('countingInApp')}
                            variant="primary"
                          >
                            {t('continueScanning')}
                          </Button>
                        ) : null}
                        {session.status === 'review' ? (
                          <Button
                            className="rz-btn--lg w-full"
                            disabled={acting}
                            onClick={() => setAsking('complete')}
                            variant="primary"
                          >
                            {t('complete')}
                          </Button>
                        ) : null}
                        {session.status === 'review' ? (
                          <Button
                            className="rz-btn--lg w-full"
                            disabled={acting}
                            onClick={() => setAsking('reopen')}
                          >
                            {t('reopen')}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="rz-caption m-0 mt-3">
                      {session.status === 'review'
                        ? t('hintReview')
                        : session.status === 'inProgress'
                          ? t('hintInProgress')
                          : session.status === 'draft'
                            ? t('hintDraft')
                            : t('hintClosed')}
                    </p>
                  </section>

                  <Card bodyClassName="p-0" title={t('zones')}>
                    <ul className="m-0 grid list-none p-0">
                      {session.zones.map((zone) => (
                        <li
                          className="border-app-line grid gap-2 border-t px-4 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                          key={zone.zoneId}
                        >
                          <div className="min-w-0">
                            <strong className="rz-strong font-semibold">
                              {zone.zoneName}
                            </strong>
                            <p className="rz-muted m-0 text-caption">
                              {zone.warehouseName} · {zone.zoneCode}
                            </p>
                            {zone.leaseOwnerUserId ? (
                              <p className="text-state-warn m-0 mt-1 text-caption">
                                {nameOf(zone.leaseOwnerUserId) === null
                                  ? t('leased', {
                                      date: date(zone.leaseExpiresAt),
                                    })
                                  : t('leasedBy', {
                                      name: String(
                                        nameOf(zone.leaseOwnerUserId),
                                      ),
                                      date: date(zone.leaseExpiresAt),
                                    })}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button asChild size="sm" variant="quiet">
                              <Link
                                to={`${base}/sessions/${id}/journal/${zone.zoneId}`}
                              >
                                {t('journal')}
                              </Link>
                            </Button>
                            <StatusPill
                              tone={
                                zone.status === 'completed'
                                  ? 'ok'
                                  : zone.status === 'counting'
                                    ? 'warn'
                                    : 'neutral'
                              }
                            >
                              {zone.status === 'completed'
                                ? t('zoneCompleted')
                                : zone.status === 'counting'
                                  ? t('zoneCounting')
                                  : t('zoneWaiting')}
                            </StatusPill>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  {workers.length === 0 ? null : (
                    <section
                      aria-label={t('workers')}
                      className="rz-card rz-card__body"
                    >
                      <h2 className="rz-h-card">{t('workers')}</h2>
                      <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
                        {workers.map(([userId, stat]) => {
                          const who = nameOf(userId)
                          return (
                            <li
                              className="flex items-center gap-3"
                              key={userId}
                            >
                              <span
                                aria-hidden
                                className="rz-avatar rz-avatar--round"
                              >
                                {initials(who ?? '?')}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="rz-strong block font-semibold">
                                  {who ?? t('nameHidden')}
                                </span>
                                <span className="rz-muted block text-caption">
                                  {t('since', { time: timeOfDay(stat.since) })}
                                </span>
                              </span>
                              <span className="text-app-muted font-mono text-body tabular-nums">
                                {stat.count}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                      {people.length === 0 ? (
                        <p className="rz-caption m-0 mt-3">
                          {t('namesHidden')}
                        </p>
                      ) : null}
                    </section>
                  )}

                  <section
                    aria-label={t('rules')}
                    className="rz-card rz-card__body"
                  >
                    <h2 className="rz-h-card">{t('rules')}</h2>
                    <ul className="m-0 mt-3 grid list-none gap-2 p-0">
                      {/* The slice stays locked until the session closes —
                          review still has decisions waiting on it. */}
                      <Rule
                        on={
                          session.status === 'inProgress' ||
                          session.status === 'review'
                        }
                      >
                        {t('ruleLocked')}
                      </Rule>
                      <Rule on={null} why={t('ruleBlindWhy')}>
                        {t('ruleBlind')}
                      </Rule>
                      <Rule on={null} why={t('rulePhotoWhy')}>
                        {t('rulePhoto')}
                      </Rule>
                    </ul>
                  </section>
                </div>
              </div>
            </div>

            <ConfirmDialog
              confirmLabel={
                asking === 'start'
                  ? t('start')
                  : asking === 'complete'
                    ? t('complete')
                    : t('reopen')
              }
              consequence={
                asking === 'start'
                  ? t('startConsequence', { number: session.number })
                  : asking === 'complete'
                    ? t('completeConsequence')
                    : t('reopenConsequence')
              }
              onConfirm={() => {
                if (asking !== null) void act(asking)
              }}
              onOpenChange={(next) => {
                if (!next) setAsking(null)
              }}
              open={asking !== null}
              pending={acting}
              title={
                asking === 'start'
                  ? t('startTitle')
                  : asking === 'complete'
                    ? t('completeTitle')
                    : t('reopenTitle')
              }
            />

            <FormDialog
              description={t('cancelHint')}
              onOpenChange={(next) => {
                if (!next) setCancelling(false)
              }}
              onSubmit={(event) => {
                event.preventDefault()
                void act('cancel')
              }}
              open={cancelling}
              pending={acting}
              submitDisabled={reason.trim() === ''}
              submitLabel={t('cancelSession')}
              title={t('cancelTitle')}
            >
              <Field hint={t('reasonHint')} label={t('reason')} required>
                <TextArea
                  name="reason"
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  value={reason}
                />
              </Field>
            </FormDialog>
          </div>
        )
      }}
    </Resource>
  )
}

/**
 * One rule of the count. A rule the cabinet cannot read is drawn unset with
 * the reason on it, so an empty mark never reads as "we checked, it is off".
 */
function Rule({
  children,
  on,
  why,
}: {
  children: ReactNode
  /** `null` when the system has no answer either way. */
  on: boolean | null
  why?: string
}) {
  const t = useT(sessionMessages)
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 font-medium',
        on === true ? 'text-app-ink' : 'text-app-dim',
      )}
      title={why}
    >
      <span
        aria-hidden
        className={cn(
          'rz-mono flex size-4.5 shrink-0 items-center justify-center rounded-full text-micro',
          on === true
            ? 'bg-state-ok-soft text-state-ok'
            : 'bg-app-neutral-soft',
        )}
      >
        {on === true ? '✓' : on === false ? '' : '?'}
      </span>
      {children}
      {on === null ? <span className="sr-only">{t('ruleUnknown')}</span> : null}
    </li>
  )
}

/** Which side of the count the reader is looking at. */
const RESULT_FILTERS = [
  { value: 'diff', label: 'filterDiff' },
  { value: 'all', label: 'filterAll' },
  { value: 'same', label: 'filterSame' },
] as const

type ResultFilter = (typeof RESULT_FILTERS)[number]['value']

interface ResultsData {
  results: InventorySessionResults
  session: InventorySession
  audit: InventoryAuditEvent[]
  people: { userId: string; name: string }[]
}

function ResultsView({ id }: { id: string }) {
  const t = useT(resultsMessages)
  const ti = useT(inventoryMessages)
  const { date, sessionStatus, locale } = useInventoryFormat()
  const base = useInventoryBase()
  const canAdjust = usePermission('inventory.adjust')
  const canSeeTeam = usePermission('team.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<ResultsData> => {
      const [results, session, audit, people] = await Promise.all([
        inventoryApi.getResults(id, { signal }),
        inventoryApi.getSession(id, { signal }),
        inventoryApi.getAudit(id, { signal }),
        canSeeTeam
          ? teamApi.listMembers({ signal }).then(
              (members) =>
                members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                })),
              () => [],
            )
          : Promise.resolve([]),
      ])
      return { results, session, audit, people }
    },
    [canSeeTeam, id],
  )
  const resource = useLoad(loader, id)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ResultFilter>('diff')
  /** The parts a reason is being asked for: one row, or every undecided row. */
  const [asking, setAsking] = useState<InventoryPartResult[] | null>(null)
  const [reason, setReason] = useState('')
  const [applied, setApplied] = useState(0)
  const [busy, setBusy] = useState(false)

  const apply = async (parts: readonly InventoryPartResult[], why: string) => {
    setBusy(true)
    setApplied(0)
    for (const [index, part] of parts.entries()) {
      try {
        const scope = requireLatestMutation({
          permission: 'inventory.adjust',
          quota: false,
        })
        await inventoryApi.applyAdjustment(id, part.partId, why, {
          signal: scope.signal,
        })
        setApplied(index + 1)
      } catch (error) {
        setOperationError(
          parts.length === 1
            ? normalizeApiProblem(error).message
            : t('applyFailedPartial', {
                error: normalizeApiProblem(error).message,
                applied: index,
                total: parts.length,
              }),
        )
        setBusy(false)
        setAsking(null)
        resource.reload()
        return
      }
    }
    setBusy(false)
    setAsking(null)
    setReason('')
    resource.reload()
  }

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ results, session, audit, people }: ResultsData) => {
        const adjusted = new Set(
          audit.flatMap((event) =>
            event.adjustmentId && event.partId ? [event.partId] : [],
          ),
        )
        const nameOf = (userId: string | null | undefined) =>
          userId == null
            ? null
            : (people.find((person) => person.userId === userId)?.name ?? null)
        const parts = results.parts
        const differing = parts.filter((part) => part.delta !== 0)
        const counts: Record<ResultFilter, number> = {
          diff: differing.length,
          all: parts.length,
          same: parts.length - differing.length,
        }
        const rows =
          filter === 'all'
            ? parts
            : filter === 'diff'
              ? differing
              : parts.filter((part) => part.delta === 0)
        /** A row can still be decided: it differs, nothing was booked yet, and
            the server will accept the write. */
        const open = differing.filter(
          (part) => !adjusted.has(part.partId) && !part.hasCoverageWarning,
        )
        const decidable =
          canAdjust && session.status === 'review' ? open : ([] as typeof open)
        const shortage = differing
          .filter((part) => part.delta < 0)
          .reduce((total, part) => total + part.delta, 0)
        const surplus = differing
          .filter((part) => part.delta > 0)
          .reduce((total, part) => total + part.delta, 0)
        const accuracy =
          parts.length === 0
            ? null
            : Math.round(
                ((parts.length - differing.length) / parts.length) * 1000,
              ) / 10
        const [statusLabel, statusTone] = sessionStatus(session.status)
        const zones = [
          ...new Set(session.zones.map((zone) => zone.zoneCode)),
        ].join(', ')
        const crew = [
          ...new Set(
            [session.startedBy, session.completedBy, session.createdBy]
              .map(nameOf)
              .filter((name): name is string => name !== null),
          ),
        ].join(', ')

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  className="rz-btn rz-btn--ghost"
                  to={`${base}/sessions/${id}`}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t('backToSession')}
                </Link>
                <p className="rz-crumbs m-0 hidden sm:flex">
                  <span>{ti('crumbInventory')}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span>{session.number}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span aria-current="page">{t('crumbResults')}</span>
                </p>
              </div>
              <div className="rz-topbar__actions flex-wrap items-center">
                <Button asChild>
                  <Link to={`${base}/sessions/${id}/audit`}>{t('audit')}</Link>
                </Button>
                <Button disabled title={t('exportUnavailable')}>
                  {t('export')}
                </Button>
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <div className="rz-page-head items-center">
                  <h1 className="rz-h-page">{t('title')}</h1>
                  <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                </div>
                <p className="rz-muted m-0 mt-1">
                  {[
                    session.zones[0]?.warehouseName,
                    zones === '' ? null : t('zonesList', { zones }),
                    session.startedAt == null ? null : date(session.startedAt),
                    session.completedAt == null
                      ? null
                      : date(session.completedAt),
                    crew === '' ? null : crew,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              <div className="rz-kpis">
                <JournalStat
                  label={t('statPositions')}
                  meta={ti('zones', { count: session.zones.length })}
                  value={String(parts.length)}
                />
                <JournalStat
                  label={t('statAccuracy')}
                  meta={t('accuracyMeta', {
                    matched: parts.length - differing.length,
                    total: parts.length,
                  })}
                  unit="%"
                  value={
                    accuracy === null
                      ? '—'
                      : (formatNumber(accuracy, locale, {
                          maximumFractionDigits: 1,
                        }) ?? '—')
                  }
                />
                <JournalStat
                  label={t('statShortage')}
                  meta={ti('positions', {
                    count: differing.filter((part) => part.delta < 0).length,
                  })}
                  tone={shortage < 0 ? 'danger' : undefined}
                  unit={t('pcs')}
                  value={String(Math.abs(shortage))}
                />
                <JournalStat
                  label={t('statSurplus')}
                  meta={ti('positions', {
                    count: differing.filter((part) => part.delta > 0).length,
                  })}
                  unit={t('pcs')}
                  value={String(surplus)}
                />
              </div>

              <div className="rz-toolbar">
                <div
                  aria-label={t('filterLabel')}
                  className="rz-seg flex-wrap"
                  role="radiogroup"
                >
                  {RESULT_FILTERS.map((option) => {
                    const active = option.value === filter
                    return (
                      <button
                        aria-checked={active}
                        key={option.value}
                        onClick={() => setFilter(option.value)}
                        role="radio"
                        type="button"
                      >
                        {t(option.label)}{' '}
                        <span className="rz-mono text-app-dim text-micro">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="rz-toolbar__end flex-wrap items-center gap-3">
                  <p className="rz-dim m-0">
                    {differing.length === 0
                      ? t('noDiffs')
                      : t('decisionsMade', {
                          done: differing.filter((part) =>
                            adjusted.has(part.partId),
                          ).length,
                          total: differing.length,
                        })}
                  </p>
                  {decidable.length > 0 ? (
                    <Button
                      onClick={() => {
                        setReason('')
                        setAsking(decidable)
                      }}
                    >
                      {t('acceptAll')}
                    </Button>
                  ) : null}
                </div>
              </div>

              <section aria-label={t('tableLabel')} className="rz-card">
                <DataTable
                  caption={t('caption')}
                  columns={[
                    {
                      key: 'code',
                      label: t('colCode'),
                      cell: (part) => (
                        <span className="rz-mono">{part.partQrCode}</span>
                      ),
                    },
                    {
                      key: 'part',
                      label: t('colPosition'),
                      variant: 'primary',
                      cell: (part) => (
                        <span className="grid min-w-0 py-1.5">
                          <span className="truncate">{part.partName}</span>
                          {part.hasCoverageWarning ? (
                            <span className="text-state-warn text-caption font-normal">
                              {t('notAllZones')}
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                    {
                      key: 'expected',
                      label: t('colExpected'),
                      align: 'end',
                      cell: (part) => (
                        <span className="text-app-muted">
                          {part.expectedQuantity}
                        </span>
                      ),
                    },
                    {
                      key: 'actual',
                      label: t('colActual'),
                      align: 'end',
                      cell: (part) => (
                        <span
                          className={cn(
                            part.delta === 0
                              ? 'text-app-muted'
                              : part.delta > 0
                                ? 'text-state-warn'
                                : 'text-state-danger',
                          )}
                        >
                          {part.actualQuantity}
                        </span>
                      ),
                    },
                    {
                      key: 'delta',
                      label: t('colDelta'),
                      align: 'end',
                      cell: (part) =>
                        part.delta === 0 ? (
                          <span className="text-app-dim">0</span>
                        ) : (
                          <StatusPill tone={part.delta > 0 ? 'warn' : 'danger'}>
                            {part.delta > 0
                              ? `+${String(part.delta)}`
                              : String(part.delta)}
                          </StatusPill>
                        ),
                    },
                    {
                      key: 'decision',
                      label: t('colDecision'),
                      align: 'end',
                      cell: (part) => (
                        <ResultDecision
                          adjusted={adjusted.has(part.partId)}
                          busy={busy}
                          canAdjust={canAdjust}
                          onAsk={() => {
                            setReason('')
                            setAsking([part])
                          }}
                          part={part}
                          status={session.status}
                        />
                      ),
                    },
                  ]}
                  embedded
                  empty={
                    <EmptyState
                      description={
                        parts.length === 0
                          ? t('noResultsHint')
                          : t('tryOtherFilter')
                      }
                      title={
                        parts.length === 0
                          ? t('noResultsTitle')
                          : t('noFilteredTitle')
                      }
                    />
                  }
                  rowKey={(part) => part.partId}
                  rows={rows}
                />
              </section>

              <div className="flex flex-wrap items-start gap-3">
                <Card
                  className="min-w-0 flex-[1_1_420px]"
                  title={t('impactTitle')}
                >
                  <dl className="rz-facts px-0 py-0">
                    <div>
                      <dt>{t('writeOff')}</dt>
                      <dd className="rz-num text-state-danger">
                        {shortage === 0
                          ? '—'
                          : t('quantity', { count: String(shortage) })}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('addSurplus')}</dt>
                      <dd className="rz-num text-state-ok">
                        {surplus === 0
                          ? '—'
                          : t('quantity', { count: `+${String(surplus)}` })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-app-strong font-semibold">
                        {t('quantityChange')}
                      </dt>
                      <dd
                        className={cn(
                          'rz-num font-semibold',
                          shortage + surplus === 0
                            ? 'text-app-muted'
                            : shortage + surplus > 0
                              ? 'text-state-ok'
                              : 'text-state-danger',
                        )}
                      >
                        {t('quantity', {
                          count:
                            shortage + surplus > 0
                              ? `+${String(shortage + surplus)}`
                              : String(shortage + surplus),
                        })}
                      </dd>
                    </div>
                  </dl>
                  <p className="rz-dim m-0 mt-3" title={t('noCostTitle')}>
                    {t('noCost')}
                  </p>
                </Card>

                <Card
                  className="min-w-0 flex-[1_1_300px]"
                  title={t('afterTitle')}
                >
                  <ul className="text-app-ink m-0 grid list-none gap-2 p-0">
                    {[t('afterStock'), t('afterAudit'), t('afterUndo')].map(
                      (line) => (
                        <li className="flex gap-2.5" key={line}>
                          <span aria-hidden className="text-app-dim">
                            —
                          </span>
                          {line}
                        </li>
                      ),
                    )}
                  </ul>
                  {decidable.length > 0 ? (
                    <Button
                      className="rz-btn--lg mt-4 w-full"
                      onClick={() => {
                        setReason('')
                        setAsking(decidable)
                      }}
                      variant="primary"
                    >
                      {t('applyDecisions', { count: decidable.length })}
                    </Button>
                  ) : (
                    <p className="rz-dim m-0 mt-4">
                      {differing.length === 0
                        ? t('nothingToApply')
                        : session.status === 'review'
                          ? canAdjust
                            ? t('allDecided')
                            : t('needsAdjust')
                          : t('onlyInReview')}
                    </p>
                  )}
                </Card>
              </div>
            </div>

            <FormDialog
              description={
                asking === null
                  ? undefined
                  : asking.length === 1
                    ? t('oneConsequence', {
                        name: asking[0]?.partName ?? '',
                        count: String(asking[0]?.actualQuantity ?? 0),
                      })
                    : t('manyConsequence', { count: asking.length })
              }
              onOpenChange={(next) => {
                if (!next) setAsking(null)
              }}
              onSubmit={(event) => {
                event.preventDefault()
                if (asking !== null) void apply(asking, reason.trim())
              }}
              open={asking !== null}
              pending={busy}
              submitDisabled={reason.trim() === ''}
              submitLabel={
                busy && asking !== null && asking.length > 1
                  ? t('applying', { applied, total: asking.length })
                  : t('apply')
              }
              title={t('reasonTitle')}
            >
              <Field hint={t('reasonHint')} label={t('reason')} required>
                <TextArea
                  name="reason"
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  value={reason}
                />
              </Field>
            </FormDialog>
          </div>
        )
      }}
    </Resource>
  )
}

/**
 * What can still be done about one row. Only one write exists — booking the
 * counted quantity — so the column says either that, or why it is unavailable.
 */
function ResultDecision({
  part,
  adjusted,
  canAdjust,
  status,
  busy,
  onAsk,
}: {
  part: InventoryPartResult
  adjusted: boolean
  canAdjust: boolean
  status: InventorySession['status']
  busy: boolean
  onAsk: () => void
}) {
  const t = useT(resultsMessages)
  if (part.delta === 0) return <span className="text-app-dim">—</span>
  if (adjusted) return <StatusPill tone="ok">{t('applied')}</StatusPill>
  if (part.hasCoverageWarning)
    return (
      <span
        className="text-app-dim text-caption"
        title={t('partialCoverageWhy')}
      >
        {t('partialCoverage')}
      </span>
    )
  if (!canAdjust)
    return (
      <span className="text-app-dim text-caption">{t('noAdjustRight')}</span>
    )
  if (status !== 'review')
    return (
      <span className="text-app-dim text-caption">{t('awaitingReview')}</span>
    )
  return (
    <Button disabled={busy} onClick={onAsk} size="sm">
      {t('accept')}
    </Button>
  )
}

/**
 * The three things an audit trail records, taken from the action's own prefix
 * and, failing that, from which id the event carries. An unknown action still
 * lands somewhere rather than disappearing from every filter.
 */
const auditKind = (event: InventoryAuditEvent): AuditKind => {
  const prefix = event.action.split('.')[0] ?? ''
  if (prefix === 'adjustment' || event.adjustmentId != null) return 'decision'
  if (prefix === 'scan' || event.scanId != null) return 'scan'
  return 'session'
}

type AuditKind = 'decision' | 'scan' | 'session'

const AUDIT_KINDS: Record<AuditKind, { label: AuditKey; dot: string }> = {
  decision: { label: 'kindDecision', dot: 'bg-state-warn' },
  scan: { label: 'kindScan', dot: 'bg-state-info' },
  session: { label: 'kindSession', dot: 'bg-state-ok' },
}

const AUDIT_FILTERS = [
  { value: 'all', label: 'filterAll' },
  { value: 'decision', label: 'kindDecision' },
  { value: 'scan', label: 'kindScan' },
  { value: 'session', label: 'kindSession' },
] as const

type AuditFilter = (typeof AUDIT_FILTERS)[number]['value']

/** How many audit events to show before the reader asks for more. */
const AUDIT_PAGE = 20

interface AuditData {
  events: InventoryAuditEvent[]
  session: InventorySession
  people: { userId: string; name: string }[]
}

function AuditView({ id }: { id: string }) {
  const t = useT(auditMessages)
  const ti = useT(inventoryMessages)
  const { date, locale } = useInventoryFormat()
  const base = useInventoryBase()
  const canSeeTeam = usePermission('team.view')
  const [filter, setFilter] = useState<AuditFilter>('all')
  const [query, setQuery] = useState('')
  const [raw, setRaw] = useState(false)
  const [shown, setShown] = useState(AUDIT_PAGE)
  const loader = useCallback(
    async (signal: AbortSignal): Promise<AuditData> => {
      const [events, session, people] = await Promise.all([
        inventoryApi.getAudit(id, { signal }),
        inventoryApi.getSession(id, { signal }),
        canSeeTeam
          ? teamApi.listMembers({ signal }).then(
              (members) =>
                members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                })),
              () => [],
            )
          : Promise.resolve([]),
      ])
      return { events, session, people }
    },
    [canSeeTeam, id],
  )
  const resource = useLoad(loader, id)

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ events, session, people }: AuditData) => {
        const nameOf = (userId: string) =>
          people.find((person) => person.userId === userId)?.name ?? null
        const counts: Record<AuditFilter, number> = {
          all: events.length,
          decision: events.filter((event) => auditKind(event) === 'decision')
            .length,
          scan: events.filter((event) => auditKind(event) === 'scan').length,
          session: events.filter((event) => auditKind(event) === 'session')
            .length,
        }
        const needle = query.trim().toLowerCase()
        const rows = events.filter((event) => {
          if (filter !== 'all' && auditKind(event) !== filter) return false
          if (needle === '') return true
          const haystack =
            `${auditTitle(event.action, locale)} ${nameOf(event.actorUserId) ?? ''}`.toLowerCase()
          return haystack.includes(needle)
        })
        const visible = rows.slice(0, shown)
        const zones = [
          ...new Set(session.zones.map((zone) => zone.zoneCode)),
        ].join(', ')
        const warehouse = session.zones[0]?.warehouseName ?? null

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  className="rz-btn rz-btn--ghost"
                  to={`${base}/sessions/${id}`}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t('backToSession')}
                </Link>
                <p className="rz-crumbs m-0 hidden sm:flex">
                  <span>{ti('crumbInventory')}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span>{session.number}</span>
                  <ChevronRight aria-hidden className="size-3" />
                  <span aria-current="page">{t('crumbAudit')}</span>
                </p>
              </div>
              <div className="rz-topbar__actions flex-wrap items-center">
                <Button
                  aria-pressed={raw}
                  onClick={() => setRaw((value) => !value)}
                >
                  {raw ? t('hideRaw') : t('showRaw')}
                </Button>
                <Button disabled title={t('exportUnavailable')}>
                  {t('export')}
                </Button>
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <h1 className="rz-h-page">{t('title')}</h1>
                <p className="rz-muted m-0 mt-1">
                  {[
                    warehouse,
                    zones === '' ? null : t('zonesList', { zones }),
                    date(session.createdAt),
                    t('events', { count: events.length }),
                    t('readOnly'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="rz-toolbar">
                <SearchInput
                  aria-label={t('searchLabel')}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setShown(AUDIT_PAGE)
                  }}
                  placeholder={t('searchPlaceholder')}
                  value={query}
                />
                <div
                  aria-label={t('filterLabel')}
                  className="rz-seg flex-wrap"
                  role="radiogroup"
                >
                  {AUDIT_FILTERS.map((option) => (
                    <button
                      aria-checked={option.value === filter}
                      key={option.value}
                      onClick={() => {
                        setFilter(option.value)
                        setShown(AUDIT_PAGE)
                      }}
                      role="radio"
                      type="button"
                    >
                      {t(option.label)}{' '}
                      <span className="rz-mono text-app-dim text-micro">
                        {counts[option.value]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <section aria-label={t('logLabel')} className="rz-card">
                {visible.length === 0 ? (
                  <p className="rz-muted m-0 px-4 py-6 text-center">
                    {events.length === 0 ? t('noEvents') : t('noFiltered')}
                  </p>
                ) : (
                  <ol className="rz-timeline">
                    {visible.map((event) => {
                      const kind = auditKind(event)
                      const change = auditChange(event.detailsJson, locale)
                      return (
                        <li key={event.id}>
                          <span aria-hidden className="rz-timeline__icon">
                            <span
                              className={cn(
                                'size-2 rounded-full',
                                AUDIT_KINDS[kind].dot,
                              )}
                            />
                          </span>
                          <span className="grid min-w-0 gap-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="rz-strong font-semibold">
                                {auditTitle(event.action, locale)}
                              </span>
                              <StatusPill>
                                {t(AUDIT_KINDS[kind].label)}
                              </StatusPill>
                            </span>
                            <span className="rz-muted block">
                              {nameOf(event.actorUserId) ?? t('actorUnknown')}
                            </span>
                            {change === null ? null : (
                              <span className="rz-change">
                                <s>{change.from}</s>
                                <ArrowRight
                                  aria-hidden
                                  className="text-app-dim size-3.5"
                                />
                                <span className="text-app-strong">
                                  {change.to}
                                </span>
                              </span>
                            )}
                            {raw && event.detailsJson ? (
                              <span className="rz-inset rz-mono text-app-muted block px-3 py-2 text-micro break-all">
                                {event.detailsJson}
                              </span>
                            ) : null}
                          </span>
                          <span className="rz-timeline__date">
                            {date(event.createdAt)}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>

              {rows.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="rz-dim m-0">
                    {t('shown', {
                      visible: visible.length,
                      count: rows.length,
                    })}
                  </p>
                  {visible.length < rows.length ? (
                    <Button
                      onClick={() => setShown((value) => value + AUDIT_PAGE)}
                    >
                      {t('showMore', {
                        count: Math.min(
                          AUDIT_PAGE,
                          rows.length - visible.length,
                        ),
                      })}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )
      }}
    </Resource>
  )
}

/** What the journal is being read for: everything, the gaps, or the matches. */
const JOURNAL_FILTERS = [
  { value: 'all', label: 'filterAll' },
  { value: 'diff', label: 'filterDiff' },
  { value: 'same', label: 'filterSame' },
] as const

type JournalFilter = (typeof JOURNAL_FILTERS)[number]['value']

/**
 * Counting pace, in scans per hour. Under a quarter of an hour of counting the
 * figure says more about the clock than about the work, so it is withheld.
 */
const pace = (scans: readonly InventoryScan[]) => {
  if (scans.length < 2) return null
  const times = scans.map((scan) => new Date(scan.scannedAt).getTime())
  const span = Math.max(...times) - Math.min(...times)
  if (!Number.isFinite(span) || span < 15 * 60 * 1000) return null
  return Math.round(scans.length / (span / 3_600_000))
}

interface JournalData {
  scans: InventoryScan[]
  session: InventorySession
  /** Empty until the count is far enough along for the server to total it. */
  results: InventoryPartResult[]
  /** Empty when this person cannot see the team; scanners then stay unnamed. */
  people: { userId: string; name: string }[]
}

function JournalView({ id, zoneId }: { id: string; zoneId: string }) {
  const t = useT(journalMessages)
  const ti = useT(inventoryMessages)
  const { date, timeOfDay } = useInventoryFormat()
  const base = useInventoryBase()
  const canSeeTeam = usePermission('team.view')
  const [filter, setFilter] = useState<JournalFilter>('all')
  const [who, setWho] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(JOURNAL_PAGE)
  const loader = useCallback(
    async (signal: AbortSignal): Promise<JournalData> => {
      const [scans, session, results, people] = await Promise.all([
        inventoryApi.getScans(id, zoneId, { signal }),
        inventoryApi.getSession(id, { signal }),
        // Totals exist once the server has something to total; before that the
        // journal still stands on its own.
        inventoryApi.getResults(id, { signal }).then(
          (data) => data.parts,
          () => [],
        ),
        canSeeTeam
          ? teamApi.listMembers({ signal }).then(
              (members) =>
                members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                })),
              () => [],
            )
          : Promise.resolve([]),
      ])
      return { scans, session, results, people }
    },
    [canSeeTeam, id, zoneId],
  )
  const resource = useLoad(loader, `${id}:${zoneId}`)

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ scans, session, results, people }: JournalData) => {
        const zone = session.zones.find((item) => item.zoneId === zoneId)
        const nameOf = (userId: string) =>
          people.find((person) => person.userId === userId)?.name ?? null
        const resultOf = (partId: string) =>
          results.find((part) => part.partId === partId) ?? null
        const live = scans.filter((scan) => scan.voidedAt == null)
        const counts: Record<JournalFilter, number> = {
          all: scans.length,
          diff: scans.filter((scan) => {
            const part = resultOf(scan.partId)
            return part !== null && part.delta !== 0
          }).length,
          same: scans.filter((scan) => {
            const part = resultOf(scan.partId)
            return part !== null && part.delta === 0
          }).length,
        }
        const scanners = [...new Set(live.map((scan) => scan.scannedBy))]
        const needle = query.trim().toUpperCase()
        const rows = scans.filter((scan) => {
          const part = resultOf(scan.partId)
          // A scan the server has not totalled yet belongs to neither side.
          if (filter === 'diff' && (part?.delta ?? 0) === 0) return false
          if (filter === 'same' && part?.delta !== 0) return false
          if (who !== 'all' && scan.scannedBy !== who) return false
          if (
            needle !== '' &&
            !`${scan.partName} ${scan.partQrCode}`
              .toUpperCase()
              .includes(needle)
          )
            return false
          return true
        })
        const visible = rows.slice(0, shown)
        const last = live.reduce<InventoryScan | null>(
          (latest, scan) =>
            latest === null || scan.scannedAt > latest.scannedAt
              ? scan
              : latest,
          null,
        )
        const speed = pace(live)
        const pending = session.zones.filter(
          (item) => item.status === 'pending',
        )
        const backTo = `${base}/sessions/${id}`

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <div className="flex min-w-0 items-center gap-3">
                <Link className="rz-btn rz-btn--ghost" to={backTo}>
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t('backToSession')}
                </Link>
                <p className="rz-crumbs m-0 hidden sm:flex">
                  <span>{t('crumbSession', { number: session.number })}</span>
                  {zone ? (
                    <>
                      <ChevronRight aria-hidden className="size-3" />
                      <span aria-current="page">{zone.zoneCode}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="rz-topbar__actions flex-wrap items-center">
                <Button asChild>
                  <Link to={`${base}/sessions/${id}/results`}>
                    {t('results')}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <h1 className="rz-h-page">
                  {zone ? t('titleZone', { zone: zone.zoneCode }) : t('title')}
                </h1>
                <p className="rz-muted m-0 mt-1">
                  {[
                    zone?.warehouseName,
                    zone?.zoneName,
                    session.startedAt == null
                      ? t('notStarted')
                      : t('runningSince', { date: date(session.startedAt) }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <Notice tone="info">{t('readOnly')}</Notice>

              <div className="rz-kpis">
                <JournalStat
                  label={t('statScans')}
                  meta={ti('positions', {
                    count: new Set(live.map((scan) => scan.partId)).size,
                  })}
                  unit={
                    scans.length === live.length
                      ? undefined
                      : t('ofTotal', { count: scans.length })
                  }
                  value={String(live.length)}
                />
                <JournalStat
                  label={t('statDiffs')}
                  meta={
                    results.length === 0 ? t('totalsLater') : t('needDecision')
                  }
                  tone={counts.diff > 0 ? 'danger' : undefined}
                  unit={ti('positionsUnit')}
                  value={String(counts.diff)}
                />
                <JournalStat
                  label={t('statPace')}
                  meta={t('scanners', { count: scanners.length })}
                  unit={speed === null ? undefined : t('perHour')}
                  value={speed == null ? '—' : String(speed)}
                />
                <JournalStat
                  label={t('statLast')}
                  meta={
                    last === null
                      ? t('noScansYet')
                      : [nameOf(last.scannedBy), zone?.zoneCode]
                          .filter(Boolean)
                          .join(' · ')
                  }
                  value={last === null ? '—' : timeOfDay(last.scannedAt)}
                />
              </div>

              <div className="rz-toolbar">
                <SearchInput
                  aria-label={t('searchLabel')}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setShown(JOURNAL_PAGE)
                  }}
                  placeholder={t('searchPlaceholder')}
                  value={query}
                />
                <div
                  aria-label={t('filterLabel')}
                  className="rz-seg flex-wrap"
                  role="radiogroup"
                >
                  {JOURNAL_FILTERS.map((option) => {
                    const active = option.value === filter
                    const locked =
                      option.value !== 'all' && results.length === 0
                    return (
                      <button
                        aria-checked={active}
                        disabled={locked}
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value)
                          setShown(JOURNAL_PAGE)
                        }}
                        role="radio"
                        title={locked ? t('compareLater') : undefined}
                        type="button"
                      >
                        {t(option.label)}{' '}
                        <span className="rz-mono text-app-dim text-micro">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {people.length > 0 && scanners.length > 1 ? (
                  <div
                    aria-label={t('whoLabel')}
                    className="rz-seg flex-wrap"
                    role="radiogroup"
                  >
                    {[
                      { id: 'all', label: t('filterAll') },
                      ...scanners.map((userId) => ({
                        id: userId,
                        label: nameOf(userId) ?? t('nameless'),
                      })),
                    ].map((person) => (
                      <button
                        aria-checked={who === person.id}
                        key={person.id}
                        onClick={() => {
                          setWho(person.id)
                          setShown(JOURNAL_PAGE)
                        }}
                        role="radio"
                        type="button"
                      >
                        {person.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <section aria-label={t('title')} className="rz-card">
                <DataTable
                  caption={t('caption')}
                  columns={[
                    {
                      key: 'time',
                      label: t('colTime'),
                      cell: (scan) => (
                        <span className="rz-mono text-app-dim">
                          {timeOfDay(scan.scannedAt)}
                        </span>
                      ),
                    },
                    {
                      key: 'part',
                      label: t('colPosition'),
                      variant: 'primary',
                      cell: (scan) => (
                        <span className="grid min-w-0 py-1.5">
                          <span className="truncate">{scan.partName}</span>
                          <span className="rz-mono rz-caption font-normal">
                            {scan.partQrCode}
                          </span>
                          {/* Facts about this scan rather than about the
                              total, so they stay beside the part. */}
                          {scan.voidReason == null ? null : (
                            <span className="text-app-muted text-caption font-normal">
                              {scan.voidReason}
                            </span>
                          )}
                          {scan.unexpected && scan.voidedAt == null ? (
                            <span className="text-state-warn text-caption font-normal">
                              {t('unexpected')}
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                    ...(people.length > 0
                      ? [
                          {
                            key: 'who',
                            label: t('colWho'),
                            cell: (scan: InventoryScan) =>
                              nameOf(scan.scannedBy) ?? '—',
                          },
                        ]
                      : []),
                    {
                      key: 'expected',
                      label: t('colExpected'),
                      align: 'end',
                      cell: (scan) => (
                        <span className="text-app-muted">
                          {resultOf(scan.partId)?.expectedQuantity ?? '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'actual',
                      label: t('colScan'),
                      align: 'end',
                      cell: (scan) => (
                        <span className="text-app-strong">
                          {resultOf(scan.partId)?.actualQuantity ??
                            scan.zonePartCount}
                        </span>
                      ),
                    },
                    {
                      key: 'delta',
                      label: t('colDelta'),
                      align: 'end',
                      cell: (scan) => {
                        if (scan.voidedAt != null)
                          return (
                            <StatusPill tone="danger">{t('voided')}</StatusPill>
                          )
                        const part = resultOf(scan.partId)
                        if (part === null)
                          return <span className="text-app-dim">—</span>
                        return (
                          <StatusPill
                            tone={
                              part.delta === 0
                                ? 'ok'
                                : part.delta > 0
                                  ? 'warn'
                                  : 'danger'
                            }
                          >
                            {part.delta > 0
                              ? `+${String(part.delta)}`
                              : String(part.delta)}
                          </StatusPill>
                        )
                      },
                    },
                  ]}
                  embedded
                  empty={
                    <EmptyState
                      description={
                        scans.length === 0 ? t('emptyHint') : t('filteredHint')
                      }
                      title={
                        scans.length === 0
                          ? t('emptyTitle')
                          : t('filteredTitle')
                      }
                    />
                  }
                  rowKey={(scan) => scan.id}
                  rows={visible}
                />
                {rows.length > 0 ? (
                  <div className="rz-pager">
                    <p className="rz-mono m-0">
                      {t('shown', {
                        visible: visible.length,
                        count: rows.length,
                      })}
                    </p>
                    {visible.length < rows.length ? (
                      <div className="rz-pager__nav">
                        <Button
                          onClick={() =>
                            setShown((value) => value + JOURNAL_PAGE)
                          }
                        >
                          {t('showMore')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {pending.length > 0 ? (
                <section aria-label={t('pendingZones')} className="grid gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="rz-h-card">{t('pendingZones')}</h2>
                    <span className="rz-dim">
                      {ti('zones', { count: pending.length })}
                    </span>
                  </div>
                  <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 p-0">
                    {pending.map((item) => (
                      <li key={item.zoneId}>
                        <Link
                          className="rz-btn rz-mono w-full border-dashed"
                          to={`${base}/sessions/${id}/journal/${item.zoneId}`}
                        >
                          {item.zoneCode}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        )
      }}
    </Resource>
  )
}

/** One cell of the journal's figure strip: `.rz-kpi`. */
function JournalStat({
  label,
  value,
  unit,
  meta,
  tone,
}: {
  label: string
  value: string
  unit?: string | undefined
  meta?: string | undefined
  tone?: 'danger' | undefined
}) {
  return (
    <div className="rz-kpi">
      <p className="rz-kpi__label m-0">{label}</p>
      <p className="rz-kpi__value m-0">
        <span
          className={cn('rz-display', tone === 'danger' && 'text-state-danger')}
        >
          {value}
        </span>
        {unit === undefined ? null : (
          <span className="rz-kpi__unit">{unit}</span>
        )}
      </p>
      {meta === undefined ? null : <p className="rz-kpi__meta m-0">{meta}</p>}
    </div>
  )
}

/** Which part-history events are about where a part lies. */
const PLACEMENT_EVENTS = new Set(['placed', 'unplaced', 'moved'])

interface PlacementData {
  warehouses: Warehouse[]
  zones: InventoryZone[]
  sections: InventorySection[]
  shelves: InventoryShelf[]
  placement: PartInventoryZone[]
  part: PartDetail | null
  history: PartHistory | null
  /** Parts per zone, so a zone can say how loaded it is. */
  byZone: Map<string, number> | null
}

export function PartPlacementDrawer({
  partId,
  onClose,
  onSaved,
}: {
  partId: string
  onClose: () => void
  onSaved: () => void
}) {
  return <PartPlacementView partId={partId} drawer={{ onClose, onSaved }} />
}

function PartPlacementView({
  partId,
  drawer,
}: {
  partId: string
  drawer?: { onClose: () => void; onSaved: () => void }
}) {
  const t = useT(placementMessages)
  const tc = useT(commonMessages)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const ti = useT(inventoryMessages)
  const tw = useT(warehouseMessages)
  const to = useT(overviewMessages)
  const { date, locale } = useInventoryFormat()
  const { targetTenant } = useCabinet()
  const canManage = usePermission('inventory.zones.manage')
  const canSeeParts = usePermission('parts.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<PlacementData> => {
      const [
        warehouses,
        zones,
        sections,
        shelves,
        placement,
        part,
        history,
        byZone,
      ] = await Promise.all([
        inventoryApi.getWarehouses({ signal }),
        inventoryApi.getZones({ signal }),
        inventoryApi.getSections(undefined, { signal }),
        inventoryApi.getShelves(undefined, { signal }),
        inventoryApi.getPartZones(partId, { signal }),
        canSeeParts
          ? partsApi.get(partId, { signal }).then(
              (data) => data,
              () => null,
            )
          : Promise.resolve(null),
        canSeeParts
          ? partsApi.history(partId, { signal }).then(
              (data) => data,
              () => null,
            )
          : Promise.resolve(null),
        canSeeParts
          ? partsApi.facets({}, ['zone'], { signal }).then(
              (facets) =>
                new Map(facets.zones.map((zone) => [zone.id, zone.count])),
              () => null,
            )
          : Promise.resolve(null),
      ])
      return {
        warehouses,
        zones,
        sections,
        shelves,
        placement,
        part,
        history,
        byZone,
      }
    },
    [canSeeParts, partId],
  )
  const resource = useLoad(loader, partId)
  const [selection, setSelection] = useState<string[] | null>(null)
  const [shelfSelection, setShelfSelection] = useState<
    string | null | undefined
  >(undefined)
  const [sectionSelection, setSectionSelection] = useState<
    string | null | undefined
  >(undefined)
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState<'warehouse' | 'zone' | null>(
    null,
  )
  const [draft, setDraft] = useState({ name: '', code: '' })
  const selected = useMemo(
    () =>
      selection ??
      (resource.state.kind === 'ready'
        ? resource.state.data.placement.map((zone) => zone.zoneId)
        : []),
    [resource.state, selection],
  )

  const save = async () => {
    if (!canManage || saving || selected.length === 0) return
    setSaving(true)
    try {
      setOperationError(null)
      setSaved(false)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      const currentShelfId =
        resource.state.kind === 'ready'
          ? resource.state.data.placement.find(
              (zone) => zone.shelfId && selected.includes(zone.zoneId),
            )?.shelfId
          : undefined
      const currentSectionId =
        resource.state.kind === 'ready'
          ? resource.state.data.placement.find(
              (zone) => zone.sectionId && selected.includes(zone.zoneId),
            )?.sectionId
          : undefined
      await inventoryApi.replacePartZones(
        partId,
        selected,
        { signal: scope.signal },
        shelfSelection === undefined
          ? (currentShelfId ?? undefined)
          : (shelfSelection ?? undefined),
        sectionSelection === undefined
          ? (currentSectionId ?? undefined)
          : (sectionSelection ?? undefined),
      )
      if (scope.signal.aborted || !mounted.current) return
      if (drawer) {
        drawer.onSaved()
        drawer.onClose()
        return
      }
      setSelection(null)
      setShelfSelection(undefined)
      setSectionSelection(undefined)
      setSaved(true)
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setSaving(false)
    }
  }

  const openCreate = (mode: 'warehouse' | 'zone') => {
    setDraft({ name: '', code: '' })
    setCreateError(null)
    setCreateMode(mode)
  }

  const createWarehouse = async () => {
    const name = draft.name.trim()
    const code = draft.code.trim()
    if (!name || !code || creating) return
    setCreating(true)
    try {
      setCreateError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      const warehouse = await inventoryApi.createWarehouse(
        { name, code },
        { signal: scope.signal },
      )
      setWarehouseId(warehouse.id)
      setDraft({ name: '', code: '' })
      setCreateMode('zone')
      resource.refresh()
    } catch (error) {
      setCreateError(normalizeApiProblem(error).message)
    } finally {
      setCreating(false)
    }
  }

  const createZone = async (targetWarehouseId: string, input: ZoneDraft) => {
    const { name, code } = input
    if (!name || !code || creating) return
    setCreating(true)
    try {
      setCreateError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      const zone = await inventoryApi.createZone(
        { warehouseId: targetWarehouseId, name, code },
        { signal: scope.signal },
      )
      setSelection((value) => {
        const current = value ?? selected
        return current.includes(zone.id) ? current : [...current, zone.id]
      })
      setWarehouseId(zone.warehouseId)
      setQuery('')
      setSaved(false)
      setCreateMode(null)
      resource.refresh()
    } catch (error) {
      setCreateError(normalizeApiProblem(error).message)
    } finally {
      setCreating(false)
    }
  }

  const back = targetTenant
    ? cabinetPath(targetTenant.slug, 'parts', partId)
    : '/'

  const content = (
    <Resource framed={!drawer} retry={resource.reload} state={resource.state}>
      {({
        warehouses,
        zones,
        sections,
        shelves,
        placement,
        part,
        history,
        byZone,
      }: PlacementData) => {
        const real = zones.filter(
          (zone) => zone.isActive && !zone.isSystemUnassigned,
        )
        const houses = warehouses.filter((warehouse) => warehouse.isActive)
        /* Open on the warehouse the part already lies in — that is where a
           correction is most likely to be made. */
        const preferredHouse = warehouseId ?? placement[0]?.warehouseId
        const house =
          houses.find((item) => item.id === preferredHouse)?.id ??
          (createMode === 'zone' ? warehouseId : null) ??
          houses[0]?.id ??
          null
        const inHouse = real.filter((zone) => zone.warehouseId === house)
        const warehouseOnly = zones.find(
          (zone) =>
            zone.warehouseId === house &&
            zone.isSystemUnassigned &&
            zone.isActive,
        )
        const needle = query.trim().toLowerCase()
        const shown = inHouse.filter(
          (zone) =>
            needle === '' ||
            `${zone.name} ${zone.code}`.toLowerCase().includes(needle),
        )
        const partsIn = (zoneId: string) => byZone?.get(zoneId) ?? null
        const busiest = Math.max(
          1,
          ...inHouse.map((zone) => partsIn(zone.id) ?? 0),
        )
        const before = placement.map((zone) => zone.zoneId)
        const selectedShelfId =
          shelfSelection === undefined
            ? (placement.find(
                (zone) => zone.shelfId && selected.includes(zone.zoneId),
              )?.shelfId ?? null)
            : shelfSelection
        const selectedSectionId =
          sectionSelection === undefined
            ? (placement.find(
                (zone) => zone.sectionId && selected.includes(zone.zoneId),
              )?.sectionId ?? null)
            : sectionSelection
        const changed =
          selected.length !== before.length ||
          selected.some((id) => !before.includes(id)) ||
          selectedShelfId !==
            (placement.find((zone) => zone.shelfId)?.shelfId ?? null) ||
          selectedSectionId !==
            (placement.find((zone) => zone.sectionId)?.sectionId ?? null)
        const chosen = zones.filter((zone) => selected.includes(zone.id))
        const selectedSection = sections.find(
          (section) =>
            section.id === selectedSectionId &&
            selected.includes(section.zoneId),
        )
        const selectedShelf = shelves.find(
          (shelf) =>
            shelf.id === selectedShelfId &&
            shelf.sectionId === selectedSection?.id,
        )
        const hasPhysicalZone = chosen.some((zone) => !zone.isSystemUnassigned)
        const availableSections = sections.filter(
          (section) => section.isActive && selected.includes(section.zoneId),
        )
        const availableShelves = shelves.filter(
          (shelf) =>
            shelf.isActive &&
            shelf.sectionId === selectedSectionId &&
            selected.includes(shelf.zoneId),
        )
        const moves = (history?.events ?? []).filter((event) =>
          PLACEMENT_EVENTS.has(event.eventType),
        )
        const toggleZone = (zoneId: string) => {
          setSaved(false)
          setShelfSelection(null)
          setSectionSelection(null)
          setSelection((currentSelection) => {
            const current =
              currentSelection ?? placement.map((zone) => zone.zoneId)
            return current.includes(zoneId)
              ? current.filter((id) => id !== zoneId)
              : [...current.filter((id) => id !== warehouseOnly?.id), zoneId]
          })
        }

        return (
          <div
            className={
              drawer ? 'grid min-w-0 content-start' : 'grid content-start'
            }
          >
            {!drawer ? (
              <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Link className="rz-btn rz-btn--ghost" to={back}>
                    <ChevronLeft aria-hidden className="size-3.5" />
                    {t('backToPart')}
                  </Link>
                  <p className="rz-crumbs m-0 hidden sm:flex">
                    <span>{ti('crumbWarehouse')}</span>
                    <ChevronRight aria-hidden className="size-3" />
                    <span>{t('crumbParts')}</span>
                    {part === null ? null : (
                      <>
                        <ChevronRight aria-hidden className="size-3" />
                        <span aria-current="page">{part.qrCode}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="rz-topbar__actions flex-wrap items-center">
                  {canManage ? (
                    <Button
                      aria-busy={saving}
                      disabled={saving || selected.length === 0}
                      onClick={() => void save()}
                      variant="primary"
                    >
                      {saving ? t('saving') : t('place')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className={drawer ? 'grid min-w-0 gap-3' : 'rz-page'}>
              <div className="min-w-0">
                {!drawer ? (
                  <div className="rz-page-head">
                    <h1 className="rz-h-page">{t('title')}</h1>
                  </div>
                ) : null}
                <p className="rz-muted m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {part === null ? (
                    <span>{t('partHidden')}</span>
                  ) : (
                    <>
                      <span className="text-app-ink font-semibold">
                        {part.name}
                      </span>
                      <span aria-hidden className="text-app-dim">
                        ·
                      </span>
                      <span className="max-w-full break-all font-mono">
                        {part.qrCode}
                      </span>
                      <span aria-hidden className="text-app-dim">
                        ·
                      </span>
                      <span>
                        {t('inStock', {
                          count: part.quantityTotal,
                          unit: unitLabel(part.unit, locale),
                        })}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}
              {saved ? <Notice tone="ok">{t('saved')}</Notice> : null}

              <div className="flex flex-wrap items-start gap-4">
                <div
                  className={
                    drawer
                      ? 'grid min-w-0 w-full gap-3'
                      : 'flex min-w-0 flex-[2_1_34rem] flex-col gap-3'
                  }
                >
                  <Step
                    hint={t('warehouseHint')}
                    number="01"
                    title={t('warehouse')}
                  >
                    <div
                      aria-label={t('warehouse')}
                      className="flex flex-wrap gap-2"
                      role="radiogroup"
                    >
                      {houses.length === 0 ? (
                        <div className="rz-inset rz-muted grid w-full gap-3 border-dashed">
                          <p className="m-0">{t('noActiveWarehouses')}</p>
                          {canManage ? (
                            <Button onClick={() => openCreate('warehouse')}>
                              <Plus aria-hidden />
                              {to('addWarehouse')}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {houses.map((item) => {
                        const active = item.id === house
                        const count = real.filter(
                          (zone) => zone.warehouseId === item.id,
                        ).length
                        return (
                          <button
                            aria-checked={active}
                            className={cn(
                              'rz-choice-card grid flex-[1_1_10rem] gap-0.5 bg-transparent text-left hover:bg-app-hover',
                              active && 'border-brand bg-brand-soft',
                            )}
                            key={item.id}
                            onClick={() => {
                              setWarehouseId(item.id)
                              setQuery('')
                            }}
                            role="radio"
                            type="button"
                          >
                            <span
                              className={cn(
                                'block font-semibold',
                                active ? 'text-app-strong' : 'text-app-ink',
                              )}
                            >
                              {item.name}
                            </span>
                            <span className="rz-muted block text-caption">
                              {ti('zones', { count })}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </Step>

                  <Step
                    aside={
                      <p className="rz-muted m-0 flex flex-wrap items-center gap-3 text-caption">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="bg-app-line-2 size-2 rounded-rz-xs"
                          />
                          {t('legendEmpty')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="bg-state-warn/50 size-2 rounded-rz-xs"
                          />
                          {t('legendFilled')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="bg-state-danger/50 size-2 rounded-rz-xs"
                          />
                          {t('legendBusiest')}
                        </span>
                      </p>
                    }
                    hint={t('zoneHint')}
                    number="02"
                    title={t('zone')}
                  >
                    {warehouseOnly ? (
                      <label
                        className={cn(
                          'mb-3 rz-choice-card items-center justify-between',
                        )}
                      >
                        <input
                          type="radio"
                          name="placement-location"
                          className="peer sr-only"
                          disabled={!canManage}
                          checked={
                            selected.length === 1 &&
                            selected[0] === warehouseOnly.id
                          }
                          onChange={() => {
                            setSelection([warehouseOnly.id])
                            setSectionSelection(null)
                            setShelfSelection(null)
                            setSaved(false)
                          }}
                        />
                        <span>{t('warehouseOnly')}</span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-rz-xs border peer-focus-visible:shadow-[var(--rz-focus)]',
                            selected.length === 1 &&
                              selected[0] === warehouseOnly.id
                              ? 'border-brand bg-brand text-[var(--rz-on-brand)]'
                              : 'border-app-line-2',
                          )}
                        >
                          {selected.length === 1 &&
                          selected[0] === warehouseOnly.id ? (
                            <Check size={11} strokeWidth={3} />
                          ) : null}
                        </span>
                      </label>
                    ) : null}
                    {house === null ? null : (
                      <div className="flex flex-wrap items-center gap-3">
                        <SearchInput
                          aria-label={t('zoneSearch')}
                          className="min-w-0 flex-1"
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder={t('zoneSearchPlaceholder')}
                          value={query}
                        />
                        {canManage ? (
                          <Button onClick={() => openCreate('zone')}>
                            <Plus aria-hidden />
                            {tw('addZone')}
                          </Button>
                        ) : null}
                      </div>
                    )}
                    {house !== null && shown.length === 0 ? (
                      <p className="rz-inset rz-muted m-0 mt-3 border-dashed">
                        {inHouse.length === 0
                          ? t('noActiveZones')
                          : t('noZonesFound')}
                      </p>
                    ) : house !== null ? (
                      <ul
                        className={
                          drawer
                            ? 'm-0 mt-3 grid list-none gap-2 p-0'
                            : 'm-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] gap-2 p-0'
                        }
                      >
                        {shown.map((zone) => {
                          const on = selected.includes(zone.id)
                          const count = partsIn(zone.id)
                          const load =
                            count === null
                              ? 0
                              : Math.round((count / busiest) * 100)
                          return (
                            <li key={zone.id}>
                              <label className="rz-choice-card block px-3 py-2.5">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="min-w-0">
                                    <span
                                      className={cn(
                                        drawer
                                          ? 'block font-semibold break-words'
                                          : 'block truncate font-semibold',
                                        on ? 'text-app-strong' : 'text-app-ink',
                                      )}
                                    >
                                      {zone.name}
                                    </span>
                                    <span className="rz-mono rz-caption block">
                                      {zone.code}
                                    </span>
                                  </span>
                                  <input
                                    aria-label={`${zone.warehouseName} · ${zone.name}`}
                                    checked={on}
                                    className="peer sr-only"
                                    disabled={!canManage}
                                    onChange={() => toggleZone(zone.id)}
                                    type="checkbox"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      'flex size-4 shrink-0 items-center justify-center rounded-rz-xs border peer-focus-visible:shadow-[var(--rz-focus)]',
                                      on
                                        ? 'border-brand bg-brand text-[var(--rz-on-brand)]'
                                        : 'border-app-line-2',
                                    )}
                                  >
                                    {on ? (
                                      <Check size={11} strokeWidth={3} />
                                    ) : null}
                                  </span>
                                </span>
                                <span
                                  aria-hidden
                                  className={cn(
                                    'rz-meter mt-2',
                                    load >= 100
                                      ? 'rz-meter--danger'
                                      : 'rz-meter--warn',
                                  )}
                                >
                                  <span style={{ width: `${String(load)}%` }} />
                                </span>
                                <span className="rz-muted mt-1 block text-micro">
                                  {count === null
                                    ? ti('stockUnavailable')
                                    : ti('positions', { count })}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </Step>

                  {hasPhysicalZone ? (
                    <Step
                      number="03"
                      title={t('section')}
                      hint={t('sectionHint')}
                    >
                      {drawer ? (
                        <LocationSelect
                          label={t('section')}
                          searchLabel={t('sectionSearch')}
                          noneLabel={t('noSection')}
                          value={selectedSectionId}
                          options={availableSections.map((section) => ({
                            id: section.id,
                            name: section.name,
                            code: section.code,
                            ...(chosen.length > 1
                              ? { context: section.zoneName }
                              : {}),
                          }))}
                          disabled={!canManage || saving || creating}
                          onChange={(id) => {
                            setSectionSelection(id)
                            setShelfSelection(null)
                          }}
                        />
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label
                            className={cn(
                              'rz-choice-card items-center justify-between',
                            )}
                          >
                            <input
                              type="radio"
                              name="placement-section"
                              className="peer sr-only"
                              disabled={!canManage || selected.length === 0}
                              checked={!selectedSectionId}
                              onChange={() => {
                                setSectionSelection(null)
                                setShelfSelection(null)
                              }}
                            />
                            <span>{t('noSection')}</span>
                            <span
                              aria-hidden="true"
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded-rz-xs border peer-focus-visible:shadow-[var(--rz-focus)]',
                                !selectedSectionId
                                  ? 'border-brand bg-brand text-[var(--rz-on-brand)]'
                                  : 'border-app-line-2',
                              )}
                            >
                              {!selectedSectionId ? (
                                <Check size={11} strokeWidth={3} />
                              ) : null}
                            </span>
                          </label>
                          {availableSections.map((section) => (
                            <label
                              className={cn(
                                'rz-choice-card items-center justify-between',
                              )}
                              key={section.id}
                            >
                              <input
                                type="radio"
                                name="placement-section"
                                className="peer sr-only"
                                disabled={!canManage}
                                checked={selectedSectionId === section.id}
                                onChange={() => {
                                  setSectionSelection(section.id)
                                  setShelfSelection(null)
                                }}
                              />
                              <span>
                                {section.zoneName} · {section.name}
                              </span>
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'flex size-4 shrink-0 items-center justify-center rounded-rz-xs border peer-focus-visible:shadow-[var(--rz-focus)]',
                                  selectedSectionId === section.id
                                    ? 'border-brand bg-brand text-[var(--rz-on-brand)]'
                                    : 'border-app-line-2',
                                )}
                              >
                                {selectedSectionId === section.id ? (
                                  <Check size={11} strokeWidth={3} />
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </Step>
                  ) : null}

                  {hasPhysicalZone && selectedSectionId ? (
                    <Step number="04" title={t('shelf')} hint={t('shelfHint')}>
                      {drawer ? (
                        <LocationSelect
                          label={t('shelf')}
                          searchLabel={t('shelfSearch')}
                          noneLabel={t('noShelf')}
                          value={selectedShelfId}
                          options={availableShelves.map((shelf) => ({
                            id: shelf.id,
                            name: shelf.name,
                            code: shelf.code,
                          }))}
                          disabled={!canManage || saving || creating}
                          onChange={setShelfSelection}
                        />
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label
                            className={cn(
                              'rz-choice-card items-center justify-between',
                            )}
                          >
                            <input
                              type="radio"
                              name="placement-shelf"
                              className="peer sr-only"
                              disabled={!canManage || !selectedSectionId}
                              checked={!selectedShelfId}
                              onChange={() => setShelfSelection(null)}
                            />
                            <span>{t('noShelf')}</span>
                            <span
                              aria-hidden="true"
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded-rz-xs border peer-focus-visible:shadow-[var(--rz-focus)]',
                                !selectedShelfId
                                  ? 'border-brand bg-brand text-[var(--rz-on-brand)]'
                                  : 'border-app-line-2',
                              )}
                            >
                              {!selectedShelfId ? (
                                <Check size={11} strokeWidth={3} />
                              ) : null}
                            </span>
                          </label>
                          {availableShelves.map((shelf) => (
                            <label
                              className={cn(
                                'rz-choice-card items-center justify-between',
                              )}
                              key={shelf.id}
                            >
                              <input
                                type="radio"
                                name="placement-shelf"
                                className="peer sr-only"
                                disabled={!canManage}
                                checked={selectedShelfId === shelf.id}
                                onChange={() => setShelfSelection(shelf.id)}
                              />
                              <span>
                                {shelf.zoneName} · {shelf.sectionName} ·{' '}
                                {shelf.name}
                              </span>
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'flex size-4 shrink-0 items-center justify-center rounded-rz-xs border peer-focus-visible:shadow-[var(--rz-focus)]',
                                  selectedShelfId === shelf.id
                                    ? 'border-brand bg-brand text-[var(--rz-on-brand)]'
                                    : 'border-app-line-2',
                                )}
                              >
                                {selectedShelfId === shelf.id ? (
                                  <Check size={11} strokeWidth={3} />
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </Step>
                  ) : null}

                  <Step
                    hint={t('quantityHint')}
                    number={
                      selectedSectionId ? '05' : hasPhysicalZone ? '04' : '03'
                    }
                    title={t('quantity')}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="rz-stepper" title={t('notSplitTitle')}>
                        <button
                          aria-hidden
                          disabled
                          tabIndex={-1}
                          type="button"
                        >
                          −
                        </button>
                        <span className="rz-mono rz-strong border-app-line grid h-full min-w-12 place-items-center border-x px-2">
                          {part?.quantityTotal ?? '—'}
                        </span>
                        <button
                          aria-hidden
                          disabled
                          tabIndex={-1}
                          type="button"
                        >
                          +
                        </button>
                      </span>
                      <p className="rz-muted m-0 min-w-[12rem] flex-1">
                        {t('notSplit')}
                      </p>
                    </div>
                  </Step>

                  {!drawer ? (
                    <Card
                      aside={
                        <span className="rz-eyebrow">
                          {t('records', { count: moves.length })}
                        </span>
                      }
                      bodyClassName="p-0"
                      className="min-w-0"
                      title={t('historyTitle')}
                    >
                      {moves.length === 0 ? (
                        <p className="rz-muted m-0 px-4 pt-3 pb-4">
                          {history === null
                            ? t('historyHidden')
                            : t('neverMoved')}
                        </p>
                      ) : (
                        <ul className="m-0 grid list-none p-0">
                          {moves.slice(0, 8).map((event) => (
                            <li
                              className="border-app-line flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t px-4 py-2.5"
                              key={event.id}
                            >
                              <span className="rz-strong w-28 shrink-0 font-semibold">
                                {historyLabel(event.eventType, locale)}
                              </span>
                              <span className="rz-muted min-w-0 flex-1">
                                {historyDetails(event.data, locale).join(' · ')}
                              </span>
                              <span className="rz-timeline__date">
                                {date(event.createdAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  ) : null}
                </div>

                {!drawer ? (
                  <section
                    aria-label={t('newPlacement')}
                    className="rz-card rz-card__body flex min-w-0 flex-[1_1_18rem] flex-col self-start"
                  >
                    <h2 className="rz-h-card">{t('newPlacement')}</h2>
                    <div className="rz-inset mt-3">
                      {chosen.length > 0 ? (
                        <ul className="m-0 grid list-none gap-2 p-0">
                          {chosen.map((zone) => (
                            <li className="min-w-0" key={zone.id}>
                              <span className="text-app-ink font-semibold">
                                {zone.warehouseName} ·{' '}
                                {zone.isSystemUnassigned
                                  ? t('warehouseLevel')
                                  : zone.name}
                              </span>
                              {selectedSection?.zoneId === zone.id ? (
                                <span className="text-app-muted block">
                                  {selectedSection.name}
                                  {selectedShelf
                                    ? ` · ${selectedShelf.name}`
                                    : ''}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rz-muted m-0">
                          {t('noLocationSelected')}
                        </p>
                      )}
                    </div>
                    {canManage ? (
                      <Button
                        aria-busy={saving}
                        className="rz-btn--lg mt-4 w-full"
                        disabled={saving || selected.length === 0}
                        onClick={() => void save()}
                        variant="primary"
                      >
                        {saving ? t('saving') : t('savePlacement')}
                      </Button>
                    ) : null}
                    <p className="rz-caption m-0 mt-3">
                      {selected.length === 0
                        ? t('pickOne')
                        : changed
                          ? t('replacesAll')
                          : t('unchanged')}
                    </p>
                  </section>
                ) : null}
              </div>
            </div>
            <WarehouseEditorSheet
              open={createMode === 'warehouse'}
              draft={draft}
              onChange={setDraft}
              onClose={() => setCreateMode(null)}
              onSubmit={() => void createWarehouse()}
              pending={creating}
              error={createError}
            />
            {createMode === 'zone' && house !== null ? (
              <ZoneEditorSheet
                eyebrow={houses.find((item) => item.id === house)?.name}
                error={createError}
                onClose={() => setCreateMode(null)}
                onSubmit={(input) => void createZone(house, input)}
                pending={creating}
              />
            ) : null}
          </div>
        )
      }}
    </Resource>
  )
  if (!drawer) return content
  const pending = saving || creating
  return (
    <Sheet
      open
      title={t('title')}
      onOpenChange={(open) => {
        if (!open && !pending) drawer.onClose()
      }}
      footer={
        <>
          <Button disabled={pending} onClick={drawer.onClose} type="button">
            {tc('cancel')}
          </Button>
          {canManage ? (
            <Button
              aria-busy={saving}
              disabled={
                pending ||
                resource.state.kind !== 'ready' ||
                selected.length === 0
              }
              onClick={() => void save()}
              variant="primary"
            >
              {saving ? t('saving') : t('savePlacement')}
            </Button>
          ) : null}
        </>
      }
    >
      {content}
    </Sheet>
  )
}
