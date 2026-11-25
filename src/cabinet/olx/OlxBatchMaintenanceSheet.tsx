import { useEffect, useRef, useState } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import { olxApi, type OlxConnection } from '@/api/olx'
import { olxLiveApi } from '@/api/olx-live'
import { Button, Notice, Sheet, SkeletonFields } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { tenantRequestScope } from '../tenant-request-scope'
import {
  OlxBatchResults,
  type OlxBatchPart,
  type OlxBatchResult,
} from './OlxBatchSheet'
import { olxBatchMessages, olxBatchStopMessage } from './olx-batch-messages'
import { olxLiveMessages } from './olx-live-messages'
import { olxPublicationMessages } from './olx-publication-messages'

export type OlxBatchMaintenanceMode = 'remove' | 'exclude' | 'include'

const actions = {
  remove: { title: 'withdrawBatch', hint: 'withdrawBatchHint' },
  exclude: { title: 'excludeBatch', hint: 'excludeBatchHint' },
  include: { title: 'includeBatch', hint: 'includeBatchHint' },
} as const

export function OlxBatchMaintenanceSheet({
  mode,
  parts,
  partsHref,
  expectedAccountId,
  onChanged,
  onClose,
  returnFocus,
}: {
  mode: OlxBatchMaintenanceMode
  parts: readonly OlxBatchPart[]
  partsHref: string
  expectedAccountId?: string
  onChanged: () => void
  onClose: () => void
  returnFocus: () => void
}) {
  const t = useT(olxBatchMessages)
  const tl = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const tc = useT(commonMessages)
  const scope = useRef<AbortSignal | null>(null)
  const running = useRef(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [account, setAccount] = useState<OlxConnection | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [rows, setRows] = useState<OlxBatchResult[]>([])
  const [stop, setStop] = useState<string | null>(null)
  const action = actions[mode]
  const canRun =
    account?.available &&
    account.connected &&
    account.mode === 'oauth' &&
    account.accountId &&
    (!expectedAccountId || account.accountId === expectedAccountId) &&
    !account.reconnectRequired
  const canRemove =
    account?.writesAvailable && account.scope?.split(' ').includes('write')

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    scope.current = signal
    void olxApi.connection({ signal }).then(
      (value) => {
        if (!signal.aborted) setAccount(value)
      },
      () => {
        if (!signal.aborted) setLoadFailed(true)
      },
    )
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (complete) resultsRef.current?.focus({ preventScroll: true })
  }, [complete])

  async function apply(
    part: OlxBatchPart,
    accountId: string,
    signal: AbortSignal,
  ): Promise<OlxBatchResult & { stop?: string }> {
    if (mode !== 'remove') {
      const excluded = mode === 'exclude'
      await olxLiveApi.setExclusion(
        part.id,
        { expectedAccountId: accountId, excluded },
        { signal },
      )
      return { ...part, status: excluded ? 'excluded' : 'included' }
    }

    const publication = await olxLiveApi.publication(part.id, { signal })
    if (part.expectedAdvertId && publication.advertId !== part.expectedAdvertId)
      return { ...part, status: 'failed', issues: [tp('advertMismatch')] }
    if (!publication.advertId || publication.state === 'deleted')
      return { ...part, status: 'skipped', issues: [t('withdrawNoAdvert')] }

    const withdrawn = await olxLiveApi.remove(part.id, {
      signal,
      expectedAccountId: accountId,
      expectedAdvertId: publication.advertId,
    })
    const advertId = withdrawn.advertId ?? publication.advertId
    const { error, state } = withdrawn
    if (!error && (state === 'removed' || state === 'deleted'))
      return { ...part, status: 'withdrawn', advertId }

    if (error === 'OLX_WRITE_REJECTED' || error === 'OLX_ADVERT_MISMATCH')
      return {
        ...part,
        status: 'failed',
        advertId,
        issues: [
          tp(
            error === 'OLX_ADVERT_MISMATCH'
              ? 'advertMismatch'
              : 'providerRejected',
          ),
        ],
      }

    const stopped = error ? olxBatchStopMessage({ code: error }) : undefined
    return {
      ...part,
      status: 'pending',
      advertId,
      issues: [t(stopped ?? 'withdrawPending')],
      ...(stopped ? { stop: t(stopped) } : {}),
    }
  }

  async function run() {
    const signal = scope.current
    if (
      !canRun ||
      !account?.accountId ||
      !signal ||
      signal.aborted ||
      running.current ||
      complete ||
      (mode === 'remove' && !canRemove)
    )
      return

    running.current = true
    setBusy(true)
    let stopped = false
    let changed = false
    const results: OlxBatchResult[] = []
    try {
      for (const part of parts) {
        if (signal.aborted) return
        if (stopped) results.push({ ...part, status: 'skipped' })
        else {
          try {
            const applied = await apply(part, account.accountId, signal)
            results.push(applied)
            if (applied.stop) {
              stopped = true
              setStop(applied.stop)
            }
            if (applied.status !== 'skipped') changed = true
          } catch (failure) {
            if (signal.aborted) return
            const problem = normalizeApiProblem(failure)
            const reason = olxBatchStopMessage(problem)
            const message = reason
              ? t(reason)
              : problem.code === 'OLX_ADVERT_MISMATCH'
                ? tp('advertMismatch')
                : mode !== 'remove' && problem.code === 'OLX_BUSY'
                  ? t('partBusy')
                  : t('failedAction')
            if (reason) {
              stopped = true
              setStop(message)
            }
            results.push({ ...part, status: 'failed', issues: [message] })
          }
        }
        if (!signal.aborted) setRows([...results])
      }
      if (!signal.aborted) setComplete(true)
    } finally {
      running.current = false
      if (!signal.aborted) {
        setBusy(false)
        if (changed) onChanged()
      }
    }
  }

  return (
    <Sheet
      open
      className="sm:w-[min(520px,100vw)]"
      title={t(action.title)}
      description={t('count', { count: parts.length })}
      pending={busy}
      onOpenChange={(open) => {
        if (!open && !running.current) onClose()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        returnFocus()
      }}
      footer={
        <>
          <Button
            disabled={busy}
            onClick={onClose}
            variant={complete ? 'primary' : 'ghost'}
          >
            {complete ? t('done') : tc('cancel')}
          </Button>
          {!complete && (
            <Button
              variant={mode === 'remove' ? 'danger' : 'primary'}
              disabled={busy || !canRun || (mode === 'remove' && !canRemove)}
              onClick={() => void run()}
            >
              {t(action.title)}
            </Button>
          )}
        </>
      }
    >
      <div ref={resultsRef} tabIndex={-1} className="grid gap-4 outline-none">
        {!complete && (
          <Notice tone={mode === 'remove' ? 'warn' : 'info'}>
            {t(action.hint)}
          </Notice>
        )}
        {loadFailed ? (
          <Notice
            tone="danger"
            action={
              <Button
                onClick={() => {
                  setLoadFailed(false)
                  setAttempt((value) => value + 1)
                }}
              >
                {tl('retry')}
              </Button>
            }
          >
            {t('failedRead')}
          </Notice>
        ) : !account ? (
          <SkeletonFields count={1} label={tl('loading')} />
        ) : !canRun ? (
          <Notice tone="warn">{t('connectionRequired')}</Notice>
        ) : mode === 'remove' && !canRemove ? (
          <Notice tone="warn">{tp('noWrite')}</Notice>
        ) : null}
        {stop && (
          <Notice tone="warn" role="alert">
            {stop}
          </Notice>
        )}
        {busy && (
          <p className="rz-caption m-0" role="status">
            {t('progress', { done: rows.length, total: parts.length })}
          </p>
        )}
        {rows.length > 0 && (
          <OlxBatchResults
            rows={rows}
            busy={busy}
            partsHref={partsHref}
            onNavigate={onClose}
          />
        )}
      </div>
    </Sheet>
  )
}
