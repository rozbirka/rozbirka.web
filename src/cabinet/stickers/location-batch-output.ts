import type { LocationLabelQueue } from '../inventory/location-label-queue'
import { nextLabelBatch } from '../inventory/location-label-queue'
import type { PrintableZoneLabel } from '../inventory/zone-label-output'

/** Never silently replace or skip an unavailable queued location. */
export function resolveLocationBatch(
  queue: LocationLabelQueue,
  labels: readonly PrintableZoneLabel[],
): PrintableZoneLabel[] {
  const byId = new Map(labels.map((label) => [label.id, label]))
  return nextLabelBatch(queue).map((id) => {
    const label = byId.get(id)
    if (!label?.qrCode.trim() || label.kind !== queue.target.kind)
      throw new Error('queued-location-unavailable')
    return label
  })
}
