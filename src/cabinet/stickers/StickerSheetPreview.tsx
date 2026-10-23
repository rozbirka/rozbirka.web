import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { stickersMessages } from './messages'

export interface StickerPreviewCard {
  id: string
  name: string
  detail?: string | null
  qrSvg?: string | null
}
/** The same sheet preview for parts and physical storage labels. */
export function StickerSheetPreview({
  cards,
  objects,
  total,
  actions,
  children,
}: {
  cards: StickerPreviewCard[]
  objects: number
  total: number
  actions: ReactNode
  children?: ReactNode
}) {
  const t = useT(stickersMessages)
  return (
    <section
      data-slot="sticker-sheet-preview"
      aria-label={t('sheetLabel')}
      className="rz-card xl:sticky xl:top-14"
    >
      <div data-slot="sticker-sheet-header" className="rz-card__head">
        <h2 className="rz-h-card">{t('sheet')}</h2>
        <span className="rz-caption">{t('preview')}</span>
      </div>
      <div data-slot="sticker-sheet-body" className="rz-card__body grid gap-3">
        {/* Paper is black on white whatever the cabinet theme (.rz-paper). */}
        <div className="rz-inset grid grid-cols-2 gap-1.5 p-3">
          {Array.from({ length: 6 }, (_, index) => {
            const sticker = cards[index]
            return sticker ? (
              <article
                aria-label={t('previewSticker', { name: sticker.name })}
                className="rz-paper grid min-h-[88px] grid-cols-[42px_minmax(0,1fr)] content-center gap-2 overflow-hidden rounded-rz-xs p-2"
                key={`${sticker.id}-${String(index)}`}
              >
                {sticker.qrSvg ? (
                  <div
                    aria-label={t('qrCode', { name: sticker.name })}
                    className="grid size-[42px] place-items-center overflow-hidden [&>svg]:block [&>svg]:size-full"
                    dangerouslySetInnerHTML={{ __html: sticker.qrSvg }}
                    role="img"
                  />
                ) : (
                  <div className="rz-mono grid size-[42px] place-items-center border border-dashed border-current text-micro opacity-60">
                    QR
                  </div>
                )}
                <div className="min-w-0 self-center">
                  <p className="m-0 line-clamp-2 text-micro font-bold">
                    {sticker.name}
                  </p>
                  {sticker.detail ? (
                    <p className="m-0 mt-1 line-clamp-2 text-micro opacity-70">
                      {sticker.detail}
                    </p>
                  ) : null}
                </div>
              </article>
            ) : (
              <div
                className="border-app-line-2 min-h-[88px] rounded-rz-xs border border-dashed"
                key={`empty-${String(index)}`}
              />
            )
          })}
        </div>
        <p className="rz-caption m-0 text-center">{t('sheetHint')}</p>
        <dl className="rz-facts px-0">
          <div>
            <dt>{t('selectedObjects')}</dt>
            <dd className="rz-num">{objects}</dd>
          </div>
          <div>
            <dt>{t('stickersCount')}</dt>
            <dd className="rz-num">{total}</dd>
          </div>
        </dl>
        {children}
        {actions}
      </div>
    </section>
  )
}
