import { useEffect, useRef, useState } from 'react'
import { stickersApi, type StickerData } from '@/api/stickers'
import { useT, type Locale } from '@/i18n'
import { usePartPrintQueue } from './use-part-print-queue'
import { partQueueStore, withPartQueueLock } from './part-queue-store'
import {
  nextPartBatch,
  type PartQueueCopy,
  type PartStickerSelection,
} from './part-print-queue'
import type { PrintQueueExpected, PrintQueueScope } from './print-queue-store'
import {
  buildStickerHtml,
  renderStickers,
  type PrintableSticker,
  type RenderedSticker,
} from './sticker-output'
import { locationLabelMessages } from '../inventory/location-label-messages'
import { stickersMessages } from './messages'
import { locationStickersMessages } from './location-stickers-messages'
import type { useLatestMutationGuard } from '../use-latest-mutation-guard'

export function resolvePartCopies(
  copies: readonly PartQueueCopy[],
  items: readonly StickerData[],
): PrintableSticker[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  return copies.map((copy) => {
    const part = byId.get(copy.partId)
    if (!part?.qrCode.trim()) throw new Error('queued-part-unavailable')
    const vehicle = [part.carBrand, part.carModel].filter(Boolean).join(' ')
    const carLabel = [
      part.carCode,
      [vehicle, part.carYear ? `(${part.carYear})` : '']
        .filter(Boolean)
        .join(' '),
    ]
      .filter(Boolean)
      .join(' · ')
    return {
      id: copy.id,
      name: part.name,
      qrCode: part.qrCode,
      quantity: 1,
      carLabel: carLabel || null,
    }
  })
}
interface QueueActionState {
  expected: PrintQueueExpected
  ids: string[]
  mode: 'remove' | 'confirm'
}
interface PendingPartBatch {
  expected: PrintQueueExpected
  ids: string[]
  signal: AbortSignal
}
type LatestGuard = ReturnType<
  typeof useLatestMutationGuard
