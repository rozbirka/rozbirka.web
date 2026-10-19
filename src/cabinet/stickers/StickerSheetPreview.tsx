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
      aria-label={t('sheetLabel')}
      className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border xl:sticky xl:top-5"
    >
      <div className="border-app-line flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="font-mono text-[11.5px] tracking-[0.14em] text-white uppercase">
          {t('sheet')}
        </h2>
        <span className="text-app-dim text-[12px]">{t('preview')}</span>
      </div>
      <div className="p-5">
        <div className="grid min-h-[310px] grid-cols-2 gap-1.5 rounded-[16px] bg-[#eee] p-3">
          {Array.from({ length: 6 }, (_, index) => {
            const sticker = cards[index]
            return sticker ? (
              <article
                aria-label={t('previewSticker', { name: sticker.name })}
                className="grid min-h-[88px] grid-cols-[42px_minmax(0,1fr)] content-center gap-2 overflow-hidden rounded-[7px] border border-black/10 bg-white p-2 text-black"
                key={`${sticker.id}-${String(index)}`}
              >
                {sticker.qrSvg ? (
                  <div
                    aria-label={t('qrCode', { name: sticker.name })}
                    className="grid size-[42px] place-items-center overflow-hidden bg-white [&>svg]:block [&>svg]:size-full"
                    dangerouslySetInnerHTML={{ __html: sticker.qrSvg }}
                    role="img"
                  />
                ) : (
                  <div className="grid size-[42px] place-items-center rounded-[3px] bg-black font-mono text-[8px] text-white">
                    QR
                  </div>
                )}
                <div className="min-w-0 self-center">
                  <p className="line-clamp-2 text-[9.5px] leading-[1.2] font-extrabold">
                    {sticker.name}
                  </p>
                  {sticker.detail ? (
                    <p className="mt-1 line-clamp-2 text-[7.5px] leading-[1.25] text-black/55">
                      {sticker.detail}
                    </p>
                  ) : null}
                </div>
              </article>
            ) : (
              <div
                className="min-h-[88px] rounded-[7px] border border-dashed border-black/10 bg-black/[0.025]"
                key={`empty-${String(index)}`}
              />
            )
          })}
        </div>
        <p className="text-app-dim mt-3 text-center text-[12px] leading-5">
          {t('sheetHint')}
        </p>
        <dl className="mt-5 grid gap-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-app-muted">{t('selectedObjects')}</dt>
            <dd className="font-mono text-white tabular-nums">{objects}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-app-muted">{t('stickersCount')}</dt>
            <dd className="font-mono text-white tabular-nums">{total}</dd>
          </div>
        </dl>
        {children}
        {actions}
      </div>
    </section>
  )
}
