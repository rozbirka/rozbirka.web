import type { PartOlxStatus } from '@/api/parts'
import type { OlxLivePublication } from '@/api/olx-live'
import { useT } from '@/i18n'
import {
  olxPublicationFailures,
  olxPublicationMessages,
} from '../olx/olx-publication-messages'
import { useOlxPublicationStatus } from '../olx/use-olx-publication-status'
import { olxLiveMessages } from '../olx/olx-live-messages'
import { partMarketplaceMessages } from './part-marketplace-messages'

export function usePartOlxPresentation(
  status: PartOlxStatus | OlxLivePublication | null,
  hasStock = true,
  canSeeDiagnostics = false,
) {
  const t = useT(partMarketplaceMessages)
  const tp = useT(olxPublicationMessages)
  const tl = useT(olxLiveMessages)
  const presentation = useOlxPublicationStatus(status)
  const publication = status && 'canLinkExisting' in status ? status : null
  const attention =
    status && 'needsAttention' in status && status.needsAttention
  const error = publication?.error
  const errorMessage =
    canSeeDiagnostics && error && Object.hasOwn(olxPublicationFailures, error)
      ? tp(olxPublicationFailures[error]!)
      : null
  const excluded = publication?.excluded === true
  const moderationReason = canSeeDiagnostics
    ? publication?.moderationReason?.trim()
    : null
  let reason = errorMessage
  if (moderationReason) reason = moderationReason

  if (!reason && status) {
    const observed = status.observedStatus
    if (observed === 'unpaid') reason = t('payInOlx')
    else if (observed === 'limited') reason = t('limitedReason')
    else if (observed === 'removed_by_user') {
      if (publication?.requiresManualRestore === false && !hasStock)
        reason = t('stockRemoval')
      else reason = t('manualRemoval')
    } else if (['new', 'unconfirmed'].includes(observed ?? ''))
      reason = t('processingReason')
    else if (attention || error || status.state === 'rejected')
      reason = canSeeDiagnostics
        ? t('reasonUnavailable')
        : publication
          ? tp('diagnosticsRestricted')
          : tl('attention')
  }
  return {
    label: excluded ? t('excluded') : presentation.label,
    tone: excluded ? ('neutral' as const) : presentation.tone,
    reason,
    attention,
    excluded,
  }
}
