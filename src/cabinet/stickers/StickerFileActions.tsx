import { Download, Share2 } from 'lucide-react'
import { Button } from '@/components/app'
import { useT } from '@/i18n'
import { stickersMessages } from './messages'
import type { StickerFileFormat } from './sticker-file-output'

/** File actions always export the selection, or the next batch when nothing is selected. */
export function StickerFileActions({
  count,
  source,
  disabled,
  onOutput,
}: {
  count: number
  source: 'selection' | 'batch'
  disabled: boolean
  onOutput: (format: StickerFileFormat) => void
}) {
  const t = useT(stickersMessages)
  if (!count) return null
  return (
    <div className="grid gap-2">
      <p className="rz-caption m-0">
        {t(source === 'selection' ? 'filesSelection' : 'filesBatch', { count })}
      </p>
      <Button disabled={disabled} onClick={() => onOutput('pdf')}>
        {t('pdf', { count })}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-w-0"
          disabled={disabled}
          onClick={() => onOutput('download')}
        >
          <Download aria-hidden />
          {t('download')}
        </Button>
        <Button
          className="min-w-0"
          disabled={disabled}
          onClick={() => onOutput('share')}
        >
          <Share2 aria-hidden />
          {t('share')}
        </Button>
      </div>
      <p className="rz-caption m-0">{t('pdfHint')}</p>
    </div>
  )
}
