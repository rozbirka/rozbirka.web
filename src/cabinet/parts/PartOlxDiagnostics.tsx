import { Link } from 'react-router'
import {
  Button,
  Card,
  DateValue,
  EmptyState,
  ErrorState,
  SkeletonRows,
  StatusPill,
} from '@/components/app'
import { useT } from '@/i18n'
import { olxIssueKeys, olxLiveMessages } from '../olx/olx-live-messages'
import {
  olxProviderFieldLabel,
  olxPublicationMessages,
  readOlxProviderIssue,
} from '../olx/olx-publication-messages'
import { partMarketplaceMessages } from './part-marketplace-messages'
import {
  usePartOlxConnection,
  usePartOlxPublication,
} from './part-olx-marketplace'
import { usePartOlxPresentation } from './use-part-olx-presentation'

export function PartOlxDiagnostics({
  partId,
  settingsHref,
}: {
  partId: string
  settingsHref: string
}) {
  const t = useT(partMarketplaceMessages)
  const tp = useT(olxPublicationMessages)
  const tl = useT(olxLiveMessages)
  const connection = usePartOlxConnection()
  const account = connection.result
  const connected =
    account?.available === true && account.mode === 'oauth' && account.connected
  const publication = usePartOlxPublication(connected ? partId : undefined)
  const { label, tone, reason } = usePartOlxPresentation(
    publication.result ?? null,
    undefined,
    true,
  )

  if (account === null || (connected && publication.result === null))
    return (
      <ErrorState
        title={tp('loadPublicationError')}
        onRetry={account === null ? connection.retry : publication.retry}
      />
    )
  if (account === undefined || (connected && publication.result === undefined))
    return <SkeletonRows rows={3} label={tp('loadingPublication')} />
  if (!connected)
    return (
      <EmptyState
        title={tp('partTabDisconnected')}
        description={tp('connectHint')}
        actions={
          <Button asChild>
            <Link to={settingsHref}>{tp('partTabIntegrations')}</Link>
          </Button>
        }
      />
    )

  const issues = new Set<string>()
  for (const issue of publication.result?.errorFields ?? []) {
    const local = olxIssueKeys.find((key) => key === issue)
    if (local) {
      issues.add(tl(local))
      continue
    }
    const { field, reason } = readOlxProviderIssue(issue)
    const label = olxProviderFieldLabel(field)
    if (label) issues.add(reason ? `${tp(label)} · ${tp(reason)}` : tp(label))
  }

  return (
    <Card title={t('diagnosticsTitle')} bodyClassName="grid gap-2">
      <div>
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
      {reason && <p className="text-app-muted break-words">{reason}</p>}
      {issues.size > 0 && (
        <div>
          <p className="rz-caption">{tp('partTabIssues')}</p>
          <ul className="text-app-muted list-disc pl-5">
            {[...issues].map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {publication.result?.checkedAt && (
        <p className="rz-caption">
          {t('checked')} <DateValue value={publication.result.checkedAt} />
        </p>
      )}
    </Card>
  )
}
