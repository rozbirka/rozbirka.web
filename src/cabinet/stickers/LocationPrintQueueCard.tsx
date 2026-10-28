import { useT } from '@/i18n'
import { locationLabelMessages } from '../inventory/location-label-messages'
import {
  LOCATION_LABEL_BATCH,
  type LocationLabelQueue,
} from '../inventory/location-label-queue'
import { PrintQueueCard } from './PrintQueueCard'
import type { ComponentProps } from 'react'
export function LocationPrintQueueCard({
  queue,
  ...props
}: Omit<
  ComponentProps<typeof PrintQueueCard>,
  'queue' | 'context' | 'count'
> & { queue: LocationLabelQueue }) {
  const t = useT(locationLabelMessages)
  return (
    <PrintQueueCard
      {...props}
      queue={{ ...queue, remainingCount: queue.remainingIds.length }}
      count={Math.min(LOCATION_LABEL_BATCH, queue.remainingIds.length)}
      context={
        <>
          {t(queue.target.kind)} · {queue.target.parentName}
        </>
      }
    />
  )
}
