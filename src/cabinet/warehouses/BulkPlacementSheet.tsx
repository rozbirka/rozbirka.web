import { useCallback, useEffect, useRef, useState } from 'react'
import { inventoryApi } from '@/api/inventory'
import type { PartSearchItem } from '@/api/parts'
import { normalizeApiProblem } from '@/api/errors'
import { Button, Notice, Sheet } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { LocationSelect } from '../inventory/LocationSelect'
import { Resource } from '../inventory/InventoryResource'
import { useLoad } from '../inventory/use-stock-resource'
import { unassignedMessages } from './unassigned-messages'

interface Outcome {
  part: PartSearchItem
  kind: 'placed' | 'skipped' | 'failed'
  message?: string
}

/** Existing per-part writes, with an explicit result and retry set. */
export function BulkPlacementSheet({
  warehouseId,
  sourceZoneId,
  parts,
  onClose,
  onApplied,
}: {
  warehouseId: string
  sourceZoneId: string
  parts: readonly PartSearchItem[]
  onClose: () => void
  onApplied: (ids: ReadonlySet<string>) => void
}) {
  const t = useT(unassignedMessages)
  const tc = useT(commonMessages)
  const loader = useCallback(
    (signal: AbortSignal) => inventoryApi.getWarehouse(warehouseId, { signal }),
    [warehouseId],
  )
  const resource = useLoad(loader, warehouseId)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.warehouses,
  )
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [pending, setPending] = useState(false)
  const [processed, setProcessed] = useState(0)
  const flight = useRef<AbortController | null>(null)
  useEffect(() => () => flight.current?.abort(), [])
  const attempted = outcomes.length > 0
  const remaining = attempted
    ? outcomes.filter((item) => item.kind === 'failed').map((item) => item.part)
    : parts
  const placed = outcomes.filter((item) => item.kind === 'placed').length
  const warehouse = resource.state.kind === 'ready' ? resource.state.data : null
  const zones = warehouse?.isActive
    ? warehouse.zones.filter(
        (zone) => zone.isActive && !zone.isSystemUnassigned,
      )
    : []
  const target = zones.find((zone) => zone.id === zoneId)

  const place = async () => {
    if (flight.current || !target || !remaining.length) return
    const controller = new AbortController()
    flight.current = controller
    setPending(true)
    setProcessed(0)
    const next = outcomes.filter((item) => item.kind !== 'failed')
    const applied = new Set<string>()
    try {
      for (const part of remaining) {
        if (controller.signal.aborted) return
        try {
          const scope = requireLatestMutation({
            permission: 'inventory.zones.manage',
            quota: false,
          })
          const signal = AbortSignal.any([scope.signal, controller.signal])
          const current = await inventoryApi.getPartZones(part.id, { signal })
          if (signal.aborted) return
          if (!current.some((zone) => zone.zoneId === sourceZoneId)) {
            next.push({
              part,
              kind: current.some((zone) => zone.zoneId === target.id)
                ? 'placed'
                : 'skipped',
            })
          } else {
            const physical = current.filter((zone) => !zone.isSystemUnassigned)
            const ids = [
              ...new Set([...physical.map((zone) => zone.zoneId), target.id]),
            ]
            const location =
              physical.find((zone) => zone.shelfId) ??
              physical.find((zone) => zone.sectionId)
            requireLatestMutation({
              permission: 'inventory.zones.manage',
              quota: false,
            })
            await inventoryApi.replacePartZones(
              part.id,
              ids,
              { signal },
              location?.shelfId ?? undefined,
              location?.sectionId ?? undefined,
            )
            if (signal.aborted) return
            next.push({ part, kind: 'placed' })
          }
          applied.add(part.id)
        } catch (error) {
          if (controller.signal.aborted) return
          next.push({
            part,
            kind: 'failed',
            message: normalizeApiProblem(error).message,
          })
        }
        setProcessed((value) => value + 1)
      }
      setOutcomes(next)
      if (applied.size) onApplied(applied)
    } finally {
      if (!controller.signal.aborted) {
        flight.current = null
        setPending(false)
      }
    }
  }

  return (
    <Sheet
      open
      title={t('bulkTitle')}
      eyebrow={warehouse?.name}
      onOpenChange={(open) => {
        if (!open && !flight.current) onClose()
      }}
      footer={
        <>
          <Button disabled={pending} onClick={onClose}>
            {attempted ? t('done') : tc('cancel')}
          </Button>
          {remaining.length ? (
            <Button
              variant="primary"
              disabled={pending || !target}
              aria-busy={pending}
              onClick={() => void place()}
            >
              {pending
                ? t('progress', { count: processed, total: remaining.length })
                : attempted
                  ? t('retryRemaining')
                  : t('place')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-5">
        <p className="text-app-ink text-base font-semibold">
          {t('selectedCount', { count: parts.length })}
        </p>
        <p className="text-app-muted text-sm">{t('bulkHint')}</p>
        <Resource state={resource.state} retry={resource.reload} framed={false}>
          {() => (
            <>
              {!zones.length ? (
                <Notice>
                  {t(warehouse?.isActive ? 'noActiveZones' : 'archived')}
                </Notice>
              ) : (
                <div className="grid gap-2">
                  <p className="text-app-muted text-sm font-semibold">
                    {t('zone')}
                  </p>
                  <LocationSelect
                    label={t('zone')}
                    searchLabel={t('searchZone')}
                    noneLabel={t('chooseZone')}
                    options={zones}
                    value={zoneId}
                    onChange={setZoneId}
                    disabled={pending || attempted}
                  />
                </div>
              )}
            </>
          )}
        </Resource>
        {attempted ? (
          <Notice tone={placed === parts.length ? 'ok' : 'info'}>
            {t('bulkResult', { count: placed, total: parts.length })}
          </Notice>
        ) : null}
        {outcomes.map((item) =>
          item.kind === 'failed' ? (
            <Notice key={item.part.id} tone="danger">
              {item.part.name}: {item.message}
            </Notice>
          ) : item.kind === 'skipped' ? (
            <p key={item.part.id} className="text-app-muted text-sm">
              {t('skipped', { name: item.part.name })}
            </p>
          ) : null,
        )}
        <ul
          className="border-app-line divide-app-line divide-y border-y"
          aria-label={t('selectedParts')}
        >
          {parts.map((part) => (
            <li key={part.id} className="py-3 text-sm">
              <span className="text-app-ink font-semibold">{part.name}</span>
              {part.oemCode ? (
                <span className="text-app-muted ml-3 font-mono">
                  {part.oemCode}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
