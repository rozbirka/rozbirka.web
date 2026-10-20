import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  Archive,
  ArrowRight,
  ChevronLeft,
  ClipboardList,
  Pause,
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
  StatusPill,
  TextArea,
} from '@/components/app'
import {
  inventoryApi,
  type InventoryAuditEvent,
  type InventoryPartResult,
  type InventoryScan,
  type InventorySession,
  type InventorySessionResults,
  type InventoryZone,
  type Warehouse,
} from '@/api/inventory'
import { partsApi } from '@/api/parts'
import { normalizeApiProblem } from '@/api/errors'
import { cn } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { formatNumber, useT } from '@/i18n'
import { auditChange, auditTitle, type AuditKey } from './audit-labels'
import { auditMessages } from './audit-messages'
import { useInventoryFormat } from './inventory-format'
import { journalMessages } from './journal-messages'
import { inventoryMessages } from './messages'
import { newSessionMessages } from './new-session-messages'
import { overviewMessages } from './overview-messages'
import { resultsMessages } from './results-messages'
import { sessionMessages } from './session-messages'
import { InventoryLoadError, Resource } from './InventoryResource'
import {
  optionalInventoryData,
  useLoad,
  usePermission,
} from './use-stock-resource'
import { useInventoryRefresh } from './use-inventory-refresh'
import { InventoryRefreshStatus } from './InventoryRefreshStatus'
import { InventoryTeamStatus } from './InventoryTeamStatus'
import { useInventoryTeam } from './use-inventory-team'
import { StockStat } from './StockStat'
import { Step } from './StockStep'

/** How many journal rows to show before the reader asks for more. */
const JOURNAL_PAGE = 25

export function InventoryScreen({
  definition: _definition,
}: CabinetModuleScreenProps) {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const route = segments[0] === 'app' ? segments.slice(2) : segments
  const tail = route[0] === 'inventory' ? route.slice(1) : []
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
  sessions: InventorySession[]
  zones: InventoryZone[] | null
  /** The cut-off for "checked recently", taken once when the data loads. */
  since: number
}

