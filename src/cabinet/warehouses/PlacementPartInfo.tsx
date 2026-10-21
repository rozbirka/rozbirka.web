import { StatusPill } from '@/components/app'
import { useFormat, useT } from '@/i18n'
import { placementMessages } from '../inventory/placement-messages'
import { locationContentsMessages } from '../inventory/location-contents-messages'
import { unassignedMessages } from './unassigned-messages'

/** Shared part details for single and bulk warehouse placement. */
export function PlacementPartInfo({
  name,
  oemCode,
  code,
  quantity,
  unit,
  status,
  car,
}: {
  name: string
  oemCode?: string | null
  code?: string | null
  quantity: number
  unit: string
  status: string
  car?: string | null
}) {
  const t = useT(unassignedMessages)
  const tp = useT(placementMessages)
  const tl = useT(locationContentsMessages)
  const f = useFormat()
  return (
    <span className="grid min-w-0 flex-1 gap-0.5">
      <span className="rz-strong font-semibold break-words">{name}</span>
      {oemCode ? (
        <span className="rz-mono rz-dim text-caption break-all">{oemCode}</span>
      ) : null}
      <span className="rz-caption flex flex-wrap items-center gap-2">
        <span>
          {tp('inStock', {
            count: f.number(quantity) ?? String(quantity),
            unit,
          })}
        </span>
        <StatusPill
          tone={
            status === 'sold' ? 'danger' : status === 'reserved' ? 'warn' : 'ok'
          }
        >
          {tl(
            status === 'sold'
              ? 'sold'
              : status === 'reserved'
                ? 'reserved'
                : 'available',
          )}
        </StatusPill>
      </span>
      {code ? (
        <span className="rz-caption rz-mono break-all">
          {t('externalCode', { code })}
        </span>
      ) : null}
      {car ? <span className="rz-caption">{car}</span> : null}
    </span>
  )
}
