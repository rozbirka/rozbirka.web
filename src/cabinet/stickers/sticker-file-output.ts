export type StickerFileFormat = 'pdf' | 'download' | 'share'
export class StickerSharingUnsupported extends Error {}

/** Both modes download the generated printable HTML, revoking the URL even on failure. */
export function downloadStickerHtml(html: string) {
  const url = URL.createObjectURL(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
  )
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = 'rozbirka-stickers.html'
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
export async function shareStickerHtml(html: string, title: string) {
  const file = new File([html], 'rozbirka-stickers.html', { type: 'text/html' })
  if (!navigator.share || !navigator.canShare?.({ files: [file] }))
    throw new StickerSharingUnsupported()
  await navigator.share({ files: [file], title })
}
