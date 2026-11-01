import { ConfirmDialog, Notice } from '@/components/app'
import { useT } from '@/i18n'
import { locationLabelMessages } from '../inventory/location-label-messages'
import { locationStickersMessages } from './location-stickers-messages'
import { partQueueMessages } from './part-queue-messages'
import { PART_BATCH_SIZE } from './part-print-queue'
import { PrintQueueCard } from './PrintQueueCard'
import { PrintBatchConfirmation } from './PrintBatchConfirmation'
import { PrintQueueEditor } from './PrintQueueEditor'
import type { usePartStickerPrinting } from './use-part-sticker-printing'
export function PartPrintQueuePanel({
  printing,
  disabled,
}: {
  printing: ReturnType<typeof usePartStickerPrinting>
  disabled: boolean
}) {
  const t = useT(locationLabelMessages),
    ts = useT(locationStickersMessages),
    tp = useT(partQueueMessages)
  const { queue, expected, pending, editor, cancel, preview } = printing
  const byCopy = new Map(preview.map((copy) => [copy.id, copy]))
  const counts = new Map<string, number>()
  const entries =
    queue?.remaining.map((copy) => {
      const number = (counts.get(copy.partId) ?? 0) + 1
      counts.set(copy.partId, number)
      const name = byCopy.get(copy.id)?.name ?? copy.name ?? tp('unavailable')
      return {
        id: copy.id,
        name: `${name} · ${tp('copy', { number })}`,
        code: copy.externalCode ?? '',
      }
    }) ?? []
  return (
    <>
      {queue ? (
        <PrintQueueCard
          queue={{ ...queue, remainingCount: queue.remaining.length }}
          context={ts('parts')}
          count={Math.min(PART_BATCH_SIZE, queue.remaining.length)}
          busy={printing.busy || disabled}
          sameCollection
          onPrint={() => void printing.output('print')}
          onPdf={() => void printing.output('pdf')}
          onManage={printing.edit}
          onCancel={printing.cancelQueue}
          onContinue={() => undefined}
        />
      ) : null}
      {pending ? (
        <PrintBatchConfirmation
          onAll={() => printing.confirm(pending.ids)}
          onPartial={printing.partial}
          onNone={printing.nothing}
        />
      ) : null}
      {printing.persistenceError ? (
        <Notice tone="warn">{ts('storageError')}</Notice>
      ) : null}
      {printing.error ? <Notice tone="danger">{printing.error}</Notice> : null}
      {printing.message ? <Notice tone="ok">{printing.message}</Notice> : null}
      {editor && expected ? (
        <PrintQueueEditor
          key={`${editor.expected.queueId}:${editor.expected.revision}:${editor.mode}`}
          ids={editor.ids}
          entries={entries}
          mode={editor.mode}
          onClose={printing.closeEditor}
          onSubmit={printing.submitEditor}
        />
      ) : null}
      <ConfirmDialog
        open={!!cancel}
        onOpenChange={(open) => {
          if (!open) printing.closeCancel()
        }}
        title={t('cancelTitle')}
        consequence={t('cancelHint')}
        confirmLabel={t('cancelQueue')}
        pending={printing.busy}
        onConfirm={printing.discard}
      />
    </>
  )
}
