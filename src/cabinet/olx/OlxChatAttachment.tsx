import { useEffect, useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { olxMessagesApi } from '@/api/olx-messages'
import { Button, Skeleton, Thumbnail } from '@/components/app'
import { useT } from '@/i18n'
import {
  isPreviewableOlxAttachment,
  type AttachmentSelection,
} from './olx-attachment'
import { olxChatMessages } from './olx-chat-messages'

export function OlxChatAttachment({
  accountId,
  threadId,
  attachment: { messageId, index, name },
  tenantSignal,
  onOpen,
}: {
  accountId: string
  threadId: string
  attachment: AttachmentSelection
  tenantSignal: AbortSignal
  onOpen: (trigger: HTMLButtonElement, attachment: AttachmentSelection) => void
}) {
  const t = useT(olxChatMessages)
  const trigger = useRef<HTMLButtonElement>(null)
  const [preview, setPreview] = useState<string | null>()
  const isImageName = /\.(jpe?g|png|webp|gif)$/i.test(name)
  const showThumbnail = isImageName && preview !== null

  useEffect(() => {
    const button = trigger.current
    if (!isImageName || !button || tenantSignal.aborted) return

    const request = new AbortController()
    const signal = AbortSignal.any([request.signal, tenantSignal])
    let objectUrl: string | undefined
    let observer: IntersectionObserver | undefined
    const release = () => {
      observer?.disconnect()
      if (objectUrl !== undefined) {
        URL.revokeObjectURL(objectUrl)
        objectUrl = undefined
      }
    }
    const clearPreview = () => {
      release()
      setPreview(null)
    }
    tenantSignal.addEventListener('abort', clearPreview, { once: true })

    const load = () => {
      observer?.disconnect()
      if (signal.aborted) return
      void olxMessagesApi
        .attachment(threadId, messageId, index, accountId, { signal })
        .then((blob) => {
          if (signal.aborted) return
          if (isPreviewableOlxAttachment(blob)) {
            objectUrl = URL.createObjectURL(blob)
          }
          setPreview(objectUrl ?? null)
        })
        .catch(() => {
          if (!signal.aborted) setPreview(null)
        })
    }
    if (typeof IntersectionObserver === 'undefined') {
      load()
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load()
      })
      observer.observe(button)
    }

    return () => {
      request.abort()
      tenantSignal.removeEventListener('abort', clearPreview)
      release()
    }
  }, [accountId, index, isImageName, messageId, tenantSignal, threadId])

  return (
    <Button
      aria-label={t('openAttachment', { name })}
      ref={trigger}
      variant="quiet"
      className={
        showThumbnail
          ? 'block h-auto w-56 max-w-full p-0'
          : 'h-auto min-h-8 w-full min-w-0 justify-start px-2 py-1.5 text-left whitespace-normal'
      }
      onClick={(event) =>
        onOpen(event.currentTarget, {
          messageId,
          index,
          name,
          ...(preview ? { previewUrl: preview } : {}),
        })
      }
    >
      {showThumbnail ? (
        preview ? (
          <Thumbnail
            alt={name}
            photo={{ url: preview }}
            ratio="wide"
            size="full"
            className="[&>img]:object-contain"
            onUnavailable={() => setPreview(null)}
          />
        ) : (
          <Skeleton className="block aspect-4/3 w-full" />
        )
      ) : (
        <>
          <Paperclip aria-hidden />
          <span className="min-w-0 break-all">{name}</span>
        </>
      )}
    </Button>
  )
}
