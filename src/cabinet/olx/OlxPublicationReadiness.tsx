import { ArrowUpRight } from 'lucide-react'
import type { OlxConnection } from '@/api/olx'
import { Button, Notice } from '@/components/app'
import { useT } from '@/i18n'
import { olxPublicationMessages } from './olx-publication-messages'

export function OlxPublicationReadiness({
  connection,
  canManage,
  onGrant,
  busy = false,
  error,
  showReady = false,
}: {
  connection: OlxConnection
  canManage: boolean
  onGrant: () => void
  busy?: boolean
  error?: string | null
  showReady?: boolean
}) {
  const t = useT(olxPublicationMessages)
  if (
    connection.mode !== 'oauth' ||
    !connection.available ||
    !connection.connected ||
    connection.reconnectRequired
  )
    return null

  if (connection.writesAvailable === false)
    return <Notice tone="info">{t('publicationUnavailable')}</Notice>

  if (connection.scope?.split(/\s+/).includes('write'))
    return showReady ? <Notice tone="ok">{t('publicationReady')}</Notice> : null

  if (!connection.writesAvailable) return null

  return (
    <div className="grid min-w-0 gap-2">
      <Notice
        className="max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:items-start"
        action={
          canManage && (
            <Button
              size="sm"
              aria-busy={busy}
              disabled={busy}
              onClick={onGrant}
              className="max-sm:col-start-2 max-sm:justify-self-start"
            >
              <ArrowUpRight aria-hidden />
              {t('grant')}
            </Button>
          )
        }
      >
        {t(canManage ? 'grantHint' : 'grantByManager')}
      </Notice>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
