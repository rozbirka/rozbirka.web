import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  Archive,
  ArrowRight,
  ChevronLeft,
  ClipboardCheck,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
} from 'lucide-react'
import {
  Button,
  Card,
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

function WarehouseView({ id }: { id: string }) {
  const base = useInventoryBase()
  const navigate = useNavigate()
  const canManage = usePermission('inventory.zones.manage')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    (signal: AbortSignal) => inventoryApi.getWarehouse(id, { signal }),
    [id],
  )
  const resource = useLoad(loader, id)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const createZone = async (form: FormData) => {
    const name = formText(form, 'name')
    const code = formText(form, 'code')
    if (!name || !code) return
    try {
      setOperationError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await inventoryApi.createZone(
        { warehouseId: id, name, code },
        { signal: scope.signal },
      )
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    }
  }
  const editWarehouse = async (warehouse: WarehouseDetail) => {
    const name = window.prompt('Назва складу', warehouse.name)?.trim()
    if (!name) return
    const code = window.prompt('Код складу', warehouse.code)?.trim()
    if (!code) return
    try {
      setOperationError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await inventoryApi.updateWarehouse(
        id,
        {
          name,
          code,
          isActive: warehouse.isActive,
        },
        { signal: scope.signal },
      )
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    }
  }
  const archiveWarehouse = async (warehouse: WarehouseDetail) => {
    if (!window.confirm(`Архівувати склад «${warehouse.name}»?`)) return
    try {
      setOperationError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await inventoryApi.archiveWarehouse(id, { signal: scope.signal })
      void navigate(base, { replace: true })
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    }
  }
  const editZone = async (zone: WarehouseDetail['zones'][number]) => {
    const name = window.prompt('Назва зони', zone.name)?.trim()
    if (!name) return
    const code = window.prompt('Код зони', zone.code)?.trim()
    if (!code) return
    try {
      setOperationError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await inventoryApi.updateZone(
        zone.id,
        {
          name,
          code,
          isActive: zone.isActive,
        },
        { signal: scope.signal },
      )
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    }
  }
  const archiveZone = async (zone: WarehouseDetail['zones'][number]) => {
    if (!window.confirm(`Архівувати зону «${zone.name}»?`)) return
    try {
      setOperationError(null)
      const scope = requireLatestMutation({
        permission: 'inventory.zones.manage',
        quota: false,
      })
      await inventoryApi.archiveZone(zone.id, { signal: scope.signal })
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    }
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
    <PageBody>
      <PageHeader
        eyebrow={
          <Link className="hover:text-white" to={base}>
            Інвентаризація
          </Link>
        }
        title="Склад"
      />
      {operationError ? <Notice tone="danger">{operationError}</Notice> : null}
      <Resource state={resource.state} retry={resource.reload}>
        {(warehouse: WarehouseDetail) => (
          <>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {warehouse.name}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-app-dim">
                    {warehouse.code}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={printing}
                    onClick={() => void printZones()}
                    variant="quiet"
                  >
                    <Printer aria-hidden />
                    Друкувати QR зон
                  </Button>
                  {canManage ? (
                    <Button
                      onClick={() => void editWarehouse(warehouse)}
                      variant="ghost"
                    >
                      <Pencil aria-hidden />
                      Редагувати склад
                    </Button>
                  ) : null}
                  {canManage && !warehouse.isSystemDefault ? (
                    <Button
                      onClick={() => void archiveWarehouse(warehouse)}
                      variant="danger"
                    >
                      Архівувати склад
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-sm text-app-dim">
                Без зони: {warehouse.unassignedPartCount} запчастин
              </p>
            </Panel>
            {canManage ? (
              <Panel>
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
                  action={(form) => void createZone(form)}
                >
                  <label className="grid gap-1 text-sm text-app-dim">
                    Назва зони
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
                      className="min-h-11 rounded-lg border border-app-line bg-app-canvas px-3 text-white"
                    />
                  </label>
                  <Button type="submit">Додати зону</Button>
                </form>
              </Panel>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {warehouse.zones.map((zone) => (
                <Panel key={zone.id}>
                  <div className="flex justify-between gap-2">
                    <div>
                      <strong className="text-white">{zone.name}</strong>
                      <p className="font-mono text-xs text-app-dim">
                        {zone.code}
                      </p>
                    </div>
                    {zone.isSystemUnassigned ? (
                      <StatusPill tone="neutral">Системна</StatusPill>
                    ) : (
                      <ClipboardCheck className="text-brand" aria-hidden />
                    )}
                  </div>
                  {canManage && !zone.isSystemUnassigned ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        aria-label={`Редагувати зону ${zone.name}`}
                        onClick={() => void editZone(zone)}
                        variant="ghost"
                      >
                        <Pencil aria-hidden />
                        Редагувати
                      </Button>
                      <Button
                        aria-label={`Архівувати зону ${zone.name}`}
                        onClick={() => void archiveZone(zone)}
                        variant="danger"
                      >
                        Архівувати
                      </Button>
                    </div>
                  ) : null}
                </Panel>
              ))}
            </div>
          </>
        )}
      </Resource>
    </PageBody>
  )
}

function NewSessionView() {
  const base = useInventoryBase()
  const navigate = useNavigate()
  const canManage = usePermission('inventory.manage')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    (signal: AbortSignal) => inventoryApi.getZones({ signal }),
    [],
  )
  const zones = useLoad(loader, 'zones')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const create = async () => {
    if (!canManage || !selected.length) return
    setCreating(true)
    setOperationError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      const session = await inventoryApi.createSession(selected, {
        signal: scope.signal,
      })
      void navigate(`${base}/sessions/${session.id}`, { replace: true })
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setCreating(false)
    }
  }
  return (
    <PageBody width="narrow">
      <PageHeader
        eyebrow={<Link to={base}>Інвентаризація</Link>}
        title="Нова інвентаризація"
      />
      <Notice tone="info">
        Підрахунок виконуватиметься працівниками у Mobile. Тут ви обираєте зони
        та запускаєте сесію.
      </Notice>
      {!canManage ? (
        <Notice tone="danger">
          Для створення інвентаризації потрібен дозвіл керування.
        </Notice>
      ) : null}
      {operationError ? <Notice tone="danger">{operationError}</Notice> : null}
      <Resource state={zones.state} retry={zones.reload}>
        {(items: InventoryZone[]) => (
          <Panel>
            <div className="grid gap-2">
              {items
                .filter((zone) => zone.isActive && !zone.isSystemUnassigned)
                .map((zone) => (
                  <label
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-app-line px-3 text-white"
                    key={zone.id}
                  >
                    <input
                      checked={selected.includes(zone.id)}
                      disabled={!canManage}
                      onChange={() =>
                        setSelected((value) =>
                          value.includes(zone.id)
                            ? value.filter((id) => id !== zone.id)
                            : [...value, zone.id],
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      {zone.warehouseName} · {zone.name}
                    </span>
                  </label>
                ))}
            </div>
            <Button
              className="mt-4 w-full"
              disabled={creating || !canManage || !selected.length}
              onClick={() => void create()}
              variant="primary"
            >
              Створити чернетку
            </Button>
          </Panel>
        )}
      </Resource>
    </PageBody>
  )
}

function SessionView({ id }: { id: string }) {
  const base = useInventoryBase()
  const canManage = usePermission('inventory.manage')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.inventory,
  )
  const loader = useCallback(
    (signal: AbortSignal) => inventoryApi.getSession(id, { signal }),
    [id],
  )
  const resource = useLoad(loader, id)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const isInProgress =
    resource.state.kind === 'ready' &&
    resource.state.data.status === 'inProgress'
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
    if (!window.confirm('Підтвердити дію із сесією?')) return
    const reason =
      action === 'cancel'
        ? window.prompt('Причина скасування')?.trim()
        : undefined
    if (action === 'cancel' && !reason) return
    setActing(true)
    try {
      setOperationError(null)
      const scope = requireLatestMutation({ quota: false })
      const options = { signal: scope.signal }
      if (action === 'start') await inventoryApi.startSession(id, options)
      if (action === 'complete') await inventoryApi.completeSession(id, options)
      if (action === 'reopen') await inventoryApi.reopenSession(id, options)
      if (action === 'cancel' && reason) {
        await inventoryApi.cancelSession(id, reason, options)
      }
      resource.reload()
    } catch (error) {
      setOperationError(normalizeApiProblem(error).message)
    } finally {
      setActing(false)
    }
  }
  return (
    <PageBody>
      <Resource state={resource.state} retry={resource.reload}>
        {(session) => {
          const [label, tone] = sessionStatus(session.status)
          const completed = session.zones.filter(
            (zone) => zone.status === 'completed',
          ).length
          return (
            <>
              <PageHeader
                eyebrow={<Link to={base}>Інвентаризація</Link>}
                title={session.number}
                actions={
                  <>
                    <Button onClick={resource.reload} variant="ghost">
                      <RefreshCw aria-hidden />
                      Оновити
                    </Button>
                    {session.status !== 'draft' ? (
                      <Button asChild variant="quiet">
                        <Link to={`${base}/sessions/${id}/results`}>
                          Результати
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild variant="quiet">
                      <Link to={`${base}/sessions/${id}/audit`}>Аудит</Link>
                    </Button>
                  </>
                }
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Статус"
                  value={<StatusPill tone={tone}>{label}</StatusPill>}
                />
                <StatCard
                  label="Завершено зон"
                  value={`${completed}/${session.zones.length}`}
                  accent
                />
                <StatCard
                  label="Запчастин у зрізі"
                  value={session.preview.includedPartCount}
                />
              </div>
              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}
              {canManage ? (
                <Panel className="flex flex-wrap gap-2">
                  {session.status === 'draft' ? (
                    <Button
                      disabled={acting}
                      onClick={() => void act('start')}
                      variant="primary"
                    >
                      Запустити
                    </Button>
                  ) : null}
                  {session.status === 'review' ? (
                    <Button
                      onClick={() => void act('complete')}
                      disabled={acting}
                      variant="primary"
                    >
                      Завершити
                    </Button>
                  ) : null}
                  {session.status === 'review' ? (
                    <Button
                      disabled={acting}
                      onClick={() => void act('reopen')}
                      variant="quiet"
                    >
                      Відкрити повторно
                    </Button>
                  ) : null}
                  {!['completed', 'cancelled'].includes(session.status) ? (
                    <Button
                      disabled={acting}
                      onClick={() => void act('cancel')}
                      variant="danger"
                    >
                      <Archive aria-hidden />
                      Скасувати
                    </Button>
                  ) : null}
                </Panel>
              ) : null}
              <div className="overflow-hidden rounded-panel border border-app-line">
                {session.zones.map((zone) => (
                  <div
                    className="grid gap-2 border-b border-app-line p-4 last:border-0 sm:grid-cols-[1fr_auto]"
                    key={zone.zoneId}
                  >
                    <div>
                      <strong className="text-white">{zone.zoneName}</strong>
                      <p className="text-xs text-app-dim">
                        {zone.warehouseName} · {zone.zoneCode}
                      </p>
                      {zone.leaseOwnerUserId ? (
                        <p className="mt-2 text-xs text-state-warn">
                          Зона зайнята користувачем до{' '}
                          {date(zone.leaseExpiresAt)}
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
                  </div>
                ))}
              </div>
            </>
          )
        }}
      </Resource>
    </PageBody>
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
                        {option.label}
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
                        {option.label}
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
                        {option.label}
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
