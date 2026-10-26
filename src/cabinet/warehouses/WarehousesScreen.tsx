import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  Archive,
  ArrowRight,
  LayoutGrid,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  TriangleAlert,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  BulkBar,
  Card,
  ConfirmDialog,
  Field,
  Notice,
  SearchInput,
  Sheet,
  SkeletonRows,
  StateScreen,
  StatusPill,
  TextInput,
  useOptionalToast,
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
import {
  partsApi,
  type PartDetail,
  type PartHistory,
  type PartSearchItem,
} from '@/api/parts'
import { historyDetails, historyLabel, unitLabel } from '../parts/part-labels'
import { partsListMessages } from '../parts/parts-list-messages'
import { normalizeApiProblem } from '@/api/errors'
import { cn } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { commonMessages, useFormat, useT } from '@/i18n'
import { useInventoryFormat } from '../inventory/inventory-format'
import { inventoryMessages } from '../inventory/messages'
import { overviewMessages } from '../inventory/overview-messages'
import { placementMessages } from '../inventory/placement-messages'
import { LocationSelect } from '../inventory/LocationSelect'
import {
  LocationBrowser,
  LocationSearch,
  LocationStatusFilter,
} from '../inventory/LocationBrowser'
import { LocationLabelsPage } from '../inventory/LocationLabelPrinter'
import { locationPartsHref } from '../inventory/location-contents'
import { locationBrowserMessages } from '../inventory/location-browser-messages'
import { locationContentsMessages } from '../inventory/location-contents-messages'
import { warehouseMessages } from '../inventory/warehouse-messages'
import { Crumbs, RedesignShell } from '../redesign-shell'
import { BackAction, WarehousePageHead } from './warehouse-page'
import { inventoryCodeFromName } from '../inventory/inventory-code'
import { ZoneEditorSheet, type ZoneDraft } from '../inventory/ZoneEditorSheet'
import { Resource } from '../inventory/InventoryResource'
import { PlacementSkeleton } from '../inventory/PlacementSkeleton'
import { WarehouseStatisticsError } from './WarehouseStatisticsError'
import { LocationPartsList } from '../inventory/LocationPartsList'
import { unassignedMessages } from './unassigned-messages'
import { BulkPlacementSheet } from './BulkPlacementSheet'
import { PlacementPartInfo } from './PlacementPartInfo'
import {
  hasPlacementStock,
  warehouseStockStatuses,
} from './placement-availability'
import { useLoad, usePermission } from '../inventory/use-stock-resource'
import { StockStat } from '../inventory/StockStat'
import { Step } from '../inventory/StockStep'
import { WarehouseZoneBrowser } from './WarehouseZoneBrowser'
import { WarehouseBrowser } from './WarehouseBrowser'

export function WarehousesScreen({ ...props }: CabinetModuleScreenProps) {
  return (
    <div className="warehouse-module contents">
      <WarehouseRoutes {...props} />
    </div>
  )
}

