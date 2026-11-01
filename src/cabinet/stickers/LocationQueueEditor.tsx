import type { ComponentProps } from 'react'
import type { PrintableZoneLabel } from '../inventory/zone-label-output'
import { PrintQueueEditor } from './PrintQueueEditor'
export function LocationQueueEditor({
  labels,
  ...props
}: Omit<ComponentProps<typeof PrintQueueEditor>, 'entries'> & {
  labels: readonly PrintableZoneLabel[]
}) {
  return (
    <PrintQueueEditor
      {...props}
      entries={labels.map((label) => ({
        id: label.id,
        name: label.zoneName,
        code: label.zoneCode,
      }))}
    />
  )
}
