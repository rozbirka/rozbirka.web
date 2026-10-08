import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, PlugZap } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  DateValue,
  Field,
  Notice,
  StatusPill,
  TextInput,
} from '@/components/app'
import {
  integrationsApi,
  type NovaPoshtaTrackingSubscription,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { commonMessages, useLocale, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { tenantRequestScope } from '../tenant-request-scope'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  isTrackingTransitional,
  trackingProblemMessage,
  trackingReasonMessage,
  trackingStatePresentation,
} from './integration-labels'
import { npFeedMessages } from './np-feed-messages'

/** A state that changes on its own is worth re-reading this often. */
const POLL_INTERVAL_MS = 5_000

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; subscription: NovaPoshtaTrackingSubscription }
  | { kind: 'denied' }
  | { kind: 'error' }

type Busy = 'connect' | 'disconnect' | 'retry'

/** Disconnecting is offered wherever there is something to disconnect. */
const CAN_DISCONNECT = new Set([
  'Connected',
  'AwaitingVerification',
  'NeedsCredentials',
  'NeedsReview',
  'RetryPending',
])

/**
 * Everything the operator typed or was last told, and the yard it belongs to.
 *
 * Carrying the scope inside the state is what makes switching yards safe: a
 * key, a failure or an open form belongs to one tenant and one integration, and
 * is simply never read again under another.
 */
interface Session {
  key: string
  busy: Busy | null
  error: string | null
  keyForm: boolean
  keyPrompt: string | null
  keyError: string | null
  apiKey: string
  revealed: boolean
  confirming: boolean
  confirmError: string | null
}

const blank = (key: string): Session => ({
  key,
  busy: null,
  error: null,
  keyForm: false,
  keyPrompt: null,
  keyError: null,
  apiKey: '',
  revealed: false,
  confirming: false,
  confirmError: null,
})

/**
 * Automatic delivery updates as one section: Core registers the subscription
 * with Nova Poshta, attaches every new waybill and waits for the carrier's
 * first callback. The yard sees one state and at most one action — never a
 * callback URL or a webhook secret, which are the service's business.
 *
 * Nothing here is optimistic. Every command is answered with "accepted", so the
 * panel re-reads the state and shows what the server says: connected only when
 * the server says `Connected`, disconnected only when it says `Disabled`.
 */
