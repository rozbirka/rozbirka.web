import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  Archive,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Printer,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FormDialog,
  Notice,
  SearchInput,
  Sheet,
  SkeletonRows,
  StatusPill,
  TextInput,
} from '@/components/app'
import {
  inventoryApi,
  type InventoryZone,
  type InventorySection,
  type InventoryShelf,
  type PartInventoryZone,
  type Warehouse,
  type WarehouseDetail,
} from '@/api/inventory'
import { partsApi, type PartDetail, type PartHistory } from '@/api/parts'
import { historyDetails, historyLabel, unitLabel } from '../parts/part-labels'
import { normalizeApiProblem } from '@/api/errors'
import { cn } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { commonMessages, useT } from '@/i18n'
import { useInventoryFormat } from '../inventory/inventory-format'
import { inventoryMessages } from '../inventory/messages'
import { overviewMessages } from '../inventory/overview-messages'
import { placementMessages } from '../inventory/placement-messages'
import { LocationSelect } from '../inventory/LocationSelect'
import { LocationBrowser } from '../inventory/LocationBrowser'
import { LocationLabelsPage } from '../inventory/LocationLabelPrinter'
import { locationPartsHref } from '../inventory/location-contents'
import { locationBrowserMessages } from '../inventory/location-browser-messages'
import { warehouseMessages } from '../inventory/warehouse-messages'
import { RedesignShell, RedesignTitle } from '../redesign-shell'
import { inventoryCodeFromName } from '../inventory/inventory-code'
import { ZoneEditorSheet, type ZoneDraft } from '../inventory/ZoneEditorSheet'
import { Resource } from '../inventory/InventoryResource'
import { useLoad, usePermission } from '../inventory/use-stock-resource'
import { StockStat } from '../inventory/StockStat'
import { Step } from '../inventory/StockStep'

export function WarehousesScreen({
  definition: _definition,
}: CabinetModuleScreenProps) {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const route = segments[0] === 'app' ? segments.slice(2) : segments
  if (route[0] === 'parts' && route[1] && route[2] === 'inventory')
    return <PartPlacementView partId={route[1]} />
  if (route[1] === 'zones' && route[2])
    return <LocationView key={`zone:${route[2]}`} id={route[2]} kind="zone" />
  if (route[1] === 'sections' && route[2])
    return (
      <LocationView key={`section:${route[2]}`} id={route[2]} kind="section" />
    )
  if (route[1]) return <WarehouseView key={route[1]} id={route[1]} />
  return <WarehousesOverview />
}

function useWarehouseBase() {
  const { targetTenant } = useCabinet()
  return targetTenant ? cabinetPath(targetTenant.slug, 'warehouses') : '/'
}

interface WarehousesOverviewData {
  warehouses: Warehouse[]
  byWarehouse: Map<string, number> | null
}

