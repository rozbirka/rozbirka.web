import { RefreshCw } from 'lucide-react'
import { Button, Notice } from '@/components/app'
import { useT } from '@/i18n'
import { useInventoryFormat } from './inventory-format'
import { inventoryMessages } from './messages'
import type { LoadState } from './use-stock-resource'

export function InventoryRefreshStatus({
  state,
  refresh,
}: {
  state: LoadState<unknown>
  refresh: () => void
}) {
  const t = useT(inventoryMessages)
  const { date } = useInventoryFormat()
  if (state.kind !== 'ready') return null
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-app-dim text-body">
          {state.updatedAt === null
            ? null
            : t('updatedAt', {
                date: date(new Date(state.updatedAt).toISOString()),
              })}
        </p>
        <Button
          onClick={refresh}
          disabled={state.refreshing}
          aria-busy={state.refreshing}
        >
          <RefreshCw aria-hidden className="size-4" />
          {state.refreshing ? t('refreshing') : t('refresh')}
        </Button>
      </div>
      {state.refreshError ? (
        <Notice
          tone="warn"
          action={
            <Button onClick={refresh} disabled={state.refreshing}>
              {t('retry')}
            </Button>
          }
        >
          {t('refreshFailed')}
        </Notice>
      ) : null}
    </div>
  )
}