function WarehouseRoutes({
  definition: _definition,
}: CabinetModuleScreenProps) {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const route = segments[0] === 'app' ? segments.slice(2) : segments
  if (route[0] === 'parts' && route[1] && route[2] === 'inventory')
    return <PartPlacementView partId={route[1]} />
  if (route[1] && route[2] === 'unassigned')
    return <UnassignedPartsView key={route[1]} id={route[1]} />
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

function UnassignedPartsView({ id }: { id: string }) {
  const t = useT(unassignedMessages)
  const tw = useT(warehouseMessages)
  const ti = useT(inventoryMessages)
  const tp = useT(partsListMessages)
  const { targetTenant } = useCabinet()
  const navigate = useNavigate()
  const base = useWarehouseBase()
  const canManage = usePermission('inventory.zones.manage')
  const canSeeParts = usePermission('parts.view')
  const loader = useCallback(
    (signal: AbortSignal) => inventoryApi.getWarehouse(id, { signal }),
    [id],
  )
  const resource = useLoad(loader, id)
  const [placing, setPlacing] = useState<PartSearchItem | null>(null)
  const [revision, setRevision] = useState(0)
  const toast = useOptionalToast()
  const [selectedParts, setSelectedParts] = useState<
    ReadonlyMap<string, PartSearchItem>
  >(new Map())
  const [bulkParts, setBulkParts] = useState<PartSearchItem[] | null>(null)
  return (
    <Resource state={resource.state} retry={resource.reload}>
      {(warehouse: WarehouseDetail) => {
        const zone = warehouse.zones.find((item) => item.isSystemUnassigned)
        return (
          <RedesignShell
            width="workspace"
            crumb={
              <Crumbs
                items={[
                  ti('crumbWarehouse'),
                  <Link key="warehouses" to={base}>
                    {ti('crumbWarehouses')}
                  </Link>,
                  <Link
                    key="warehouse"
                    to={`${base}/${encodeURIComponent(warehouse.id)}`}
                  >
                    {warehouse.name}
                  </Link>,
                  t('title'),
                ]}
              />
            }
            actions={
              <BackAction
                to={`${base}/${encodeURIComponent(warehouse.id)}`}
                label={tw('backToWarehouse')}
              />
            }
          >
            <WarehousePageHead
              title={t('title')}
              sub={t('lead', { warehouse: warehouse.name })}
            />
            {!warehouse.isActive ? <Notice>{t('archived')}</Notice> : null}
            {zone ? (
              <LocationPartsList
                target={{
                  kind: 'zone',
                  warehouseId: warehouse.id,
                  zoneId: zone.id,
                  name: t('title'),
                  path: [warehouse.name, t('title')],
                }}
                context="unassigned"
                title={t('list')}
                refreshKey={revision}
                emptyText={t('empty')}
                searchHint={
                  canManage && warehouse.isActive
                    ? t('selectionHint')
                    : undefined
                }
                selection={
                  canManage && warehouse.isActive
                    ? {
                        parts: selectedParts,
                        onChange: setSelectedParts,
                        actions: selectedParts.size ? (
                          <BulkBar
                            count={selectedParts.size}
                            noun={t('partsNoun')}
                            actions={[
                              {
                                key: 'place',
                                label: t('placeSelected'),
                                onRun: () => {
                                  const parts = [...selectedParts.values()]
                                  if (parts.length === 1) setPlacing(parts[0]!)
                                  else setBulkParts(parts)
                                },
                              },
                              ...(targetTenant
                                ? [
                                    {
                                      key: 'stickers',
                                      label: tp('bulkPrintStickers'),
                                      onRun: () =>
                                        void navigate(
                                          `${cabinetPath(targetTenant.slug, 'stickers')}?${[
                                            ...selectedParts.keys(),
                                          ]
                                            .map(
                                              (partId) =>
                                                `part=${encodeURIComponent(partId)}`,
                                            )
                                            .join('&')}`,
                                        ),
                                    },
                                  ]
                                : []),
                            ]}
                            onClear={() => setSelectedParts(new Map())}
                          />
                        ) : null,
                      }
                    : undefined
                }
              />
            ) : (
              <StateScreen
                icon={<TriangleAlert aria-hidden />}
                role="alert"
                title={t('missingZone')}
                tone="danger"
                actions={
                  <Button onClick={resource.reload}>
                    <RefreshCw aria-hidden />
                    {ti('retry')}
                  </Button>
                }
              />
            )}
            {placing && zone ? (
              <BulkPlacementSheet
                key={placing.id}
                parts={[placing]}
                warehouseId={warehouse.id}
                sourceZoneId={zone.id}
                single
                onClose={() => setPlacing(null)}
                onApplied={(_ids, placedIds) => {
                  if (placedIds.has(placing.id)) {
                    toast?.show({
                      tone: 'ok',
                      message: t('placed', { name: placing.name }),
                    })
                    setPlacing(null)
                  }
                  setSelectedParts((current) => {
                    const next = new Map(current)
                    next.delete(placing.id)
                    return next
                  })
                  setRevision((value) => value + 1)
                }}
              />
            ) : null}
            {bulkParts &&
            zone &&
            canManage &&
            canSeeParts &&
            warehouse.isActive ? (
              <BulkPlacementSheet
                warehouseId={warehouse.id}
                sourceZoneId={zone.id}
                parts={bulkParts}
                onClose={() => setBulkParts(null)}
                onApplied={(ids) => {
                  setSelectedParts(
                    (current) =>
                      new Map(
                        [...current].filter(([partId]) => !ids.has(partId)),
                      ),
                  )
                  setRevision((value) => value + 1)
                }}
              />
            ) : null}
          </RedesignShell>
        )
      }}
    </Resource>
  )
}

interface WarehousesOverviewData {
  warehouses: Warehouse[]
  byWarehouse: Map<string, number> | null
  partsTotal: number | null
  statisticsError: boolean
}

const overviewComplete = (data: WarehousesOverviewData) => !data.statisticsError
const overviewLoadOptions = {
  retainOnReload: true,
  mergeIncomplete: (
    previous: WarehousesOverviewData,
    next: WarehousesOverviewData,
  ): WarehousesOverviewData => ({
    ...next,
    partsTotal: next.partsTotal ?? previous.partsTotal,
    byWarehouse:
      next.byWarehouse ??
      (next.warehouses.length === previous.warehouses.length &&
      next.warehouses.every((warehouse) =>
        previous.warehouses.some((item) => item.id === warehouse.id),
      )
        ? previous.byWarehouse
        : null),
  }),
}

function WarehousesOverview() {
  const t = useT(overviewMessages)
  const ti = useT(inventoryMessages)
  const tb = useT(locationBrowserMessages)
  const format = useFormat()
  const base = useWarehouseBase()
  const canZones = usePermission('inventory.zones.manage')
  const canSeeParts = usePermission('parts.view')
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.warehouses,
  )
  const loader = useCallback(
    async (signal: AbortSignal): Promise<WarehousesOverviewData> => {
      const warehouses = await inventoryApi.getWarehouses({ signal })
      const warehouseIds = warehouses.map((warehouse) => warehouse.id)
      if (!canSeeParts || warehouseIds.length === 0) {
        return {
          warehouses,
          byWarehouse: canSeeParts ? new Map() : null,
          partsTotal: canSeeParts ? 0 : null,
          statisticsError: false,
        }
      }
      const [facets, total] = await Promise.allSettled([
        partsApi.facets({ statuses: warehouseStockStatuses }, ['warehouse'], {
          signal,
        }),
        partsApi.search(
          { warehouseIds, statuses: warehouseStockStatuses, pageSize: 1 },
          { signal },
        ),
      ])
      return {
        warehouses,
        byWarehouse:
          facets.status === 'fulfilled'
            ? new Map(
                facets.value.warehouses.map((item) => [item.id, item.count]),
              )
            : null,
        partsTotal: total.status === 'fulfilled' ? total.value.total : null,
        statisticsError:
          facets.status === 'rejected' || total.status === 'rejected',
      }
    },
    [canSeeParts],
  )
  const resource = useLoad(
    loader,
    'warehouses-overview',
    overviewComplete,
    overviewLoadOptions,
  )
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
      {({
        warehouses,
        byWarehouse,
        partsTotal,
        statisticsError,
      }: WarehousesOverviewData) => {
        const activeCount = warehouses.filter(
          (warehouse) => warehouse.isActive,
        ).length
        return (
          <RedesignShell
            crumb={
              <Crumbs items={[ti('crumbWarehouse'), ti('crumbWarehouses')]} />
            }
            actions={
              canZones && warehouses.length > 0 ? (
                <Button
                  onClick={() => {
                    setDraft({ name: '', code: '' })
                    setAdding(true)
                  }}
                  variant="primary"
                >
                  <Plus aria-hidden />
                  {t('addWarehouse')}
                </Button>
              ) : undefined
            }
          >
            <WarehousePageHead
              title={ti('crumbWarehouses')}
              sub={t('warehousesPageLead')}
            />
            {statisticsError ||
            (resource.state.kind === 'ready' && resource.state.refreshError) ? (
              <WarehouseStatisticsError
                onRetry={resource.refresh}
                pending={
                  resource.state.kind === 'ready' && resource.state.refreshing
                }
              />
            ) : null}
            {warehouses.length ? (
              <>
                <LocationSearch
                  label={t('searchWarehouses')}
                  placeholder={tb('nameOrCode')}
                />
                <div className="rz-kpis">
                  <StockStat
                    label={t('statWarehouses')}
                    value={format.number(warehouses.length) ?? '0'}
                    unit=""
                    meta={t('warehouseStatusSummary', {
                      active: activeCount,
                      archived: warehouses.length - activeCount,
                    })}
                  />
                  <StockStat
                    label={t('statWarehouseParts')}
                    value={
                      partsTotal === null
                        ? '—'
                        : (format.number(partsTotal) ?? '0')
                    }
                    unit=""
                    meta={partsTotal === null ? ti('stockUnavailable') : ''}
                  />
                </div>
              </>
            ) : null}
            {operationError ? (
              <Notice tone="danger">{operationError}</Notice>
            ) : null}
            <WarehouseBrowser
              warehouses={warehouses}
              stock={byWarehouse}
              base={base}
              onAdd={
                canZones
                  ? () => {
                      setDraft({ name: '', code: '' })
                      setAdding(true)
                    }
                  : undefined
              }
            />
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
  edit,
}: {
  open: boolean
  draft: { name: string; code: string }
  onChange: (draft: { name: string; code: string }) => void
  onClose: () => void
  onSubmit: () => void
  pending: boolean
  error: string | null
  /** Editing an existing warehouse: its code, so the code keeps following
   * the name until someone types their own. */
  edit?: { initialCode: string } | undefined
}) {
  const t = useT(overviewMessages)
  const tw = useT(warehouseMessages)
  const tc = useT(commonMessages)
  const formId = useId()
  return (
    <Sheet
      open={open}
      title={edit ? tw('editWarehouseTitle') : t('newWarehouseTitle')}
      description={edit ? tw('editWarehouseHint') : t('newWarehouseHint')}
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
            {edit ? tc('save') : t('addWarehouse')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        aria-busy={pending}
        className="grid content-start gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!pending && draft.name.trim() && draft.code.trim()) onSubmit()
        }}
      >
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <NameAndCode
          autoHint
          draft={draft}
          initialCode={edit?.initialCode}
          onChange={onChange}
        />
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
  loadError: boolean
}

interface WarehouseData {
  warehouse: WarehouseDetail
  stock: WarehouseStock
}

const EMPTY_STOCK: WarehouseStock = {
  byZone: new Map(),
  total: null,
  loadError: false,
}

const warehouseComplete = (data: WarehouseData) => !data.stock.loadError
const warehouseLoadOptions = {
  retainOnReload: true,
  mergeIncomplete: (
    previous: WarehouseData,
    next: WarehouseData,
  ): WarehouseData => ({
    ...next,
    stock: next.stock.loadError
      ? { ...previous.stock, loadError: true }
      : next.stock,
  }),
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
      partsApi.facets(
        { warehouseIds: [warehouseId], statuses: warehouseStockStatuses },
        ['zone'],
        { signal },
      ),
      partsApi.search(
        {
          warehouseIds: [warehouseId],
          statuses: warehouseStockStatuses,
          pageSize: 1,
        },
        { signal },
      ),
    ])
    return {
      byZone: new Map(facets.zones.map((zone) => [zone.id, zone.count])),
      total: all.total,
      loadError: false,
    }
  } catch {
    return { ...EMPTY_STOCK, loadError: true }
  }
}

