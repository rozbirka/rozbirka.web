import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  Archive,
  ArrowRight,
  ChevronLeft,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
} from 'lucide-react'
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FormDialog,
  Notice,
  PageBody,
  PageHeader,
  Panel,
  SearchInput,
  SkeletonRows,
  StatCard,
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
  type Warehouse,
  type WarehouseDetail,
} from '@/api/inventory'
import { partsApi } from '@/api/parts'
import { teamApi } from '@/api/team'
import { normalizeApiProblem } from '@/api/errors'
import { cn, plural } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { buildZoneLabelHtml } from './zone-label-output'

type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: T }

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('uk-UA', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'

const sessionStatus = (status: InventorySession['status']) =>
  ({
    draft: ['Чернетка', 'neutral'],
    inProgress: ['Триває', 'warn'],
    review: ['Перевірка', 'info'],
    completed: ['Завершено', 'ok'],
    cancelled: ['Скасовано', 'danger'],
  })[status] as [string, 'neutral' | 'warn' | 'info' | 'ok' | 'danger']

/** How many journal rows to show before the reader asks for more. */
const JOURNAL_PAGE = 25

const formText = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

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
}: {
  state: LoadState<T>
  retry: () => void
  children: (data: T) => ReactNode
}) {
  if (state.kind === 'loading')
    return <SkeletonRows label="Завантажуємо інвентаризацію…" />
  if (state.kind === 'error') {
    return (
      <Notice tone="danger">
        Не вдалося завантажити дані.{' '}
        <button className="underline" onClick={retry} type="button">
          Повторити
        </button>
      </Notice>
    )
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

function Overview() {
  const base = useInventoryBase()
  const canManage = usePermission('inventory.manage')
  const canZones = usePermission('inventory.zones.manage')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const warehousesLoader = useCallback(
    (signal: AbortSignal) => inventoryApi.getWarehouses({ signal }),
    [],
  )
  const sessionsLoader = useCallback(
    (signal: AbortSignal) => inventoryApi.getSessions({ signal }),
    [],
  )
  const warehouses = useLoad(warehousesLoader, 'warehouses')
  const sessions = useLoad(sessionsLoader, 'sessions')
  const [creating, setCreating] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const createWarehouse = async (form: FormData) => {
    const name = formText(form, 'name')
    const code = formText(form, 'code')
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
      warehouses.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setCreating(false)
    }
  }
  return (
    <PageBody>
      <PageHeader
        eyebrow="Складський облік"
        title="Інвентаризація"
        actions={
          canManage ? (
            <Button asChild variant="primary">
              <Link to={`${base}/sessions/new`}>
                <Plus aria-hidden />
                Нова інвентаризація
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Складів"
          value={
            warehouses.state.kind === 'ready'
              ? warehouses.state.data.length
              : '—'
          }
        />
        <StatCard
          label="Активних сесій"
          value={
            sessions.state.kind === 'ready'
              ? sessions.state.data.filter(
                  (item) => item.status === 'inProgress',
                ).length
              : '—'
          }
          accent
        />
        <StatCard
          label="На перевірці"
          value={
            sessions.state.kind === 'ready'
              ? sessions.state.data.filter((item) => item.status === 'review')
                  .length
              : '—'
          }
        />
      </div>
      {operationError ? <Notice tone="danger">{operationError}</Notice> : null}
      {canZones ? (
        <Panel>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
            action={(form) => void createWarehouse(form)}
          >
            <label className="grid gap-1 text-sm text-app-dim">
              Назва
              <input
                name="name"
                required
                className="min-h-11 rounded-lg border border-app-line bg-app-canvas px-3 text-white"
              />
            </label>
            <label className="grid gap-1 text-sm text-app-dim">
              Код
              <input
                name="code"
                required
                className="min-h-11 rounded-lg border border-app-line bg-app-canvas px-3 font-mono text-white"
              />
            </label>
            <Button disabled={creating} type="submit">
              Додати склад
            </Button>
          </form>
        </Panel>
      ) : null}
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-white">Склади й зони</h2>
        <Resource state={warehouses.state} retry={warehouses.reload}>
          {(items) =>
            items.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                  <WarehouseCard key={item.id} item={item} base={base} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Складів ще немає"
                description="Створіть перший склад, щоб налаштувати зони."
              />
            )
          }
        </Resource>
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-white">Останні сесії</h2>
        <Resource state={sessions.state} retry={sessions.reload}>
          {(items) =>
            items.length ? (
              <div className="overflow-hidden rounded-panel border border-app-line">
                {items.map((item) => (
                  <SessionRow key={item.id} item={item} base={base} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Інвентаризацій ще немає"
                description="Створіть сесію та передайте підрахунок працівникам у Mobile."
              />
            )
          }
        </Resource>
      </section>
    </PageBody>
  )
}

function WarehouseCard({ item, base }: { item: Warehouse; base: string }) {
  return (
    <Link
      className="rounded-panel border border-app-line bg-app-raised p-4 transition hover:border-brand/50"
      to={`${base}/warehouses/${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{item.name}</h3>
          <p className="mt-1 font-mono text-xs text-app-dim">{item.code}</p>
        </div>
        {item.isSystemDefault ? (
          <StatusPill tone="info">Основний</StatusPill>
        ) : null}
      </div>
      <p className="mt-4 text-sm text-app-dim">{item.zoneCount} зон</p>
    </Link>
  )
}

function SessionRow({ item, base }: { item: InventorySession; base: string }) {
  const [label, tone] = sessionStatus(item.status)
  const completed = item.zones.filter(
    (zone) => zone.status === 'completed',
  ).length
  return (
    <Link
      className="grid gap-2 border-b border-app-line p-4 last:border-0 hover:bg-white/[0.025] sm:grid-cols-[1fr_auto_auto] sm:items-center"
      to={`${base}/sessions/${item.id}`}
    >
      <div>
        <strong className="text-white">{item.number}</strong>
        <p className="text-xs text-app-dim">Створено {date(item.createdAt)}</p>
      </div>
      <span className="text-sm tabular-nums text-app-dim">
        {completed}/{item.zones.length} зон
      </span>
      <StatusPill tone={tone}>{label}</StatusPill>
    </Link>
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

/** The day alone — a check is remembered by its date, not by its minute. */
const day = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' }).format(
        new Date(value),
      )
    : '—'

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
  const base = useInventoryBase()
  const { targetTenant } = useCabinet()
  const navigate = useNavigate()
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
  const [printing, setPrinting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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

  const createZone = async () => {
    const name = draft.name.trim()
    const code = draft.code.trim()
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
  const saveZone = async (zone: WarehouseZone) => {
    const name = draft.name.trim()
    const code = draft.code.trim()
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
  const printZones = async () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setOperationError('Браузер заблокував вікно друку.')
      return
    }
    printWindow.opener = null
    setPrinting(true)
    setOperationError(null)
    try {
      const zones = (await inventoryApi.getZones({ warehouseId: id })).filter(
        (zone) => zone.isActive && !zone.isSystemUnassigned,
      )
      const html = await buildZoneLabelHtml(
        zones.map((zone) => ({
          id: zone.id,
          qrCode: zone.qrCode,
          zoneName: zone.name,
          zoneCode: zone.code,
          warehouseName: zone.warehouseName,
        })),
      )
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } catch {
      printWindow.close()
      setOperationError('Не вдалося підготувати QR-етикетки.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Resource retry={resource.reload} state={resource.state}>
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
            return { label: 'триває', tone: 'text-state-warn' }
          const last = history.find(
            (item) =>
              item.status === 'completed' &&
              item.zones.some((zone) => zone.zoneId === zoneId),
          )
          return last === undefined
            ? { label: 'не перевіряли', tone: 'text-app-dim' }
            : { label: day(last.completedAt), tone: 'text-app-muted' }
        }
        const zonesOf = (item: InventorySession) =>
          [...new Set(item.zones.map((zone) => zone.zoneName))].join(', ')
        const countedZones =
          active === null
            ? 0
            : active.zones.filter((zone) => zone.status === 'completed').length

        return (
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={base}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  До інвентаризації
                </Link>
                <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                  <span>Склад</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span>Склади</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span className="text-app-muted truncate">
                    {warehouse.name}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {canManage ? (
                  <Button
                    className="px-[18px] text-sm font-semibold"
                    onClick={() => {
                      setDraft({ name: warehouse.name, code: warehouse.code })
                      setEditingWarehouse(true)
                    }}
                  >
                    <Pencil aria-hidden />
                    Редагувати
                  </Button>
                ) : null}
                {canSession ? (
                  <Button
                    asChild
                    className="px-5 text-sm font-bold"
                    variant="primary"
                  >
                    <Link to={`${base}/sessions/new`}>Нова сесія</Link>
                  </Button>
                ) : null}
                <Button
                  aria-expanded={menuOpen}
                  aria-label="Інші дії зі складом"
                  className="min-w-11 px-0 text-base font-bold tracking-[0.1em]"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <span aria-hidden>···</span>
                </Button>
              </div>
            </div>

            <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                    {warehouse.name}
                  </h1>
                  {warehouse.isActive ? (
                    <span className="border-state-ok/30 bg-state-ok-soft text-state-ok inline-flex h-[30px] items-center gap-2 rounded-full border pr-3.5 pl-3 text-[13px] font-bold">
                      <span
                        aria-hidden
                        className="bg-state-ok size-1.5 rounded-full"
                      />
                      Активний
                    </span>
                  ) : (
                    <StatusPill tone="neutral">Архівний</StatusPill>
                  )}
                </div>
                <p className="text-app-muted mt-3 text-[15px]">
                  {[
                    `код ${warehouse.code}`,
                    `${String(real.length)} ${plural(real.length, ['зона', 'зони', 'зон'])}`,
                    stock.total === null
                      ? null
                      : `${String(stock.total)} ${plural(stock.total, ['позиція', 'позиції', 'позицій'])}`,
                    `${String(warehouse.unassignedPartCount)} без зони`,
                    warehouse.isSystemDefault ? 'склад за замовчуванням' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              {menuOpen ? (
                <div className="border-app-line bg-app-raised flex flex-wrap items-center gap-2.5 rounded-[14px] border px-4 py-3">
                  <Button
                    disabled={printing}
                    onClick={() => void printZones()}
                    variant="ghost"
                  >
                    <Printer aria-hidden />
                    {printing ? 'Готуємо стікери…' : 'Друк стікерів зон'}
                  </Button>
                  <Button
                    disabled
                    title="Сервер поки не віддає залишки складу файлом"
                    variant="ghost"
                  >
                    Експорт залишків
                  </Button>
                  {canManage && !warehouse.isSystemDefault ? (
                    <Button
                      onClick={() => setArchivingWarehouse(true)}
                      variant="danger"
                    >
                      <Archive aria-hidden />
                      Архівувати склад
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-px overflow-hidden rounded-[20px] border">
                <WarehouseStat
                  label="Позицій на складі"
                  meta={`${String(real.length)} ${plural(real.length, ['зона', 'зони', 'зон'])} · ${String(warehouse.unassignedPartCount)} без зони`}
                  unit="позицій"
                  value={stock.total === null ? '—' : String(stock.total)}
                />
                <WarehouseStat
                  label="Заповнені зони"
                  meta={
                    occupancy === null
                      ? 'потрібне право «parts.view»'
                      : `${String(filled)} з ${String(real.length)} ${plural(real.length, ['зони', 'зон', 'зон'])} мають залишок`
                  }
                  tone={
                    occupancy !== null && occupancy >= 80 ? 'warn' : 'plain'
                  }
                  unit="%"
                  value={occupancy === null ? '—' : String(occupancy)}
                />
                <WarehouseStat
                  label="Вартість залишку"
                  meta="сервер не рахує вартість складу"
                  unit="USD"
                  value="—"
                />
                <WarehouseStat
                  label="Розходження"
                  meta="позиції з незакритою різницею"
                  tone={
                    stock.differing !== null && stock.differing > 0
                      ? 'danger'
                      : 'plain'
                  }
                  unit="позицій"
                  value={
                    stock.differing === null ? '—' : String(stock.differing)
                  }
                />
              </div>

              <div className="flex flex-wrap items-start gap-5">
                <Card
                  aside={
                    canManage ? (
                      <Button
                        className="text-[13px] font-semibold"
                        onClick={() => {
                          setDraft({ name: '', code: '' })
                          setAddingZone(true)
                        }}
                        variant="ghost"
                      >
                        <Plus aria-hidden />
                        Додати зону
                      </Button>
                    ) : (
                      <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                        {real.length}{' '}
                        {plural(real.length, ['зона', 'зони', 'зон'])}
                      </span>
                    )
                  }
                  bodyClassName="p-0 pt-4"
                  className="min-w-0 flex-[2_1_34rem]"
                  title="Зони"
                >
                  <div
                    aria-hidden
                    className={cn(
                      'border-app-line text-app-muted hidden gap-3 border-y px-6 py-3 font-mono text-[10px] tracking-[0.14em] uppercase md:grid',
                      canManage
                        ? 'grid-cols-[minmax(0,1fr)_4.5rem_10rem_6.5rem_5.5rem]'
                        : 'grid-cols-[minmax(0,1fr)_4.5rem_10rem_6.5rem]',
                    )}
                  >
                    <span>Зона</span>
                    <span className="text-right">Позицій</span>
                    <span>Заповнення</span>
                    <span className="text-right">Перевірено</span>
                    {canManage ? <span className="text-right">Дії</span> : null}
                  </div>
                  <ul className="grid">
                    {zones.length === 0 ? (
                      <li className="text-app-muted px-6 py-6 text-sm">
                        Зон ще немає — додайте першу, щоб розкладати запчастини
                        по місцях.
                      </li>
                    ) : null}
                    {zones.map((zone) => {
                      const count = partsIn(zone.id)
                      /** How much of the warehouse's stock lies in this zone. */
                      const share =
                        stock.total === null || stock.total === 0
                          ? 0
                          : Math.round((count / stock.total) * 100)
                      const check = checkOf(zone.id)
                      return (
                        <li
                          className={cn(
                            'border-app-line grid items-center gap-x-4 gap-y-2 border-b px-6 py-4 last:border-0 md:gap-3',
                            canManage
                              ? 'md:grid-cols-[minmax(0,1fr)_4.5rem_10rem_6.5rem_5.5rem]'
                              : 'md:grid-cols-[minmax(0,1fr)_4.5rem_10rem_6.5rem]',
                          )}
                          key={zone.id}
                        >
                          <div className="min-w-0">
                            {partsBase === null ? (
                              <span className="text-[15px] font-bold text-white">
                                {zone.name}
                              </span>
                            ) : (
                              <Link
                                className="text-[15px] font-bold text-white hover:underline"
                                to={`${partsBase}?zone=${encodeURIComponent(zone.id)}`}
                              >
                                {zone.name}
                              </Link>
                            )}
                            <p className="text-app-muted mt-0.5 text-[13px]">
                              {[
                                zone.code,
                                zone.isSystemUnassigned ? 'системна' : null,
                                zone.isActive ? null : 'архівна',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <p className="text-app-muted font-mono text-[14px] tabular-nums md:text-right">
                            {stock.total === null ? '—' : count}
                          </p>
                          <div>
                            <span
                              aria-hidden
                              className="bg-app-line-2 block h-1.5 overflow-hidden rounded-full"
                            >
                              <span
                                className="bg-state-ok block h-full rounded-full"
                                style={{ width: `${String(share)}%` }}
                              />
                            </span>
                            <p className="text-app-muted mt-2 font-mono text-[12px]">
                              {stock.total === null
                                ? 'залишки недоступні'
                                : `${String(share)}% складу`}
                            </p>
                          </div>
                          <p
                            className={cn(
                              'text-[13px] md:text-right',
                              check.tone,
                            )}
                          >
                            {check.label}
                          </p>
                          {canManage ? (
                            <div className="flex gap-1.5 md:justify-end">
                              <Button
                                aria-label={`Редагувати зону ${zone.name}`}
                                className="min-w-11 px-0"
                                disabled={zone.isSystemUnassigned}
                                onClick={() => {
                                  setDraft({
                                    name: zone.name,
                                    code: zone.code,
                                  })
                                  setEditingZone(zone)
                                }}
                                title={
                                  zone.isSystemUnassigned
                                    ? 'Системну зону не можна змінювати'
                                    : undefined
                                }
                                variant="ghost"
                              >
                                <Pencil aria-hidden />
                              </Button>
                              <Button
                                aria-label={`Архівувати зону ${zone.name}`}
                                className="min-w-11 px-0"
                                disabled={zone.isSystemUnassigned}
                                onClick={() => setArchivingZone(zone)}
                                title={
                                  zone.isSystemUnassigned
                                    ? 'Системну зону не можна архівувати'
                                    : undefined
                                }
                                variant="ghost"
                              >
                                <Archive aria-hidden />
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </Card>

                <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
                  <section
                    aria-label="Активна сесія"
                    className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-[22px] pb-6"
                  >
                    <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                      Активна сесія
                    </h2>
                    {active === null ? (
                      <>
                        <p className="mt-3 text-[19px] font-bold tracking-[-0.015em] text-white">
                          Перевірка не йде
                        </p>
                        <p className="text-app-muted mt-1 text-[13px]">
                          Останній підрахунок:{' '}
                          {history[0] === undefined
                            ? 'ще не було'
                            : day(closedAt(history[0]))}
                          .
                        </p>
                        {canSession ? (
                          <Button
                            asChild
                            className="mt-5 min-h-11 w-full text-sm font-bold"
                            variant="primary"
                          >
                            <Link to={`${base}/sessions/new`}>
                              Почати сесію
                            </Link>
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-[19px] font-bold tracking-[-0.015em] text-white">
                          {active.number} · {zonesOf(active)}
                        </p>
                        <p className="text-app-muted mt-1 text-[13px]">
                          {active.startedAt == null
                            ? `Створено ${date(active.createdAt)}`
                            : `Розпочато ${date(active.startedAt)}`}
                          {nameOf(active.startedBy ?? active.createdBy) === null
                            ? null
                            : ` · ${String(nameOf(active.startedBy ?? active.createdBy))}`}
                        </p>
                        <span
                          aria-hidden
                          className="bg-app-line-2 mt-4 block h-1.5 overflow-hidden rounded-full"
                        >
                          <span
                            className="bg-state-warn block h-full rounded-full"
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
                        <p className="text-app-muted mt-2.5 flex justify-between gap-3 font-mono text-[12px]">
                          <span>
                            {countedZones} / {active.zones.length}{' '}
                            {plural(active.zones.length, [
                              'зона',
                              'зони',
                              'зон',
                            ])}
                          </span>
                          <span>
                            {active.preview.conflictingPartCount}{' '}
                            {plural(active.preview.conflictingPartCount, [
                              'розходження',
                              'розходження',
                              'розходжень',
                            ])}
                          </span>
                        </p>
                        <Button
                          asChild
                          className="mt-5 min-h-11 w-full text-sm font-bold"
                          variant="primary"
                        >
                          <Link to={`${base}/sessions/${active.id}`}>
                            Продовжити сесію
                          </Link>
                        </Button>
                      </>
                    )}
                  </section>

                  <Card
                    aside={
                      <Link
                        className="text-brand text-[13px] font-semibold hover:underline"
                        to={base}
                      >
                        Усі
                      </Link>
                    }
                    bodyClassName="p-0"
                    title="Історія перевірок"
                  >
                    {history.length === 0 ? (
                      <p className="text-app-muted px-6 pt-4 pb-6 text-sm">
                        Завершених перевірок цього складу ще немає.
                      </p>
                    ) : (
                      <ul className="grid">
                        {history.map((item) => {
                          const conflicts = item.preview.conflictingPartCount
                          return (
                            <li
                              className="border-app-line flex items-center gap-4 border-t px-6 py-3.5"
                              key={item.id}
                            >
                              <div className="min-w-0 flex-1">
                                <Link
                                  className="text-[14px] font-semibold text-white hover:underline"
                                  to={`${base}/sessions/${item.id}`}
                                >
                                  {item.number} · {zonesOf(item)}
                                </Link>
                                <p className="text-app-muted mt-0.5 text-[12px]">
                                  {[
                                    day(closedAt(item)),
                                    nameOf(item.completedBy ?? item.createdBy),
                                    item.status === 'cancelled'
                                      ? 'скасована'
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              </div>
                              <p
                                className={cn(
                                  'font-mono text-[13px] whitespace-nowrap tabular-nums',
                                  conflicts === 0
                                    ? 'text-state-ok'
                                    : 'text-state-danger',
                                )}
                              >
                                {conflicts}
                                <span className="sr-only">
                                  {' '}
                                  {plural(conflicts, [
                                    'розходження',
                                    'розходження',
                                    'розходжень',
                                  ])}
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
              description="Назва і код видно всюди, де зустрічається цей склад."
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
              submitLabel="Зберегти"
              title="Редагувати склад"
            >
              <NameAndCode draft={draft} onChange={setDraft} />
            </FormDialog>

            <FormDialog
              description="Зона — це місце, куди кладуть запчастину і де її потім рахують."
              onOpenChange={(next) => {
                if (!next) setAddingZone(false)
              }}
              onSubmit={(event) => {
                event.preventDefault()
                void createZone()
              }}
              open={addingZone}
              pending={busy}
              submitDisabled={
                draft.name.trim() === '' || draft.code.trim() === ''
              }
              submitLabel="Додати зону"
              title="Нова зона"
            >
              <NameAndCode draft={draft} onChange={setDraft} />
            </FormDialog>

            <FormDialog
              description={
                editingZone === null
                  ? undefined
                  : `Зона «${editingZone.name}» складу «${warehouse.name}».`
              }
              onOpenChange={(next) => {
                if (!next) setEditingZone(null)
              }}
              onSubmit={(event) => {
                event.preventDefault()
                if (editingZone !== null) void saveZone(editingZone)
              }}
              open={editingZone !== null}
              pending={busy}
              submitDisabled={
                draft.name.trim() === '' || draft.code.trim() === ''
              }
              submitLabel="Зберегти"
              title="Редагувати зону"
            >
              <NameAndCode draft={draft} onChange={setDraft} />
            </FormDialog>

            <ConfirmDialog
              confirmLabel="Архівувати склад"
              consequence={`Склад «${warehouse.name}» зникне зі списків і з фільтрів. Запчастини залишаться на своїх зонах.`}
              destructive
              onConfirm={() => void archiveWarehouse()}
              onOpenChange={(next) => {
                if (!next) setArchivingWarehouse(false)
              }}
              open={archivingWarehouse}
              pending={busy}
              title="Архівувати склад?"
            />

            <ConfirmDialog
              confirmLabel="Архівувати зону"
              consequence={
                archivingZone === null
                  ? ''
                  : `Зона «${archivingZone.name}» більше не зʼявиться у виборі місця. Запчастини, що в ній лежать, доведеться перекласти вручну.`
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
              title="Архівувати зону?"
            />
          </div>
        )
      }}
    </Resource>
  )
}

/** Name and code, the two fields every warehouse and zone dialog asks for. */
function NameAndCode({
  draft,
  onChange,
}: {
  draft: { name: string; code: string }
  onChange: (draft: { name: string; code: string }) => void
}) {
  return (
    <>
      <Field label="Назва" required>
        <TextInput
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          value={draft.name}
        />
      </Field>
      <Field
        hint="Короткий код для етикеток і пошуку — наприклад A1."
        label="Код"
        required
      >
        <TextInput
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
          value={draft.code}
        />
      </Field>
    </>
  )
}

/** One figure of the warehouse strip: label, number, unit and what it counts. */
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
  tone?: 'plain' | 'warn' | 'danger'
}) {
  return (
    <div className="bg-app-raised px-6 pt-[22px] pb-6">
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums',
            tone === 'warn'
              ? 'text-state-warn'
              : tone === 'danger'
                ? 'text-state-danger'
                : 'text-white',
          )}
        >
          {value}
        </span>
        <span className="text-app-muted font-mono text-[13px] font-medium">
          {unit}
        </span>
      </p>
      <p className="text-app-dim mt-3.5 text-[13px]">{meta}</p>
    </div>
  )
}

/** How the session picks its zones. */
const SESSION_TYPES = [
  {
    value: 'full' as const,
    label: 'Повна',
    hint: 'Усі активні зони вибраного складу',
    available: true,
  },
  {
    value: 'zones' as const,
    label: 'По зонах',
    hint: 'Вибрані зони повністю',
    available: true,
  },
  {
    value: 'sample' as const,
    label: 'Вибіркова',
    hint: 'Окремі позиції або група деталей',
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
          houses.find((item) => item.id === house)?.name ?? 'Склад'
        const typeName = type === 'full' ? 'повна' : 'по зонах'
        const ready = selected.length > 0 && canManage

        return (
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={base}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  До інвентаризації
                </Link>
                <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                  <span>Склад</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span className="text-app-muted">Інвентаризація</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  className="px-[18px] text-sm font-semibold"
                  disabled={!ready || busy !== null}
                  onClick={() => void create(selected, false)}
                >
                  {busy === 'draft' ? 'Зберігаємо…' : 'Зберегти чернетку'}
                </Button>
                <Button
                  className="px-5 text-sm font-bold"
                  disabled={!ready || busy !== null}
                  onClick={() => void create(selected, true)}
                  variant="primary"
                >
                  {busy === 'start' ? 'Запускаємо…' : 'Розпочати сесію'}
                </Button>
              </div>
            </div>

            <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
              <div className="min-w-0">
                <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                  Нова сесія інвентаризації
                </h1>
                <p className="text-app-muted mt-3 text-[15px]">
                  Поки сесія активна, позиції в її зонах не можна редагувати
                  вручну. Рахують у мобільному застосунку.
                </p>
              </div>

              {!canManage ? (
                <Notice tone="danger">
                  Для створення інвентаризації потрібен дозвіл керування.
                </Notice>
              ) : null}
              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              <div className="flex flex-wrap items-start gap-6">
                <div className="flex min-w-0 flex-[2_1_34rem] flex-col gap-5">
                  <Step
                    hint="Визначає, які зони входять у сесію."
                    number="01"
                    title="Тип перевірки"
                  >
                    <div
                      aria-label="Тип перевірки"
                      className="flex flex-wrap gap-2"
                      role="radiogroup"
                    >
                      {SESSION_TYPES.map((option) => {
                        const active = option.value === type
                        return (
                          <button
                            aria-checked={active}
                            className={cn(
                              'focus-visible:outline-brand min-h-[70px] flex-[1_1_10rem] rounded-xl border px-4 py-3.5 text-left',
                              active
                                ? 'border-app-line-2 bg-white/[0.07]'
                                : 'border-app-line bg-transparent',
                              option.available
                                ? 'cursor-pointer hover:border-white/20'
                                : 'cursor-not-allowed opacity-55',
                            )}
                            disabled={!option.available}
                            key={option.value}
                            onClick={() => setType(option.value)}
                            role="radio"
                            title={
                              option.available
                                ? undefined
                                : 'Сесія створюється з переліку зон — окремі позиції вибрати не можна'
                            }
                            type="button"
                          >
                            <span
                              className={cn(
                                'block text-[15px] font-bold',
                                active ? 'text-app-ink' : 'text-app-muted',
                              )}
                            >
                              {option.label}
                            </span>
                            <span className="text-app-muted mt-1.5 block text-[12px] leading-[1.4] font-medium">
                              {option.hint}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </Step>

                  <Step
                    hint={
                      type === 'full'
                        ? 'Повна перевірка охоплює всі активні зони вибраного складу.'
                        : 'Виберіть зони, які входять у сесію.'
                    }
                    number="02"
                    title="Склад і зони"
                  >
                    {houses.length > 1 ? (
                      <div
                        aria-label="Склад"
                        className="flex flex-wrap gap-1.5"
                        role="radiogroup"
                      >
                        {houses.map((item) => {
                          const active = item.id === house
                          return (
                            <button
                              aria-checked={active}
                              className={cn(
                                'focus-visible:outline-brand min-h-11 cursor-pointer rounded-[10px] border px-4 text-[14px] font-semibold',
                                active
                                  ? 'border-app-line-2 text-app-ink bg-white/[0.07]'
                                  : 'border-app-line text-app-muted hover:border-white/20',
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
                          На цьому складі немає активних зон.
                        </li>
                      ) : null}
                      {inHouse.map((zone) => {
                        const on = selected.includes(zone.id)
                        const count = partsIn(zone.id)
                        return (
                          <li key={zone.id}>
                            <label
                              className={cn(
                                'flex w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-xl border px-4 py-3.5',
                                on
                                  ? 'border-app-line-2 bg-white/[0.04]'
                                  : 'border-app-line bg-app-canvas',
                                type === 'full'
                                  ? 'cursor-not-allowed'
                                  : 'cursor-pointer hover:border-white/20',
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
                                    'block text-[15px] font-bold',
                                    type === 'full'
                                      ? 'text-app-muted'
                                      : 'text-app-ink',
                                  )}
                                >
                                  {zone.name}
                                </span>
                                <span className="text-app-muted mt-0.5 block text-[13px]">
                                  {zone.code} · {zone.warehouseName}
                                </span>
                              </span>
                              {/* Narrow screens give the count its own line
                                  rather than squeezing the zone's name. */}
                              <span className="text-app-muted w-full pl-8.5 font-mono text-[13px] tabular-nums sm:w-auto sm:pl-0">
                                {count === null
                                  ? '—'
                                  : `${String(count)} ${plural(count, ['позиція', 'позиції', 'позицій'])}`}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </Step>

                  <Step
                    hint="Сканувати може будь-хто з правом на інвентаризацію — сесія не закріплюється за людьми."
                    number="03"
                    title="Виконавці"
                  >
                    {people.length === 0 ? (
                      <p className="text-app-muted text-sm">
                        {canSeeTeam
                          ? 'У команді ще нікого немає.'
                          : 'Список команди видно тим, хто має право «team.view».'}
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {people.map((person) => (
                          <li key={person.userId}>
                            <span
                              className="border-app-line text-app-muted flex min-h-11 items-center gap-2.5 rounded-full border py-0 pr-4 pl-2 text-[14px] font-semibold"
                              title="Сервер не закріплює сесію за виконавцями — кожне сканування записується на того, хто його зробив"
                            >
                              <span
                                aria-hidden
                                className="flex size-7 items-center justify-center rounded-full bg-white/[0.06] text-[12px] font-bold"
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

                  <Step number="04" title="Правила">
                    <ul className="grid gap-2.5">
                      <Toggle
                        hint="Продаж і переміщення в цих зонах недоступні, поки сесія не закриється."
                        label="Блокувати рух позицій"
                        on
                        why="Так працює інвентаризація завжди — вимкнути не можна"
                      />
                      <Toggle
                        hint="Виконавець не бачить очікувану кількість під час сканування."
                        label="Сліпий підрахунок"
                        on={false}
                        why="Налаштування сліпого підрахунку в системі немає"
                      />
                      <Toggle
                        hint="Якщо кількість не збігається, потрібно додати фото."
                        label="Фото при розходженні"
                        on={false}
                        why="Вимоги фото при розходженні в системі немає"
                      />
                    </ul>
                    <div className="mt-4">
                      <Field
                        hint="Сервер не зберігає коментар до сесії — причину можна написати при скасуванні або в коригуванні."
                        label="Коментар до сесії"
                      >
                        <TextArea
                          disabled
                          name="comment"
                          placeholder="Наприклад: перевірка після переміщення стелажів"
                          rows={2}
                        />
                      </Field>
                    </div>
                  </Step>
                </div>

                <section
                  aria-label="Обсяг сесії"
                  className="border-app-line bg-app-raised flex min-w-0 flex-[1_1_18rem] flex-col rounded-[18px] border px-5.5 pt-[22px] pb-6"
                >
                  <h2 className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
                    Обсяг сесії
                  </h2>
                  <div className="border-app-line bg-app-canvas mt-4 rounded-[14px] border p-4">
                    <p className="text-[17px] font-bold tracking-[-0.015em] text-white">
                      {houseName} · {typeName}
                    </p>
                    <p className="text-app-muted mt-1 text-[14px]">
                      {selected.length === 0
                        ? 'Зони не вибрані'
                        : inHouse
                            .filter((zone) => selected.includes(zone.id))
                            .map((zone) => zone.name)
                            .join(', ')}
                    </p>
                  </div>
                  <dl className="mt-5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                    <dt className="text-app-muted text-[14px] font-semibold">
                      Зон
                    </dt>
                    <dd className="font-mono text-[15px] text-white tabular-nums">
                      {selected.length === 0 ? '—' : selected.length}
                    </dd>
                    <dt className="text-app-muted text-[14px] font-semibold">
                      Позицій
                    </dt>
                    <dd className="font-mono text-[15px] text-white tabular-nums">
                      {byZone === null || selected.length === 0
                        ? '—'
                        : partsTotal}
                    </dd>
                    <dt
                      className="text-app-muted text-[14px] font-semibold"
                      title="Сервер не закріплює сесію за виконавцями"
                    >
                      Виконавців
                    </dt>
                    <dd className="text-app-dim font-mono text-[15px]">—</dd>
                    <dd
                      aria-hidden
                      className="bg-app-line col-span-2 my-1 h-px"
                    />
                    <dt
                      className="text-[15px] font-bold text-white"
                      title="Сервер не оцінює тривалість підрахунку"
                    >
                      Орієнтовно
                    </dt>
                    <dd className="text-app-dim font-mono text-[20px]">—</dd>
                  </dl>
                  <Button
                    className="mt-5.5 min-h-11.5 w-full text-[15px] font-bold"
                    disabled={!ready || busy !== null}
                    onClick={() => void create(selected, true)}
                    variant="primary"
                  >
                    {busy === 'start' ? 'Запускаємо…' : 'Розпочати сесію'}
                  </Button>
                  <p className="text-app-dim mt-3 text-[12px] leading-[1.5]">
                    {selected.length === 0
                      ? 'Виберіть хоча б одну зону.'
                      : 'Після старту зони блокуються для ручних змін. «Зберегти чернетку» створює сесію, не запускаючи підрахунок.'}
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
function Step({
  number,
  title,
  hint,
  children,
}: {
  number: string
  title: string
  hint?: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="border-app-line bg-app-raised rounded-[18px] border px-6 pt-[22px] pb-6"
    >
      <div className="flex items-baseline gap-2.5">
        <span aria-hidden className="text-app-dim font-mono text-[11px]">
          {number}
        </span>
        <h2
          className="text-[17px] font-bold tracking-[-0.01em] text-white"
          id={titleId}
        >
          {title}
        </h2>
      </div>
      {hint === undefined ? null : (
        <p className="text-app-muted mt-1.5 text-[14px]">{hint}</p>
      )}
      <div className="mt-4.5">{children}</div>
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
  return (
    <li
      className="border-app-line bg-app-canvas flex items-center gap-3.5 rounded-xl border px-4 py-3.5"
      title={why}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-white">{label}</span>
        <span className="text-app-muted mt-0.5 block text-[13px] leading-[1.45]">
          {hint} {why}.
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'flex h-6 w-10.5 shrink-0 items-center rounded-full p-[3px]',
          on ? 'bg-brand' : 'bg-white/10',
        )}
      >
        <span
          className={cn(
            'size-4.5 rounded-full',
            on ? 'bg-app-canvas translate-x-4.5' : 'bg-app-muted',
          )}
        />
      </span>
      <span className="sr-only">{on ? 'увімкнено' : 'вимкнено'}</span>
    </li>
  )
}

/** Which side of the count the session table is showing. */
const SESSION_FILTERS = [
  { value: 'all', label: 'Усі' },
  { value: 'diff', label: 'Розходження' },
  { value: 'same', label: 'Збіглося' },
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
  const [menuOpen, setMenuOpen] = useState(false)
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
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={base}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  До інвентаризації
                </Link>
                <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                  <span>Інвентаризація</span>
                  <span aria-hidden className="text-white/20">
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
                      Результати
                    </Link>
                  </Button>
                )}
                {/* Counting happens in the mobile app; the cabinet watches it. */}
                <Button
                  className="px-5 text-sm font-bold"
                  disabled
                  title="Підрахунок ведеться в мобільному застосунку — кабінет показує його наживо"
                  variant="primary"
                >
                  Сканувати
                </Button>
                <Button
                  aria-expanded={menuOpen}
                  aria-label="Інші дії із сесією"
                  className="min-w-11 px-0 text-base font-bold tracking-[0.1em]"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <span aria-hidden>···</span>
                </Button>
              </div>
            </div>

            <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                    {session.number}
                  </h1>
                  <StatusPill tone={tone}>{label}</StatusPill>
                </div>
                <p className="text-app-muted mt-3 text-[15px]">
                  {[
                    session.zones[0]?.warehouseName ?? null,
                    session.zones.length === 0
                      ? null
                      : `${String(session.zones.length)} ${plural(session.zones.length, ['зона', 'зони', 'зон'])}`,
                    session.startedAt == null
                      ? `створено ${date(session.createdAt)}`
                      : `розпочато ${date(session.startedAt)}`,
                    counters.length > 0 ? counters.join(', ') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}

              {menuOpen ? (
                <div className="border-app-line bg-app-raised flex flex-wrap items-center gap-2.5 rounded-[14px] border px-4 py-3">
                  <Button asChild variant="ghost">
                    <Link to={`${base}/sessions/${id}/audit`}>Аудит сесії</Link>
                  </Button>
                  <Button onClick={resource.reload} variant="ghost">
                    <RefreshCw aria-hidden />
                    Оновити
                  </Button>
                  <Button
                    disabled
                    title="Сервер не вміє ставити сесію на паузу — її можна лише завершити або скасувати"
                    variant="ghost"
                  >
                    Призупинити
                  </Button>
                  {canManage &&
                  session.status !== 'completed' &&
                  session.status !== 'cancelled' ? (
                    <Button
                      onClick={() => {
                        setReason('')
                        setCancelling(true)
                      }}
                      variant="danger"
                    >
                      <Archive aria-hidden />
                      Скасувати сесію
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap-reverse items-end gap-6">
                <div className="flex min-w-0 flex-[2_1_34rem] flex-col gap-5">
                  <Card
                    aside={
                      <div
                        aria-label="Які позиції показувати"
                        className="border-app-line bg-app-canvas flex flex-wrap gap-1 rounded-[10px] border p-[3px]"
                        role="radiogroup"
                      >
                        {SESSION_FILTERS.map((option) => {
                          const active = option.value === filter
                          return (
                            <button
                              aria-checked={active}
                              className={cn(
                                'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-[8px] px-3 text-[12px] font-bold',
                                active
                                  ? 'text-app-ink bg-white/[0.08]'
                                  : 'text-app-muted hover:text-app-ink',
                              )}
                              key={option.value}
                              onClick={() => setFilter(option.value)}
                              role="radio"
                              type="button"
                            >
                              {option.label}{' '}
                              <span className="text-app-dim font-mono text-[11px] font-medium">
                                {counts[option.value]}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    }
                    bodyClassName="p-0 pt-4"
                    className="min-w-0"
                    title="Позиції"
                  >
                    <div
                      aria-hidden
                      className="border-app-line text-app-muted hidden gap-3 border-y px-6 py-3 font-mono text-[10px] tracking-[0.14em] uppercase md:grid md:grid-cols-[7rem_minmax(0,1fr)_5.5rem_5.5rem_6rem]"
                    >
                      <span>Код</span>
                      <span>Позиція</span>
                      <span className="text-right">Очікується</span>
                      <span className="text-right">Факт</span>
                      <span className="text-right">Різниця</span>
                    </div>
                    {rows.length === 0 ? (
                      <p className="text-app-muted px-6 py-6 text-sm">
                        {results === null
                          ? 'Сесія ще не запущена — рахувати нічого.'
                          : parts.length === 0
                            ? 'У зрізі сесії немає позицій.'
                            : 'За цим фільтром позицій немає.'}
                      </p>
                    ) : (
                      <ul className="grid">
                        {rows.map((part) => (
                          <li
                            className="border-app-line grid items-center gap-x-3 gap-y-1 border-b px-6 py-3.5 last:border-0 md:grid-cols-[7rem_minmax(0,1fr)_5.5rem_5.5rem_6rem]"
                            key={part.partId}
                          >
                            <span className="text-app-muted font-mono text-[14px]">
                              {part.partQrCode}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[15px] font-semibold tracking-[-0.01em] text-white">
                                {part.partName}
                              </span>
                              {part.hasCoverageWarning ? (
                                <span className="text-state-warn mt-0.5 block text-[12px]">
                                  Позиція лежить і поза зрізом сесії
                                </span>
                              ) : null}
                            </span>
                            <span className="text-app-muted font-mono text-[14px] tabular-nums md:text-right">
                              {/* Stacked rows lose the header row, so each
                                  number carries its own name below md. */}
                              <span className="mr-2 text-[10px] tracking-[0.14em] uppercase md:hidden">
                                Очікується
                              </span>
                              {part.expectedQuantity}
                            </span>
                            <span
                              className={cn(
                                'font-mono text-[14px] tabular-nums md:text-right',
                                part.delta === 0
                                  ? 'text-app-muted'
                                  : part.delta > 0
                                    ? 'text-state-warn'
                                    : 'text-state-danger',
                              )}
                            >
                              <span className="text-app-muted mr-2 text-[10px] tracking-[0.14em] uppercase md:hidden">
                                Факт
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
                    title="Останні сканування"
                  >
                    {scans.length === 0 ? (
                      <p className="text-app-muted px-6 pt-4 pb-6 text-sm">
                        Сканувань ще не було.
                      </p>
                    ) : (
                      <ul className="grid">
                        {scans.slice(0, 8).map((scan) => (
                          <li
                            className="border-app-line flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t px-6 py-3"
                            key={scan.id}
                          >
                            <span className="text-app-dim w-13 shrink-0 font-mono text-[13px]">
                              {timeOfDay(scan.scannedAt)}
                            </span>
                            <Link
                              className="text-app-ink w-24 shrink-0 font-mono text-[14px] hover:underline"
                              to={`${base}/sessions/${id}/journal/${scan.zoneId}`}
                            >
                              {zoneName(scan.zoneId)}
                            </Link>
                            <span className="text-app-muted order-last min-w-0 basis-full truncate text-[14px] sm:order-none sm:flex-1 sm:basis-auto">
                              {scan.partName}
                            </span>
                            {nameOf(scan.scannedBy) === null ? null : (
                              <span className="text-app-muted text-[13px] whitespace-nowrap">
                                {nameOf(scan.scannedBy)}
                              </span>
                            )}
                            <span
                              className={cn(
                                'min-w-12 text-right font-mono text-[13px] tabular-nums',
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
                    aria-label="Прогрес"
                    className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-[22px] pb-6"
                  >
                    <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                      Прогрес
                    </h2>
                    <p className="mt-3 flex items-baseline gap-2.5">
                      <span className="text-[34px] leading-none font-extrabold tracking-[-0.03em] tabular-nums text-white">
                        {percent}%
                      </span>
                      <span className="text-app-muted font-mono text-[14px]">
                        {done} / {session.zones.length}{' '}
                        {plural(session.zones.length, ['зона', 'зони', 'зон'])}
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
                      <dt className="text-app-muted text-[14px] font-semibold">
                        Збіглося позицій
                      </dt>
                      <dd className="text-state-ok font-mono text-[15px] tabular-nums">
                        {results === null ? '—' : matched}
                      </dd>
                      <dt className="text-app-muted text-[14px] font-semibold">
                        Розходжень
                      </dt>
                      <dd className="text-state-danger font-mono text-[15px] tabular-nums">
                        {results === null ? '—' : differing}
                      </dd>
                      <dt className="text-app-muted text-[14px] font-semibold">
                        Зон лишилось
                      </dt>
                      <dd className="font-mono text-[15px] text-white tabular-nums">
                        {session.zones.length - done}
                      </dd>
                    </dl>
                    {canManage ? (
                      <div className="mt-4.5 grid gap-2.5">
                        {session.status === 'draft' ? (
                          <Button
                            className="min-h-11 w-full text-sm font-bold"
                            disabled={acting}
                            onClick={() => setAsking('start')}
                            variant="primary"
                          >
                            Запустити
                          </Button>
                        ) : null}
                        {session.status === 'inProgress' ? (
                          <Button
                            className="min-h-11 w-full text-sm font-bold"
                            disabled
                            title="Підрахунок ведеться в мобільному застосунку"
                            variant="primary"
                          >
                            Продовжити сканування
                          </Button>
                        ) : null}
                        {session.status === 'review' ? (
                          <Button
                            className="min-h-11 w-full text-sm font-bold"
                            disabled={acting}
                            onClick={() => setAsking('complete')}
                            variant="primary"
                          >
                            Завершити
                          </Button>
                        ) : null}
                        {session.status === 'review' ? (
                          <Button
                            className="min-h-11 w-full text-sm font-semibold"
                            disabled={acting}
                            onClick={() => setAsking('reopen')}
                          >
                            Відкрити повторно
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="text-app-dim mt-3 text-[12px] leading-[1.5]">
                      {session.status === 'review'
                        ? 'Завершити можна й раніше — неперевірені зони залишаться з попередніми даними.'
                        : session.status === 'inProgress'
                          ? 'Сесія переходить у перевірку, коли всі зони порахують у застосунку.'
                          : session.status === 'draft'
                            ? 'Поки сесія не запущена, залишки рухаються як завжди.'
                            : 'Сесія закрита — залишки вже зафіксовані.'}
                    </p>
                  </section>

                  <Card bodyClassName="p-0 pt-2" title="Зони">
                    <ul className="grid">
                      {session.zones.map((zone) => (
                        <li
                          className="border-app-line grid gap-2 border-t px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                          key={zone.zoneId}
                        >
                          <div className="min-w-0">
                            <strong className="text-[15px] font-bold text-white">
                              {zone.zoneName}
                            </strong>
                            <p className="text-app-muted mt-0.5 text-[13px]">
                              {zone.warehouseName} · {zone.zoneCode}
                            </p>
                            {zone.leaseOwnerUserId ? (
                              <p className="text-state-warn mt-1.5 text-[12px]">
                                Зона зайнята користувачем
                                {nameOf(zone.leaseOwnerUserId) === null
                                  ? ''
                                  : ` ${String(nameOf(zone.leaseOwnerUserId))}`}{' '}
                                до {date(zone.leaseExpiresAt)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button asChild size="md" variant="quiet">
                              <Link
                                to={`${base}/sessions/${id}/journal/${zone.zoneId}`}
                              >
                                Журнал
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
                                ? 'Завершено'
                                : zone.status === 'counting'
                                  ? 'Підрахунок триває'
                                  : 'Очікує'}
                            </StatusPill>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  {workers.length === 0 ? null : (
                    <section
                      aria-label="Виконавці"
                      className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-[22px] pb-6"
                    >
                      <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                        Виконавці
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
                                className="bg-brand-soft text-brand flex size-[34px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                              >
                                {initials(who ?? '?')}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-semibold text-white">
                                  {who ?? 'Імʼя приховано'}
                                </span>
                                <span className="text-app-muted mt-0.5 block text-[12px]">
                                  з {timeOfDay(stat.since)}
                                </span>
                              </span>
                              <span className="text-app-muted font-mono text-[14px] tabular-nums">
                                {stat.count}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                      {people.length === 0 ? (
                        <p className="text-app-muted mt-3.5 text-[12px] leading-[1.5]">
                          Імена видно тим, хто має право «team.view».
                        </p>
                      ) : null}
                    </section>
                  )}

                  <section
                    aria-label="Правила"
                    className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-[22px] pb-6"
                  >
                    <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                      Правила
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
                        Рух позицій заблоковано
                      </Rule>
                      <Rule
                        on={null}
                        why="Сліпий підрахунок налаштовується в мобільному застосунку — кабінет про нього не знає"
                      >
                        Сліпий підрахунок
                      </Rule>
                      <Rule
                        on={null}
                        why="Вимоги фото при розходженні в системі немає"
                      >
                        Фото при розходженні
                      </Rule>
                    </ul>
                  </section>
                </div>
              </div>
            </div>

            <ConfirmDialog
              confirmLabel={
                asking === 'start'
                  ? 'Запустити'
                  : asking === 'complete'
                    ? 'Завершити'
                    : 'Відкрити повторно'
              }
              consequence={
                asking === 'start'
                  ? `Сесія ${session.number} піде в роботу: позиції зрізу заблокуються для продажу, поки її не закриють.`
                  : asking === 'complete'
                    ? 'Залишки зафіксуються за прийнятими рішеннями. Неперевірені зони залишаться з попередніми даними.'
                    : 'Сесія повернеться в підрахунок, і зони знову можна буде рахувати.'
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
                  ? 'Запустити сесію?'
                  : asking === 'complete'
                    ? 'Завершити сесію?'
                    : 'Відкрити сесію повторно?'
              }
            />

            <FormDialog
              description="Причина потрапить у журнал аудиту сесії."
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
              submitLabel="Скасувати сесію"
              title="Скасувати сесію?"
            >
              <Field
                hint="Скасовану сесію не можна відкрити знову — залишки лишаться такими, як були."
                label="Причина"
                required
              >
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
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 text-[13px] font-semibold',
        on === true ? 'text-app-ink' : 'text-app-dim',
      )}
      title={why}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-4.5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold',
          on === true ? 'bg-state-ok-soft text-state-ok' : 'bg-white/[0.06]',
        )}
      >
        {on === true ? '✓' : on === false ? '' : '?'}
      </span>
      {children}
      {on === null ? <span className="sr-only"> — невідомо</span> : null}
    </li>
  )
}

/** Which side of the count the reader is looking at. */
const RESULT_FILTERS = [
  { value: 'diff', label: 'Розходження' },
  { value: 'all', label: 'Усі позиції' },
  { value: 'same', label: 'Збіглося' },
] as const

type ResultFilter = (typeof RESULT_FILTERS)[number]['value']

interface ResultsData {
  results: InventorySessionResults
  session: InventorySession
  audit: InventoryAuditEvent[]
  people: { userId: string; name: string }[]
}

function ResultsView({ id }: { id: string }) {
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
            : `${normalizeApiProblem(error).message} Застосовано ${String(index)} з ${String(parts.length)} — решта лишилася без рішення.`,
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
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={`${base}/sessions/${id}`}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  До сесії
                </Link>
                <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                  <span>Інвентаризація</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span>{session.number}</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span className="text-app-muted">Результати</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button asChild className="px-[18px] text-sm font-semibold">
                  <Link to={`${base}/sessions/${id}/audit`}>Аудит</Link>
                </Button>
                <Button
                  disabled
                  title="Сервер поки не віддає результати сесії файлом"
                >
                  Експорт
                </Button>
              </div>
            </div>

            <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                    Результати сесії
                  </h1>
                  <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                </div>
                <p className="text-app-muted mt-3 text-[15px]">
                  {[
                    session.zones[0]?.warehouseName,
                    zones === '' ? null : `зони ${zones}`,
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

              <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-[20px] border">
                <JournalStat
                  label="Позицій у сесії"
                  meta={`${String(session.zones.length)} ${plural(session.zones.length, ['зона', 'зони', 'зон'])}`}
                  value={String(parts.length)}
                />
                <JournalStat
                  label="Точність"
                  meta={`${String(parts.length - differing.length)} з ${String(parts.length)} збіглися`}
                  unit="%"
                  value={accuracy === null ? '—' : String(accuracy)}
                />
                <JournalStat
                  label="Недостача"
                  meta={`${String(differing.filter((part) => part.delta < 0).length)} ${plural(differing.filter((part) => part.delta < 0).length, ['позиція', 'позиції', 'позицій'])}`}
                  tone={shortage < 0 ? 'danger' : undefined}
                  unit="шт"
                  value={String(Math.abs(shortage))}
                />
                <JournalStat
                  label="Лишки"
                  meta={`${String(differing.filter((part) => part.delta > 0).length)} ${plural(differing.filter((part) => part.delta > 0).length, ['позиція', 'позиції', 'позицій'])}`}
                  unit="шт"
                  value={String(surplus)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div
                  aria-label="Які позиції показувати"
                  className="border-app-line bg-app-raised flex flex-wrap gap-1 rounded-xl border p-1"
                  role="radiogroup"
                >
                  {RESULT_FILTERS.map((option) => {
                    const active = option.value === filter
                    return (
                      <button
                        aria-checked={active}
                        className={cn(
                          'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-bold',
                          active
                            ? 'text-app-ink bg-white/[0.08]'
                            : 'text-app-muted hover:text-app-ink',
                        )}
                        key={option.value}
                        onClick={() => setFilter(option.value)}
                        role="radio"
                        type="button"
                      >
                        {option.label}{' '}
                        <span className="text-app-dim font-mono text-[11px] font-medium">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-app-dim text-[13px]">
                    {differing.length === 0
                      ? 'Розходжень немає'
                      : `${String(differing.filter((part) => adjusted.has(part.partId)).length)} з ${String(differing.length)} рішень прийнято`}
                  </p>
                  {decidable.length > 0 ? (
                    <Button
                      className="min-h-9 px-3.5 text-[13px] font-semibold"
                      onClick={() => {
                        setReason('')
                        setAsking(decidable)
                      }}
                    >
                      Прийняти факт для всіх
                    </Button>
                  ) : null}
                </div>
              </div>

              <section
                aria-label="Результати підрахунку"
                className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
              >
                <DataTable
                  caption="Позиції сесії"
                  columns={[
                    {
                      key: 'code',
                      label: 'Код',
                      cell: (part) => (
                        <span className="text-app-muted font-mono text-[13px]">
                          {part.partQrCode}
                        </span>
                      ),
                    },
                    {
                      key: 'part',
                      label: 'Позиція',
                      variant: 'primary',
                      cell: (part) => (
                        <span className="grid gap-0.5">
                          <span className="font-semibold text-white">
                            {part.partName}
                          </span>
                          {part.hasCoverageWarning ? (
                            <span className="text-state-warn text-[12px]">
                              Порахована не в усіх зонах
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                    {
                      key: 'expected',
                      label: 'Облік',
                      align: 'end',
                      cell: (part) => (
                        <span className="text-app-muted font-mono tabular-nums">
                          {part.expectedQuantity}
                        </span>
                      ),
                    },
                    {
                      key: 'actual',
                      label: 'Факт',
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
                      label: 'Різниця',
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
                      label: 'Рішення',
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
                  empty={
                    <EmptyState
                      description={
                        parts.length === 0
                          ? 'Підсумки зʼявляться, коли сесію буде перераховано.'
                          : 'Спробуйте інший фільтр.'
                      }
                      title={
                        parts.length === 0
                          ? 'Підсумків ще немає'
                          : 'У цьому фільтрі позицій немає'
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
                  title="Вплив на облік"
                >
                  <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-3">
                    <dt className="text-app-muted text-sm font-semibold">
                      Списати недостачу
                    </dt>
                    <dd className="text-state-danger font-mono text-[15px] tabular-nums">
                      {shortage === 0 ? '—' : `${String(shortage)} шт`}
                    </dd>
                    <dt className="text-app-muted text-sm font-semibold">
                      Додати лишки
                    </dt>
                    <dd className="text-state-ok font-mono text-[15px] tabular-nums">
                      {surplus === 0 ? '—' : `+${String(surplus)} шт`}
                    </dd>
                    <div className="bg-app-line col-span-2 my-0.5 h-px" />
                    <dt className="text-[15px] font-bold text-white">
                      Зміна кількості
                    </dt>
                    <dd
                      className={cn(
                        'font-mono text-[19px] tabular-nums',
                        shortage + surplus === 0
                          ? 'text-app-muted'
                          : shortage + surplus > 0
                            ? 'text-state-ok'
                            : 'text-state-danger',
                      )}
                    >
                      {shortage + surplus > 0
                        ? `+${String(shortage + surplus)}`
                        : String(shortage + surplus)}{' '}
                      шт
                    </dd>
                  </dl>
                  <p
                    className="text-app-dim mt-4 text-[13px] leading-[1.5]"
                    title="Підсумки сесії не несуть собівартості позицій"
                  >
                    Вартість списаного й оприбуткованого сервер у підсумках не
                    повертає — тут лише кількість.
                  </p>
                </Card>

                <Card
                  className="min-w-[280px] flex-[1_1_300px]"
                  title="Після застосування"
                >
                  <ul className="text-app-ink grid gap-3 text-sm leading-[1.5]">
                    {[
                      'Залишок позиції стане таким, як порахували в зонах сесії.',
                      'Кожне коригування потрапить у журнал аудиту сесії.',
                      'Скасувати застосоване коригування з вебу не можна.',
                    ].map((line) => (
                      <li className="flex gap-2.5" key={line}>
                        <span aria-hidden className="text-app-dim">
                          —
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                  {decidable.length > 0 ? (
                    <Button
                      className="mt-5 min-h-11 w-full text-sm font-bold"
                      onClick={() => {
                        setReason('')
                        setAsking(decidable)
                      }}
                      variant="primary"
                    >
                      Застосувати {decidable.length}{' '}
                      {plural(decidable.length, [
                        'рішення',
                        'рішення',
                        'рішень',
                      ])}
                    </Button>
                  ) : (
                    <p className="text-app-dim mt-5 text-[13px] leading-[1.5]">
                      {differing.length === 0
                        ? 'Розходжень немає — застосовувати нічого.'
                        : session.status === 'review'
                          ? canAdjust
                            ? 'Усі розходження вже мають рішення.'
                            : 'Застосування коригувань потребує права «inventory.adjust».'
                          : 'Коригування застосовуються, коли сесія в статусі «Перевірка».'}
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
                    ? `Залишок «${asking[0]?.partName ?? ''}» стане ${String(asking[0]?.actualQuantity ?? 0)} шт.`
                    : `Факт буде прийнято для ${String(asking.length)} ${plural(asking.length, ['позиції', 'позицій', 'позицій'])}.`
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
                  ? `Застосовуємо ${String(applied)} з ${String(asking.length)}…`
                  : 'Застосувати'
              }
              title="Причина коригування"
            >
              <Field
                hint="Потрапить у журнал аудиту сесії — напишіть, звідки взялася різниця."
                label="Причина"
                required
              >
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
  if (part.delta === 0) return <span className="text-app-dim font-mono">—</span>
  if (adjusted) return <StatusPill tone="ok">Застосовано</StatusPill>
  if (part.hasCoverageWarning)
    return (
      <span
        className="text-app-dim text-[12px]"
        title="Позиція лежить і в зонах поза цією сесією, тож факт не можна вважати повним"
      >
        Неповне покриття
      </span>
    )
  if (!canAdjust)
    return (
      <span className="text-app-dim text-[12px]">
        Немає права на коригування
      </span>
    )
  if (status !== 'review')
    return <span className="text-app-dim text-[12px]">Чекає на перевірку</span>
  return (
    <Button
      className="min-h-9 px-3 text-xs font-bold"
      disabled={busy}
      onClick={onAsk}
    >
      Прийняти факт
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

const AUDIT_KINDS: Record<AuditKind, { label: string; dot: string }> = {
  decision: { label: 'Рішення', dot: 'bg-brand' },
  scan: { label: 'Сканування', dot: 'bg-state-info' },
  session: { label: 'Сесія', dot: 'bg-state-ok' },
}

const AUDIT_FILTERS = [
  { value: 'all', label: 'Усі' },
  { value: 'decision', label: 'Рішення' },
  { value: 'scan', label: 'Сканування' },
  { value: 'session', label: 'Сесія' },
] as const

type AuditFilter = (typeof AUDIT_FILTERS)[number]['value']

/**
 * What the server calls each event, said in Ukrainian. An action the vocabulary
 * does not know is shown as it came rather than guessed at.
 */
const AUDIT_ACTIONS: Record<string, string> = {
  'session.created': 'Сесію створено',
  'session.started': 'Сесію розпочато',
  'session.reopened': 'Сесію повернуто в роботу',
  'session.completed': 'Сесію завершено',
  'session.cancelled': 'Сесію скасовано',
  'zone.started': 'Зону взято в підрахунок',
  'zone.completed': 'Зону перераховано',
  'scan.recorded': 'Позицію відскановано',
  'scan.voided': 'Сканування скасовано',
  'adjustment.applied': 'Коригування застосовано',
}

const auditTitle = (action: string) => AUDIT_ACTIONS[action] ?? action

/** The pairs of keys an audit payload uses when it records a change. */
const CHANGE_KEYS: [string, string][] = [
  ['expectedQuantity', 'actualQuantity'],
  ['expected', 'fact'],
  ['expected', 'actual'],
  ['oldValue', 'newValue'],
  ['from', 'to'],
]

/**
 * A before and after, but only when the payload really carries one. Nothing is
 * inferred: an event whose details name no such pair simply has no change row.
 */
const auditChange = (
  detailsJson: string | null | undefined,
): { from: string; to: string } | null => {
  if (detailsJson == null || detailsJson === '') return null
  let payload: unknown
  try {
    payload = JSON.parse(detailsJson)
  } catch {
    return null
  }
  if (payload === null || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const shown = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : typeof value === 'boolean'
        ? value
          ? 'увімкнено'
          : 'вимкнено'
        : null
  for (const [fromKey, toKey] of CHANGE_KEYS) {
    const from = shown(record[fromKey])
    const to = shown(record[toKey])
    if (from !== null && to !== null) return { from, to }
  }
  return null
}

/** How many audit events to show before the reader asks for more. */
const AUDIT_PAGE = 20

interface AuditData {
  events: InventoryAuditEvent[]
  session: InventorySession
  people: { userId: string; name: string }[]
}

function AuditView({ id }: { id: string }) {
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
            `${auditTitle(event.action)} ${nameOf(event.actorUserId) ?? ''}`.toLowerCase()
          return haystack.includes(needle)
        })
        const visible = rows.slice(0, shown)
        const zones = [
          ...new Set(session.zones.map((zone) => zone.zoneCode)),
        ].join(', ')
        const warehouse = session.zones[0]?.warehouseName ?? null

        return (
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={`${base}/sessions/${id}`}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  До сесії
                </Link>
                <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                  <span>Інвентаризація</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span>{session.number}</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span className="text-app-muted">Аудит</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  aria-pressed={raw}
                  className="px-4 text-sm font-semibold"
                  onClick={() => setRaw((value) => !value)}
                >
                  {raw ? 'Сховати дані' : 'Технічні дані'}
                </Button>
                <Button
                  disabled
                  title="Сервер поки не віддає журнал аудиту файлом"
                >
                  Експорт журналу
                </Button>
              </div>
            </div>

            <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
              <div className="min-w-0">
                <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                  Аудит сесії
                </h1>
                <p className="text-app-muted mt-3 text-[15px]">
                  {[
                    warehouse,
                    zones === '' ? null : `зони ${zones}`,
                    date(session.createdAt),
                    `${String(events.length)} ${plural(events.length, ['подія', 'події', 'подій'])}`,
                    'журнал не редагується',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  aria-label="Які події показувати"
                  className="border-app-line bg-app-raised flex flex-wrap gap-1 rounded-xl border p-1"
                  role="radiogroup"
                >
                  {AUDIT_FILTERS.map((option) => {
                    const active = option.value === filter
                    return (
                      <button
                        aria-checked={active}
                        className={cn(
                          'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-bold',
                          active
                            ? 'text-app-ink bg-white/[0.08]'
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
                        {option.label}{' '}
                        <span className="text-app-dim font-mono text-[11px] font-medium">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="min-w-[200px] flex-[1_1_220px]">
                  <SearchInput
                    aria-label="Пошук в аудиті"
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setShown(AUDIT_PAGE)
                    }}
                    placeholder="Подія або виконавець"
                    value={query}
                  />
                </div>
              </div>

              <section
                aria-label="Журнал аудиту"
                className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-6 pb-2"
              >
                {visible.length === 0 ? (
                  <p className="text-app-muted py-6 text-center text-sm">
                    {events.length === 0
                      ? 'Подій аудиту ще немає — дії із сесією зʼявляться тут автоматично.'
                      : 'За цим фільтром подій немає.'}
                  </p>
                ) : (
                  <ol className="grid">
                    {visible.map((event, index) => {
                      const kind = auditKind(event)
                      const change = auditChange(event.detailsJson)
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
                              <span className="text-[15px] font-bold text-white">
                                {auditTitle(event.action)}
                              </span>
                              <span className="border-app-line-2 text-app-muted inline-flex h-[22px] items-center rounded-full border bg-white/[0.05] px-2.5 text-[11px] font-bold">
                                {AUDIT_KINDS[kind].label}
                              </span>
                              <span className="text-app-dim font-mono text-[12px]">
                                {date(event.createdAt)}
                              </span>
                            </span>
                            <span className="text-app-muted mt-1 block text-[13px]">
                              {nameOf(event.actorUserId) ??
                                'виконавець невідомий'}
                            </span>
                            {change === null ? null : (
                              <span className="border-app-line bg-app-input mt-2.5 inline-flex items-center gap-3 rounded-[10px] border px-3.5 py-2 font-mono text-[13px]">
                                <span className="text-app-muted line-through">
                                  {change.from}
                                </span>
                                <ArrowRight
                                  aria-hidden
                                  className="text-app-dim size-3.5"
                                />
                                <span className="text-white">{change.to}</span>
                              </span>
                            )}
                            {raw && event.detailsJson ? (
                              <span className="border-app-line bg-app-input text-app-muted mt-2.5 block rounded-[9px] border px-3 py-2.5 font-mono text-[11px] leading-[1.55] break-all">
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
                  <p className="text-app-dim text-[13px]">
                    Показано {visible.length} з {rows.length}{' '}
                    {plural(rows.length, ['події', 'подій', 'подій'])}
                  </p>
                  {visible.length < rows.length ? (
                    <Button
                      className="min-h-10 px-4 text-[13px] font-bold"
                      onClick={() => setShown((value) => value + AUDIT_PAGE)}
                    >
                      Показати ще{' '}
                      {Math.min(AUDIT_PAGE, rows.length - visible.length)}
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
  { value: 'all', label: 'Усі' },
  { value: 'diff', label: 'Розходження' },
  { value: 'same', label: 'Збіглося' },
] as const

type JournalFilter = (typeof JOURNAL_FILTERS)[number]['value']

const timeOfDay = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(parsed)
}

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
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={backTo}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  До сесії
                </Link>
                <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                  <span>Сесія {session.number}</span>
                  {zone ? (
                    <>
                      <span aria-hidden className="text-white/20">
                        /
                      </span>
                      <span className="text-app-muted">{zone.zoneCode}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button asChild className="px-[18px] text-sm font-semibold">
                  <Link to={`${base}/sessions/${id}/results`}>Результати</Link>
                </Button>
              </div>
            </div>

            <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
              <div className="min-w-0">
                <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                  Журнал сканувань{zone ? ` · ${zone.zoneCode}` : null}
                </h1>
                <p className="text-app-muted mt-3 text-[15px]">
                  {[
                    zone?.warehouseName,
                    zone?.zoneName,
                    session.startedAt == null
                      ? 'сесію ще не розпочато'
                      : `сесія триває з ${date(session.startedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <Notice tone="info">
                Підрахунок ведеться в Mobile. Тут журнал доступний лише для
                перегляду.
              </Notice>

              <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-[20px] border">
                <JournalStat
                  label="Сканувань"
                  meta={`${String(new Set(live.map((scan) => scan.partId)).size)} позицій`}
                  unit={
                    scans.length === live.length
                      ? undefined
                      : `з ${String(scans.length)}`
                  }
                  value={String(live.length)}
                />
                <JournalStat
                  label="Розходжень"
                  meta={
                    results.length === 0
                      ? 'підсумки з’являться після підрахунку'
                      : 'потребують рішення'
                  }
                  tone={counts.diff > 0 ? 'danger' : undefined}
                  unit="позицій"
                  value={String(counts.diff)}
                />
                <JournalStat
                  label="Темп"
                  meta={`${String(scanners.length)} ${plural(scanners.length, ['виконавець', 'виконавці', 'виконавців'])}`}
                  unit={speed === null ? undefined : 'сканувань/год'}
                  value={speed === null ? '—' : String(speed)}
                />
                <JournalStat
                  label="Останній скан"
                  meta={
                    last === null
                      ? 'сканувань ще немає'
                      : [nameOf(last.scannedBy), zone?.zoneCode]
                          .filter(Boolean)
                          .join(' · ')
                  }
                  value={last === null ? '—' : timeOfDay(last.scannedAt)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  aria-label="Які сканування показувати"
                  className="border-app-line bg-app-raised flex gap-1 rounded-xl border p-1"
                  role="radiogroup"
                >
                  {JOURNAL_FILTERS.map((option) => {
                    const active = option.value === filter
                    const locked =
                      option.value !== 'all' && results.length === 0
                    return (
                      <button
                        aria-checked={active}
                        className={cn(
                          'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50',
                          active
                            ? 'text-app-ink bg-white/[0.08]'
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
                            ? 'Порівняння з обліком з’явиться, коли сервер порахує підсумки сесії'
                            : undefined
                        }
                        type="button"
                      >
                        {option.label}{' '}
                        <span className="text-app-dim font-mono text-[11px] font-medium">
                          {counts[option.value]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {people.length > 0 && scanners.length > 1 ? (
                  <div
                    aria-label="Чиї сканування показувати"
                    className="flex flex-wrap gap-1.5"
                    role="radiogroup"
                  >
                    {[
                      { id: 'all', label: 'Усі' },
                      ...scanners.map((userId) => ({
                        id: userId,
                        label: nameOf(userId) ?? 'Без імені',
                      })),
                    ].map((person) => (
                      <button
                        aria-checked={who === person.id}
                        className={cn(
                          'focus-visible:outline-brand min-h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold',
                          who === person.id
                            ? 'border-app-line-2 bg-app-input text-white'
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
                    aria-label="Пошук у журналі"
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setShown(JOURNAL_PAGE)
                    }}
                    placeholder="Позиція або код"
                    value={query}
                  />
                </div>
              </div>

              <section
                aria-label="Журнал сканувань"
                className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
              >
                <DataTable
                  caption="Сканування зони"
                  columns={[
                    {
                      key: 'time',
                      label: 'Час',
                      cell: (scan) => (
                        <span className="text-app-dim font-mono text-[13px]">
                          {timeOfDay(scan.scannedAt)}
                        </span>
                      ),
                    },
                    {
                      key: 'part',
                      label: 'Позиція',
                      variant: 'primary',
                      cell: (scan) => (
                        <span className="grid gap-0.5">
                          <span className="font-semibold text-white">
                            {scan.partName}
                          </span>
                          <span className="text-app-dim font-mono text-[12px]">
                            {scan.partQrCode}
                          </span>
                          {/* Facts about this scan rather than about the
                              total, so they stay beside the part. */}
                          {scan.voidReason == null ? null : (
                            <span className="text-app-muted text-[12px]">
                              {scan.voidReason}
                            </span>
                          )}
                          {scan.unexpected && scan.voidedAt == null ? (
                            <span className="text-state-warn text-[12px]">
                              Несподівана
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                    ...(people.length > 0
                      ? [
                          {
                            key: 'who',
                            label: 'Хто',
                            cell: (scan: InventoryScan) =>
                              nameOf(scan.scannedBy) ?? '—',
                          },
                        ]
                      : []),
                    {
                      key: 'expected',
                      label: 'Облік',
                      align: 'end',
                      cell: (scan) => (
                        <span className="text-app-muted font-mono tabular-nums">
                          {resultOf(scan.partId)?.expectedQuantity ?? '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'actual',
                      label: 'Скан',
                      align: 'end',
                      cell: (scan) => (
                        <span className="font-mono text-white tabular-nums">
                          {resultOf(scan.partId)?.actualQuantity ??
                            scan.zonePartCount}
                        </span>
                      ),
                    },
                    {
                      key: 'delta',
                      label: 'Різниця',
                      align: 'end',
                      cell: (scan) => {
                        if (scan.voidedAt != null)
                          return (
                            <StatusPill tone="danger">Скасовано</StatusPill>
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
                  empty={
                    <EmptyState
                      description={
                        scans.length === 0
                          ? 'Записи зʼявляться після підрахунку в Mobile.'
                          : 'Спробуйте зняти фільтр або очистити пошук.'
                      }
                      title={
                        scans.length === 0
                          ? 'Сканувань ще немає'
                          : 'Сканувань за цим фільтром немає'
                      }
                    />
                  }
                  rowKey={(scan) => scan.id}
                  rows={visible}
                />
                {rows.length > 0 ? (
                  <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
                    <p className="text-app-dim text-[13px]">
                      Показано {visible.length} з {rows.length}{' '}
                      {plural(rows.length, [
                        'сканування',
                        'сканування',
                        'сканувань',
                      ])}
                    </p>
                    {visible.length < rows.length ? (
                      <Button
                        className="min-h-9 px-3.5 text-[13px] font-bold"
                        onClick={() =>
                          setShown((value) => value + JOURNAL_PAGE)
                        }
                      >
                        Показати ще
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {pending.length > 0 ? (
                <section
                  aria-label="Неперевірені зони"
                  className="grid gap-4.5"
                >
                  <div className="flex items-baseline gap-3.5">
                    <h2 className="text-app-muted font-mono text-[11px] tracking-[0.16em] uppercase">
                      Неперевірені зони
                    </h2>
                    <span aria-hidden className="bg-app-line h-px flex-1" />
                    <span className="text-app-dim text-[13px]">
                      {pending.length}{' '}
                      {plural(pending.length, ['зона', 'зони', 'зон'])}
                    </span>
                  </div>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                    {pending.map((item) => (
                      <li key={item.zoneId}>
                        <Link
                          className="border-app-line-2 text-app-muted hover:text-app-ink block rounded-[11px] border border-dashed bg-white/[0.02] px-3 py-2.5 text-center font-mono text-[13px] hover:bg-white/[0.05]"
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
      <p className="text-app-muted font-mono text-[11px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums',
            tone === 'danger' ? 'text-state-danger' : 'text-white',
          )}
        >
          {value}
        </span>
        {unit === undefined ? null : (
          <span className="text-app-muted font-mono text-[13px] font-medium">
            {unit}
          </span>
        )}
      </p>
      {meta === undefined ? null : (
        <p className="text-app-dim mt-3.5 text-[13px]">{meta}</p>
      )}
    </div>
  )
}

function PartPlacementView({ partId }: { partId: string }) {
  const { targetTenant } = useCabinet()
  const canManage = usePermission('inventory.zones.manage')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const [zones, placement] = await Promise.all([
        inventoryApi.getZones({ signal }),
        inventoryApi.getPartZones(partId, { signal }),
      ])
      return { zones, placement }
    },
    [partId],
  )
  const resource = useLoad(loader, partId)
  const [selection, setSelection] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const selected = useMemo(
    () =>
      selection ??
      (resource.state.kind === 'ready'
        ? resource.state.data.placement.map((zone) => zone.zoneId)
        : []),
    [resource.state, selection],
  )

  const save = async () => {
    if (!canManage || !selected.length) return
    setSaving(true)
    try {
      setOperationError(null)
      setSaved(false)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await inventoryApi.replacePartZones(partId, selected, {
        signal: scope.signal,
      })
      setSelection(null)
      setSaved(true)
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setSaving(false)
    }
  }

  const back = targetTenant
    ? cabinetPath(targetTenant.slug, 'parts', partId)
    : '/'
  return (
    <PageBody width="narrow">
      <PageHeader
        eyebrow={<Link to={back}>Запчастина</Link>}
        title="Розміщення по зонах"
      />
      <Notice tone="info">
        Виберіть щонайменше одну зону зберігання. Системна зона «Без зони» не
        показується серед фізичних місць.
      </Notice>
      {operationError ? <Notice tone="danger">{operationError}</Notice> : null}
      {saved ? <Notice tone="ok">Розміщення збережено</Notice> : null}
      <Resource state={resource.state} retry={resource.reload}>
        {({ zones: items }: { zones: InventoryZone[] }) => (
          <Panel>
            <div className="grid gap-2">
              {items
                .filter((zone) => zone.isActive && !zone.isSystemUnassigned)
                .map((zone) => {
                  const checked = selected.includes(zone.id)
                  return (
                    <label
                      className="flex min-h-11 items-center gap-3 rounded-lg border border-app-line px-3 text-white"
                      key={zone.id}
                    >
                      <input
                        aria-label={`${zone.warehouseName} · ${zone.name}`}
                        checked={checked}
                        disabled={!canManage}
                        onChange={() => {
                          setSaved(false)
                          setSelection((value) => {
                            const current = value ?? selected
                            return checked
                              ? current.filter((id) => id !== zone.id)
                              : [...current, zone.id]
                          })
                        }}
                        type="checkbox"
                      />
                      <span>
                        {zone.warehouseName} · {zone.name}
                      </span>
                    </label>
                  )
                })}
            </div>
            {canManage ? (
              <Button
                className="mt-4 w-full"
                aria-busy={saving}
                disabled={saving || !selected.length}
                onClick={() => void save()}
                variant="primary"
              >
                {saving ? 'Зберігаємо…' : 'Зберегти розміщення'}
              </Button>
            ) : null}
          </Panel>
        )}
      </Resource>
    </PageBody>
  )
}
