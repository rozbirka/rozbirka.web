import type { ReactNode } from 'react'
import { Button } from '@/components/app'
import { useT } from '@/i18n'
import { locationLabelMessages } from '../inventory/location-label-messages'
import { locationStickersMessages } from './location-stickers-messages'

export function PrintQueueCard({
  queue,
  context,
  count,
  busy,
  sameCollection,
  onPrint,
  onPdf,
  onContinue,
  onManage,
  onCancel,
}: {
  queue: { totalCount: number; printedCount: number; remainingCount: number }
  context: ReactNode
  count: number
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
  return (
    <section className="rz-card" aria-label={t('queue')}>
      <div className="rz-card__body grid gap-3">
        <div>
          <h2 className="rz-h-card">
            {t('queue')} · {context}
          </h2>
          <p className="rz-muted m-0 mt-1" role="status">
            {t('progress', {
              printed: queue.printedCount,
              total: queue.totalCount,
              remaining: queue.remainingCount,
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
