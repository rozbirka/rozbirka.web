import { Card, Skeleton } from '@/components/app'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { olxChatMessages } from './olx-chat-messages'

export const chatGrid =
  'grid min-w-0 items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]'
export const chatGridWithPart = 'xl:grid-cols-[17.5rem_minmax(0,1fr)_15.5rem]'
export const chatPanelHeight =
  'min-h-0 lg:h-[min(38.25rem,max(30rem,calc(100dvh-12rem)))]'
export const conversationPanel =
  'min-h-[min(31rem,calc(100dvh-9rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden'
export const conversationBody =
  'grid min-h-0 grid-rows-[minmax(0,1fr)_auto] p-0'
export const conversationHistory =
  'max-h-[55dvh] min-h-0 overflow-y-auto lg:max-h-none'
export const conversationComposer =
  'border-app-line grid min-w-0 gap-2 border-t p-3'

const threadNames = ['w-20', 'w-24', 'w-16', 'w-24', 'w-20']
const bubbles = [
  { side: 'start', width: 'w-3/5', line: 'w-4/5' },
  { side: 'end', width: 'w-2/3', line: 'w-full', second: 'w-3/5' },
  { side: 'start', width: 'w-2/5', line: 'w-full' },
  { side: 'end', width: 'w-1/2', line: 'w-5/6' },
] as const

export function ConversationHistorySkeleton() {
  return (
    <div aria-hidden className="grid min-h-full content-end gap-2.5 p-4">
      <Skeleton className="mx-auto mb-1 w-18" />
      {bubbles.map(({ side, width, line, ...detail }) => {
        const outgoing = side === 'end'
        return (
          <div
            key={width}
            className={cn(
              'grid min-w-0 max-w-xs gap-1.5',
              width,
              outgoing ? 'justify-self-end' : 'justify-self-start',
            )}
          >
            <div
              className={cn(
                'border-app-line rounded-panel grid min-w-0 gap-2 border px-3 py-2.5',
                outgoing ? 'bg-app-selected' : 'bg-app-canvas',
              )}
            >
              <Skeleton className={line} />
              {'second' in detail && <Skeleton className={detail.second} />}
            </div>
            <Skeleton
              className={cn('h-2 w-16', outgoing && 'justify-self-end')}
            />
          </div>
        )
      })}
    </div>
  )
}

export function ConversationComposerSkeleton() {
  return (
    <div aria-hidden className={conversationComposer}>
      <div className="border-app-line bg-app-raised rounded-rz-sm min-h-20 border px-3 py-3">
        <Skeleton className="w-32 max-w-full" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="w-2/5 max-w-48" />
        <Skeleton className="h-control w-24 shrink-0" />
      </div>
    </div>
  )
}

export function OlxMessagesSkeleton({
  canReadParts,
}: {
  canReadParts: boolean
}) {
  const t = useT(olxChatMessages)
  return (
    <div className="grid min-w-0 gap-3">
      <p className="sr-only" role="status">
        {t('loadingThreads')}
      </p>
      <div aria-hidden className="flex justify-end">
        <Skeleton className="h-control w-44" />
      </div>
      <div
        aria-hidden
        className={cn(chatGrid, canReadParts && chatGridWithPart)}
      >
        <Card
          title={t('threads')}
          className={cn('overflow-hidden', chatPanelHeight)}
          bodyClassName="p-0"
        >
          <div className="border-app-line border-b px-3 py-2">
            <Skeleton className="h-control w-36" />
          </div>
          <div className="divide-app-line divide-y">
            {threadNames.map((nameWidth, index) => (
              <div
                key={index}
                className="grid min-h-17 grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 px-3 py-2.5"
              >
                <Skeleton className="rounded-rz-sm size-8" />
                <div className="grid min-w-0 gap-1.5 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className={nameWidth} />
                    {index === 0 && (
                      <Skeleton className="h-3 w-6 rounded-full" />
                    )}
                  </div>
                  <Skeleton className={index % 2 === 0 ? 'w-5/6' : 'w-3/5'} />
                  <Skeleton className="h-2 w-24" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title={
            <span className="grid min-h-9 w-52 max-w-full content-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="w-full" />
            </span>
          }
          className={cn('hidden lg:grid', conversationPanel, chatPanelHeight)}
          bodyClassName={conversationBody}
        >
          <div className={conversationHistory}>
            <ConversationHistorySkeleton />
          </div>
          <ConversationComposerSkeleton />
        </Card>
        {canReadParts && (
          <Card title={t('part')} className="hidden xl:block">
            <div className="grid gap-3">
              {['w-4/5', 'w-9', 'w-16'].map((width) => (
                <div key={width} className="grid gap-2 py-0.5">
                  <Skeleton className="w-16" />
                  <Skeleton className={cn('h-3', width)} />
                </div>
              ))}
              <div className="grid gap-2">
                <Skeleton className="h-control w-full" />
                <Skeleton className="h-control w-32" />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
