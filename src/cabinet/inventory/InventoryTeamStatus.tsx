import { Button, Notice, SkeletonRows } from '@/components/app'
import { useT } from '@/i18n'
import { inventoryMessages } from './messages'
import type { useInventoryTeam } from './use-inventory-team'

export function InventoryTeamStatus({
  team,
}: {
  team: ReturnType<typeof useInventoryTeam>
}) {
  const t = useT(inventoryMessages)
  if (!team.allowed) return null
  if (team.state.kind === 'loading') {
    return <SkeletonRows embedded label={t('teamLoading')} rows={1} />
  }
  const stale = team.state.kind === 'ready' && team.state.refreshError
  if (team.state.kind !== 'error' && !stale) return null
  const pending = team.state.kind === 'ready' && team.state.refreshing
  return (
    <Notice
      tone={stale ? 'warn' : 'danger'}
      action={
        <Button onClick={team.refresh} disabled={pending}>
          {t('retry')}
        </Button>
      }
    >
      {t(stale ? 'teamRefreshFailed' : 'teamLoadFailed')}
    </Notice>
  )
}
