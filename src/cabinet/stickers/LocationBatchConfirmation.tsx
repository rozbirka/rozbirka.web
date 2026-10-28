import { Button, Notice } from '@/components/app'
import { useT } from '@/i18n'
import { locationLabelMessages } from '../inventory/location-label-messages'
import { locationStickersMessages } from './location-stickers-messages'

export function LocationBatchConfirmation({
  onAll,
  onPartial,
  onNone,
}: {
  onAll: () => void
  onPartial: () => void
  onNone: () => void
}) {
  const t = useT(locationLabelMessages),
    ts = useT(locationStickersMessages)
  return (
    <section aria-label={ts('confirmResult')} className="grid gap-2">
      <Notice tone="warn">{t('confirmHint')}</Notice>
      <div className="rz-btn-row flex-wrap">
        <Button variant="primary" onClick={onAll}>
          {ts('allPrinted')}
        </Button>
        <Button onClick={onPartial}>{ts('partlyPrinted')}</Button>
        <Button variant="quiet" onClick={onNone}>
          {ts('nothingPrinted')}
        </Button>
      </div>
    </section>
  )
}
