import QRCode from 'qrcode'
import { SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { stickerOutputMessages } from './sticker-output-messages'

export interface PrintableSticker {
  id: string
  name: string
  qrCode: string
  quantity: number
  carLabel: string | null
}

export interface RenderedSticker extends PrintableSticker {
  resumeUrl: string
  qrSvg: string
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

export const stickerResumeUrl = (qrCode: string, origin: string) =>
  new URL(`/scan/${encodeURIComponent(qrCode)}`, origin).href

export const buildStickerSvg = (resumeUrl: string) =>
  QRCode.toString(resumeUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  })

export const renderStickers = async (
  stickers: PrintableSticker[],
  origin: string,
): Promise<RenderedSticker[]> =>
  Promise.all(
    stickers.flatMap((sticker) =>
      Array.from({ length: sticker.quantity }, async () => {
        const resumeUrl = stickerResumeUrl(sticker.qrCode, origin)
        return {
          ...sticker,
          quantity: 1,
          resumeUrl,
          qrSvg: await buildStickerSvg(resumeUrl),
        }
      }),
    ),
  )

/**
 * Printable sticker sheet. `locale` is the tenant document language (printed
 * labels do not follow the operator's interface language).
 */
export const buildStickerHtml = async (
  stickers: PrintableSticker[],
  origin: string,
  locale: Locale = SOURCE_LOCALE,
) => {
  const text = (key: 'documentTitle' | 'qrAlt', name = '') =>
    escapeHtml(translate(stickerOutputMessages, locale, key, { name }))
  const rendered = await renderStickers(stickers, origin)
  const cards = rendered
    .map(
      (sticker) => `<article class="sticker">
  <div class="qr" role="img" aria-label="${text('qrAlt', sticker.name)}">${sticker.qrSvg}</div>
  <strong>${escapeHtml(sticker.name)}</strong>
  ${sticker.carLabel ? `<span>${escapeHtml(sticker.carLabel)}</span>` : ''}
  <a href="${escapeHtml(sticker.resumeUrl)}">${escapeHtml(sticker.resumeUrl)}</a>
</article>`,
    )
    .join('\n')
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${text('documentTitle')}</title>
  <style>
    @page{size:40mm 58mm;margin:0}
    html,body{margin:0;padding:0}
    *{box-sizing:border-box}
    body{width:40mm;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff}
    .sticker{width:40mm;height:57mm;padding:2mm;display:flex;flex-direction:column;align-items:center;overflow:hidden;text-align:center;page-break-after:always;break-after:page}
    .sticker:last-child{page-break-after:auto;break-after:auto}
    .qr{width:36mm;height:36mm;flex:none;margin-bottom:1.5mm}
    .qr svg{display:block;width:100%;height:100%}
    strong{display:-webkit-box;width:100%;overflow:hidden;font-size:9px;line-height:1.2;-webkit-box-orient:vertical;-webkit-line-clamp:2}
    span{display:-webkit-box;width:100%;overflow:hidden;margin-top:1px;color:#444;font-size:7px;line-height:1.2;-webkit-box-orient:vertical;-webkit-line-clamp:2}
    a{display:none}
  </style>
</head>
<body>${cards}</body>
</html>`
}
