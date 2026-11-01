import { afterEach, expect, it, vi } from 'vitest'
import {
  downloadStickerHtml,
  shareStickerHtml,
  StickerSharingUnsupported,
} from './sticker-file-output'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('revokes a generated download URL even when the browser rejects the download hand-off', () => {
  const revoke = vi.fn()
  class TestURL extends URL {
    static override createObjectURL = vi.fn().mockReturnValue('blob:stickers')
    static override revokeObjectURL = revoke
  }
  vi.stubGlobal('URL', TestURL)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    throw new Error('download-rejected')
  })
  expect(() => downloadStickerHtml('<html>stickers</html>')).toThrow(
    'download-rejected',
  )
  expect(revoke).toHaveBeenCalledWith('blob:stickers')
})
it('shares a printable HTML file with the localized title', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true })
  await shareStickerHtml('<html>stickers</html>', 'Стікери Rozbirka')
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Стікери Rozbirka',
      files: [
        expect.objectContaining({
          name: 'rozbirka-stickers.html',
          type: 'text/html',
        }),
      ],
    }),
  )
})
it('reports unsupported file sharing without handing off a file', async () => {
  const share = vi.fn()
  vi.stubGlobal('navigator', { ...navigator, share, canShare: () => false })
  await expect(
    shareStickerHtml('<html>stickers</html>', 'Stickers'),
  ).rejects.toBeInstanceOf(StickerSharingUnsupported)
  expect(share).not.toHaveBeenCalled()
})