function Overview() {
  const t = useT(overviewMessages)
  const ti = useT(inventoryMessages)
  const { date, day, sessionStatus, locale } = useInventoryFormat()
  const base = useInventoryBase()
  const canManage = usePermission('inventory.manage')
  const loader = useCallback(
    async (signal: AbortSignal): Promise<OverviewData> => {
      const [sessions, zones] = await Promise.all([
        inventoryApi.getSessions({ signal }),
        inventoryApi.getZones({ activeOnly: true, signal }).catch(() => null),
      ])
      return {
        sessions,
        zones,
        since: Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000,
      }
    },
    [],
  )
  const resource = useLoad(loader, 'inventory-overview')
  const [segment, setSegment] = useState<OverviewSegment>('active')
  const [query, setQuery] = useState('')

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ sessions, zones, since }: OverviewData) => {
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
        const countable = (zones ?? []).filter(
          (zone) => !zone.isSystemUnassigned,
        )
        const running = sessions.filter(
          (item) => segmentOf(item.status) === 'active',
        )
        const openDiffs = running.reduce(
          (sum, item) => sum + item.preview.conflictingPartCount,
          0,
        )

        return (
          <div className="grid content-start">
            <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
              <p className="rz-crumbs flex-wrap">
                <span>{ti('crumbWarehouse')}</span>
                <span aria-hidden className="text-app-dim">
                  /
                </span>
                <span className="text-app-muted">{ti('crumbInventory')}</span>
              </p>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
                <div className="min-w-[12rem] flex-[0_1_20rem]">
                  <SearchInput
                    aria-label={t('searchLabel')}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('searchPlaceholder')}
                    value={query}
                  />
                </div>
                {canManage ? (
                  <Button
                    asChild
                    className="px-5 text-sm font-bold"
                    variant="primary"
                  >
                    <Link to={`${base}/sessions/new`}>{ti('newSession')}</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <h1 className="rz-h-page break-words">
                  {ti('crumbInventory')}
                </h1>
                <p className="rz-caption mt-1">
                  {last === null
                    ? t('noCompletedYet')
                    : t('lastCompleted', {
                        date: day(last.completedAt),
                        count: last.preview.conflictingPartCount,
                      })}
                </p>
              </div>

              {zones === null ? (
                <InventoryLoadError
                  message={ti('zonesLoadFailed')}
                  onRetry={resource.reload}
                />
              ) : null}

              <div className="rz-kpis">
                <StockStat
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
                <StockStat
                  label={t('statZones')}
                  meta={t('lastDays', { count: RECENT_DAYS })}
                  unit={
                    countable.length === 0
                      ? t('zonesUnit')
                      : t('ofTotal', { count: countable.length })
                  }
                  value={zones === null ? '—' : String(checkedZones)}
                />
                <StockStat
                  label={ti('discrepancies')}
                  meta={t('inRunning')}
                  tone={openDiffs > 0 ? 'danger' : 'plain'}
                  unit={ti('positionsUnit')}
                  value={String(openDiffs)}
                />
                <StockStat
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

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div
                  aria-label={t('segmentsLabel')}
                  className="rz-seg flex-wrap"
                  role="radiogroup"
                >
                  {OVERVIEW_SEGMENTS.map((option) => {
                    const active = option.value === segment
                    return (
                      <button
                        aria-checked={active}
                        className={cn(
                          'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-3.5 text-body font-bold',
                          active
                            ? 'text-app-strong bg-app-selected'
                            : 'text-app-muted hover:text-app-ink',
                        )}
                        key={option.value}
                        onClick={() => setSegment(option.value)}
                        role="radio"
                        type="button"
                      >
                        {t(option.label)}{' '}
                        <span className="text-app-dim font-mono text-micro font-medium">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-app-muted text-body">
                  {t('rowsSummary', { count: rows.length })}
                </p>
              </div>

              <section
                aria-label={t('sessionsLabel')}
                className="border-app-line bg-app-raised overflow-hidden rounded-panel border"
              >
                <div
                  aria-hidden
                  className="border-app-line text-app-muted hidden gap-4 border-b px-6 py-3 font-mono text-micro tracking-[var(--rz-ls-mono)] uppercase md:grid md:grid-cols-[1.6fr_1fr_9.5rem_7rem_6rem]"
                >
                  <span>{t('colSession')}</span>
                  <span>{t('colWarehouseZones')}</span>
                  <span>{t('colProgress')}</span>
                  <span>{ti('discrepancies')}</span>
                  <span className="text-right">{t('colStatus')}</span>
                </div>
                {rows.length === 0 ? (
                  <p className="text-app-muted px-6 py-8 text-center text-sm">
                    {sessions.length === 0 ? t('noSessions') : t('noFiltered')}
                  </p>
                ) : (
                  <ul className="grid">
                    {rows.map((item) => {
                      const [label, tone] = sessionStatus(item.status)
                      const total = item.zones.length
                      const done = doneZones(item)
                      const percent =
                        total === 0 ? 0 : Math.round((done / total) * 100)
                      return (
                        <li
                          className="border-app-line border-b last:border-0"
                          key={item.id}
                        >
                          <Link
                            className="grid items-center gap-x-4 gap-y-2 px-6 py-4 hover:bg-app-hover md:grid-cols-[1.6fr_1fr_9.5rem_7rem_6rem]"
                            to={`${base}/sessions/${item.id}`}
                          >
                            <span className="min-w-0">
                              <span className="block text-title font-bold tracking-[-0.01em] text-app-strong">
                                {item.number}
                              </span>
                              <span className="text-app-muted mt-0.5 block text-body">
                                {ti('created', { date: date(item.createdAt) })}
                              </span>
                            </span>
                            <span className="text-app-muted min-w-0 text-body">
                              {houseOf(item)}
                              {zonesOf(item) === ''
                                ? ''
                                : ` · ${zonesOf(item)}`}
                            </span>
                            <span>
                              <span
                                aria-hidden
                                className="bg-app-line-2 block h-1.5 overflow-hidden rounded-full"
                              >
                                <span
                                  className={cn(
                                    'block h-full rounded-full',
                                    percent === 100
                                      ? 'bg-state-ok'
                                      : percent > 0
                                        ? 'bg-state-warn'
                                        : 'bg-transparent',
                                  )}
                                  style={{ width: `${String(percent)}%` }}
                                />
                              </span>
                              <span className="text-app-muted mt-1.5 block font-mono text-caption">
                                {ti('zonesProgress', { done, count: total })}
                              </span>
                            </span>
                            <span
                              className={cn(
                                'font-mono text-body tabular-nums',
                                item.status === 'draft'
                                  ? 'text-app-dim'
                                  : item.preview.conflictingPartCount === 0
                                    ? 'text-state-ok'
                                    : 'text-state-danger',
                              )}
                            >
                              <span className="text-app-muted mr-2 text-micro tracking-[var(--rz-ls-mono)] uppercase md:hidden">
                                {ti('discrepancies')}
                              </span>
                              {item.status === 'draft'
                                ? '—'
                                : item.preview.conflictingPartCount}
                            </span>
                            <span className="md:flex md:justify-end">
                              <StatusPill tone={tone}>{label}</StatusPill>
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )
      }}
    </Resource>
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
}

function NewSessionView() {
  const t = useT(newSessionMessages)
  const ti = useT(inventoryMessages)
  const base = useInventoryBase()
  const navigate = useNavigate()
  const canManage = usePermission('inventory.manage')
  const canSeeParts = usePermission('parts.view')
  const team = useInventoryTeam()
  const { people } = team
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<NewSessionData> => {
      const [warehouses, zones, byZone] = await Promise.all([
        inventoryApi.getWarehouses({ signal }),
        inventoryApi.getZones({ activeOnly: true, signal }),
        canSeeParts
          ? partsApi.facets({}, ['zone'], { signal }).then(
              (facets) =>
                new Map(facets.zones.map((zone) => [zone.id, zone.count])),
              () => null,
            )
          : Promise.resolve(null),
      ])
      return { warehouses, zones, byZone }
    },
    [canSeeParts],
  )
  const resource = useLoad(loader, 'new-session')
  const [params] = useSearchParams()
  const [type, setType] = useState<SessionType>('zones')
  const [warehouseId, setWarehouseId] = useState<string | null>(() =>
    params.get('warehouseId'),
  )
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState<'draft' | 'start' | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const creatingSession = useRef(false)

  const create = async (zoneIds: readonly string[], start: boolean) => {
    if (!canManage || zoneIds.length === 0 || creatingSession.current) return
    creatingSession.current = true
    setBusy(start ? 'start' : 'draft')
    setOperationError(null)
    let createdSession: InventorySession | null = null
    let mutationSignal: AbortSignal | undefined
    try {
      const scope = requireLatestMutation({ quota: false })
      mutationSignal = scope.signal
      const session = await inventoryApi.createSession([...zoneIds], {
        signal: scope.signal,
      })
      createdSession = session
      if (scope.signal.aborted) return
      if (start) {
        await inventoryApi.startSession(session.id, { signal: scope.signal })
      }
      if (scope.signal.aborted) return
      void navigate(`${base}/sessions/${session.id}`, { replace: true })
    } catch (error) {
      if (mutationSignal?.aborted) return
      const message = normalizeApiProblem(error).message
      if (createdSession) {
        void navigate(`${base}/sessions/${createdSession.id}`, {
          replace: true,
          state: {
            inventoryStartError: t('startFailedAfterCreate', {
              number: createdSession.number,
              error: message,
            }),
          },
        })
      } else setOperationError(message)
    } finally {
      creatingSession.current = false
      setBusy(null)
    }
  }

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ warehouses, zones, byZone }: NewSessionData) => {
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
        const house =
          houses.find((item) => item.id === warehouseId)?.id ??
          houses[0]?.id ??
          null
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
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-app-hover"
                  to={base}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {ti('backToInventory')}
                </Link>
                <p className="rz-crumbs hidden sm:flex">
                  <span>{ti('crumbWarehouse')}</span>
                  <span aria-hidden className="text-app-dim">
                    /
                  </span>
                  <span className="text-app-muted">{ti('crumbInventory')}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  className="px-[18px] text-sm font-semibold"
                  disabled={!ready || busy !== null}
                  onClick={() => void create(selected, false)}
                >
                  {busy === 'draft' ? t('saving') : t('saveDraft')}
                </Button>
                <Button
                  className="px-5 text-sm font-bold"
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
                <h1 className="rz-h-page break-words">{t('title')}</h1>
                <p className="rz-caption mt-1">{t('intro')}</p>
              </div>

              {!canManage ? (
                <Notice tone="danger">{t('noPermission')}</Notice>
              ) : null}
              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              <div className="flex flex-wrap items-start gap-6">
                <div className="flex min-w-0 flex-[2_1_34rem] flex-col gap-5">
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
                              'focus-visible:outline-brand min-h-[70px] flex-[1_1_10rem] rounded-panel border px-4 py-3.5 text-left',
                              active
                                ? 'border-app-line-2 bg-app-hover'
                                : 'border-app-line bg-transparent',
                              option.available
                                ? 'cursor-pointer hover:border-app-line-2'
                                : 'cursor-not-allowed opacity-55',
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
                                'block text-title font-bold',
                                active ? 'text-app-ink' : 'text-app-muted',
                              )}
                            >
                              {t(option.label)}
                            </span>
                            <span className="text-app-muted mt-1.5 block text-caption leading-[1.4] font-medium">
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
                        className="flex flex-wrap gap-1.5"
                        role="radiogroup"
                      >
                        {houses.map((item) => {
                          const active = item.id === house
                          return (
                            <button
                              aria-checked={active}
                              className={cn(
                                'focus-visible:outline-brand min-h-control cursor-pointer rounded-control border px-4 text-body font-semibold',
                                active
                                  ? 'border-app-line-2 text-app-strong bg-app-selected'
                                  : 'border-app-line text-app-muted hover:border-app-line-2',
                              )}
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
                    <ul className="mt-4 grid gap-2">
                      {inHouse.length === 0 ? (
                        <li className="text-app-muted text-sm">
                          {t('noActiveZones')}
                        </li>
                      ) : null}
                      {inHouse.map((zone) => {
                        const on = selected.includes(zone.id)
                        const count = partsIn(zone.id)
                        return (
                          <li key={zone.id}>
                            <label
                              className={cn(
                                'flex w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-panel border px-4 py-3.5',
                                on
                                  ? 'border-app-line-2 bg-app-hover'
                                  : 'border-app-line bg-app-canvas',
                                type === 'full'
                                  ? 'cursor-not-allowed'
                                  : 'cursor-pointer hover:border-app-line-2',
                              )}
                            >
                              <input
                                checked={on}
                                className="accent-brand size-5 shrink-0"
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
                                    'block text-title font-bold',
                                    type === 'full'
                                      ? 'text-app-muted'
                                      : 'text-app-ink',
                                  )}
                                >
                                  {zone.name}
                                </span>
                                <span className="text-app-muted mt-0.5 block text-body">
                                  {zone.code} · {zone.warehouseName}
                                </span>
                              </span>
                              {/* Narrow screens give the count its own line
                                  rather than squeezing the zone's name. */}
                              <span className="text-app-muted w-full pl-8.5 font-mono text-body tabular-nums sm:w-auto sm:pl-0">
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
                    <InventoryTeamStatus team={team} />
                    {!team.allowed || team.empty ? (
                      <p className="text-app-muted text-sm">
                        {team.allowed ? t('noPeople') : t('teamHidden')}
                      </p>
                    ) : people.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {people.map((person) => (
                          <li key={person.userId}>
                            <span
                              className="border-app-line text-app-muted flex min-h-control items-center gap-2.5 rounded-full border py-0 pr-4 pl-2 text-body font-semibold"
                              title={t('personHint')}
                            >
                              <span
                                aria-hidden
                                className="flex size-7 items-center justify-center rounded-full bg-app-hover text-caption font-bold"
                              >
                                {initials(person.name)}
                              </span>
                              {person.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Step>

                  <Step number="04" title={t('rulesTitle')}>
                    <ul className="grid gap-2.5">
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
                    <div className="mt-4">
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
                  className="border-app-line bg-app-raised flex min-w-0 flex-[1_1_18rem] flex-col rounded-panel border px-5.5 pt-[22px] pb-6"
                >
                  <h2 className="text-app-dim font-mono text-micro tracking-[var(--rz-ls-mono)] uppercase">
                    {t('scopeTitle')}
                  </h2>
                  <div className="border-app-line bg-app-canvas mt-4 rounded-panel border p-4">
                    <p className="text-title font-bold tracking-[-0.015em] text-app-strong">
                      {houseName} · {typeName}
                    </p>
                    <p className="text-app-muted mt-1 text-body">
                      {selected.length === 0
                        ? t('noZonesPicked')
                        : inHouse
                            .filter((zone) => selected.includes(zone.id))
                            .map((zone) => zone.name)
                            .join(', ')}
                    </p>
                  </div>
                  <dl className="mt-5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                    <dt className="text-app-muted text-body font-semibold">
                      {t('zonesCount')}
                    </dt>
                    <dd className="font-mono text-title text-app-strong tabular-nums">
                      {selected.length === 0 ? '—' : selected.length}
                    </dd>
                    <dt className="text-app-muted text-body font-semibold">
                      {t('positionsCount')}
                    </dt>
                    <dd className="font-mono text-title text-app-strong tabular-nums">
                      {byZone === null || selected.length === 0
                        ? '—'
                        : partsTotal}
                    </dd>
                    <dt
                      className="text-app-muted text-body font-semibold"
                      title={t('peopleNotAssigned')}
                    >
                      {t('peopleCount')}
                    </dt>
                    <dd className="text-app-dim font-mono text-title">—</dd>
                    <dd
                      aria-hidden
                      className="bg-app-line col-span-2 my-1 h-px"
                    />
                    <dt
                      className="text-title font-bold text-app-strong"
                      title={t('durationNotEstimated')}
                    >
                      {t('estimate')}
                    </dt>
                    <dd className="text-app-dim font-mono text-page">—</dd>
                  </dl>
                  <Button
                    className="mt-5.5 min-h-control-lg w-full text-title font-bold"
                    disabled={!ready || busy !== null}
                    onClick={() => void create(selected, true)}
                    variant="primary"
                  >
                    {busy === 'start' ? t('starting') : t('start')}
                  </Button>
                  <p className="text-app-dim mt-3 text-caption leading-[1.5]">
                    {selected.length === 0 ? t('pickOne') : t('afterStart')}
                  </p>
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
    <li
      className="border-app-line bg-app-canvas flex items-center gap-3.5 rounded-panel border px-4 py-3.5"
      title={why}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-title font-bold text-app-strong">
          {label}
        </span>
        <span className="text-app-muted mt-0.5 block text-body leading-[1.45]">
          {hint} {why}.
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'flex h-6 w-10.5 shrink-0 items-center rounded-full p-[3px]',
          on ? 'bg-brand' : 'bg-app-line-2',
        )}
      >
        <span
          className={cn(
            'size-4.5 rounded-full',
            on ? 'bg-app-canvas translate-x-4.5' : 'bg-app-muted',
          )}
        />
      </span>
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
  /** Drafts have no results; null for other statuses means loading failed. */
  results: InventorySessionResults | null
  /** Every zone's scans in one stream, newest first. */
  scans: InventoryScan[] | null
}

const sessionDataComplete = (data: SessionData) =>
  (data.session.status === 'draft' || data.results !== null) &&
  data.scans !== null

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
  const ti = useT(inventoryMessages)
  const { date, sessionStatus, timeOfDay } = useInventoryFormat()
  const navigate = useNavigate()
  const location = useLocation()
  const startError = (
    location.state as { inventoryStartError?: unknown } | null
  )?.inventoryStartError
  const base = useInventoryBase()
  const canManage = usePermission('inventory.manage')
  const team = useInventoryTeam()
  const { people } = team
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<SessionData> => {
      const session = await inventoryApi.getSession(id, { signal })
      const [results, scanLists] = await Promise.all([
        session.status === 'draft'
          ? Promise.resolve(null)
          : inventoryApi
              .getResults(id, { signal })
              .then((data) => data, optionalInventoryData),
        Promise.all(
          session.zones.map((zone) =>
            inventoryApi.getScans(id, zone.zoneId, { signal }),
          ),
        ).catch(optionalInventoryData),
      ])
      const scans =
        scanLists === null
          ? null
          : scanLists
              .flat()
              .sort((left, right) =>
                right.scannedAt.localeCompare(left.scannedAt),
              )
      return { session, results, scans }
    },
    [id],
  )
  const resource = useLoad(loader, id, sessionDataComplete)
  const { refresh: refreshData } = resource
  const { refresh: refreshTeam } = team
  const refresh = useCallback(() => {
    refreshData()
    refreshTeam()
  }, [refreshData, refreshTeam])
  useInventoryRefresh(refresh)
  const [operationError, setOperationError] = useState<string | null>(() =>
    typeof startError === 'string' ? startError : null,
  )
  useEffect(() => {
    if (typeof startError !== 'string') return
    const state = { ...(location.state as Record<string, unknown>) }
    delete state['inventoryStartError']
    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      { replace: true, state },
    )
  }, [startError, location, navigate])
  const [acting, setActing] = useState(false)
  const [filter, setFilter] = useState<SessionFilter>('all')
  /** The action waiting for a confirmation, and the reason a cancel needs. */
  const [asking, setAsking] = useState<'start' | 'complete' | 'reopen' | null>(
    null,
  )
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')

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
      {({ session, results, scans: loadedScans }: SessionData) => {
        const scans = loadedScans ?? []
        const resultsFailed = session.status !== 'draft' && results === null
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
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-app-hover"
                  to={base}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {ti('backToInventory')}
                </Link>
                <p className="rz-crumbs hidden sm:flex">
                  <span>{ti('crumbInventory')}</span>
                  <span aria-hidden className="text-app-dim">
                    /
                  </span>
                  <span className="text-app-muted">{session.number}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {session.status === 'draft' ? null : (
                  <Button
                    asChild
                    className="px-[18px] text-sm font-semibold"
                    variant="quiet"
                  >
                    <Link to={`${base}/sessions/${id}/results`}>
                      {t('results')}
                    </Link>
                  </Button>
                )}
                {/* Counting happens in the mobile app; the cabinet watches it. */}
                <Button
                  className="px-5 text-sm font-bold"
                  disabled
                  title={t('scanUnavailable')}
                  variant="primary"
                >
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
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="rz-h-page break-words">{session.number}</h1>
                  <StatusPill tone={tone}>{label}</StatusPill>
                </div>
                <p className="rz-caption mt-1">
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

              <InventoryRefreshStatus
                state={resource.state}
                refresh={refresh}
              />
              <InventoryTeamStatus team={team} />

              <div className="flex flex-wrap-reverse items-end gap-6">
                <div className="flex min-w-0 flex-[2_1_34rem] flex-col gap-5">
                  <Card
                    aside={
                      <div
                        aria-label={t('filterLabel')}
                        className="border-app-line bg-app-canvas flex flex-wrap gap-1 rounded-control border p-[3px]"
                        role="radiogroup"
                      >
                        {SESSION_FILTERS.map((option) => {
                          const active = option.value === filter
                          return (
                            <button
                              aria-checked={active}
                              className={cn(
                                'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-3 text-caption font-bold',
                                active
                                  ? 'text-app-strong bg-app-selected'
                                  : 'text-app-muted hover:text-app-ink',
                              )}
                              disabled={resultsFailed}
                              key={option.value}
                              onClick={() => setFilter(option.value)}
                              role="radio"
                              type="button"
                            >
                              {t(option.label)}{' '}
                              <span className="text-app-dim font-mono text-micro font-medium">
                                {resultsFailed ? '—' : counts[option.value]}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    }
                    bodyClassName="p-0 pt-4"
                    className="min-w-0"
                    title={t('positionsTitle')}
                  >
                    <div
                      aria-hidden
                      className="border-app-line text-app-muted hidden gap-3 border-y px-6 py-3 font-mono text-micro tracking-[var(--rz-ls-mono)] uppercase md:grid md:grid-cols-[7rem_minmax(0,1fr)_5.5rem_5.5rem_6rem]"
                    >
                      <span>{t('colCode')}</span>
                      <span>{t('colPosition')}</span>
                      <span className="text-right">{t('colExpected')}</span>
                      <span className="text-right">{t('colActual')}</span>
                      <span className="text-right">{t('colDelta')}</span>
                    </div>
                    {resultsFailed ? (
                      <div className="p-4 sm:p-6">
                        <InventoryLoadError
                          message={ti('resultsLoadFailed')}
                          onRetry={resource.refresh}
                        />
                      </div>
                    ) : rows.length === 0 ? (
                      <p className="text-app-muted px-6 py-6 text-sm">
                        {results === null
                          ? t('notStarted')
                          : parts.length === 0
                            ? t('noPositions')
                            : t('noFiltered')}
                      </p>
                    ) : (
                      <ul className="grid">
                        {rows.map((part) => (
                          <li
                            className="border-app-line grid items-center gap-x-3 gap-y-1 border-b px-6 py-3.5 last:border-0 md:grid-cols-[7rem_minmax(0,1fr)_5.5rem_5.5rem_6rem]"
                            key={part.partId}
                          >
                            <span className="text-app-muted font-mono text-body">
                              {part.partQrCode}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-title font-semibold tracking-[-0.01em] text-app-strong">
                                {part.partName}
                              </span>
                              {part.hasCoverageWarning ? (
                                <span className="text-state-warn mt-0.5 block text-caption">
                                  {t('coverageWarning')}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-app-muted font-mono text-body tabular-nums md:text-right">
                              {/* Stacked rows lose the header row, so each
                                  number carries its own name below md. */}
                              <span className="mr-2 text-micro tracking-[var(--rz-ls-mono)] uppercase md:hidden">
                                {t('colExpected')}
                              </span>
                              {part.expectedQuantity}
                            </span>
                            <span
                              className={cn(
                                'font-mono text-body tabular-nums md:text-right',
                                part.delta === 0
                                  ? 'text-app-muted'
                                  : part.delta > 0
                                    ? 'text-state-warn'
                                    : 'text-state-danger',
                              )}
                            >
                              <span className="text-app-muted mr-2 text-micro tracking-[var(--rz-ls-mono)] uppercase md:hidden">
                                {t('colActual')}
                              </span>
                              {part.actualQuantity}
                            </span>
                            <span className="md:flex md:justify-end">
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
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  <Card
                    bodyClassName="p-0"
                    className="min-w-0"
                    title={t('recentScans')}
                  >
                    {loadedScans === null ? (
                      <div className="p-4 sm:p-6">
                        <InventoryLoadError
                          message={ti('scansLoadFailed')}
                          onRetry={resource.refresh}
                        />
                      </div>
                    ) : scans.length === 0 ? (
                      <p className="text-app-muted px-6 pt-4 pb-6 text-sm">
                        {t('noScans')}
                      </p>
                    ) : (
                      <ul className="grid">
                        {scans.slice(0, 8).map((scan) => (
                          <li
                            className="border-app-line flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t px-6 py-3"
                            key={scan.id}
                          >
                            <span className="text-app-dim w-13 shrink-0 font-mono text-body">
                              {timeOfDay(scan.scannedAt)}
                            </span>
                            <Link
                              className="text-app-ink w-24 shrink-0 font-mono text-body hover:underline"
                              to={`${base}/sessions/${id}/journal/${scan.zoneId}`}
                            >
                              {zoneName(scan.zoneId)}
                            </Link>
                            <span className="text-app-muted order-last min-w-0 basis-full truncate text-body sm:order-none sm:flex-1 sm:basis-auto">
                              {scan.partName}
                            </span>
                            {nameOf(scan.scannedBy) === null ? null : (
                              <span className="text-app-muted text-body whitespace-nowrap">
                                {nameOf(scan.scannedBy)}
                              </span>
                            )}
                            <span
                              className={cn(
                                'min-w-12 text-right font-mono text-body tabular-nums',
                                scan.voidedAt != null
                                  ? 'text-state-danger line-through'
                                  : scan.unexpected
                                    ? 'text-state-warn'
                                    : 'text-app-muted',
                              )}
                            >
                              {scan.zonePartCount}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>

                <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
                  <section
                    aria-label={t('progress')}
                    className="border-app-line bg-app-raised rounded-panel border px-6 pt-[22px] pb-6"
                  >
                    <h2 className="text-app-muted font-mono text-micro tracking-[var(--rz-ls-mono)] uppercase">
                      {t('progress')}
                    </h2>
                    <p className="mt-3 flex items-baseline gap-2.5">
                      <span className="text-display leading-none font-extrabold tracking-[var(--rz-ls-title)] tabular-nums text-app-strong">
                        {percent}%
                      </span>
                      <span className="text-app-muted font-mono text-body">
                        {ti('zonesProgress', {
                          done,
                          count: session.zones.length,
                        })}
                      </span>
                    </p>
                    <span
                      aria-hidden
                      className="bg-app-line-2 mt-4 block h-2 overflow-hidden rounded-full"
                    >
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          percent === 100 ? 'bg-state-ok' : 'bg-state-warn',
                        )}
                        style={{ width: `${String(percent)}%` }}
                      />
                    </span>
                    <dl className="border-app-line mt-4.5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5 border-t pt-4">
                      <dt className="text-app-muted text-body font-semibold">
                        {t('matched')}
                      </dt>
                      <dd className="text-state-ok font-mono text-title tabular-nums">
                        {results === null ? '—' : matched}
                      </dd>
                      <dt className="text-app-muted text-body font-semibold">
                        {t('differing')}
                      </dt>
                      <dd className="text-state-danger font-mono text-title tabular-nums">
                        {results === null ? '—' : differing}
                      </dd>
                      <dt className="text-app-muted text-body font-semibold">
                        {t('zonesLeft')}
                      </dt>
                      <dd className="font-mono text-title text-app-strong tabular-nums">
                        {session.zones.length - done}
                      </dd>
                    </dl>
                    {canManage ? (
                      <div className="mt-4.5 grid gap-2.5">
                        {session.status === 'draft' ? (
                          <Button
                            className="min-h-control w-full text-sm font-bold"
                            disabled={acting}
                            onClick={() => setAsking('start')}
                            variant="primary"
                          >
                            {t('start')}
                          </Button>
                        ) : null}
                        {session.status === 'inProgress' ? (
                          <Button
                            className="min-h-control w-full text-sm font-bold"
                            disabled
                            title={t('countingInApp')}
                            variant="primary"
                          >
                            {t('continueScanning')}
                          </Button>
                        ) : null}
                        {session.status === 'review' ? (
                          <Button
                            className="min-h-control w-full text-sm font-bold"
                            disabled={acting}
                            onClick={() => setAsking('complete')}
                            variant="primary"
                          >
                            {t('complete')}
                          </Button>
                        ) : null}
                        {session.status === 'review' ? (
                          <Button
                            className="min-h-control w-full text-sm font-semibold"
                            disabled={acting}
                            onClick={() => setAsking('reopen')}
                          >
                            {t('reopen')}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="text-app-dim mt-3 text-caption leading-[1.5]">
                      {session.status === 'review'
                        ? t('hintReview')
                        : session.status === 'inProgress'
                          ? t('hintInProgress')
                          : session.status === 'draft'
                            ? t('hintDraft')
                            : t('hintClosed')}
                    </p>
                  </section>

                  <Card bodyClassName="p-0 pt-2" title={t('zones')}>
                    <ul className="grid">
                      {session.zones.map((zone) => (
                        <li
                          className="border-app-line grid gap-2 border-t px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                          key={zone.zoneId}
                        >
                          <div className="min-w-0">
                            <strong className="text-title font-bold text-app-strong">
                              {zone.zoneName}
                            </strong>
                            <p className="text-app-muted mt-0.5 text-body">
                              {zone.warehouseName} · {zone.zoneCode}
                            </p>
                            {zone.leaseOwnerUserId ? (
                              <p className="text-state-warn mt-1.5 text-caption">
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
                            <Button asChild size="md" variant="quiet">
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
                      className="border-app-line bg-app-raised rounded-panel border px-6 pt-[22px] pb-6"
                    >
                      <h2 className="text-app-muted font-mono text-micro tracking-[var(--rz-ls-mono)] uppercase">
                        {t('workers')}
                      </h2>
                      <ul className="mt-4 grid gap-3.5">
                        {workers.map(([userId, stat]) => {
                          const who = nameOf(userId)
                          return (
                            <li
                              className="flex items-center gap-3"
                              key={userId}
                            >
                              <span
                                aria-hidden
                                className="bg-brand-soft text-brand flex size-[34px] shrink-0 items-center justify-center rounded-full text-body font-bold"
                              >
                                {initials(who ?? '?')}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-title font-semibold text-app-strong">
                                  {who ??
                                    (team.allowed
                                      ? ti('teamNameUnavailable')
                                      : t('nameHidden'))}
                                </span>
                                <span className="text-app-muted mt-0.5 block text-caption">
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
                      {!team.allowed ? (
                        <p className="text-app-muted mt-3.5 text-caption leading-[1.5]">
                          {t('namesHidden')}
                        </p>
                      ) : null}
                    </section>
                  )}

                  <section
                    aria-label={t('rules')}
                    className="border-app-line bg-app-raised rounded-panel border px-6 pt-[22px] pb-6"
                  >
                    <h2 className="text-app-muted font-mono text-micro tracking-[var(--rz-ls-mono)] uppercase">
                      {t('rules')}
                    </h2>
                    <ul className="mt-3.5 grid gap-2.5">
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
        'flex items-center gap-2.5 text-body font-semibold',
        on === true ? 'text-app-ink' : 'text-app-dim',
      )}
      title={why}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-4.5 shrink-0 items-center justify-center rounded-full text-micro font-extrabold',
          on === true ? 'bg-state-ok-soft text-state-ok' : 'bg-app-hover',
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
}

function ResultsView({ id }: { id: string }) {
  const t = useT(resultsMessages)
  const ti = useT(inventoryMessages)
  const { date, sessionStatus, locale } = useInventoryFormat()
  const base = useInventoryBase()
  const canAdjust = usePermission('inventory.adjust')
  const team = useInventoryTeam()
  const { people } = team
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<ResultsData> => {
      const [results, session, audit] = await Promise.all([
        inventoryApi.getResults(id, { signal }),
        inventoryApi.getSession(id, { signal }),
        inventoryApi.getAudit(id, { signal }),
      ])
      return { results, session, audit }
    },
    [id],
  )
  const resource = useLoad(loader, id)
  const { refresh: refreshData } = resource
  const { refresh: refreshTeam } = team
  const refresh = useCallback(() => {
    refreshData()
    refreshTeam()
  }, [refreshData, refreshTeam])
  useInventoryRefresh(refresh)
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
      {({ results, session, audit }: ResultsData) => {
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
        const undecided = differing.filter((part) => !adjusted.has(part.partId))
        const hasBlocked = undecided.some((part) => part.hasCoverageWarning)
        const open = undecided.filter((part) => !part.hasCoverageWarning)
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
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-app-hover"
                  to={`${base}/sessions/${id}`}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t('backToSession')}
                </Link>
                <p className="rz-crumbs hidden sm:flex">
                  <span>{ti('crumbInventory')}</span>
                  <span aria-hidden className="text-app-dim">
                    /
                  </span>
                  <span>{session.number}</span>
                  <span aria-hidden className="text-app-dim">
                    /
                  </span>
                  <span className="text-app-muted">{t('crumbResults')}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button asChild className="px-[18px] text-sm font-semibold">
                  <Link to={`${base}/sessions/${id}/audit`}>{t('audit')}</Link>
                </Button>
                <Button disabled title={t('exportUnavailable')}>
                  {t('export')}
                </Button>
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="rz-h-page break-words">{t('title')}</h1>
                  <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                </div>
                <p className="rz-caption mt-1">
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

              <InventoryRefreshStatus
                state={resource.state}
                refresh={refresh}
              />
              <InventoryTeamStatus team={team} />

              <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-panel border">
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

              <div className="flex flex-wrap items-center justify-between gap-4">
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
                        className={cn(
                          'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-3.5 text-body font-bold',
                          active
                            ? 'text-app-strong bg-app-selected'
                            : 'text-app-muted hover:text-app-ink',
                        )}
                        key={option.value}
                        onClick={() => setFilter(option.value)}
                        role="radio"
                        type="button"
                      >
                        {t(option.label)}{' '}
                        <span className="text-app-dim font-mono text-micro font-medium">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-app-dim text-body">
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
                      className="min-h-9 px-3.5 text-body font-semibold"
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

              <section
                aria-label={t('tableLabel')}
                className="border-app-line bg-app-raised overflow-hidden rounded-panel border"
              >
                <DataTable
                  caption={t('caption')}
                  columns={[
                    {
                      key: 'code',
                      label: t('colCode'),
                      cell: (part) => (
                        <span className="text-app-muted font-mono text-body">
                          {part.partQrCode}
                        </span>
                      ),
                    },
                    {
                      key: 'part',
                      label: t('colPosition'),
                      variant: 'primary',
                      cell: (part) => (
                        <span className="grid gap-0.5">
                          <span className="font-semibold text-app-strong">
                            {part.partName}
                          </span>
                          {part.hasCoverageWarning ? (
                            <span className="text-state-warn text-caption">
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
                        <span className="text-app-muted font-mono tabular-nums">
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
                            'font-mono tabular-nums',
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
                          <span className="text-app-dim font-mono tabular-nums">
                            0
                          </span>
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

              <div className="flex flex-wrap items-start gap-5">
                <Card
                  className="min-w-[320px] flex-[1_1_420px]"
                  title={t('impactTitle')}
                >
                  <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-3">
                    <dt className="text-app-muted text-sm font-semibold">
                      {t('writeOff')}
                    </dt>
                    <dd className="text-state-danger font-mono text-title tabular-nums">
                      {shortage === 0
                        ? '—'
                        : t('quantity', { count: String(shortage) })}
                    </dd>
                    <dt className="text-app-muted text-sm font-semibold">
                      {t('addSurplus')}
                    </dt>
                    <dd className="text-state-ok font-mono text-title tabular-nums">
                      {surplus === 0
                        ? '—'
                        : t('quantity', { count: `+${String(surplus)}` })}
                    </dd>
                    <div className="bg-app-line col-span-2 my-0.5 h-px" />
                    <dt className="text-title font-bold text-app-strong">
                      {t('quantityChange')}
                    </dt>
                    <dd
                      className={cn(
                        'font-mono text-title tabular-nums',
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
                  </dl>
                  <p
                    className="text-app-dim mt-4 text-body leading-[1.5]"
                    title={t('noCostTitle')}
                  >
                    {t('noCost')}
                  </p>
                </Card>

                <Card
                  className="min-w-[280px] flex-[1_1_300px]"
                  title={t('afterTitle')}
                >
                  <ul className="text-app-ink grid gap-3 text-sm leading-[1.5]">
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
                  {decidable.length > 0 && hasBlocked ? (
                    <p className="text-app-dim mt-5 text-body leading-[1.5]">
                      {t('coverageBlocked')}
                    </p>
                  ) : null}
                  {decidable.length > 0 ? (
                    <Button
                      className="mt-5 min-h-control w-full text-sm font-bold"
                      onClick={() => {
                        setReason('')
                        setAsking(decidable)
                      }}
                      variant="primary"
                    >
                      {t('applyDecisions', { count: decidable.length })}
                    </Button>
                  ) : (
                    <p className="text-app-dim mt-5 text-body leading-[1.5]">
                      {differing.length === 0
                        ? t('nothingToApply')
                        : session.status === 'review'
                          ? canAdjust
                            ? t(
                                undecided.length === 0
                                  ? 'allDecided'
                                  : 'coverageBlocked',
                              )
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
  if (part.delta === 0) return <span className="text-app-dim font-mono">—</span>
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
    <Button
      className="min-h-9 px-3 text-xs font-bold"
      disabled={busy}
      onClick={onAsk}
    >
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
  decision: { label: 'kindDecision', dot: 'bg-state-info' },
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
}

function AuditView({ id }: { id: string }) {
  const t = useT(auditMessages)
  const ti = useT(inventoryMessages)
  const { date, locale } = useInventoryFormat()
  const base = useInventoryBase()
  const team = useInventoryTeam()
  const { people } = team
  const [filter, setFilter] = useState<AuditFilter>('all')
  const [query, setQuery] = useState('')
  const [raw, setRaw] = useState(false)
  const [shown, setShown] = useState(AUDIT_PAGE)
  const loader = useCallback(
    async (signal: AbortSignal): Promise<AuditData> => {
      const [events, session] = await Promise.all([
        inventoryApi.getAudit(id, { signal }),
        inventoryApi.getSession(id, { signal }),
      ])
      return { events, session }
    },
    [id],
  )
  const resource = useLoad(loader, id)

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ events, session }: AuditData) => {
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
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-app-hover"
                  to={`${base}/sessions/${id}`}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t('backToSession')}
                </Link>
                <p className="rz-crumbs hidden sm:flex">
                  <span>{ti('crumbInventory')}</span>
                  <span aria-hidden className="text-app-dim">
                    /
                  </span>
                  <span>{session.number}</span>
                  <span aria-hidden className="text-app-dim">
                    /
                  </span>
                  <span className="text-app-muted">{t('crumbAudit')}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  aria-pressed={raw}
                  className="px-4 text-sm font-semibold"
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
                <h1 className="rz-h-page break-words">{t('title')}</h1>
                <p className="rz-caption mt-1">
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

              <InventoryTeamStatus team={team} />

              <div className="flex flex-wrap items-center gap-3">
                <div
                  aria-label={t('filterLabel')}
                  className="rz-seg flex-wrap"
                  role="radiogroup"
                >
                  {AUDIT_FILTERS.map((option) => {
                    const active = option.value === filter
                    return (
                      <button
                        aria-checked={active}
                        className={cn(
                          'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-3.5 text-body font-bold',
                          active
                            ? 'text-app-strong bg-app-selected'
                            : 'text-app-muted hover:text-app-ink',
                        )}
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value)
                          setShown(AUDIT_PAGE)
                        }}
                        role="radio"
                        type="button"
                      >
                        {t(option.label)}{' '}
                        <span className="text-app-dim font-mono text-micro font-medium">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="min-w-[200px] flex-[1_1_220px]">
                  <SearchInput
                    aria-label={t('searchLabel')}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setShown(AUDIT_PAGE)
                    }}
                    placeholder={t('searchPlaceholder')}
                    value={query}
                  />
                </div>
              </div>

              <section
                aria-label={t('logLabel')}
                className="border-app-line bg-app-raised rounded-panel border px-6 pt-6 pb-2"
              >
                {visible.length === 0 ? (
                  <p className="text-app-muted py-6 text-center text-sm">
                    {events.length === 0 ? t('noEvents') : t('noFiltered')}
                  </p>
                ) : (
                  <ol className="grid">
                    {visible.map((event, index) => {
                      const kind = auditKind(event)
                      const change = auditChange(event.detailsJson, locale)
                      return (
                        <li className="flex gap-4" key={event.id}>
                          <span
                            aria-hidden
                            className="flex flex-col items-center"
                          >
                            <span
                              className={cn(
                                'mt-1.5 size-2.5 rounded-full',
                                AUDIT_KINDS[kind].dot,
                              )}
                            />
                            {index < visible.length - 1 ? (
                              <span className="bg-app-line w-px flex-1" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 pb-5.5">
                            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="text-title font-bold text-app-strong">
                                {auditTitle(event.action, locale)}
                              </span>
                              <span className="border-app-line-2 text-app-muted inline-flex h-[22px] items-center rounded-full border bg-app-hover px-2.5 text-micro font-bold">
                                {t(AUDIT_KINDS[kind].label)}
                              </span>
                              <span className="text-app-dim font-mono text-caption">
                                {date(event.createdAt)}
                              </span>
                            </span>
                            <span className="text-app-muted mt-1 block text-body">
                              {nameOf(event.actorUserId) ?? t('actorUnknown')}
                            </span>
                            {change === null ? null : (
                              <span className="border-app-line bg-app-input mt-2.5 inline-flex items-center gap-3 rounded-control border px-3.5 py-2 font-mono text-body">
                                <span className="text-app-muted line-through">
                                  {change.from}
                                </span>
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
                              <span className="border-app-line bg-app-input text-app-muted mt-2.5 block rounded-control border px-3 py-2.5 font-mono text-micro leading-[1.55] break-all">
                                {event.detailsJson}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>

              {rows.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-app-dim text-body">
                    {t('shown', {
                      visible: visible.length,
                      count: rows.length,
                    })}
                  </p>
                  {visible.length < rows.length ? (
                    <Button
                      className="min-h-10 px-4 text-body font-bold"
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
  /** Drafts have no totals; null means totals failed to load. */
  results: InventoryPartResult[] | null
}

const journalDataComplete = (data: JournalData) => data.results !== null

function JournalView({ id, zoneId }: { id: string; zoneId: string }) {
  const t = useT(journalMessages)
  const ti = useT(inventoryMessages)
  const { date, timeOfDay } = useInventoryFormat()
  const base = useInventoryBase()
  const team = useInventoryTeam()
  const { people } = team
  const [filter, setFilter] = useState<JournalFilter>('all')
  const [who, setWho] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(JOURNAL_PAGE)
  const loader = useCallback(
    async (signal: AbortSignal): Promise<JournalData> => {
      const session = await inventoryApi.getSession(id, { signal })
      const [scans, results] = await Promise.all([
        inventoryApi.getScans(id, zoneId, { signal }),
        session.status === 'draft'
          ? Promise.resolve([])
          : inventoryApi
              .getResults(id, { signal })
              .then((data) => data.parts, optionalInventoryData),
      ])
      return { scans, session, results }
    },
    [id, zoneId],
  )
  const resource = useLoad(loader, `${id}:${zoneId}`, journalDataComplete)
  const { refresh: refreshData } = resource
  const { refresh: refreshTeam } = team
  const refresh = useCallback(() => {
    refreshData()
    refreshTeam()
  }, [refreshData, refreshTeam])
  useInventoryRefresh(refresh)

  return (
    <Resource retry={resource.reload} state={resource.state}>
      {({ scans, session, results }: JournalData) => {
        const zone = session.zones.find((item) => item.zoneId === zoneId)
        const nameOf = (userId: string) =>
          people.find((person) => person.userId === userId)?.name ?? null
        const resultOf = (partId: string) =>
          results?.find((part) => part.partId === partId) ?? null
        const effectiveFilter = results === null ? 'all' : filter
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
          if (effectiveFilter === 'diff' && (part?.delta ?? 0) === 0)
            return false
          if (effectiveFilter === 'same' && part?.delta !== 0) return false
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
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-app-hover"
                  to={backTo}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t('backToSession')}
                </Link>
                <p className="rz-crumbs hidden sm:flex">
                  <span>{t('crumbSession', { number: session.number })}</span>
                  {zone ? (
                    <>
                      <span aria-hidden className="text-app-dim">
                        /
                      </span>
                      <span className="text-app-muted">{zone.zoneCode}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button asChild className="px-[18px] text-sm font-semibold">
                  <Link to={`${base}/sessions/${id}/results`}>
                    {t('results')}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rz-page">
              <div className="min-w-0">
                <h1 className="rz-h-page break-words">
                  {zone ? t('titleZone', { zone: zone.zoneCode }) : t('title')}
                </h1>
                <p className="rz-caption mt-1">
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

              <InventoryRefreshStatus
                state={resource.state}
                refresh={refresh}
              />
              <InventoryTeamStatus team={team} />

              {results === null ? (
                <InventoryLoadError
                  message={ti('resultsLoadFailed')}
                  onRetry={resource.refresh}
                />
              ) : null}

              <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-panel border">
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
                    results === null
                      ? undefined
                      : results.length === 0
                        ? t('totalsLater')
                        : t('needDecision')
                  }
                  tone={counts.diff > 0 ? 'danger' : undefined}
                  unit={ti('positionsUnit')}
                  value={results === null ? '—' : String(counts.diff)}
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

              <div className="flex flex-wrap items-center gap-3">
                <div
                  aria-label={t('filterLabel')}
                  className="rz-seg"
                  role="radiogroup"
                >
                  {JOURNAL_FILTERS.map((option) => {
                    const active = option.value === effectiveFilter
                    const locked =
                      option.value !== 'all' &&
                      (results === null || results.length === 0)
                    return (
                      <button
                        aria-checked={active}
                        className={cn(
                          'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-3.5 text-body font-bold disabled:cursor-not-allowed disabled:opacity-50',
                          active
                            ? 'text-app-strong bg-app-selected'
                            : 'text-app-muted hover:text-app-ink',
                        )}
                        disabled={locked}
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value)
                          setShown(JOURNAL_PAGE)
                        }}
                        role="radio"
                        title={
                          locked
                            ? results === null
                              ? ti('resultsLoadFailed')
                              : t('compareLater')
                            : undefined
                        }
                        type="button"
                      >
                        {t(option.label)}{' '}
                        <span className="text-app-dim font-mono text-micro font-medium">
                          {results === null && option.value !== 'all'
                            ? '—'
                            : counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {people.length > 0 && scanners.length > 1 ? (
                  <div
                    aria-label={t('whoLabel')}
                    className="flex flex-wrap gap-1.5"
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
                        className={cn(
                          'focus-visible:outline-brand min-h-9 cursor-pointer rounded-full border px-3.5 text-body font-semibold',
                          who === person.id
                            ? 'border-app-line-2 bg-app-input text-app-strong'
                            : 'border-app-line text-app-muted hover:text-app-ink',
                        )}
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
                <div className="min-w-[180px] flex-[1_1_200px]">
                  <SearchInput
                    aria-label={t('searchLabel')}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setShown(JOURNAL_PAGE)
                    }}
                    placeholder={t('searchPlaceholder')}
                    value={query}
                  />
                </div>
              </div>

              <section
                aria-label={t('title')}
                className="border-app-line bg-app-raised overflow-hidden rounded-panel border"
              >
                <DataTable
                  caption={t('caption')}
                  columns={[
                    {
                      key: 'time',
                      label: t('colTime'),
                      cell: (scan) => (
                        <span className="text-app-dim font-mono text-body">
                          {timeOfDay(scan.scannedAt)}
                        </span>
                      ),
                    },
                    {
                      key: 'part',
                      label: t('colPosition'),
                      variant: 'primary',
                      cell: (scan) => (
                        <span className="grid gap-0.5">
                          <span className="font-semibold text-app-strong">
                            {scan.partName}
                          </span>
                          <span className="text-app-dim font-mono text-caption">
                            {scan.partQrCode}
                          </span>
                          {/* Facts about this scan rather than about the
                              total, so they stay beside the part. */}
                          {scan.voidReason == null ? null : (
                            <span className="text-app-muted text-caption">
                              {scan.voidReason}
                            </span>
                          )}
                          {scan.unexpected && scan.voidedAt == null ? (
                            <span className="text-state-warn text-caption">
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
                        <span className="text-app-muted font-mono tabular-nums">
                          {resultOf(scan.partId)?.expectedQuantity ?? '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'actual',
                      label: t('colScan'),
                      align: 'end',
                      cell: (scan) => (
                        <span className="font-mono text-app-strong tabular-nums">
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
                          return (
                            <span className="text-app-dim font-mono">—</span>
                          )
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
                  <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
                    <p className="text-app-dim text-body">
                      {t('shown', {
                        visible: visible.length,
                        count: rows.length,
                      })}
                    </p>
                    {visible.length < rows.length ? (
                      <Button
                        className="min-h-9 px-3.5 text-body font-bold"
                        onClick={() =>
                          setShown((value) => value + JOURNAL_PAGE)
                        }
                      >
                        {t('showMore')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {pending.length > 0 ? (
                <section
                  aria-label={t('pendingZones')}
                  className="grid gap-4.5"
                >
                  <div className="flex items-baseline gap-3.5">
                    <h2 className="text-app-muted font-mono text-micro tracking-[0.16em] uppercase">
                      {t('pendingZones')}
                    </h2>
                    <span aria-hidden className="bg-app-line h-px flex-1" />
                    <span className="text-app-dim text-body">
                      {ti('zones', { count: pending.length })}
                    </span>
                  </div>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                    {pending.map((item) => (
                      <li key={item.zoneId}>
                        <Link
                          className="border-app-line-2 text-app-muted hover:text-app-ink block rounded-control border border-dashed bg-app-hover px-3 py-2.5 text-center font-mono text-body hover:bg-app-hover"
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

/** One cell of the journal's figure strip. */
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
    <div className="bg-app-raised px-6 pt-[22px] pb-6">
      <p className="text-app-muted font-mono text-micro tracking-[var(--rz-ls-mono)] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-display leading-none font-extrabold tracking-[var(--rz-ls-title)] tabular-nums',
            tone === 'danger' ? 'text-state-danger' : 'text-app-strong',
          )}
        >
          {value}
        </span>
        {unit === undefined ? null : (
          <span className="text-app-muted font-mono text-body font-medium">
            {unit}
          </span>
        )}
      </p>
      {meta === undefined ? null : (
        <p className="text-app-dim mt-3.5 text-body">{meta}</p>
      )}
    </div>
  )
}

/** Which part-history events are about where a part lies. */
