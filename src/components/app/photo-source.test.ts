import { describe, expect, it } from 'vitest'
import { fullPhotoSource } from './photo-source'

describe('fullPhotoSource', () => {
  const url = 'https://qamedia.rozbirka.com/tenant/parts/photo.heic'
  const thumbnailUrl =
    'https://qamedia.rozbirka.com/cdn-cgi/image/width=200,quality=80,format=auto/tenant/parts/photo.heic'

  it('uses a full-size browser-compatible transform for legacy HEIC photos', () => {
    expect(fullPhotoSource({ url, thumbnailUrl })).toBe(
      'https://qamedia.rozbirka.com/cdn-cgi/image/width=1920,height=1920,fit=scale-down,quality=85,format=auto/tenant/parts/photo.heic',
    )
  })

  it('also handles uppercase HEIF without changing the stored object path', () => {
    const photo = {
      url: url.replace('photo.heic', 'Photo.HEIF'),
      thumbnailUrl: thumbnailUrl.replace('photo.heic', 'Photo.HEIF'),
    }
    expect(fullPhotoSource(photo)).toContain('/tenant/parts/Photo.HEIF')
    expect(fullPhotoSource(photo)).toContain('width=1920,height=1920')
  })

  it('keeps browser-supported originals at their original URL', () => {
    for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'avif']) {
      const original = url.replace('.heic', `.${extension}`)
      expect(fullPhotoSource({ url: original, thumbnailUrl })).toBe(original)
    }
  })

  it('does not invent transformations or rewrite unrelated, signed or local URLs', () => {
    for (const photo of [
      { url },
      { url, thumbnailUrl: 'https://other.example/thumbnail.heic' },
      { url, thumbnailUrl: thumbnailUrl.replace('photo.heic', 'other.heic') },
      { url, thumbnailUrl: url },
      { url: `${url}?signature=original`, thumbnailUrl },
      { url, thumbnailUrl: `${thumbnailUrl}?signature=thumbnail` },
      { url: 'blob:local-preview', thumbnailUrl },
      { url: '/local/photo.heic', thumbnailUrl },
    ]) {
      expect(fullPhotoSource(photo)).toBe(photo.url)
    }
  })
})
