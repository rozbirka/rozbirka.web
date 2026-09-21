import { mediaApi, type MediaEntityType } from '@/api/media'

/** A photo the person picked. It lives in the browser until the form is sent. */
export interface PickedPhoto {
  id: string
  name: string
  size: number
  file: File
  /** Object URL for the thumbnail; revoked when the photo is dropped. */
  preview: string
}

/** Names of the photos that failed, so a form can say which ones to retry. */
export class PhotoUploadError extends Error {
  readonly names: string[]
  constructor(names: string[]) {
    super('photo-upload-failed')
    this.name = 'PhotoUploadError'
    this.names = names
  }
}

/**
 * Sends the picked files and answers with their storage keys, in the order they
 * were picked. Called from a submit handler, never from the file chooser: a car
 * or a batch that is never created leaves nothing behind in storage.
 */
export async function uploadPickedPhotos(
  photos: readonly PickedPhoto[],
  entityType: Exclude<MediaEntityType, 'tenants'>,
  signal: AbortSignal,
): Promise<string[]> {
  if (photos.length === 0) return []
  const results = await Promise.allSettled(
    photos.map((photo) => mediaApi.upload(photo.file, entityType, { signal })),
  )
  const failed = results.flatMap((result, index) => {
    const photo = photos[index]
    return result.status === 'rejected' && photo ? [photo.name] : []
  })
  if (failed.length > 0) throw new PhotoUploadError(failed)
  return results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value.storageKey] : [],
  )
}
