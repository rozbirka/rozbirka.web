/** Reuse the API's CDN route for legacy HEIC originals that browsers cannot decode. */
export function fullPhotoSource(photo: {
  url: string
  thumbnailUrl?: string
}): string {
  if (!photo.thumbnailUrl) return photo.url
  try {
    const original = new URL(photo.url)
    const thumbnail = new URL(photo.thumbnailUrl)
    const transform = /^\/cdn-cgi\/image\/[^/]+/
    if (
      !/\.hei[cf]$/i.test(original.pathname) ||
      original.origin !== thumbnail.origin ||
      original.search ||
      thumbnail.search ||
      !transform.test(thumbnail.pathname) ||
      thumbnail.pathname.replace(transform, '') !== original.pathname
    ) {
      return photo.url
    }
    thumbnail.pathname = `/cdn-cgi/image/width=1920,height=1920,fit=scale-down,quality=85,format=auto${original.pathname}`
    thumbnail.hash = original.hash
    return thumbnail.href
  } catch {
    return photo.url
  }
}
