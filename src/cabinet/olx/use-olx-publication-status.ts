import type { OlxLivePublication } from '@/api/olx-live'
import type { StatusTone } from '@/components/app'
import { useT } from '@/i18n'
import {
  olxAdvertStatuses,
  olxAdvertTone,
  olxLiveMessages,
} from './olx-live-messages'
import { olxPublicationMessages } from './olx-publication-messages'

const states = [
  'draft',
  'creating',
  'unknown',
  'linked',
  'update_pending',
  'updating',
  'remove_pending',
  'restore_pending',
  'removing',
  'removed',
  'deleted',
  'delete_unknown',
  'rejected',
] as const

export function useOlxPublicationStatus(
  publication: Pick<
    OlxLivePublication,
    'state' | 'observedStatus' | 'revision'
  > | null,
  editing = false,
) {
  const t = useT(olxPublicationMessages)
  const tl = useT(olxLiveMessages)
  const state = states.find((x) => x === publication?.state) ?? 'unknown'
  const providerStatus = olxAdvertStatuses.find(
    (status) => status === publication?.observedStatus,
  )
  const providerLabel = publication?.observedStatus
    ? providerStatus === 'removed_by_user'
      ? t('removed')
      : providerStatus
        ? tl(providerStatus)
        : tl('unknown', { status: publication?.observedStatus })
    : null
  const label =
    !editing && state === 'linked' && providerLabel
      ? providerLabel
      : !editing && state === 'draft' && !publication?.revision
        ? t('notPublished')
        : t(state)
  const tone: StatusTone =
    state === 'linked' && providerStatus
      ? olxAdvertTone(providerStatus)
      : state === 'rejected'
        ? 'danger'
        : state === 'remove_pending'
          ? 'warn'
          : [
                'creating',
                'unknown',
                'update_pending',
                'updating',
                'removing',
                'restore_pending',
                'delete_unknown',
              ].includes(state)
            ? 'info'
            : 'neutral'
  return { state, providerStatus, providerLabel, label, tone }
}