export function TrackingSubscriptionPanel({
  integrationId,
}: {
  integrationId: string
}) {
  const cabinet = useCabinet()
  const { locale } = useLocale()
  const t = useT(npFeedMessages)
  const tc = useT(commonMessages)
  const tenant = cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const scopeKey = `${generation ?? ''}:${tenant?.id ?? ''}:${integrationId}`
  const [loaded, setLoaded] = useState<{
    key: string
    state: LoadState
  } | null>(null)
  const [stored, setStored] = useState<Session>(() => blank(scopeKey))
  const mountedRef = useRef(true)
  const readRef = useRef<(() => Promise<void>) | null>(null)
  const transitionalRef = useRef(false)
  const runningRef = useRef(false)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.integrations,
  )

  const state: LoadState =
    loaded?.key === scopeKey ? loaded.state : { kind: 'loading' }
  const subscription = state.kind === 'ready' ? state.subscription : null
  const session = stored.key === scopeKey ? stored : blank(scopeKey)

  const patch = useCallback(
    (next: Partial<Session>) => {
      setStored((current) => ({
        ...(current.key === scopeKey ? current : blank(scopeKey)),
        ...next,
        key: scopeKey,
      }))
    },
    [scopeKey],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (integrationId === '') return
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    let reading = false
    const read = async () => {
      // One read at a time: a slow answer must not stack requests behind it.
      if (reading || signal.aborted) return
      reading = true
      try {
        const next = await integrationsApi.trackingSubscription(integrationId, {
          signal,
        })
        if (signal.aborted) return
        setLoaded({
          key: scopeKey,
          state: { kind: 'ready', subscription: next },
        })
      } catch (problem) {
        if (signal.aborted) return
        const { kind } = normalizeApiProblem(problem)
        setLoaded((current) => {
          if (kind === 'forbidden')
            return { key: scopeKey, state: { kind: 'denied' } }
          // A state already on screen survives a failed refresh: blanking it
          // would read as "the subscription is gone".
          if (current?.key === scopeKey && current.state.kind === 'ready')
            return current
          return { key: scopeKey, state: { kind: 'error' } }
        })
      } finally {
        reading = false
      }
    }
    readRef.current = read
    void read()
    const interval = window.setInterval(() => {
      if (transitionalRef.current) void read()
    }, POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
      readRef.current = null
      controller.abort()
    }
  }, [integrationId, scopeKey])

  useEffect(() => {
    transitionalRef.current =
      subscription !== null && isTrackingTransitional(subscription.state)
  }, [subscription])

  const refresh = useCallback(() => {
    void readRef.current?.()
  }, [])

  const run = useCallback(
    async (kind: Busy, action: () => Promise<void>, carriedKey: boolean) => {
      // The ref, not the rendered state: two clicks inside one frame would both
      // see `busy === null` and ask the server for the same work twice.
      if (runningRef.current) return
      try {
        requireLatestMutation()
      } catch {
        patch({ error: t('noAccess') })
        return
      }
      runningRef.current = true
      patch({ busy: kind, error: null, keyError: null, confirmError: null })
      try {
        await action()
        if (!mountedRef.current) return
        // The key has done its job; nothing keeps it in memory afterwards.
        patch({
          busy: null,
          keyForm: false,
          keyPrompt: null,
          apiKey: '',
          revealed: false,
          confirming: false,
        })
      } catch (problem) {
        if (!mountedRef.current) return
        const normalized = normalizeApiProblem(problem)
        const message = trackingProblemMessage(normalized, locale)
        const needsKey =
          normalized.code?.toLowerCase() === 'tracking_credentials_required'
        patch({
          busy: null,
          ...(needsKey
            ? { keyForm: true, keyPrompt: message }
            : carriedKey
              ? { keyError: message }
              : kind === 'disconnect'
                ? // The question is still on screen: the answer belongs beside
                  // the button that failed, not behind the dialog.
                  { confirmError: message }
                : { error: message }),
        })
      } finally {
        runningRef.current = false
        // A command may have been accepted even when its answer never arrived,
        // so the state is re-read either way — and the command never resent.
        refresh()
      }
    },
    [locale, patch, refresh, requireLatestMutation, t],
  )

  const connect = (key: string | null) =>
    void run(
      'connect',
      () => integrationsApi.connectTracking(integrationId, key),
      key !== null,
    )

  const submitKey = (event: FormEvent) => {
    event.preventDefault()
    const value = session.apiKey.trim()
    if (value === '') {
      patch({ keyError: t('pasteKey') })
      return
    }
    connect(value)
  }

  if (tenant === null) {
    return <p className="text-app-muted text-sm">{t('pickBusinessTracking')}</p>
  }

  const { busy } = session
  const presentation =
    subscription === null
      ? null
      : trackingStatePresentation(subscription.state, locale)
  const reason =
    subscription === null
      ? null
      : trackingReasonMessage(subscription.reasonCode, locale)
  const callbackReady = subscription?.publicCallbackConfigured ?? false

  return (
    <section
      aria-label={t('trackingTitle')}
      className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-6 py-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
          {t('trackingTitle')}
        </h2>
        {presentation !== null && (
          <StatusPill tone={presentation.tone}>{presentation.label}</StatusPill>
        )}
      </div>
      <p className="text-app-muted mt-2 max-w-[62ch] text-[13.5px] leading-5 text-pretty">
        {t('trackingIntro')}
      </p>

      <div className="mt-4 grid gap-3.5">
        {state.kind === 'loading' && (
          <p className="text-app-muted text-sm">{t('readingState')}</p>
        )}

        {state.kind === 'denied' && <Notice tone="warn">{t('denied')}</Notice>}

        {state.kind === 'error' && (
          <Notice tone="danger">
            {t('stateError')}{' '}
            <button
              className="underline underline-offset-4"
              onClick={refresh}
              type="button"
            >
              {t('tryAgainLower')}
            </button>
            .
          </Notice>
        )}

        {session.error !== null && (
          <Notice tone="danger">{session.error}</Notice>
        )}

        {subscription !== null && presentation !== null && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p
                className={`text-[16px] font-bold ${
                  presentation.tone === 'danger'
                    ? 'text-state-danger'
                    : 'text-app-ink'
                }`}
              >
                {presentation.detail}
              </p>
              <p className="text-app-dim font-mono text-[12px]">
                {subscription.lastCallbackAt === null ? (
                  t('noUpdatesYet')
                ) : (
                  <>
                    {t('lastUpdate')}{' '}
                    <DateValue value={subscription.lastCallbackAt} />
                  </>
                )}
              </p>
            </div>

            {reason !== null && <Notice tone="warn">{reason}</Notice>}

            {!callbackReady && (
              <Notice tone="warn">{t('callbackUnavailable')}</Notice>
            )}

            {subscription.pendingNumbers > 0 && (
              <p className="text-app-muted text-[13px] leading-5">
                {t('pendingNumbers', { count: subscription.pendingNumbers })}
              </p>
            )}

            {subscription.unconfirmedNumbers > 0 && (
              <Notice tone="warn">
                {t('unconfirmed', { count: subscription.unconfirmedNumbers })}
              </Notice>
            )}

            {session.keyForm ? (
              <form className="grid gap-3.5" noValidate onSubmit={submitKey}>
                {session.keyPrompt !== null && (
                  <Notice tone="warn">{session.keyPrompt}</Notice>
                )}
                <Field
                  error={session.keyError}
                  hint={t('keyHint')}
                  label={t('keyLabel')}
                  required
                >
                  <div className="flex items-start gap-2">
                    <TextInput
                      autoComplete="off"
                      className="font-mono"
                      onChange={(event) =>
                        patch({ apiKey: event.target.value, keyError: null })
                      }
                      placeholder={t('keyPlaceholder')}
                      spellCheck={false}
                      type={session.revealed ? 'text' : 'password'}
                      value={session.apiKey}
                    />
                    <Button
                      aria-label={
                        session.revealed ? t('hideKey') : t('showKey')
                      }
                      aria-pressed={session.revealed}
                      onClick={() => patch({ revealed: !session.revealed })}
                      size="icon"
                      title={session.revealed ? t('hideKey') : t('showKey')}
                    >
                      {session.revealed ? (
                        <EyeOff aria-hidden />
                      ) : (
                        <Eye aria-hidden />
                      )}
                    </Button>
                  </div>
                </Field>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    aria-busy={busy === 'connect'}
                    disabled={busy !== null || !callbackReady}
                    title={callbackReady ? undefined : t('callbackUnavailable')}
                    type="submit"
                    variant="primary"
                  >
                    {busy === 'connect' ? t('connecting') : t('connect')}
                  </Button>
                  <Button
                    disabled={busy !== null}
                    onClick={() =>
                      patch({
                        keyForm: false,
                        keyPrompt: null,
                        keyError: null,
                        apiKey: '',
                        revealed: false,
                      })
                    }
                  >
                    {tc('cancel')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {subscription.state === 'Disabled' && (
                  <Button
                    aria-busy={busy === 'connect'}
                    disabled={busy !== null || !callbackReady}
                    onClick={() => connect(null)}
                    title={callbackReady ? undefined : t('callbackUnavailable')}
                    variant="primary"
                  >
                    {busy === 'connect' ? t('connecting') : t('connect')}
                  </Button>
                )}

                {subscription.state === 'NeedsCredentials' && (
                  <Button
                    disabled={busy !== null}
                    onClick={() => patch({ keyForm: true, keyPrompt: null })}
                    variant="primary"
                  >
                    {t('enterKey')}
                  </Button>
                )}

                {subscription.canRetry && (
                  <Button
                    aria-busy={busy === 'retry'}
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        'retry',
                        () => integrationsApi.retryTracking(integrationId),
                        false,
                      )
                    }
                  >
                    {busy === 'retry' ? t('retrying') : t('retryNow')}
                  </Button>
                )}

                {CAN_DISCONNECT.has(subscription.state) && (
                  <Button
                    disabled={busy !== null}
                    onClick={() => patch({ confirming: true })}
                    variant="ghost"
                  >
                    {t('disconnect')}
                  </Button>
                )}

                <Button disabled={busy !== null} onClick={refresh}>
                  {t('refreshState')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        confirmLabel={t('disconnect')}
        consequence={t('disconnectConsequence')}
        error={session.confirmError}
        icon={PlugZap}
        onConfirm={() =>
          void run(
            'disconnect',
            () => integrationsApi.disconnectTracking(integrationId),
            false,
          )
        }
        onOpenChange={(open) =>
          patch({ confirming: open, ...(open ? {} : { confirmError: null }) })
        }
        open={session.confirming}
        pending={busy === 'disconnect'}
        title={t('disconnectTitle')}
      />
    </section>
  )
}