function WarehousesOverview() {
  const t = useT(overviewMessages)
  const ti = useT(inventoryMessages)
  const base = useWarehouseBase()
  const canZones = usePermission('inventory.zones.manage')
  const canSeeParts = usePermission('parts.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.warehouses,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<WarehousesOverviewData> => {
      const [warehouses, byWarehouse] = await Promise.all([
        inventoryApi.getWarehouses({ signal }),
        canSeeParts
          ? partsApi.facets({}, ['warehouse'], { signal }).then(
              (facets) =>
                new Map(facets.warehouses.map((item) => [item.id, item.count])),
              () => null,
            )
          : Promise.resolve(null),
      ])
      return { warehouses, byWarehouse }
    },
    [canSeeParts],
  )
  const resource = useLoad(loader, 'warehouses-overview')
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
      {({ warehouses, byWarehouse }: WarehousesOverviewData) => {
        const stock = byWarehouse
        const stockTotal =
          stock === null
            ? 0
            : [...stock.values()].reduce((sum, value) => sum + value, 0)

        return (
          <RedesignShell crumb={ti('crumbWarehouses')}>
            <RedesignTitle
              title={ti('crumbWarehouses')}
              lead={t('warehousesLead')}
            />
            {operationError ? (
              <Notice tone="danger">{operationError}</Notice>
            ) : null}
            <section aria-label={t('warehouses')} className="grid gap-4.5">
              <div className="flex flex-wrap items-baseline gap-3.5">
                <h2 className="text-app-muted font-mono text-[11px] tracking-[0.16em] uppercase">
                  {t('warehouses')}
                </h2>
                <span aria-hidden className="bg-app-line h-px flex-1" />
                {canZones ? (
                  <Button
                    className="text-[13px] font-semibold"
                    onClick={() => {
                      setDraft({ name: '', code: '' })
                      setAdding(true)
                    }}
                    variant="ghost"
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
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
                  {warehouses.map((item) => {
                    const parts = stock?.get(item.id) ?? null
                    const share =
                      parts === null || stockTotal === 0
                        ? 0
                        : Math.round((parts / stockTotal) * 100)
                    return (
                      <li key={item.id}>
                        <Link
                          className="border-app-line bg-app-raised block h-full rounded-[18px] border px-5.5 pt-5 pb-5.5 hover:border-white/20"
                          to={`${base}/${item.id}`}
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="text-[17px] font-bold tracking-[-0.01em] text-white">
                              {item.name}
                            </span>
                            <span className="text-app-muted font-mono text-[13px]">
                              {ti('zones', { count: item.zoneCount })}
                            </span>
                          </span>
                          <span className="text-app-muted mt-1 block text-[13px]">
                            {[
                              t('warehouseCode', { code: item.code }),
                              item.isSystemDefault ? t('defaultTag') : null,
                              item.isActive ? null : t('archivedTag'),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                          <span
                            aria-hidden
                            className="bg-app-line-2 mt-4 block h-1.5 overflow-hidden rounded-full"
                          >
                            <span
                              className="bg-state-ok block h-full rounded-full"
                              style={{ width: `${String(share)}%` }}
                            />
                          </span>
                          <span className="text-app-muted mt-2.5 flex items-baseline justify-between gap-3 text-[13px]">
                            <span>
                              {parts === null
                                ? ti('stockUnavailable')
                                : t('shareOfYard', { share })}
                            </span>
                            <span className="font-mono">
                              {parts === null
                                ? '—'
                                : t('positionsShort', { count: parts })}
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            <WarehouseEditorSheet
              open={adding}
              draft={draft}
              onChange={setDraft}
              onClose={() => setAdding(false)}
              onSubmit={() => void createWarehouse()}
              pending={creating}
              error={operationError}
            />
          </RedesignShell>
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
        className="grid content-start gap-5"
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
}

interface WarehouseData {
  warehouse: WarehouseDetail
  stock: WarehouseStock
}

const EMPTY_STOCK: WarehouseStock = {
  byZone: new Map(),
  total: null,
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
    const [facets, all] = await Promise.all([
      partsApi.facets({ warehouseIds: [warehouseId] }, ['zone'], { signal }),
      partsApi.search({ warehouseIds: [warehouseId], pageSize: 1 }, { signal }),
    ])
    return {
      byZone: new Map(facets.zones.map((zone) => [zone.id, zone.count])),
      total: all.total,
    }
  } catch {
    return EMPTY_STOCK
  }
}

function WarehouseView({ id }: { id: string }) {
  const t = useT(warehouseMessages)
  const ti = useT(inventoryMessages)
  const tc = useT(commonMessages)
  const base = useWarehouseBase()
  const { targetTenant } = useCabinet()
  const navigate = useNavigate()
  const [labelParams] = useSearchParams()
  const labelsOpen = labelParams.get('labels') === '1'
  const labelTriggerRef = useRef<HTMLButtonElement>(null)
  const canManage = usePermission('inventory.zones.manage')
  const canSeeParts = usePermission('parts.view')
  const partsBase = targetTenant
    ? cabinetPath(targetTenant.slug, 'parts')
    : null
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.warehouses,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<WarehouseData> => {
      const [warehouse, stock] = await Promise.all([
        inventoryApi.getWarehouse(id, { signal }),
        canSeeParts
          ? loadWarehouseStock(id, signal)
          : Promise.resolve(EMPTY_STOCK),
      ])
      return { warehouse, stock }
    },
    [canSeeParts, id],
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
      {({ warehouse, stock }: WarehouseData) => {
        const zones = warehouse.zones
        /** The zones a person actually fills — the catch-all is not one. */
        const real = zones.filter((zone) => !zone.isSystemUnassigned)
        const partsIn = (zoneId: string) => stock.byZone.get(zoneId) ?? 0
        const filled = real.filter((zone) => partsIn(zone.id) > 0).length
        const occupancy =
          stock.total === null || real.length === 0
            ? null
            : Math.round((filled / real.length) * 100)

        return (
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={base}
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {ti('backToWarehouses')}
                </Link>
                <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                  <span>{ti('crumbWarehouse')}</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span>{ti('crumbWarehouses')}</span>
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
                    {t('edit')}
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
                          `${base}/${encodeURIComponent(id)}?labels=1`,
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

            <div className="mx-auto grid w-full max-w-[1240px] gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
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
                      {t('active')}
                    </span>
                  ) : (
                    <StatusPill tone="neutral">{t('archived')}</StatusPill>
                  )}
                </div>
                <p className="text-app-muted mt-3 text-[15px]">
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

              <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-px overflow-hidden rounded-[20px] border">
                <StockStat
                  label={t('statPositions')}
                  meta={`${ti('zones', { count: real.length })} · ${t('unassigned', { count: warehouse.unassignedPartCount })}`}
                  unit={ti('positionsUnit')}
                  value={stock.total == null ? '—' : String(stock.total)}
                />
                <StockStat
                  label={t('statFilled')}
                  meta={stock.total === null ? t('needsPartsView') : ''}
                  tone={
                    occupancy !== null && occupancy >= 80 ? 'warn' : 'plain'
                  }
                  unit=""
                  value={
                    stock.total === null
                      ? '—'
                      : t('filledRatio', { filled, count: real.length })
                  }
                />
              </div>

              <div className="grid min-w-0 gap-5">
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
                  bodyClassName={labelsOpen ? 'p-4 sm:p-6' : 'p-0 pt-4'}
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
                    <>
                      <div
                        aria-hidden
                        className={cn(
                          'border-app-line text-app-muted hidden gap-3 border-y px-6 py-3 font-mono text-[10px] tracking-[0.14em] uppercase md:grid',
                          canManage
                            ? 'grid-cols-[minmax(0,1fr)_4.5rem_10rem_5.5rem]'
                            : 'grid-cols-[minmax(0,1fr)_4.5rem_10rem]',
                        )}
                      >
                        <span>{t('colZone')}</span>
                        <span className="text-right">{t('colPositions')}</span>
                        <span>{t('colFill')}</span>
                        {canManage ? (
                          <span className="text-right">{t('colActions')}</span>
                        ) : null}
                      </div>
                      <ul className="grid">
                        {zones.length === 0 ? (
                          <li className="text-app-muted px-6 py-6 text-sm">
                            {t('noZones')}
                          </li>
                        ) : null}
                        {zones.map((zone) => {
                          const count = partsIn(zone.id)
                          /** How much of the warehouse's stock lies in this zone. */
                          const share =
                            stock.total === null || stock.total === 0
                              ? 0
                              : Math.round((count / stock.total) * 100)
                          return (
                            <li
                              className={cn(
                                'border-app-line grid items-center gap-x-4 gap-y-2 border-b px-6 py-4 last:border-0 md:gap-3',
                                canManage
                                  ? 'md:grid-cols-[minmax(0,1fr)_4.5rem_10rem_5.5rem]'
                                  : 'md:grid-cols-[minmax(0,1fr)_4.5rem_10rem]',
                              )}
                              key={zone.id}
                            >
                              <div className="min-w-0">
                                {zone.isSystemUnassigned &&
                                partsBase === null ? (
                                  <span className="text-[15px] font-bold text-white">
                                    {zone.name}
                                  </span>
                                ) : (
                                  <Link
                                    className="flex min-h-11 items-center justify-between gap-3 text-[15px] font-bold text-white hover:underline"
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
                                        className="text-app-muted size-4 shrink-0"
                                      />
                                    ) : null}
                                  </Link>
                                )}
                                <p className="text-app-muted mt-0.5 text-[13px]">
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
                                    ? ti('stockUnavailable')
                                    : t('shareOfWarehouse', { share })}
                                </p>
                              </div>
                              {canManage ? (
                                <div className="flex gap-1.5 md:justify-end">
                                  <Button
                                    aria-label={t('editZone', {
                                      name: zone.name,
                                    })}
                                    className="min-w-11 px-0"
                                    disabled={zone.isSystemUnassigned}
                                    onClick={() => {
                                      setOperationError(null)
                                      setEditingZone(zone)
                                    }}
                                    title={
                                      zone.isSystemUnassigned
                                        ? t('systemNoEdit')
                                        : undefined
                                    }
                                    variant="ghost"
                                  >
                                    <Pencil aria-hidden />
                                  </Button>
                                  <Button
                                    aria-label={t('archiveZoneLabel', {
                                      name: zone.name,
                                    })}
                                    className="min-w-11 px-0"
                                    disabled={zone.isSystemUnassigned}
                                    onClick={() => setArchivingZone(zone)}
                                    title={
                                      zone.isSystemUnassigned
                                        ? t('systemNoArchive')
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
                    </>
                  )}
                </Card>
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
  const base = useWarehouseBase()
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
          <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
            <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
              <div className="flex min-w-0 items-center gap-5">
                <Link
                  className="border-app-line-2 text-app-muted hover:text-app-ink flex min-h-11 shrink-0 items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                  to={
                    section
                      ? `${base}/zones/${zone.id}${returnQuery}`
                      : `${base}/${zone.warehouseId}`
                  }
                >
                  <ChevronLeft aria-hidden className="size-3.5" />
                  {t(section ? 'backToZone' : 'backToWarehouse')}
                </Link>
                <p className="text-app-muted hidden min-w-0 items-center gap-2 text-sm sm:flex">
                  <span>{ti('crumbWarehouse')}</span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  <span className="text-app-muted truncate">
                    {zone.warehouseName}
                  </span>
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                  {section ? (
                    <>
                      <span className="text-app-muted truncate">
                        {zone.name}
                      </span>
                      <span aria-hidden className="text-white/20">
                        /
                      </span>
                    </>
                  ) : null}
                  <span>{t(section ? 'sectionType' : 'zoneType')}</span>
                </p>
              </div>
              {canViewParts && targetTenant ? (
                <Button asChild className="px-4 text-sm font-semibold">
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
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
              <header className="min-w-0">
                <h1 className="break-words text-[38px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                  {section?.name ?? zone.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3">
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
                  <p className="text-app-muted min-w-0 break-all font-mono text-[13px]">
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
                    <div className="border-app-line bg-app-raised rounded-[20px] border p-4 sm:p-6">
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
  const base = useWarehouseBase()
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
    cabinetModules.warehouses,
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
      className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
    >
      {error ? (
        <div className="p-4 sm:p-6">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      {resource.state.kind === 'loading' ? (
        <div className="p-4 sm:p-6">
          <SkeletonRows rows={3} />
        </div>
      ) : null}
      {resource.state.kind === 'error' ? (
        <Button
          className="m-4 sm:m-6"
          onClick={resource.reload}
          variant="ghost"
        >
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
          partsBase={base.replace(/\/warehouses$/, '/parts')}
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
          className="grid content-start gap-5"
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
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
          value={draft.code}
        />
      </Field>
    </>
  )
}

/** One figure of the warehouse strip: label, number, unit and what it counts. */

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
    cabinetModules.warehouses,
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
    <Resource retry={resource.reload} state={resource.state}>
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
              drawer
                ? 'type-redesign grid min-w-0 content-start'
                : 'type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10'
            }
          >
            {!drawer ? (
              <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
                <div className="flex min-w-0 items-center gap-5">
                  <Link
                    className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
                    to={back}
                  >
                    <ChevronLeft aria-hidden className="size-3.5" />
                    {t('backToPart')}
                  </Link>
                  <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
                    <span>{ti('crumbWarehouse')}</span>
                    <span aria-hidden className="text-white/20">
                      /
                    </span>
                    <span>{t('crumbParts')}</span>
                    {part === null ? null : (
                      <>
                        <span aria-hidden className="text-white/20">
                          /
                        </span>
                        <span className="text-app-muted">{part.qrCode}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {canManage ? (
                    <Button
                      aria-busy={saving}
                      className="px-5 text-sm font-bold"
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

            <div
              className={
                drawer
                  ? 'grid min-w-0 gap-5'
                  : 'mx-auto grid w-full max-w-[1240px] gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12'
              }
            >
              <div className="min-w-0">
                {!drawer ? (
                  <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
                    {t('title')}
                  </h1>
                ) : null}
                <p className="text-app-muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
                  {part === null ? (
                    <span>{t('partHidden')}</span>
                  ) : (
                    <>
                      <span className="text-app-ink font-semibold">
                        {part.name}
                      </span>
                      <span aria-hidden className="text-white/20">
                        ·
                      </span>
                      <span className="max-w-full break-all font-mono">
                        {part.qrCode}
                      </span>
                      <span aria-hidden className="text-white/20">
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

              <div className="flex flex-wrap items-start gap-6">
                <div
                  className={
                    drawer
                      ? 'grid min-w-0 w-full gap-5'
                      : 'flex min-w-0 flex-[2_1_34rem] flex-col gap-5'
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
                        <div className="border-app-line-2 text-app-muted grid w-full gap-3 rounded-xl border border-dashed bg-white/[0.02] p-4.5 text-sm">
                          <p>{t('noActiveWarehouses')}</p>
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
                              'focus-visible:outline-brand min-h-[66px] flex-[1_1_10rem] cursor-pointer rounded-xl border px-3.5 py-3 text-left hover:border-white/20',
                              active
                                ? 'border-app-line-2 bg-white/[0.07]'
                                : 'border-app-line bg-transparent',
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
                                'block text-[15px] font-bold',
                                active ? 'text-app-ink' : 'text-app-muted',
                              )}
                            >
                              {item.name}
                            </span>
                            <span className="text-app-muted mt-1 block text-[12px] font-medium">
                              {ti('zones', { count })}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </Step>

                  <Step
                    aside={
                      <p className="text-app-muted flex flex-wrap items-center gap-3.5 text-[12px]">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="size-2 rounded-[3px] bg-white/15"
                          />
                          {t('legendEmpty')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="bg-state-warn/50 size-2 rounded-[3px]"
                          />
                          {t('legendFilled')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="bg-state-danger/50 size-2 rounded-[3px]"
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
                          'mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors',
                          selected.length === 1 &&
                            selected[0] === warehouseOnly.id
                            ? 'border-brand bg-brand/[0.08]'
                            : 'border-app-line hover:border-app-line-2',
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
                            'flex size-5 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand',
                            selected.length === 1 &&
                              selected[0] === warehouseOnly.id
                              ? 'border-brand bg-brand text-app-canvas'
                              : 'border-app-line-2',
                          )}
                        >
                          {selected.length === 1 &&
                          selected[0] === warehouseOnly.id ? (
                            <Check size={15} strokeWidth={3} />
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
                      <p className="border-app-line-2 text-app-muted mt-3.5 rounded-xl border border-dashed bg-white/[0.02] p-4.5 text-sm">
                        {inHouse.length === 0
                          ? t('noActiveZones')
                          : t('noZonesFound')}
                      </p>
                    ) : house !== null ? (
                      <ul
                        className={
                          drawer
                            ? 'mt-3.5 grid gap-2'
                            : 'mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] gap-2'
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
                              <label
                                className={cn(
                                  'block cursor-pointer rounded-xl border px-3 pt-2.5 pb-3 hover:border-white/20',
                                  on
                                    ? 'border-brand bg-brand/[0.08]'
                                    : 'border-app-line bg-app-canvas',
                                )}
                              >
                                <span className="flex items-start justify-between gap-2">
                                  <span className="min-w-0">
                                    <span
                                      className={cn(
                                        drawer
                                          ? 'block break-words text-[14px] font-bold'
                                          : 'block truncate text-[14px] font-bold',
                                        on ? 'text-app-ink' : 'text-app-muted',
                                      )}
                                    >
                                      {zone.name}
                                    </span>
                                    <span className="text-app-muted block font-mono text-[12px]">
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
                                      'flex size-5 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand',
                                      on
                                        ? 'border-brand bg-brand text-app-canvas'
                                        : 'border-app-line-2',
                                    )}
                                  >
                                    {on ? (
                                      <Check size={15} strokeWidth={3} />
                                    ) : null}
                                  </span>
                                </span>
                                <span
                                  aria-hidden
                                  className="mt-2.5 block h-1 overflow-hidden rounded-full bg-white/[0.08]"
                                >
                                  <span
                                    className={cn(
                                      'block h-full rounded-full',
                                      load >= 100
                                        ? 'bg-state-danger/60'
                                        : load > 0
                                          ? 'bg-state-warn/60'
                                          : 'bg-transparent',
                                    )}
                                    style={{ width: `${String(load)}%` }}
                                  />
                                </span>
                                <span className="text-app-muted mt-1.5 block text-[11px] font-semibold">
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
                              'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors',
                              !selectedSectionId
                                ? 'border-brand bg-brand/[0.08]'
                                : 'border-app-line hover:border-app-line-2',
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
                                'flex size-5 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand',
                                !selectedSectionId
                                  ? 'border-brand bg-brand text-app-canvas'
                                  : 'border-app-line-2',
                              )}
                            >
                              {!selectedSectionId ? (
                                <Check size={15} strokeWidth={3} />
                              ) : null}
                            </span>
                          </label>
                          {availableSections.map((section) => (
                            <label
                              className={cn(
                                'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors',
                                selectedSectionId === section.id
                                  ? 'border-brand bg-brand/[0.08]'
                                  : 'border-app-line hover:border-app-line-2',
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
                                  'flex size-5 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand',
                                  selectedSectionId === section.id
                                    ? 'border-brand bg-brand text-app-canvas'
                                    : 'border-app-line-2',
                                )}
                              >
                                {selectedSectionId === section.id ? (
                                  <Check size={15} strokeWidth={3} />
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
                              'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors',
                              !selectedShelfId
                                ? 'border-brand bg-brand/[0.08]'
                                : 'border-app-line hover:border-app-line-2',
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
                                'flex size-5 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand',
                                !selectedShelfId
                                  ? 'border-brand bg-brand text-app-canvas'
                                  : 'border-app-line-2',
                              )}
                            >
                              {!selectedShelfId ? (
                                <Check size={15} strokeWidth={3} />
                              ) : null}
                            </span>
                          </label>
                          {availableShelves.map((shelf) => (
                            <label
                              className={cn(
                                'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors',
                                selectedShelfId === shelf.id
                                  ? 'border-brand bg-brand/[0.08]'
                                  : 'border-app-line hover:border-app-line-2',
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
                                  'flex size-5 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand',
                                  selectedShelfId === shelf.id
                                    ? 'border-brand bg-brand text-app-canvas'
                                    : 'border-app-line-2',
                                )}
                              >
                                {selectedShelfId === shelf.id ? (
                                  <Check size={15} strokeWidth={3} />
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
                    <div className="flex flex-wrap items-center gap-4.5">
                      <span
                        className="border-app-line bg-app-canvas text-app-muted flex items-center gap-1 rounded-xl border p-[3px]"
                        title={t('notSplitTitle')}
                      >
                        <span
                          aria-hidden
                          className="flex size-9.5 items-center justify-center rounded-[9px] text-[18px] font-bold opacity-40"
                        >
                          −
                        </span>
                        <span className="w-13 text-center font-mono text-[17px] text-white">
                          {part?.quantityTotal ?? '—'}
                        </span>
                        <span
                          aria-hidden
                          className="flex size-9.5 items-center justify-center rounded-[9px] text-[18px] font-bold opacity-40"
                        >
                          +
                        </span>
                      </span>
                      <p className="text-app-muted min-w-[12rem] flex-1 text-[14px]">
                        {t('notSplit')}
                      </p>
                    </div>
                  </Step>

                  {!drawer ? (
                    <Card
                      aside={
                        <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                          {t('records', { count: moves.length })}
                        </span>
                      }
                      bodyClassName="p-0"
                      className="min-w-0"
                      title={t('historyTitle')}
                    >
                      {moves.length === 0 ? (
                        <p className="text-app-muted px-6 pt-4 pb-6 text-sm">
                          {history === null
                            ? t('historyHidden')
                            : t('neverMoved')}
                        </p>
                      ) : (
                        <ul className="grid">
                          {moves.slice(0, 8).map((event) => (
                            <li
                              className="border-app-line flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t px-6 py-3"
                              key={event.id}
                            >
                              <span className="text-app-ink w-28 shrink-0 text-[14px] font-semibold">
                                {historyLabel(event.eventType, locale)}
                              </span>
                              <span className="text-app-muted min-w-0 flex-1 text-[13px]">
                                {historyDetails(event.data, locale).join(' · ')}
                              </span>
                              <span className="text-app-dim font-mono text-[13px] whitespace-nowrap">
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
                    className="border-app-line bg-app-raised flex min-w-0 flex-[1_1_18rem] flex-col rounded-[18px] border px-5.5 pt-[22px] pb-6"
                  >
                    <h2 className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
                      {t('newPlacement')}
                    </h2>
                    <div className="border-app-line bg-app-canvas mt-4 rounded-[14px] border p-4">
                      {chosen.length > 0 ? (
                        <ul className="grid gap-3 text-[14px]">
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
                        <p className="text-app-muted text-[14px]">
                          {t('noLocationSelected')}
                        </p>
                      )}
                    </div>
                    {canManage ? (
                      <Button
                        aria-busy={saving}
                        className="mt-5.5 min-h-11.5 w-full text-[15px] font-bold"
                        disabled={saving || selected.length === 0}
                        onClick={() => void save()}
                        variant="primary"
                      >
                        {saving ? t('saving') : t('savePlacement')}
                      </Button>
                    ) : null}
                    <p className="text-app-dim mt-3 text-[12px] leading-[1.5]">
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
