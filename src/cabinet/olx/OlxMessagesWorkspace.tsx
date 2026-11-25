import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react'
import type { ApiProblem } from '@/api/contracts'
import { normalizeApiProblem } from '@/api/errors'
import {
  olxMessagesApi,
  type OlxConversation,
  type OlxConversationHistory,
  type OlxConversationMessage,
  type OlxConversationPage,
} from '@/api/olx-messages'
import {
  Amount,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Fact,
  FactList,
  Field,
  Notice,
  Segmented,
  Sheet,
  StatusPill,
  TextArea,
  useOptionalToast,
} from '@/components/app'
import { useFormat, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { tenantRequestScope } from '../tenant-request-scope'
import { OlxAttachmentSheet } from './OlxAttachmentSheet'
import { OlxChatAttachment } from './OlxChatAttachment'
import {
  chatGrid,
  chatGridWithPart,
  chatPanelHeight,
  conversationBody,
  conversationComposer,
  conversationHistory,
  conversationPanel,
  ConversationComposerSkeleton,
  ConversationHistorySkeleton,
  OlxMessagesSkeleton,
} from './OlxMessagesSkeleton'
import { olxChatMessages } from './olx-chat-messages'
import type { AttachmentSelection } from './olx-attachment'

type ReplyState =
  | 'draft'
  | 'sentHistoryFailed'
  | 'rejected'
  | 'rateLimited'
  | 'uncertain'
  | 'checkedUncertain'
  | 'otherError'

interface ReplyDraft {
  text: string
  state: ReplyState
  refreshAtFailure?: number
}

interface ConfirmedReply {
  message: OlxConversationMessage
  previousSentIds: ReadonlySet<string>
}

type AccessFailure = 'connection' | 'permission'

const emptyDraft: ReplyDraft = { text: '', state: 'draft' }
const noConfirmedReplies: readonly ConfirmedReply[] = []

function accessFailure(problem: ApiProblem): AccessFailure | null {
  if (
    [
      'OLX_NOT_CONNECTED',
      'OLX_CONNECTION_CHANGED',
      'OLX_RECONNECT_REQUIRED',
    ].includes(problem.code ?? '')
  )
    return 'connection'
  return problem.kind === 'forbidden' ? 'permission' : null
}

function replyFailed(problem: ApiProblem): ReplyState {
  if (problem.code === 'OLX_RATE_LIMITED') return 'rateLimited'
  if (
    problem.code === 'OLX_MESSAGE_OUTCOME_UNKNOWN' ||
    ['network', 'timeout', 'server', 'unknown'].includes(problem.kind)
  )
    return 'uncertain'
  return problem.code === 'OLX_MESSAGE_REJECTED' ? 'rejected' : 'otherError'
}

function repliesMissingFromHistory(
  replies: readonly ConfirmedReply[],
  messages: OlxConversationHistory['messages'],
) {
  // OLX acknowledges a send without a message ID. Match only outgoing records
  // that were absent before that send, and consume each record at most once.
  const sent = messages.filter((message) => message.direction === 'sent')
  const matched = new Set<string>()
  const remaining = replies.filter(({ message, previousSentIds }) => {
    const entry = sent.find(
      (candidate) =>
        candidate.text === message.text &&
        !previousSentIds.has(candidate.id) &&
        !matched.has(candidate.id),
    )
    if (!entry) return true
    matched.add(entry.id)
    return false
  })
  if (!matched.size) return replies
  return remaining.map((reply) => ({
    ...reply,
    previousSentIds: new Set([...reply.previousSentIds, ...matched]),
  }))
}

export function OlxMessagesWorkspace({
  accountId,
  accountHref,
  canManageConnection,
  canReadParts,
  partsHref,
  newOrderHref,
}: {
  accountId: string
  accountHref: string
  canManageConnection: boolean
  canReadParts: boolean
  partsHref: string
  newOrderHref?: string | undefined
}) {
  const t = useT(olxChatMessages)
  const format = useFormat()
  const filterId = useId()
  const [tenantSignal] = useState(() => tenantRequestScope.signal)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [mutationInFlight, setMutationInFlight] = useState(false)
  const [failure, setFailure] = useState<AccessFailure | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ReplyDraft>>({})
  const [confirmedReplies, setConfirmedReplies] = useState<
    Record<string, readonly ConfirmedReply[]>
  >({})
  const [unconfirmedReads, setUnconfirmedReads] = useState<
    Record<string, number>
  >({})
  const [loaded, setLoaded] = useState<{
    result: OlxConversationPage | null
    page: number
    refresh: number
  }>()
  const selectedButton = useRef<HTMLButtonElement>(null)
  const threadsHeading = useRef<HTMLSpanElement>(null)
  const nextReplyId = useRef(0)
  const current = loaded?.page === page ? loaded : undefined
  const list = current?.result
  const loading = current?.refresh !== refresh && !failure
  const selected = list?.items.find(({ id }) => id === selectedId)
  const visible = list?.items.filter(
    ({ unreadCount }) => filter === 'all' || unreadCount > 0,
  )
  const autoRefreshBlocked =
    loading ||
    mutationInFlight ||
    failure !== null ||
    (selectedId !== null &&
      (drafts[selectedId]?.state === 'uncertain' ||
        unconfirmedReads[selectedId] !== undefined))

  useEffect(() => {
    function refreshOnReturn() {
      if (document.visibilityState === 'visible' && !autoRefreshBlocked)
        setRefresh((value) => value + 1)
    }
    document.addEventListener('visibilitychange', refreshOnReturn)
    return () =>
      document.removeEventListener('visibilitychange', refreshOnReturn)
  }, [autoRefreshBlocked])

  const updateDraft = useCallback((id: string, draft: ReplyDraft) => {
    setDrafts((all) => ({ ...all, [id]: draft }))
  }, [])
  const confirmReply = useCallback(
    (id: string, text: string, history: OlxConversationHistory['messages']) => {
      const reply: ConfirmedReply = {
        message: {
          id: `local-${nextReplyId.current++}`,
          text,
          direction: 'sent',
          createdAt: new Date().toISOString(),
        },
        previousSentIds: new Set(
          history
            .filter((message) => message.direction === 'sent')
            .map((message) => message.id),
        ),
      }
      setConfirmedReplies((all) => ({
        ...all,
        [id]: [...(all[id] ?? noConfirmedReplies), reply],
      }))
    },
    [],
  )
  const confirmHistoryLoaded = useCallback(
    (
      id: string,
      refresh: number,
      messages: OlxConversationHistory['messages'],
    ) => {
      setConfirmedReplies((all) => {
        const replies = all[id]
        if (!replies?.length) return all
        const remaining = repliesMissingFromHistory(replies, messages)
        return remaining === replies ? all : { ...all, [id]: remaining }
      })
      setDrafts((all) => {
        const draft = all[id]
        if (draft?.state === 'sentHistoryFailed')
          return { ...all, [id]: emptyDraft }
        return draft?.state === 'uncertain' &&
          refresh > (draft.refreshAtFailure ?? 0)
          ? { ...all, [id]: { text: draft.text, state: 'checkedUncertain' } }
          : all
      })
    },
    [],
  )
  const confirmMarkedRead = useCallback(
    (id: string, requestedRefresh: number) => {
      setLoaded((current) => {
        if (current?.refresh !== requestedRefresh || !current.result)
          return current
        return {
          ...current,
          result: {
            ...current.result,
            items: current.result.items.map((thread) =>
              thread.id === id ? { ...thread, unreadCount: 0 } : thread,
            ),
          },
        }
      })
    },
    [],
  )
  const keepUnconfirmedRead = useCallback(
    (id: string, requestedRefresh: number) => {
      setUnconfirmedReads((all) => ({ ...all, [id]: requestedRefresh }))
    },
    [],
  )
  const confirmReadRefresh = useCallback(
    (id: string, verifiedRefresh: number) => {
      setUnconfirmedReads((all) => {
        const unconfirmedAt = all[id]
        if (unconfirmedAt === undefined || unconfirmedAt >= verifiedRefresh)
          return all
        const remaining = { ...all }
        delete remaining[id]
        return remaining
      })
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    void olxMessagesApi.threads(page, accountId, { signal }).then(
      (result) => {
        if (!signal.aborted) setLoaded({ page, refresh, result })
      },
      (error: unknown) => {
        if (signal.aborted) return
        const kind = accessFailure(normalizeApiProblem(error))
        if (kind) setFailure(kind)
        setLoaded({ page, refresh, result: null })
      },
    )
    return () => controller.abort()
  }, [accountId, page, refresh, tenantSignal])

  function selectPage(next: number) {
    setSelectedId(null)
    setPage(next)
  }

  function returnToThreads() {
    const previous = selectedButton.current
    setSelectedId(null)
    requestAnimationFrame(() => {
      const focusTarget = previous?.isConnected
        ? previous
        : threadsHeading.current
      focusTarget?.focus()
    })
  }

  if (failure)
    return (
      <EmptyState
        className="rz-card"
        title={t(failure === 'permission' ? 'permissionsLost' : 'accessLost')}
        description={failure === 'connection' ? t('accessHint') : undefined}
        actions={
          failure === 'connection' && canManageConnection ? (
            <Button asChild>
              <Link to={accountHref}>{t('settings')}</Link>
            </Button>
          ) : undefined
        }
      />
    )
  if (loading && !list)
    return <OlxMessagesSkeleton canReadParts={canReadParts} />

  const refreshButton = (
    <Button
      disabled={loading || mutationInFlight}
      onClick={() => setRefresh((value) => value + 1)}
    >
      <RefreshCw aria-hidden />
      {t('refresh')}
    </Button>
  )

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex justify-end">{refreshButton}</div>
      {list?.items.length === 0 && page === 1 ? (
        <EmptyState
          className="rz-card"
          title={t('empty')}
          description={t('emptyHint')}
          icon={<MessageSquare aria-hidden />}
        />
      ) : (
        <div
          className={cn(chatGrid, selected && canReadParts && chatGridWithPart)}
        >
          <Card
            title={
              <span ref={threadsHeading} tabIndex={-1}>
                {t('threads')}
              </span>
            }
            className={cn(
              'grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden',
              chatPanelHeight,
              selected && 'hidden lg:grid',
            )}
            bodyClassName="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] p-0"
          >
            <div className="border-app-line border-b px-3 py-2">
              <Segmented
                name={filterId}
                label={t('filter')}
                options={[
                  { value: 'all', label: t('all') },
                  { value: 'unread', label: t('unread') },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </div>
            <div className="min-h-0 overflow-y-auto" aria-busy={loading}>
              {!list ? (
                <ErrorState
                  title={t('failed')}
                  onRetry={() => setRefresh((value) => value + 1)}
                />
              ) : visible?.length === 0 ? (
                <p className="rz-caption m-0 px-3 py-4">
                  {t(filter === 'unread' ? 'emptyUnread' : 'emptyPage')}
                </p>
              ) : (
                <ul className="divide-app-line m-0 list-none divide-y p-0">
                  {visible?.map((thread) => {
                    const active = thread.id === selectedId
                    const name =
                      thread.interlocutorName ??
                      t('buyer', { id: thread.interlocutorId })
                    const advert = t('advert', { id: thread.advertId })
                    const unread = thread.unreadCount > 0
                    const linked = canReadParts ? thread.linkedPart : null
                    return (
                      <li key={thread.id}>
                        <Button
                          variant="quiet"
                          aria-pressed={active}
                          disabled={mutationInFlight}
                          className={cn(
                            'grid h-auto min-h-17 w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 rounded-none px-3 py-2.5 text-left',
                            active &&
                              'bg-app-selected shadow-[inset_2px_0_0_var(--rz-brand)]',
                          )}
                          ref={active ? selectedButton : undefined}
                          onClick={() => setSelectedId(thread.id)}
                        >
                          <span
                            aria-hidden
                            className="rounded-rz-sm bg-app-raised text-app-muted grid size-8 place-items-center"
                          >
                            {name.charAt(0).toLocaleUpperCase()}
                          </span>
                          <span className="grid min-w-0 gap-1">
                            <span className="flex min-w-0 items-center justify-between gap-2">
                              <span
                                className={cn(
                                  'text-app-strong truncate',
                                  unread ? 'font-bold' : 'font-medium',
                                )}
                              >
                                {name}
                              </span>
                              {unread && (
                                <span
                                  aria-label={t('unreadCount', {
                                    count: thread.unreadCount,
                                  })}
                                >
                                  <StatusPill tone="info">
                                    {thread.unreadCount}
                                  </StatusPill>
                                </span>
                              )}
                            </span>
                            <span className="rz-caption truncate">
                              {linked?.name ?? advert}
                            </span>
                            <time
                              className="rz-caption"
                              dateTime={thread.createdAt}
                            >
                              {format.dateTime(thread.createdAt)}
                            </time>
                          </span>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {list && (page > 1 || list.hasMore) && (
              <div className="border-app-line flex items-center justify-between gap-2 border-t px-3 py-2">
                <span className="rz-caption">{t('page', { page })}</span>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    aria-label={t('previous')}
                    disabled={page === 1 || loading || mutationInFlight}
                    onClick={() => selectPage(page - 1)}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    aria-label={t('next')}
                    disabled={!list.hasMore || loading || mutationInFlight}
                    onClick={() => selectPage(page + 1)}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </Card>
          {selected ? (
            <ConversationPanel
              key={selected.id}
              thread={selected}
              accountId={accountId}
              canReply={list?.canReply === true}
              listLoading={loading}
              draft={drafts[selected.id] ?? emptyDraft}
              confirmedReplies={
                confirmedReplies[selected.id] ?? noConfirmedReplies
              }
              onDraft={updateDraft}
              onReplyConfirmed={confirmReply}
              onHistoryLoaded={confirmHistoryLoaded}
              onMarkedRead={confirmMarkedRead}
              unconfirmedReadAt={unconfirmedReads[selected.id]}
              onReadUnconfirmed={keepUnconfirmedRead}
              onReadRefreshConfirmed={confirmReadRefresh}
              onBack={returnToThreads}
              onBusy={setMutationInFlight}
              onAccessFailure={setFailure}
              refresh={refresh}
              tenantSignal={tenantSignal}
              part={canReadParts ? selected.linkedPart : undefined}
              partsHref={partsHref}
              newOrderHref={newOrderHref}
            />
          ) : (
            <EmptyState
              className={cn('rz-card hidden lg:grid', chatPanelHeight)}
              title={t('select')}
              description={t('selectHint')}
              icon={<MessageSquare aria-hidden />}
            />
          )}
          {selected && canReadParts && (
            <Card title={t('part')} className="hidden xl:block">
              <ConversationPart
                part={selected.linkedPart}
                partsHref={partsHref}
                newOrderHref={newOrderHref}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function ConversationPanel({
  thread,
  accountId,
  canReply,
  listLoading,
  draft,
  confirmedReplies,
  onDraft,
  onReplyConfirmed,
  onHistoryLoaded,
  onMarkedRead,
  unconfirmedReadAt,
  onReadUnconfirmed,
  onReadRefreshConfirmed,
  onBack,
  onBusy,
  onAccessFailure,
  refresh,
  tenantSignal,
  part,
  partsHref,
  newOrderHref,
}: {
  thread: OlxConversation
  accountId: string
  canReply: boolean
  listLoading: boolean
  draft: ReplyDraft
  confirmedReplies: readonly ConfirmedReply[]
  onDraft: (id: string, value: ReplyDraft) => void
  onReplyConfirmed: (
    id: string,
    text: string,
    history: OlxConversationHistory['messages'],
  ) => void
  onHistoryLoaded: (
    id: string,
    refresh: number,
    messages: OlxConversationHistory['messages'],
  ) => void
  onMarkedRead: (id: string, refresh: number) => void
  unconfirmedReadAt: number | undefined
  onReadUnconfirmed: (id: string, refresh: number) => void
  onReadRefreshConfirmed: (id: string, refresh: number) => void
  onBack: () => void
  onBusy: (busy: boolean) => void
  onAccessFailure: (value: AccessFailure) => void
  refresh: number
  tenantSignal: AbortSignal
  part: OlxConversation['linkedPart']
  partsHref: string
  newOrderHref: string | undefined
}) {
  const t = useT(olxChatMessages)
  const format = useFormat()
  const toast = useOptionalToast()
  const historyArea = useRef<HTMLDivElement>(null)
  const sectionHeading = useRef<HTMLSpanElement>(null)
  const partTrigger = useRef<HTMLButtonElement>(null)
  const attachmentTrigger = useRef<HTMLButtonElement>(null)
  const markReadTrigger = useRef<HTMLButtonElement>(null)
  const mutation = useRef<AbortController | null>(null)
  const [openPart, setOpenPart] = useState(false)
  const [openAttachment, setOpenAttachment] =
    useState<AttachmentSelection | null>(null)
  const dismissAttachment = useCallback(() => setOpenAttachment(null), [])
  const handleAttachmentAccessFailure = useCallback(
    (problem: ApiProblem) => {
      if (problem.code === 'OLX_ATTACHMENT_FORBIDDEN') return
      const failure = accessFailure(problem)
      if (failure) onAccessFailure(failure)
    },
    [onAccessFailure],
  )
  const [pendingAction, setPendingAction] = useState<'reply' | 'read' | null>(
    null,
  )
  const [readRejectedAt, setReadRejectedAt] = useState<number>()
  const [writeBlocked, setWriteBlocked] = useState(false)
  const [history, setHistory] = useState<OlxConversationHistory | null>(null)
  const [historyChecked, setHistoryChecked] = useState<number>()
  const [historyFailed, setHistoryFailed] = useState(false)
  const loading = historyChecked !== refresh
  const initialHistoryLoading = loading && !history && !confirmedReplies.length
  const disabled = !canReply || history?.canReply !== true || writeBlocked
  const canWriteNow =
    !disabled &&
    !listLoading &&
    !loading &&
    !historyFailed &&
    pendingAction === null
  const canSend =
    canWriteNow && draft.state !== 'uncertain' && Boolean(draft.text.trim())
  const showMarkRead =
    thread.unreadCount > 0 && !disabled && !loading && !historyFailed
  const needsReadRefresh =
    unconfirmedReadAt !== undefined &&
    (refresh <= unconfirmedReadAt || listLoading || loading || historyFailed)
  const canMarkRead = showMarkRead && canWriteNow && !needsReadRefresh
  const readNotice =
    needsReadRefresh && thread.unreadCount > 0
      ? 'markReadUnconfirmed'
      : readRejectedAt === refresh
        ? 'markReadRejected'
        : null
  const sending = pendingAction === 'reply'
  const name =
    thread.interlocutorName ?? t('buyer', { id: thread.interlocutorId })
  const advert = t('advert', { id: thread.advertId })

  useEffect(() => {
    if (unconfirmedReadAt !== undefined && !needsReadRefresh)
      onReadRefreshConfirmed(thread.id, refresh)
  }, [
    needsReadRefresh,
    onReadRefreshConfirmed,
    refresh,
    thread.id,
    unconfirmedReadAt,
  ])

  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches)
      sectionHeading.current?.focus()
    return () => {
      if (!mutation.current) return
      mutation.current.abort()
      onBusy(false)
    }
  }, [onBusy])

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    void olxMessagesApi.history(thread.id, accountId, { signal }).then(
      (value) => {
        if (signal.aborted) return
        setHistory(value)
        setWriteBlocked(false)
        setHistoryFailed(false)
        setHistoryChecked(refresh)
        onHistoryLoaded(thread.id, refresh, value.messages)
      },
      (error: unknown) => {
        if (signal.aborted) return
        const kind = accessFailure(normalizeApiProblem(error))
        if (kind) onAccessFailure(kind)
        setHistoryChecked(refresh)
        setHistoryFailed(true)
      },
    )
    return () => controller.abort()
  }, [
    thread.id,
    accountId,
    refresh,
    tenantSignal,
    onAccessFailure,
    onHistoryLoaded,
  ])

  useEffect(() => {
    const container = historyArea.current
    if (container) container.scrollTop = container.scrollHeight
  }, [history, confirmedReplies])

  async function sendReply() {
    if (!canSend || mutation.current) return
    const text = draft.text.trim()
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    mutation.current = controller
    setPendingAction('reply')
    onBusy(true)
    try {
      try {
        const result = await olxMessagesApi.reply(thread.id, accountId, text, {
          signal,
        })
        if (signal.aborted) return
        if (result?.sent !== true) {
          onDraft(thread.id, {
            text: draft.text,
            state: 'uncertain',
            refreshAtFailure: refresh,
          })
          return
        }
      } catch (error) {
        if (signal.aborted) return
        const problem = normalizeApiProblem(error)
        const access = accessFailure(problem)
        if (access) onAccessFailure(access)
        else if (
          problem.code === 'OLX_WRITE_DISABLED' ||
          problem.code === 'OLX_WRITE_SCOPE_REQUIRED'
        )
          setWriteBlocked(true)
        else
          onDraft(thread.id, {
            text: draft.text,
            state: replyFailed(problem),
            refreshAtFailure: refresh,
          })
        return
      }
      if (signal.aborted) return
      onReplyConfirmed(thread.id, text, history?.messages ?? [])
      onDraft(thread.id, emptyDraft)
      toast?.show({ message: t('sent'), tone: 'ok' })
      try {
        const current = await olxMessagesApi.history(thread.id, accountId, {
          signal,
        })
        if (!signal.aborted) {
          setHistory(current)
          setHistoryFailed(false)
          onHistoryLoaded(thread.id, refresh, current.messages)
        }
      } catch (error) {
        if (signal.aborted) return
        const kind = accessFailure(normalizeApiProblem(error))
        if (kind) onAccessFailure(kind)
        else onDraft(thread.id, { text: '', state: 'sentHistoryFailed' })
      }
    } finally {
      mutation.current = null
      if (!signal.aborted) {
        setPendingAction(null)
        onBusy(false)
      }
    }
  }

  async function markRead() {
    if (!canMarkRead || mutation.current) return
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    mutation.current = controller
    setPendingAction('read')
    setReadRejectedAt(undefined)
    onBusy(true)
    try {
      const result = await olxMessagesApi.markRead(thread.id, accountId, {
        signal,
      })
      if (signal.aborted) return
      if (result?.markedRead !== true) {
        onReadUnconfirmed(thread.id, refresh)
        return
      }
      if (
        document.activeElement === markReadTrigger.current ||
        document.activeElement === document.body
      )
        sectionHeading.current?.focus()
      onMarkedRead(thread.id, refresh)
      toast?.show({ message: t('markedRead'), tone: 'ok' })
    } catch (error) {
      if (signal.aborted) return
      const problem = normalizeApiProblem(error)
      const access = accessFailure(problem)
      if (access) {
        onAccessFailure(access)
        return
      }
      if (
        problem.code === 'OLX_WRITE_DISABLED' ||
        problem.code === 'OLX_WRITE_SCOPE_REQUIRED'
      )
        setWriteBlocked(true)
      if (
        problem.code === 'OLX_CONVERSATION_READ_OUTCOME_UNKNOWN' ||
        ['network', 'timeout', 'server', 'unknown'].includes(problem.kind)
      ) {
        onReadUnconfirmed(thread.id, refresh)
      } else {
        setReadRejectedAt(refresh)
      }
    } finally {
      mutation.current = null
      if (!signal.aborted) {
        setPendingAction(null)
        onBusy(false)
      }
    }
  }

  const messages = [
    ...(history?.messages ?? []),
    ...confirmedReplies.map(({ message }) => message),
  ].toSorted(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  )
  const feedback = draft.state !== 'draft' && (
    <Notice tone="warn" role="status">
      {t(draft.state)}
    </Notice>
  )

  return (
    <div className="grid min-w-0 gap-2">
      {initialHistoryLoading && (
        <p className="sr-only" role="status">
          {t('loadingHistory')}
        </p>
      )}
      <div className="lg:hidden">
        <Button
          disabled={pendingAction !== null}
          onClick={onBack}
          variant="quiet"
        >
          <ArrowLeft aria-hidden />
          {t('back')}
        </Button>
      </div>
      <Card
        title={
          <span
            ref={sectionHeading}
            tabIndex={-1}
            className="block min-w-0 break-words"
          >
            {name}
            <span className="rz-caption mt-0.5 block font-normal">
              {part?.name ? `${part.name} · ${advert}` : advert}
            </span>
          </span>
        }
        aside={
          (showMarkRead || part) && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {showMarkRead && (
                <Button
                  ref={markReadTrigger}
                  disabled={!canMarkRead}
                  aria-busy={pendingAction === 'read'}
                  onClick={() => void markRead()}
                >
                  <CheckCheck aria-hidden />
                  {t('markRead')}
                </Button>
              )}
              {part && (
                <Button
                  className="xl:hidden"
                  ref={partTrigger}
                  onClick={() => setOpenPart(true)}
                  size="icon"
                  aria-label={t('part')}
                >
                  <Package aria-hidden />
                </Button>
              )}
            </div>
          )
        }
        className={cn('grid', conversationPanel, chatPanelHeight)}
        bodyClassName={conversationBody}
      >
        <div
          aria-busy={loading}
          aria-label={t('tab')}
          className={conversationHistory}
          ref={historyArea}
          role="log"
        >
          {historyFailed && (
            <div className="p-4">
              <Notice tone="warn" role="status">
                {t('historyFailed')}
              </Notice>
            </div>
          )}
          {initialHistoryLoading ? (
            <ConversationHistorySkeleton />
          ) : messages.length === 0 ? (
            !historyFailed && (
              <p className="rz-caption m-0 p-4">{t('emptyChat')}</p>
            )
          ) : (
            <ol className="m-0 grid min-h-full list-none content-end gap-2.5 p-4">
              {messages.map((message, index) => {
                const sent = message.direction === 'sent'
                const day = format.date(message.createdAt)
                const previousDay =
                  index > 0 && format.date(messages[index - 1]?.createdAt ?? '')
                return (
                  <li className="grid min-w-0 gap-2" key={message.id}>
                    {day && day !== previousDay && (
                      <p className="rz-caption m-0 text-center">{day}</p>
                    )}
                    <div
                      className={cn(
                        'grid max-w-[88%] min-w-0 gap-1 sm:max-w-[78%]',
                        sent
                          ? 'justify-self-end text-right'
                          : 'justify-self-start',
                      )}
                    >
                      <div
                        className={cn(
                          'border-app-line text-app-strong rounded-panel grid min-w-0 gap-2 border px-3 py-2 text-left',
                          sent ? 'bg-app-selected' : 'bg-app-canvas',
                        )}
                      >
                        {message.text.trim() && (
                          <p className="m-0 min-w-0 break-words whitespace-pre-wrap">
                            {message.text}
                          </p>
                        )}
                        {message.attachments?.length ? (
                          <ul className="m-0 grid min-w-0 list-none gap-1 p-0">
                            {message.attachments.map(({ index, name }) => (
                              <li key={index} className="min-w-0">
                                <OlxChatAttachment
                                  accountId={accountId}
                                  threadId={thread.id}
                                  attachment={{
                                    messageId: message.id,
                                    index,
                                    name,
                                  }}
                                  tenantSignal={tenantSignal}
                                  onOpen={(trigger, attachment) => {
                                    attachmentTrigger.current = trigger
                                    setOpenAttachment(attachment)
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <span className="rz-caption">
                        {sent ? t('you') : name}
                        {' · '}
                        <time dateTime={message.createdAt}>
                          {format.time(message.createdAt)}
                        </time>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        {initialHistoryLoading ? (
          <ConversationComposerSkeleton />
        ) : (
          <form
            className={conversationComposer}
            onSubmit={(event) => {
              event.preventDefault()
              void sendReply()
            }}
          >
            {feedback}
            {readNotice && (
              <Notice tone="warn" role="status">
                {t(readNotice)}
              </Notice>
            )}
            {disabled && !loading && !historyFailed && (
              <Notice role="status">{t('readOnly')}</Notice>
            )}
            <Field hiddenLabel label={t('input')}>
              <TextArea
                disabled={
                  disabled ||
                  pendingAction !== null ||
                  draft.state === 'uncertain'
                }
                maxLength={4000}
                placeholder={t('placeholder')}
                rows={2}
                value={draft.text}
                onChange={(event) =>
                  onDraft(thread.id, {
                    text: event.target.value,
                    state: 'draft',
                  })
                }
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="rz-caption m-0">{t('sendHint')}</p>
              <Button disabled={!canSend} type="submit" variant="primary">
                <Send aria-hidden />
                {t(sending ? 'sending' : 'send')}
              </Button>
            </div>
          </form>
        )}
      </Card>
      {part && (
        <Sheet
          open={openPart}
          onOpenChange={setOpenPart}
          title={t('part')}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            partTrigger.current?.focus()
          }}
        >
          <ConversationPart
            part={part}
            partsHref={partsHref}
            newOrderHref={newOrderHref}
          />
        </Sheet>
      )}
      {openAttachment && (
        <OlxAttachmentSheet
          key={`${openAttachment.messageId}:${openAttachment.index}`}
          accountId={accountId}
          threadId={thread.id}
          attachment={openAttachment}
          tenantSignal={tenantSignal}
          onClose={dismissAttachment}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const trigger = attachmentTrigger.current
            const focusTarget = trigger?.isConnected
              ? trigger
              : sectionHeading.current
            focusTarget?.focus()
          }}
          onAccessFailure={handleAttachmentAccessFailure}
        />
      )}
    </div>
  )
}

function ConversationPart({
  part,
  partsHref,
  newOrderHref,
}: {
  part: OlxConversation['linkedPart']
  partsHref: string
  newOrderHref: string | undefined
}) {
  const t = useT(olxChatMessages)
  const format = useFormat()
  if (!part) return <p className="rz-caption m-0">{t('noPart')}</p>
  return (
    <div className="grid min-w-0 gap-3">
      <FactList columns={2} className="sm:grid-cols-1">
        <Fact label={t('partName')}>{part.name}</Fact>
        {part.quantityAvailable != null && (
          <Fact label={t('available')}>
            {format.number(part.quantityAvailable)}
          </Fact>
        )}
        {part.price != null && (
          <Fact label={t('price')}>
            <Amount value={part.price} currency={part.currency ?? null} />
          </Fact>
        )}
      </FactList>
      <div className="flex flex-wrap gap-2">
        {newOrderHref && (part.quantityAvailable ?? 0) > 0 && (
          <Button asChild variant="primary">
            <Link
              to={`${newOrderHref}?olxPartId=${encodeURIComponent(part.id)}`}
            >
              <Plus aria-hidden />
              {t('createOrder')}
            </Link>
          </Button>
        )}
        <Button asChild>
          <Link to={`${partsHref}/${encodeURIComponent(part.id)}`}>
            {t('openPart')}
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  )
}
