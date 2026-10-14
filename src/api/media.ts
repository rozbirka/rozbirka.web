import { apiClient } from './client'
import type { RequestOptions } from './contracts'

export type MediaEntityType = 'cars' | 'parts' | 'intakes' | 'tenants'

export interface MediaUploadResult {
  storageKey: string
  url: string
}

const mediaEntityTypes = new Set<MediaEntityType>([
  'cars',
  'parts',
  'intakes',
  'tenants',
])

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

let activeUploads = 0
const uploadWaiters: (() => void)[] = []

async function acquireUploadSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Upload cancelled', 'AbortError')
  }
  if (activeUploads < 3) {
    activeUploads += 1
    return
  }
  await new Promise<void>((resolve, reject) => {
    const wake = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    const abort = () => {
      const index = uploadWaiters.indexOf(wake)
      if (index >= 0) uploadWaiters.splice(index, 1)
      reject(new DOMException('Upload cancelled', 'AbortError'))
    }
    uploadWaiters.push(wake)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

function releaseUploadSlot(): void {
  const next = uploadWaiters.shift()
  if (next) next()
  else activeUploads -= 1
}

async function preparePhoto(file: File): Promise<File> {
  if (
    file.type !== 'image/jpeg' ||
    file.size < 1_000_000 ||
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  ) {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    })
    try {
      if (!bitmap.width || !bitmap.height) return file
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const context = canvas.getContext('2d')
      if (!context) return file
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.82),
      )
      canvas.width = 0
      canvas.height = 0
      if (!blob || blob.size >= file.size) return file
      return new File([blob], file.name, {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      })
    } finally {
      bitmap.close()
    }
  } catch {
    // Some browsers cannot decode all JPEG variants. Upload the original.
    return file
  }
}

export const mediaApi = {
  async upload(
    file: File,
    entityType: MediaEntityType,
    options: RequestOptions = {},
  ): Promise<MediaUploadResult> {
    if (!mediaEntityTypes.has(entityType)) {
      throw new TypeError('Unsupported media entity type')
    }
    await acquireUploadSlot(options.signal)
    try {
      options.signal?.throwIfAborted()
      const data = new FormData()
      data.append('file', await preparePhoto(file))
      options.signal?.throwIfAborted()
      const response = await apiClient.post<MediaUploadResult>(
        '/media/upload',
        data,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          params: { entityType },
          timeout: 60000,
          ...requestConfig(options),
        },
      )
      return response.data
    } finally {
      releaseUploadSlot()
    }
  },

  async remove(
    storageKey: string,
    options: RequestOptions = {},
  ): Promise<void> {
    if (!storageKey.trim()) {
      throw new TypeError('Pending media storage key is required')
    }
    await apiClient.delete('/media', {
      data: { storageKey },
      ...requestConfig(options),
    })
  },
}
