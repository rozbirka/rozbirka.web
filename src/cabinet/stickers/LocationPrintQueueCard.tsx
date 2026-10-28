import { Button } from '@/components/app'
import { useT } from '@/i18n'
import { locationLabelMessages } from '../inventory/location-label-messages'
import type { LocationLabelQueue } from '../inventory/location-label-queue'
import { LOCATION_LABEL_BATCH } from '../inventory/location-label-queue'
import { locationStickersMessages } from './location-stickers-messages'

export function LocationPrintQueueCard({
  queue,
  busy,
  sameCollection,
  onPrint,
  onPdf,
  onContinue,
  onManage,
  onCancel,
}: {
  queue: LocationLabelQueue
  busy: boolean
  sameCollection: boolean
  onPrint: () => void
  onPdf: () => void
  onContinue: () => void
  onManage: () => void
  onCancel: () => void
}) {
  const t = useT(locationLabelMessages),
    ts = useT(locationStickersMessages)
  const count = Math.min(LOCATION_LABEL_BATCH, queue.remainingIds.length)
  return (
    <section className="rz-card" aria-label={t('queue')}>
      <div className="rz-card__body grid gap-3">
        <div>
          <h2 className="rz-h-card">
            {t('queue')} · {t(queue.target.kind)} · {queue.target.parentName}
          </h2>
          <p className="rz-muted m-0 mt-1" role="status">
            {t('progress', {
              printed: queue.printedCount,
              total: queue.totalCount,
              remaining: queue.remainingIds.length,
            })}
          </p>
        </div>
        <progress
          className="h-2 w-full accent-brand"
          aria-label={t('queue')}
          value={queue.printedCount}
          max={queue.totalCount}
        />
        <div className="rz-btn-row flex-wrap">
          {sameCollection ? (
            <>
              <Button disabled={busy} onClick={onPrint} variant="primary">
                {ts('printNext', { count })}
              </Button>
              <Button disabled={busy} onClick={onPdf}>
                {ts('pdfNext', { count })}
              </Button>
              <Button disabled={busy} onClick={onManage}>
                {t('editQueue')}
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={onContinue}>
              {t('continue')}
            </Button>
          )}
          <Button disabled={busy} onClick={onCancel} variant="quiet">
            {t('cancelQueue')}
          </Button>
        </div>
        {sameCollection ? (
          <p className="rz-caption m-0">{t('pdfHint')}</p>
        ) : null}
      </div>
    </section>
  )
}
