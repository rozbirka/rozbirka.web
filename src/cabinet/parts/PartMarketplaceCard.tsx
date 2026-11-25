import { ChevronRight, EyeOff } from 'lucide-react'
import { Link } from 'react-router'
import { partsApi } from '@/api/parts'
import { Card, DateValue, SkeletonRows, StatusPill } from '@/components/app'
import { useT } from '@/i18n'
import { olxLiveMessages } from '../olx/olx-live-messages'
import { usePartOlxPresentation } from './use-part-olx-presentation'
import {
  usePartOlxConnection,
  usePartOlxPublication,
  usePartOlxRead,
} from './part-olx-marketplace'
import { partMarketplaceMessages } from './part-marketplace-messages'

// Core ranks an exact QR match first. Match the ID as well, since the search
// can also return matches in other fields.
const readSummary = (qrCode: string, signal: AbortSignal) =>
  partsApi.search({ query: qrCode, pageSize: 1 }, { signal })

export function PartMarketplaceCard({
  partId,
  qrCode,
  href,
  hasStock,
  canManagePublications,
  canSeeDiagnostics,
}: {
  partId: string
  qrCode: string | undefined
  href: string | null
  hasStock: boolean
  canManagePublications: boolean
  canSeeDiagnostics: boolean
}) {
  const t = useT(partMarketplaceMessages)
  const tl = useT(olxLiveMessages)
  const connection = usePartOlxConnection(canManagePublications)
  const { accountId } = connection
  const publication = usePartOlxPublication(accountId ? partId : undefined)
  const summary = usePartOlxRead(
    readSummary,
    !canManagePublications || (connection.result !== undefined && !accountId)
      ? qrCode
      : undefined,
  )
  const part = summary.result?.items.find(({ id }) => id === partId)
  const status = accountId ? publication.result : (part?.olx ?? null)
  const { label, tone, reason, excluded } = usePartOlxPresentation(
    status ?? null,
    hasStock,
    canManagePublications && canSeeDiagnostics,
  )

  if (!accountId && (!part || !summary.result?.olxConnected)) return null

  const rowClass =
    'grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3'
  const summaryRow = (
    <>
      <span aria-hidden className="rz-code px-2 py-1">
        OLX
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="text-app-strong flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          OLX
          {(!accountId || status) && (
            <StatusPill
              className="h-auto min-h-5 max-w-full whitespace-normal"
              tone={tone}
            >
              {excluded && <EyeOff aria-hidden className="size-3" />}
              {label}
            </StatusPill>
          )}
        </span>
        {accountId && status === null && (
          <span className="rz-caption">{t('checkDraft')}</span>
        )}
        {reason && <span className="rz-caption break-words">{reason}</span>}
        {status?.checkedAt && (
          <span className="rz-caption">
            {t('checked')} <DateValue value={status.checkedAt} />
          </span>
        )}
      </span>
      {href && <ChevronRight aria-hidden className="text-app-dim size-4" />}
    </>
  )
  return (
    <Card title={t('title')} bodyClassName="p-0">
      {status === undefined ? (
        <div className="px-4 py-3">
          <SkeletonRows rows={1} label={tl('loading')} />
        </div>
      ) : href ? (
        <Link
          to={href}
          className={`${rowClass} hover:bg-app-hover focus-visible:ring-brand focus-visible:ring-1 focus-visible:ring-inset`}
        >
          {summaryRow}
        </Link>
      ) : (
        <div className={rowClass}>{summaryRow}</div>
      )}
    </Card>
  )
}