>['requireLatestMutation']
export function usePartStickerPrinting({
  scope,
  canGenerate,
  requireLatestMutation,
  documentLocale,
}: {
  scope: PrintQueueScope | null
  canGenerate: boolean
  requireLatestMutation: LatestGuard
  documentLocale: Locale
}) {
  const state = usePartPrintQueue(scope)
  const queue = state.queue
  const t = useT(locationLabelMessages),
    ts = useT(locationStickersMessages),
    tp = useT(stickersMessages)
  const userId = scope?.userId,
    tenantId = scope?.tenantId
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{
    expected: PrintQueueExpected
    items: RenderedSticker[]
  } | null>(null)
  const [pending, setPending] = useState<PendingPartBatch | null>(null)
  const [editor, setEditor] = useState<QueueActionState | null>(null)
  const [cancel, setCancel] = useState<PrintQueueExpected | null>(null)
  const mounted = useRef(true),
    busyRef = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const matches = (expected: PrintQueueExpected) => {
    const current = partQueueStore.getSnapshot()
    return (
      mounted.current &&
      current.scope?.userId === scope?.userId &&
      current.scope?.tenantId === scope?.tenantId &&
      current.queue?.id === expected.queueId &&
      current.revision === expected.revision
    )
  }
  const expected = queue
    ? { queueId: queue.id, revision: state.revision }
    : null
  const currentOutput = (expected: PrintQueueExpected, signal: AbortSignal) =>
    matches(expected) && !signal.aborted && partQueueStore.isCurrent(expected)
  useEffect(() => {
    if (!queue || !userId || !tenantId || !canGenerate) return
    const controller = new AbortController()
    const token = { queueId: queue.id, revision: state.revision }
    const copies = nextPartBatch(queue)
    void stickersApi
      .getBatchData([...new Set(copies.map((copy) => copy.partId))], {
        signal: controller.signal,
      })
      .then(async (response) => {
        const rendered = await renderStickers(
          resolvePartCopies(copies, response.items),
          window.location.origin,
        )
        if (
          !controller.signal.aborted &&
          mounted.current &&
          partQueueStore.getSnapshot().queue?.id === token.queueId &&
          partQueueStore.getSnapshot().revision === token.revision
        )
          setPreviewData({ expected: token, items: rendered })
      })
      .catch(() => {
        if (!controller.signal.aborted && mounted.current) setError(t('failed'))
      })
    return () => controller.abort()
  }, [queue, userId, tenantId, canGenerate, state.revision, t])
  const runMutation = async (
    operation: () => boolean | Promise<boolean>,
    success?: () => void,
  ) => {
    if (!scope || !canGenerate || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const mutation = requireLatestMutation({ quota: false })
      await withPartQueueLock(scope, async () => {
        if (!mounted.current || mutation.signal.aborted) return
        requireLatestMutation({ quota: false })
        const changed = await operation()
        if (!mounted.current || mutation.signal.aborted) return
        requireLatestMutation({ quota: false })
        if (!changed) {
          setError(ts('createFailed'))
          return
        }
        setPending(null)
        setEditor(null)
        setCancel(null)
        success?.()
      })
    } catch {
      if (mounted.current) setError(ts('createFailed'))
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const enqueue = (items: PartStickerSelection[], onQueued: () => void) =>
    runMutation(async () => {
      const mutation = requireLatestMutation({ quota: false })
      const response = await stickersApi.getBatchData(
        items.map((item) => item.id),
        { signal: mutation.signal },
      )
      const labels = resolvePartCopies(
        items.map((item) => ({ id: item.id, partId: item.id })),
        response.items,
      )
      if (!mounted.current || mutation.signal.aborted) return false
      requireLatestMutation({ quota: false })
      return state.enqueue(
        items.map((item, index) => ({
          ...item,
          name: labels[index]!.name,
          carLabel: labels[index]!.carLabel,
        })),
      )
    }, onQueued)
  const output = async (format: 'print' | 'pdf' | 'download' | 'share') => {
    if (!queue || !expected || !canGenerate || busyRef.current) return
    let popup: Window | null = null
    busyRef.current = true
    setBusy(true)
    setError(null)
    setPending(null)
    try {
      const mutation = requireLatestMutation({ quota: false })
      if (format === 'print' || format === 'pdf') {
        popup = window.open('', '_blank')
        if (!popup) {
          setError(t('blocked'))
          return
        }
        popup.opener = null
      }
      const copies = nextPartBatch(queue)
      const response = await stickersApi.getBatchData(
        [...new Set(copies.map((copy) => copy.partId))],
        { signal: mutation.signal },
      )
      const labels = resolvePartCopies(copies, response.items)
      const html = await buildStickerHtml(
        labels,
        window.location.origin,
        documentLocale,
      )
      if (!currentOutput(expected, mutation.signal)) {
        popup?.close()
        return
      }
      requireLatestMutation({ quota: false })
      if (popup) {
        popup.document.write(html)
        popup.document.close()
        popup.focus()
        popup.print()
        if (format === 'print' && currentOutput(expected, mutation.signal))
          setPending({
            expected,
            ids: copies.map((copy) => copy.id),
            signal: mutation.signal,
          })
      } else if (format === 'download') {
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
      } else {
        const file = new File([html], 'rozbirka-stickers.html', {
          type: 'text/html',
        })
        if (!navigator.share || !navigator.canShare?.({ files: [file] }))
          throw new Error('share-unavailable')
        await navigator.share({ files: [file], title: tp('shareTitle') })
      }
    } catch {
      popup?.close()
      if (mounted.current) setError(t('failed'))
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const inSnapshot = (token: PrintQueueExpected) =>
    queue?.id === token.queueId && state.revision === token.revision
  const preview =
    previewData && inSnapshot(previewData.expected) && canGenerate
      ? previewData.items
      : []
  const pendingValid =
    pending && inSnapshot(pending.expected) && !pending.signal.aborted
      ? pending
      : null
  const editorValid = editor && inSnapshot(editor.expected) ? editor : null
  const cancelValid = cancel && inSnapshot(cancel) ? cancel : null
  const confirm = (ids: string[]) => {
    if (
      !pendingValid ||
      !ids.length ||
      ids.some((id) => !pendingValid.ids.includes(id))
    )
      return
    void runMutation(
      () => state.acknowledge(ids, pendingValid.expected),
      () => {
        if (!partQueueStore.getSnapshot().queue) setMessage(ts('completed'))
      },
    )
  }
  return {
    queue,
    expected,
    preview,
    busy,
    error,
    message,
    pending: pendingValid,
    editor: editorValid,
    cancel: cancelValid,
    persistenceError: state.persistenceError,
    enqueue,
    output,
    confirm,
    edit: () => {
      if (queue && expected)
        setEditor({
          expected,
          ids: queue.remaining.map((copy) => copy.id),
          mode: 'remove',
        })
    },
    partial: () => {
      if (pendingValid)
        setEditor({
          expected: pendingValid.expected,
          ids: pendingValid.ids,
          mode: 'confirm',
        })
    },
    nothing: () => setPending(null),
    cancelQueue: () => setCancel(expected),
    closeCancel: () => setCancel(null),
    closeEditor: () => setEditor(null),
    submitEditor: (ids: string[]) => {
      if (!editorValid) return
      if (editorValid.mode === 'confirm') confirm(ids)
      else
        void runMutation(
          () => state.remove(ids, editorValid.expected),
          () => {
            if (!partQueueStore.getSnapshot().queue) setMessage(ts('emptied'))
          },
        )
    },
    discard: () => {
      if (cancelValid) void runMutation(() => state.discard(cancelValid))
    },
  }
}
