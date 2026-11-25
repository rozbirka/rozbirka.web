const previewableImages = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export function isPreviewableOlxAttachment(blob: Blob) {
  return blob.size > 0 && previewableImages.has(blob.type)
}

export interface AttachmentSelection {
  messageId: string
  index: number
  name: string
  previewUrl?: string
}