function WarehouseView({ id }: { id: string }) {
  const t = useT(warehouseMessages)
  const ti = useT(inventoryMessages)
  const tb = useT(locationBrowserMessages)
  const base = useWarehouseBase()
  const { targetTenant } = useCabinet()
  const navigate = useNavigate()
  const [labelParams, setLabelParams] = useSearchParams()
  const labelsOpen = labelParams.get('labels') === '1'
  const archivedOnly = labelParams.get('locationStatus') === 'archived'
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
      const [warehouse, stock, archivedZones] = await Promise.all([
        inventoryApi.getWarehouse(id, { signal }),
        canSeeParts
          ? loadWarehouseStock(id, signal)
          : Promise.resolve(EMPTY_STOCK),
        archivedOnly
          ? inventoryApi.getZones({
              warehouseId: id,
              archivedOnly: true,
              signal,
            })
          : Promise.resolve([]),
      ])
      return {
        warehouse: {
          ...warehouse,
          zones: [
            ...new Map(
              [...warehouse.zones, ...archivedZones].map((zone) => [
                zone.id,
                zone,
              ]),
            ).values(),
          ],
        },
        stock,
      }
    },
    [canSeeParts, id, archivedOnly],
  )
  const resource = useLoad(loader, id, warehouseComplete, warehouseLoadOptions)
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
        ) : archivedOnly ? (
          <div className="grid gap-3 p-[var(--rz-card-p)]">
            <LocationStatusFilter label={t('statusZones')} />
            <Button onClick={resource.reload}>{ti('retry')}</Button>
          </div>
        ) : null
      }
    >
      {({ warehouse, stock }: WarehouseData) => {
        const zones = warehouse.zones
        /** The zones a person actually fills — the catch-all is not one. */
        const real = zones.filter(
          (zone) => zone.isActive && !zone.isSystemUnassigned,
        )
        const partsIn = (zoneId: string) => stock.byZone.get(zoneId) ?? 0
        const filled = real.filter((zone) => partsIn(zone.id) > 0).length
        const occupancy =
          stock.total === null || real.length === 0
            ? null
            : Math.round((filled / real.length) * 100)

        return (
          <RedesignShell
            crumb={
              <Crumbs
                items={[
                  ti('crumbWarehouse'),
                  <Link key="warehouses" to={base}>
                    {ti('crumbWarehouses')}
                  </Link>,
                  warehouse.name,
                ]}
              />
            }
            actions={
              <>
                <BackAction to={base} label={ti('backToWarehouses')} />
                {canManage ? (
                  <Button
                    onClick={() => {
                      setOperationError(null)
                      setDraft({ name: warehouse.name, code: warehouse.code })
                      setEditingWarehouse(true)
                    }}
                  >
                    <Pencil aria-hidden />
                    {t('edit')}
                  </Button>
                ) : null}
                {canManage && !warehouse.isSystemDefault ? (
                  <ActionMenu
                    actions={[
                      {
                        key: 'archive',
                        label: t('archiveWarehouse'),
                        icon: <Archive aria-hidden />,
                        destructive: true,
                        onSelect: () => {
                          setOperationError(null)
                          setArchivingWarehouse(true)
                        },
                      },
                    ]}
                    label={t('moreActions')}
                  />
                ) : null}
              </>
            }
          >
            <WarehousePageHead
              title={warehouse.name}
              sub={[
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
              chips={
                <StatusPill tone={warehouse.isActive ? 'ok' : 'neutral'}>
                  {t(warehouse.isActive ? 'active' : 'archived')}
                </StatusPill>
              }
            />

            {labelsOpen ? null : (
              <LocationSearch
                label={tb('searchZones')}
                placeholder={tb('nameOrCode')}
              />
            )}

            {operationError ? (
              <Notice tone="danger">{operationError}</Notice>
            ) : null}

            {stock.loadError ||
            (resource.state.kind === 'ready' && resource.state.refreshError) ? (
              <WarehouseStatisticsError
                onRetry={resource.refresh}
                pending={
                  resource.state.kind === 'ready' && resource.state.refreshing
                }
              />
            ) : null}

            <div className="rz-kpis">
              <StockStat
                label={t('statPositions')}
                meta={`${ti('zones', { count: real.length })} · ${t('unassigned', { count: warehouse.unassignedPartCount })}`}
                unit={ti('positionsUnit')}
                value={stock.total == null ? '—' : String(stock.total)}
              />
              <StockStat
                label={t('statFilled')}
                meta={!canSeeParts ? t('needsPartsView') : ''}
                tone={occupancy !== null && occupancy >= 80 ? 'warn' : 'plain'}
                unit={
                  stock.total === null
                    ? ''
                    : t('filledTotal', { count: real.length })
                }
                value={stock.total === null ? '—' : String(filled)}
              />
            </div>

            <WarehouseZoneBrowser
              zones={zones}
              base={base}
              partsBase={partsBase}
              unassignedHref={`${base}/${encodeURIComponent(warehouse.id)}/unassigned`}
              canManage={canManage}
              onAdd={startAddingZone}
              onEdit={(zone) => {
                setOperationError(null)
                setEditingZone(zone)
              }}
              pending={busy}
              onRestore={(zone) => {
                if (busy) return
                void run((signal) =>
                  inventoryApi
                    .restoreZone(zone.id, { signal })
                    .then(() => undefined),
                ).then((ok) => {
                  if (ok) resource.reload()
                })
              }}
              onArchive={(zone) => {
                setOperationError(null)
                setArchivingZone(zone)
              }}
              headerActions={
                <ActionMenu
                  triggerRef={labelTriggerRef}
                  label={tb('zonesActions')}
                  actions={[
                    {
                      key: 'print',
                      label: t('printZones'),
                      icon: <Printer aria-hidden />,
                      onSelect: () =>
                        setLabelParams(
                          (current) => {
                            const next = new URLSearchParams(current)
                            next.set('labels', '1')
                            return next
                          },
                          { preventScrollReset: true },
                        ),
                    },
                  ]}
                />
              }
              printWorkspace={
                labelsOpen ? (
                  <LocationLabelsPage
                    flush
                    target={{
                      kind: 'zone',
                      parentId: id,
                      parentName: warehouse.name,
                    }}
                    inventoryBase={base}
                    returnFocusRef={labelTriggerRef}
                  />
                ) : null
              }
            />

            <WarehouseEditorSheet
              open={editingWarehouse}
              draft={draft}
              onChange={setDraft}
              onClose={() => setEditingWarehouse(false)}
              onSubmit={() => void saveWarehouse(warehouse)}
              pending={busy}
              error={operationError}
              edit={{ initialCode: warehouse.code }}
            />

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
              error={operationError}
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
              error={operationError}
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
          </RedesignShell>
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
        const warehouseHref = `${base}/${encodeURIComponent(zone.warehouseId)}`
        const zoneHref = `${base}/zones/${encodeURIComponent(zone.id)}${returnQuery}`
        const usable =
          zone.isActive &&
          section?.isActive !== false &&
          !zone.isSystemUnassigned
        return (
          <RedesignShell
            width={usable && !labelsOpen ? 'workspace' : 'list'}
            crumb={
              <Crumbs
                items={[
                  ti('crumbWarehouse'),
                  <Link key="warehouses" to={base}>
                    {ti('crumbWarehouses')}
                  </Link>,
                  <Link key="warehouse" to={warehouseHref}>
                    {zone.warehouseName}
                  </Link>,
                  ...(section
                    ? [
                        <Link key="zone" to={zoneHref}>
                          {zone.name}
                        </Link>,
                        section.name,
                      ]
                    : [zone.name]),
                ]}
              />
            }
            actions={
              <>
                <BackAction
                  to={section ? zoneHref : warehouseHref}
                  label={t(section ? 'backToZone' : 'backToWarehouse')}
                />
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
              </>
            }
          >
            <WarehousePageHead
              title={section?.name ?? zone.name}
              sub={
                zone.isSystemUnassigned
                  ? zone.code
                  : `${t('code', { code: section?.code ?? zone.code })} · ${t('locationHierarchy')}`
              }
              chips={
                zone.isSystemUnassigned ? (
                  <StatusPill tone="neutral">{t('systemTag')}</StatusPill>
                ) : (
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
                )
              }
            />
            {usable ? (
              <ZoneLocations
                zone={zone}
                {...(section ? { section } : {})}
                onStructureChange={resource.refresh}
              />
            ) : (
              <>
                <Notice tone={zone.isSystemUnassigned ? 'info' : 'warn'}>
                  {t(
                    zone.isSystemUnassigned
                      ? 'systemZoneStructure'
                      : 'archivedZoneStructure',
                  )}
                </Notice>
                {labelsOpen && !zone.isSystemUnassigned ? (
                  <div className="rz-card p-[var(--rz-card-p)]">
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
          </RedesignShell>
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
  const archivedOnly =
    !section &&
    new URLSearchParams(location.search).get('locationStatus') === 'archived'
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
              ...(archivedOnly ? { archivedOnly: true } : {}),
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
    [warehouseId, zone.id, section, archivedOnly],
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
      counts.set(item.id, 0)
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

  const ready = resource.state.kind === 'ready'
  const noSections =
    ready &&
    !section &&
    !archivedOnly &&
    !loadedSections.some((item) => item.isActive && item.zoneId === zone.id)
  return (
    <>
      {resource.state.kind === 'error' && !section && !labelsOpen ? (
        <LocationStatusFilter label={t('statusSections')} />
      ) : null}
      {ready && !labelsOpen && !noSections ? (
        <LocationSearch
          label={tb(section ? 'searchShelves' : 'searchSections')}
          placeholder={tb(
            section ? 'searchShelfPlaceholder' : 'searchSectionPlaceholder',
          )}
        />
      ) : null}
      <div className="location-browser-layout grid min-w-0 items-stretch gap-[14px]">
        <section
          aria-label={t(section ? 'shelfType' : 'sectionType')}
          className="location-browser-card rz-card min-w-0"
        >
          {error ? (
            <div className="p-[var(--rz-card-p)]">
              <Notice tone="danger">{error}</Notice>
            </div>
          ) : null}
          {resource.state.kind === 'loading' ? (
            <div className="p-[var(--rz-card-p)]">
              <SkeletonRows rows={3} />
            </div>
          ) : null}
          {resource.state.kind === 'error' ? (
            <Button
              className="m-[var(--rz-card-p)]"
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
              sectionShelfCounts={sectionShelfCounts}
              archivedOnly={archivedOnly}
              pending={busy}
              onRestoreSection={(item) => {
                if (!busy)
                  void write((signal) =>
                    inventoryApi.restoreSection(item.id, { signal }),
                  )
              }}
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
              statusFilter={
                !section && !labelsOpen ? (
                  <LocationStatusFilter label={t('statusSections')} />
                ) : null
              }
              headerActions={
                <>
                  {!archivedOnly ? (
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
                                  setDraft({
                                    name: section.name,
                                    code: section.code,
                                  })
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
                  ) : null}
                </>
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
              addingSectionTo ? (
                <>
                  <span>{addingSectionTo.name}</span> ·{' '}
                  <span className="font-mono">{addingSectionTo.code}</span>
                </>
              ) : editingSection ? (
                <span>{editingSection.zoneName}</span>
              ) : addingTo ? (
                <>
                  <span>{addingTo.zoneName}</span> ·{' '}
                  <span>{addingTo.name}</span>
                </>
              ) : editing ? (
                <>
                  <span>{editing.zoneName}</span> ·{' '}
                  <span>{editing.sectionName}</span>
                </>
              ) : undefined
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
              className="grid content-start gap-4"
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
      </div>
    </>
  )
}

/** Name and code fields shared by warehouses, zones, sections, and shelves. */
function NameAndCode({
  draft,
  initialCode,
  onChange,
  autoHint = false,
}: {
  draft: { name: string; code: string }
  initialCode?: string | undefined
  onChange: (draft: { name: string; code: string }) => void
  /** Warehouses and zones explain that the code follows the name. */
  autoHint?: boolean
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
      <Field
        hint={t(autoHint ? 'codeAutoHint' : 'codeHint')}
        label={t('codeLabel')}
        required
      >
        <TextInput
          className="font-mono"
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

interface PlacementDrawerOptions {
  onClose: () => void
  onSaved: () => void
  initialWarehouseId?: string
  requirePhysicalZone?: boolean
}

export function PartPlacementDrawer({
  partId,
  ...drawer
}: { partId: string } & PlacementDrawerOptions) {
  return <PartPlacementView partId={partId} drawer={drawer} />
}

function PartPlacementView({
  partId,
  drawer,
}: {
  partId: string
  drawer?: PlacementDrawerOptions
}) {
  const isDrawer = drawer !== undefined
  const t = useT(placementMessages)
  const tl = useT(locationContentsMessages)
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
        canSeeParts && !isDrawer
          ? partsApi.history(partId, { signal }).then(
              (data) => data,
              () => null,
            )
          : Promise.resolve(null),
        canSeeParts && !isDrawer
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
    [canSeeParts, partId, isDrawer],
  )
  const resource = useLoad(loader, partId)
  const [selection, setSelection] = useState<string[] | null>(null)
  const [shelfSelection, setShelfSelection] = useState<
    string | null | undefined
  >(undefined)
  const [sectionSelection, setSectionSelection] = useState<
    string | null | undefined
  >(undefined)
  const [warehouseId, setWarehouseId] = useState<string | null>(
    drawer?.initialWarehouseId ?? null,
  )
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const toast = useOptionalToast()
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
        ? resource.state.data.placement.length === 1
          ? resource.state.data.placement.map((zone) => zone.zoneId)
          : []
        : []),
    [resource.state, selection],
  )

  const placementData =
    resource.state.kind === 'ready' ? resource.state.data : null
  const canSaveSelection =
    selected.length === 1 &&
    (placementData?.part == null || hasPlacementStock(placementData.part)) &&
    (!drawer?.requirePhysicalZone ||
      (placementData !== null &&
        !placementData.zones.some(
          (zone) => selected.includes(zone.id) && zone.isSystemUnassigned,
        ) &&
        placementData.zones.some(
          (zone) =>
            selected.includes(zone.id) &&
            zone.isActive &&
            !zone.isSystemUnassigned &&
            placementData.warehouses.some(
              (warehouse) =>
                warehouse.id === zone.warehouseId && warehouse.isActive,
            ),
        )))

  /** `unchanged`: the chosen set equals the saved one (module 12, 5.7). */
  const save = async (unchanged = false) => {
    if (!canManage || saving || !canSaveSelection) return
    setSaving(true)
    try {
      setOperationError(null)
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
      toast?.show(
        unchanged
          ? { tone: 'info', message: t('unchanged') }
          : { tone: 'ok', message: t('saved') },
      )
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
      setSelection([])
      setSectionSelection(null)
      setShelfSelection(null)
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
      setSelection([zone.id])
      setSectionSelection(null)
      setShelfSelection(null)
      setWarehouseId(zone.warehouseId)
      setQuery('')
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
    <Resource
      retry={resource.reload}
      state={resource.state}
      framed={!drawer}
      loadingContent={drawer ? <PlacementSkeleton /> : undefined}
    >
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
        const zoneOptions = [
          ...(warehouseOnly && !drawer?.requirePhysicalZone
            ? [{ id: warehouseOnly.id, name: t('warehouseOnly') }]
            : []),
          ...inHouse,
        ]
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
        const chooseZone = (zoneId: string | null) => {
          setSelection(zoneId ? [zoneId] : [])
          if (selected.length !== 1 || selected[0] !== zoneId) {
            setShelfSelection(null)
            setSectionSelection(null)
          }
        }
        const chooseWarehouse = (id: string | null) => {
          setWarehouseId(id)
          setQuery('')
          if (id !== house) {
            setSelection([])
            setSectionSelection(null)
            setShelfSelection(null)
          }
        }

        const levelOf = (zone: (typeof zones)[number]) =>
          [
            zone.warehouseName,
            zone.isSystemUnassigned ? t('warehouseLevel') : zone.name,
            ...(selectedSection?.zoneId === zone.id
              ? [
                  selectedSection.name,
                  ...(selectedShelf ? [selectedShelf.name] : []),
                ]
              : []),
          ].join(' → ')
        const warehouseOnlyChecked =
          warehouseOnly !== undefined &&
          selected.length === 1 &&
          selected[0] === warehouseOnly.id

        return (
          <div
            className={
              drawer ? 'grid min-w-0 content-start' : 'grid content-start'
            }
          >
            {part && !hasPlacementStock(part) ? (
              <Notice>{tl('placementNoStock')}</Notice>
            ) : null}
            {!drawer ? (
              <div className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
                <Crumbs
                  items={[
                    ti('crumbWarehouse'),
                    t('crumbParts'),
                    ...(part === null
                      ? []
                      : [
                          <Link key="part" to={back}>
                            {part.name}
                          </Link>,
                        ]),
                  ]}
                />
                <div className="rz-topbar__actions flex-wrap items-center">
                  <BackAction to={back} label={t('backToPart')} />
                  {canManage ? (
                    <Button
                      aria-busy={saving}
                      disabled={saving || !canSaveSelection}
                      onClick={() => void save(!changed)}
                      variant="primary"
                    >
                      {saving ? t('saving') : t('place')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className={drawer ? 'grid min-w-0 gap-[14px]' : 'rz-page'}>
              {!drawer ? (
                <WarehousePageHead
                  title={t('title')}
                  sub={
                    part === null ? (
                      t('partHidden')
                    ) : (
                      <>
                        <span className="max-w-full font-mono break-all">
                          {part.qrCode}
                        </span>
                        <span aria-hidden> · </span>
                        {t('inStock', {
                          count: part.quantityTotal,
                          unit: unitLabel(part.unit, locale),
                        })}
                      </>
                    )
                  }
                />
              ) : null}

              {operationError ? (
                <Notice tone="danger">{operationError}</Notice>
              ) : null}
              {drawer?.requirePhysicalZone ? (
                <Notice tone="info">{t('pickPhysicalZone')}</Notice>
              ) : null}

              {drawer ? (
                <div className="grid min-w-0 gap-4">
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="rz-label m-0">{t('warehouse')}</p>
                      {canManage ? (
                        <Button
                          disabled={saving || creating}
                          onClick={() => openCreate('warehouse')}
                        >
                          <Plus aria-hidden />
                          {to('addWarehouse')}
                        </Button>
                      ) : null}
                    </div>
                    <LocationSelect
                      label={t('warehouse')}
                      searchLabel={to('searchWarehouses')}
                      noneLabel={t('noActiveWarehouses')}
                      allowNone={false}
                      options={houses}
                      value={house}
                      disabled={!canManage || saving || creating}
                      onChange={chooseWarehouse}
                    />
                  </div>
                  {house ? (
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="rz-label m-0">{t('zone')}</p>
                        {canManage ? (
                          <Button
                            disabled={saving || creating}
                            onClick={() => openCreate('zone')}
                          >
                            <Plus aria-hidden />
                            {tw('addZone')}
                          </Button>
                        ) : null}
                      </div>
                      {zoneOptions.length ? (
                        <LocationSelect
                          label={t('zone')}
                          searchLabel={t('zoneSearch')}
                          noneLabel={t('noZonesPicked')}
                          allowNone={false}
                          options={zoneOptions}
                          value={
                            zoneOptions.find((zone) =>
                              selected.includes(zone.id),
                            )?.id ?? null
                          }
                          disabled={!canManage || saving || creating}
                          onChange={chooseZone}
                        />
                      ) : (
                        <Notice tone="info">{t('noActiveZones')}</Notice>
                      )}
                      {chosen.length > 1 ? (
                        <div className="text-app-muted text-caption">
                          <p className="m-0">
                            {t('zonesPicked')}: {chosen.length}
                          </p>
                          <ul className="m-0 max-h-32 list-none overflow-y-auto p-0">
                            {chosen.map((zone) => (
                              <li key={zone.id}>{levelOf(zone)}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {hasPhysicalZone ? (
                    <div className="grid gap-1.5">
                      <p className="rz-label m-0">{t('section')}</p>
                      <LocationSelect
                        label={t('section')}
                        searchLabel={t('sectionSearch')}
                        noneLabel={t('noSection')}
                        options={availableSections.map((section) => ({
                          ...section,
                          ...(chosen.length > 1
                            ? { context: section.zoneName }
                            : {}),
                        }))}
                        value={selectedSectionId}
                        disabled={!canManage || saving || creating}
                        onChange={(id) => {
                          setSectionSelection(id)
                          setShelfSelection(null)
                        }}
                      />
                    </div>
                  ) : null}
                  {hasPhysicalZone && selectedSectionId ? (
                    <div className="grid gap-1.5">
                      <p className="rz-label m-0">{t('shelf')}</p>
                      <LocationSelect
                        label={t('shelf')}
                        searchLabel={t('shelfSearch')}
                        noneLabel={t('noShelf')}
                        options={availableShelves}
                        value={selectedShelfId}
                        disabled={!canManage || saving || creating}
                        onChange={setShelfSelection}
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-1.5">
                    <p className="rz-label m-0">{t('partDetails')}</p>
                    {part ? (
                      <div className="border-app-line bg-app-raised flex min-w-0 rounded-panel border px-3 py-2">
                        <PlacementPartInfo
                          name={part.name}
                          oemCode={part.oemCode}
                          code={part.qrCode}
                          quantity={part.quantityTotal}
                          unit={unitLabel(part.unit, locale)}
                          status={part.status}
                          car={[part.carBrand, part.carModel, part.carYear]
                            .filter(Boolean)
                            .join(' · ')}
                        />
                      </div>
                    ) : (
                      <p className="rz-caption m-0">{t('partHidden')}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={
                    drawer
                      ? 'grid min-w-0 gap-[14px]'
                      : 'grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'
                  }
                >
                  <div className="grid min-w-0 gap-[14px]">
                    <Step
                      hint={t('warehouseHint')}
                      number="01"
                      title={t('warehouse')}
                    >
                      <div
                        aria-label={t('warehouse')}
                        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2"
                        role="radiogroup"
                      >
                        {houses.length === 0 ? (
                          <StateScreen
                            className="location-browser__placeholder col-span-full min-h-[160px]"
                            icon={<WarehouseIcon aria-hidden />}
                            title={t('noActiveWarehouses')}
                            {...(canManage
                              ? {
                                  actions: (
                                    <Button
                                      onClick={() => openCreate('warehouse')}
                                    >
                                      <Plus aria-hidden />
                                      {to('addWarehouse')}
                                    </Button>
                                  ),
                                }
                              : {})}
                          />
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
                                'rz-choice-card focus-visible:outline-brand min-w-0 bg-transparent text-left',
                                active && 'border-brand bg-brand-soft',
                              )}
                              key={item.id}
                              onClick={() => chooseWarehouse(item.id)}
                              role="radio"
                              type="button"
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  'mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border',
                                  active ? 'border-brand' : 'border-app-line-2',
                                )}
                              >
                                {active ? (
                                  <span className="bg-brand size-1.5 rounded-full" />
                                ) : null}
                              </span>
                              <span className="grid min-w-0 gap-0.5">
                                <span className="rz-strong font-semibold break-words">
                                  {item.name}
                                </span>
                                <span className="rz-caption">
                                  {ti('zones', { count })}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {warehouseOnly ? (
                        <label className="rz-choice w-fit">
                          <input
                            type="radio"
                            name="placement-location"
                            className="rz-radio"
                            disabled={!canManage}
                            checked={warehouseOnlyChecked}
                            onChange={() => chooseZone(warehouseOnly.id)}
                          />
                          <span className="rz-caption text-app-muted">
                            {t('warehouseOnly')}
                          </span>
                        </label>
                      ) : null}
                    </Step>

                    {house === null ? null : (
                      <Step
                        aside={
                          <p className="rz-caption m-0 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className="bg-app-line-2 size-2 rounded-control"
                              />
                              {t('legendEmpty')}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className="bg-state-warn size-2 rounded-control"
                              />
                              {t('legendFilled')}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className="bg-state-danger size-2 rounded-control"
                              />
                              {t('legendBusiest')}
                            </span>
                          </p>
                        }
                        hint={inHouse.length === 0 ? undefined : t('zoneHint')}
                        number="02"
                        title={t('zone')}
                      >
                        {inHouse.length === 0 ? (
                          <StateScreen
                            className="location-browser__placeholder min-h-[160px]"
                            icon={<LayoutGrid aria-hidden />}
                            title={t('noActiveZones')}
                            {...(canManage
                              ? {
                                  actions: (
                                    <Button onClick={() => openCreate('zone')}>
                                      <Plus aria-hidden />
                                      {tw('addZone')}
                                    </Button>
                                  ),
                                }
                              : {})}
                          />
                        ) : (
                          <>
                            {shown.length === 0 ? (
                              <p className="rz-caption m-0 py-3 text-center">
                                {t('noZonesFound')}
                              </p>
                            ) : (
                              <ul
                                className={cn(
                                  'm-0 grid list-none gap-2 p-0',
                                  !drawer &&
                                    'grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]',
                                )}
                              >
                                {shown.map((zone) => {
                                  const on = selected.includes(zone.id)
                                  const count = partsIn(zone.id)
                                  const load =
                                    count === null
                                      ? 0
                                      : Math.round((count / busiest) * 100)
                                  return (
                                    <li className="min-w-0" key={zone.id}>
                                      <label className="rz-choice-card min-w-0">
                                        <input
                                          aria-label={`${zone.warehouseName} · ${zone.name}`}
                                          checked={on}
                                          className="rz-radio mt-0.5"
                                          disabled={!canManage}
                                          name="placement-location"
                                          onChange={() => chooseZone(zone.id)}
                                          type="radio"
                                        />
                                        <span className="grid min-w-0 flex-1 gap-0.5">
                                          <span className="rz-strong font-semibold break-words">
                                            {zone.name}
                                          </span>
                                          <span className="rz-caption">
                                            <span className="font-mono">
                                              {zone.code}
                                            </span>
                                            {' · '}
                                            {count === null
                                              ? ti('stockUnavailable')
                                              : ti('positions', { count })}
                                          </span>
                                          <span
                                            aria-hidden
                                            className="bg-app-hover mt-1 block h-1 overflow-hidden rounded-full"
                                          >
                                            <span
                                              className={cn(
                                                'block h-full rounded-full',
                                                load >= 100
                                                  ? 'bg-state-danger'
                                                  : load > 0
                                                    ? 'bg-state-warn'
                                                    : 'bg-transparent',
                                              )}
                                              style={{
                                                width: `${String(load)}%`,
                                              }}
                                            />
                                          </span>
                                        </span>
                                      </label>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <SearchInput
                                aria-label={t('zoneSearch')}
                                className="min-w-0 flex-1"
                                onChange={(event) =>
                                  setQuery(event.target.value)
                                }
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
                          </>
                        )}
                      </Step>
                    )}

                    {hasPhysicalZone ? (
                      <div
                        className={cn(
                          'grid min-w-0 items-start gap-[14px]',
                          !drawer && selectedSectionId && 'md:grid-cols-2',
                        )}
                      >
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
                            <div className="grid gap-2">
                              <label className="rz-choice-card">
                                <input
                                  type="radio"
                                  name="placement-section"
                                  className="rz-radio mt-0.5"
                                  disabled={!canManage || selected.length === 0}
                                  checked={!selectedSectionId}
                                  onChange={() => {
                                    setSectionSelection(null)
                                    setShelfSelection(null)
                                  }}
                                />
                                <span className="min-w-0">
                                  {t('noSection')}
                                </span>
                              </label>
                              {availableSections.map((section) => (
                                <label
                                  className="rz-choice-card"
                                  key={section.id}
                                >
                                  <input
                                    type="radio"
                                    name="placement-section"
                                    className="rz-radio mt-0.5"
                                    disabled={!canManage}
                                    checked={selectedSectionId === section.id}
                                    onChange={() => {
                                      setSectionSelection(section.id)
                                      setShelfSelection(null)
                                    }}
                                  />
                                  <span className="min-w-0 break-words">
                                    {section.zoneName} · {section.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </Step>

                        {selectedSectionId ? (
                          <Step
                            number="04"
                            title={t('shelf')}
                            hint={t('shelfHint')}
                          >
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
                              <div className="grid gap-2">
                                <label className="rz-choice-card">
                                  <input
                                    type="radio"
                                    name="placement-shelf"
                                    className="rz-radio mt-0.5"
                                    disabled={!canManage || !selectedSectionId}
                                    checked={!selectedShelfId}
                                    onChange={() => setShelfSelection(null)}
                                  />
                                  <span className="min-w-0">
                                    {t('noShelf')}
                                  </span>
                                </label>
                                {availableShelves.map((shelf) => (
                                  <label
                                    className="rz-choice-card"
                                    key={shelf.id}
                                  >
                                    <input
                                      type="radio"
                                      name="placement-shelf"
                                      className="rz-radio mt-0.5"
                                      disabled={!canManage}
                                      checked={selectedShelfId === shelf.id}
                                      onChange={() =>
                                        setShelfSelection(shelf.id)
                                      }
                                    />
                                    <span className="min-w-0 break-words">
                                      {shelf.zoneName} · {shelf.sectionName} ·{' '}
                                      {shelf.name}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </Step>
                        ) : null}
                      </div>
                    ) : null}

                    <Step
                      hint={t('quantityHint')}
                      number={
                        selectedSectionId ? '05' : hasPhysicalZone ? '04' : '03'
                      }
                      title={t('quantity')}
                    >
                      <div className="flex flex-wrap items-center gap-4">
                        <span
                          className="border-app-line text-app-muted flex items-center gap-1 rounded-control border p-0.5"
                          title={t('notSplitTitle')}
                        >
                          <span
                            aria-hidden
                            className="grid size-7 place-items-center opacity-40"
                          >
                            −
                          </span>
                          <span className="rz-mono rz-strong w-10 text-center">
                            {part?.quantityTotal ?? '—'}
                          </span>
                          <span
                            aria-hidden
                            className="grid size-7 place-items-center opacity-40"
                          >
                            +
                          </span>
                        </span>
                        <p className="rz-caption m-0 min-w-[12rem] flex-1">
                          {t('notSplit')}
                        </p>
                      </div>
                    </Step>

                    {!drawer ? (
                      <Card
                        aside={
                          <span className="rz-th-label">
                            {t('records', { count: moves.length })}
                          </span>
                        }
                        bodyClassName="p-0"
                        className="min-w-0"
                        title={t('historyTitle')}
                      >
                        {moves.length === 0 ? (
                          <p className="rz-caption m-0 px-[var(--rz-card-p)] py-4">
                            {history === null
                              ? t('historyHidden')
                              : t('neverMoved')}
                          </p>
                        ) : (
                          <ul className="m-0 grid list-none p-0">
                            {moves.slice(0, 8).map((event, index) => (
                              <li
                                className={cn(
                                  'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-[var(--rz-card-p)] py-2',
                                  index > 0 && 'border-app-line border-t',
                                )}
                                key={event.id}
                              >
                                <span className="rz-strong w-28 shrink-0 font-medium">
                                  {historyLabel(event.eventType, locale)}
                                </span>
                                <span className="text-app-muted min-w-0 flex-1">
                                  {historyDetails(event.data, locale).join(
                                    ' · ',
                                  )}
                                </span>
                                <span className="rz-mono rz-dim whitespace-nowrap">
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
                      className="rz-card min-w-0 lg:sticky lg:top-[calc(var(--rz-topbar-h)+16px)]"
                    >
                      <header className="rz-card__head py-2.5">
                        <h2 className="rz-h-card">{t('newPlacement')}</h2>
                      </header>
                      <dl className="m-0 px-[var(--rz-card-p)] py-1">
                        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2">
                          <dt className="text-app-muted">
                            {t('locationLevel')}
                          </dt>
                          <dd className="rz-strong m-0 font-semibold">
                            {chosen.length > 0 ? (
                              <ul className="m-0 grid list-none gap-1 p-0">
                                {chosen.map((zone) => (
                                  <li
                                    className="min-w-0 break-words"
                                    key={zone.id}
                                  >
                                    {levelOf(zone)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-app-muted font-normal">
                                {t('noLocationSelected')}
                              </span>
                            )}
                          </dd>
                        </div>
                        {placement.length > 0 ? (
                          <div className="border-app-line grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-t py-2">
                            <dt className="text-app-muted">{t('before')}</dt>
                            <dd className="text-app-muted m-0 break-words">
                              {placement
                                .map((zone) =>
                                  zone.isSystemUnassigned
                                    ? `${zone.warehouseName} → ${t('warehouseLevel')}`
                                    : `${zone.warehouseName} → ${zone.zoneName}`,
                                )
                                .join(', ')}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className="grid gap-3 px-[var(--rz-card-p)] pt-3.5 pb-4">
                        <p className="rz-caption m-0 text-pretty">
                          {selected.length === 0
                            ? t('pickOne')
                            : changed
                              ? t('replacesAll')
                              : t('unchanged')}
                        </p>
                        {canManage ? (
                          <Button
                            aria-busy={saving}
                            className="w-full"
                            disabled={saving || !canSaveSelection}
                            onClick={() => void save(!changed)}
                            variant="primary"
                          >
                            {saving ? t('saving') : t('savePlacement')}
                          </Button>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
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
                pending || resource.state.kind !== 'ready' || !canSaveSelection
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
      <div data-placement-drawer={partId}>{content}</div>
    </Sheet>
  )
}
