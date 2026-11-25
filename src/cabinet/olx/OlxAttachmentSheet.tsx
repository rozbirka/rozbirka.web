import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { ApiProblem } from '@/api/contracts'
import { normalizeApiProblem } from '@/api/errors'
import { olxMessagesApi } from '@/api/olx-messages'
import {
  Button,
  ErrorState,
  Notice,
  Sheet,
  SkeletonRows,
} from '@/components/app'
import { useT } from '@/i18n'
import {
  isPreviewableOlxAttachment,
  type AttachmentSelection,
} from './olx-attachment'
import { olxChatMessages } from './olx-chat-messages'

type AttachmentResult =
  | { attempt: number; url: string; image: boolean }
  | { attempt: number; problem: ApiProblem }

export function OlxAttachmentSheet({
  accountId,
  threadId,
  attachment,
  tenantSignal,
  onClose,
  onCloseAutoFocus,
  onAccessFailure,
}: {
  accountId: string
  threadId: string
  attachment: AttachmentSelection
  tenantSignal: AbortSignal
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
  onAccessFailure: (problem: ApiProblem) => void
}) {
  const t = useT(olxChatMessages)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<AttachmentResult | null>(null)
  const [brokenPreview, setBrokenPreview] = useState<string | null>(null)
  const { index, messageId, name, previewUrl } = attachment
  const current = result?.attempt === attempt ? result : null
  const file = previewUrl
    ? { url: previewUrl, image: true }
    : current && 'url' in current
      ? current
      : null
  const failure = current && 'problem' in current ? current.problem : null
  const unavailable =
    failure?.code === 'OLX_ATTACHMENT_TOO_LARGE'
      ? 'attachmentTooLarge'
      : failure?.code === 'OLX_ATTACHMENT_FORBIDDEN'
        ? 'attachmentForbidden'
        : failure?.kind === 'not-found'
          ? 'attachmentMissing'
          : null
  const canRetry =
    !unavailable &&
    failure?.kind !== 'session-expired' &&
    failure?.kind !== 'forbidden'
  useEffect(() => {
    const request = new AbortController()
    const signal = AbortSignal.any([request.signal, tenantSignal])
    let objectUrl: string | undefined
    const release = () => {
      if (objectUrl === undefined) return
      URL.revokeObjectURL(objectUrl)
      objectUrl = undefined
    }
    const closeOnScopeChange = () => {
      release()
      onClose()
    }
    if (tenantSignal.aborted) return
    tenantSignal.addEventListener('abort', closeOnScopeChange, { once: true })

    if (previewUrl)
      return () => tenantSignal.removeEventListener('abort', closeOnScopeChange)

    void olxMessagesApi
      .attachment(threadId, messageId, index, accountId, { signal })
      .then((blob) => {
        if (signal.aborted) return
        if (blob.size === 0) {
          setResult({
            attempt,
            problem: { kind: 'unknown', message: '' },
          })
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setResult({
          attempt,
          url: objectUrl,
          image: isPreviewableOlxAttachment(blob),
        })
      })
      .catch((error: unknown) => {
        if (signal.aborted) return
        const problem = normalizeApiProblem(error)
        onAccessFailure(problem)
        setResult({ attempt, problem })
      })

    return () => {
      request.abort()
      tenantSignal.removeEventListener('abort', closeOnScopeChange)
      release()
    }
  }, [
    accountId,
    attempt,
    index,
    messageId,
    onAccessFailure,
    onClose,
    previewUrl,
    tenantSignal,
    threadId,
  ])

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={t('attachmentTitle')}
      description={<span className="break-all">{name}</span>}
      size="lg"
      footer={
        file ? (
          <Button asChild variant="primary">
            <a download={name} href={file.url}>
              <Download aria-hidden />
              {t('attachmentDownload')}
            </a>
          </Button>
        ) : undefined
      }
    >
      {failure ? (
        <ErrorState
          title={t('attachmentFailed')}
          description={
            unavailable ? t(unavailable) : failure.message || undefined
          }
          {...(canRetry
            ? { onRetry: () => setAttempt((value) => value + 1) }
            : {})}
        />
      ) : file ? (
        file.image ? (
          brokenPreview === file.url ? (
            <Notice tone="warn" role="status">
              {t('attachmentPreviewFailed')}
            </Notice>
          ) : (
            <img
              alt={name}
              className="border-app-line bg-app-raised mx-auto max-h-[65dvh] max-w-full rounded-panel border object-contain"
              onError={() => setBrokenPreview(file.url)}
              src={file.url}
            />
          )
        ) : (
          <Notice>{t('attachmentFile')}</Notice>
        )
      ) : (
        <SkeletonRows label={t('attachmentLoading')} rows={3} />
      )}
    </Sheet>
  )
}
