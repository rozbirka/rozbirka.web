import { useState } from 'react'
import { Button, Sheet } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { OlxPreparationPanel } from './OlxPreparationPanel'
import { olxBatchMessages } from './olx-batch-messages'

export function OlxQueueRepairSheet({
  partId,
  partLabel,
  partHref,
  listingHref,
  accountId,
  jobRevision,
  canSeeDiagnostics,
  providerFields,
  trigger,
  onClose,
  onRetry,
  retryFailure,
}: {
  partId: string
  partLabel: string
  partHref: string
  listingHref?: string | undefined
  accountId: string
  jobRevision: string
  canSeeDiagnostics: boolean
  providerFields: readonly string[] | null
  trigger: HTMLButtonElement | null
  onClose: () => void
  onRetry: (revision: string, signal: AbortSignal) => Promise<void>
  retryFailure: (failure: unknown) => string
}) {
  const t = useT(olxBatchMessages)
  const tc = useT(commonMessages)
  const { requireLatestMutation } = useLatestMutationGuard(cabinetModules.parts)
  const [footer, setFooter] = useState<HTMLDivElement | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <Sheet
      open
      title={t('queueRepairTitle')}
      description={partLabel}
      pending={pending}
      className="sm:w-[min(520px,100vw)]"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onCloseAutoFocus={(event) => {
        if (trigger?.isConnected) {
          event.preventDefault()
          trigger.focus()
        }
      }}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <div ref={setFooter} className="rz-btn-row" />
        </>
      }
    >
      <OlxPreparationPanel
        id={partId}
        canEdit
        canSeeDiagnostics={canSeeDiagnostics}
        partHref={partHref}
        actionsTarget={footer}
        onMutationBusy={setPending}
        repair={{
          accountId,
          jobRevision,
          providerFields,
          listingHref,
          mutationSignal: () =>
            requireLatestMutation({
              permission: 'olx.publications.manage',
              quota: false,
            }).signal,
          onRetry,
          retryFailure,
        }}
      />
    </Sheet>
  )
}
