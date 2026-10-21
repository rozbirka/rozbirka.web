import { Button, Notice } from '@/components/app'
import { useT } from '@/i18n'
import { inventoryMessages } from '../inventory/messages'
import { warehouseMessages } from '../inventory/warehouse-messages'

export function WarehouseStatisticsError({
  onRetry,
  pending,
}: {
  onRetry: () => void
  pending: boolean
}) {
  const t = useT(warehouseMessages)
  const ti = useT(inventoryMessages)
  return (
    <Notice
      tone="warn"
      action={
        <Button disabled={pending} aria-busy={pending} onClick={onRetry}>
          {ti('retry')}
        </Button>
      }
    >
      {t('statisticsFailed')}
    </Notice>
  )
}
