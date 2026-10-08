import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Button,
  DateValue,
  Field,
  Notice,
  TextInput,
  useToast,
} from '@/components/app'
import {
  integrationsApi,
  type NovaPoshtaWebhookStatus,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { commonMessages, useLocale, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { integrationProblemMessage } from './integration-labels'
import { npFeedMessages } from './np-feed-messages'
import { waitedFor } from './webhook-wait'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; status: NovaPoshtaWebhookStatus }
  | { kind: 'error' }

function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-6 py-5">
      <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
        {title}
      </h2>
      <div className="mt-4 grid gap-3.5">{children}</div>
    </section>
  )
}

/**
 * The carrier's status feed as a tab: whether events arrive at all, and what
 * happened to the ones that could not be processed.
 */
export function WebhookPanel({
  integrationId,
  onFailuresChange,
}: {
  integrationId: string
  onFailuresChange?: ((count: number) => void) | undefined
}) {
  const cabinet = useCabinet()
  const toast = useToast()
  const { locale } = useLocale()
  const t = useT(npFeedMessages)
  const tc = useT(commonMessages)
  const tenant = cabinet.targetTenant
  const tenantId = cabinet.snapshot?.tenantId ?? null
  const generation = cabinet.snapshot?.generation
  const scopeKey = `${generation ?? ''}:${tenant?.id ?? ''}:${integrationId}`
  const report = onFailuresChange
  const [loaded, setLoaded] = useState<{
    key: string
    state: LoadState
  } | null>(null)
  const [reloads, setReloads] = useState(0)
  const [editingSecret, setEditingSecret] = useState(false)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<null | 'secret' | 'retry'>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.integrations,
  )

  const state: LoadState =
    loaded?.key === scopeKey ? loaded.state : { kind: 'loading' }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (integrationId === '') return
    const controller = new AbortController()
    void integrationsApi
      .webhookStatus(integrationId, { signal: controller.signal })
      .then(
        (status) => {
          if (!controller.signal.aborted) {
            setLoaded({ key: scopeKey, state: { kind: 'ready', status } })
            report?.(status.deadLetters)
          }
        },
        () => {
          if (!controller.signal.aborted) {
            setLoaded({ key: scopeKey, state: { kind: 'error' } })
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, reloads, report, scopeKey])

  const reload = useCallback(() => setReloads((value) => value + 1), [])

  if (tenant === null) {
    return (
      <p className="text-app-muted text-sm">{t('pickBusinessDiagnostics')}</p>
    )
  }

  const status = state.kind === 'ready' ? state.status : null
  const receiveUrl =
    tenantId === null
      ? null
      : `${(import.meta.env['VITE_API_URL'] as string | undefined) ?? window.location.origin}/api/v1/webhooks/nova-poshta/${tenantId}/${integrationId}`

  const guard = (): boolean => {
    try {
      requireLatestMutation()
      return true
    } catch {
      setError(t('noAccess'))
      return false
    }
  }

  const saveSecret = async (event: FormEvent) => {
    event.preventDefault()
    const value = secret.trim()
    if (value === '' || busy !== null || !guard()) return
    setBusy('secret')
    setError(null)
    try {
      await integrationsApi.configureWebhook(integrationId, value)
      if (!mountedRef.current) return
      setEditingSecret(false)
      setSecret('')
      reload()
    } catch (problem) {
      if (mountedRef.current)
        setError(
          integrationProblemMessage(normalizeApiProblem(problem), locale),
        )
    } finally {
      if (mountedRef.current) setBusy(null)
    }
  }

  const retryOne = async (eventId: string) => {
    if (busy !== null || !guard()) return
    setBusy('retry')
    setRetrying(eventId)
    setError(null)
    try {
      await integrationsApi.retryWebhookEvent(integrationId, eventId)
      if (!mountedRef.current) return
      reload()
    } catch (problem) {
      if (mountedRef.current)
        setError(
          integrationProblemMessage(normalizeApiProblem(problem), locale),
        )
    } finally {
      if (mountedRef.current) {
        setBusy(null)
        setRetrying(null)
      }
    }
  }

  const retryAll = async (ids: string[]) => {
    if (busy !== null || !guard()) return
    setBusy('retry')
    setError(null)
    let done = 0
    let failed = 0
    for (const id of ids) {
      if (!mountedRef.current) return
      setRetrying(id)
      try {
        await integrationsApi.retryWebhookEvent(integrationId, id)
        done += 1
      } catch {
        // One stuck event must not stop the rest; the tally reports it.
        failed += 1
      }
    }
    if (!mountedRef.current) return
    setBusy(null)
    setRetrying(null)
    toast.show({
      tone: failed === 0 ? 'ok' : 'danger',
      message:
        failed === 0
          ? t('retriedAll', { done })
          : t('retriedSome', { done, total: ids.length, failed }),
    })
    reload()
  }

  const copyUrl = async () => {
    if (receiveUrl === null) return
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(receiveUrl)
      toast.show({ tone: 'ok', message: t('urlCopied') })
    } catch {
      setError(t('copyFailed'))
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-app-muted max-w-[62ch] text-[14px] leading-6 text-pretty">
          {t('webhookIntro')}
        </p>
        <Button disabled={busy !== null} onClick={reload}>
          {t('refreshData')}
        </Button>
      </div>

      {error !== null && <Notice tone="danger">{error}</Notice>}

      {state.kind === 'error' && (
        <Notice tone="danger">
          {t('queueError')}{' '}
          <button
            className="underline underline-offset-4"
            onClick={reload}
            type="button"
          >
            {t('tryAgainLower')}
          </button>
          .
        </Notice>
      )}

      {state.kind === 'loading' && (
        <p className="text-app-muted text-sm">{t('queueLoading')}</p>
      )}

      {status !== null && (
        <>
          {status.enabled ? (
            status.deadLetters > 0 ? (
              <Notice tone="warn">
                {t('deadLettersWarn', { count: status.deadLetters })}
              </Notice>
            ) : (
              <Notice tone="ok">{t('queueClean')}</Notice>
            )
          ) : (
            <Notice tone="danger">{t('notConfigured')}</Notice>
          )}

          <KpiStrip>
            <Kpi
              label={t('kpiReceiving')}
              meta={
                status.enabled ? t('secretSavedMeta') : t('secretMissingMeta')
              }
              tone={status.enabled ? 'plain' : 'warn'}
              value={status.enabled ? tc('yes') : tc('no')}
            />
            <Kpi
              label={t('kpiPending')}
              meta={status.pending === 0 ? t('queueEmpty') : t('inQueue')}
              unit={t('events', { count: status.pending })}
              value={String(status.pending)}
            />
            <Kpi
              label={t('kpiOldest')}
              meta={
                status.oldestPendingAt === null ? (
                  t('noUnprocessed')
                ) : (
                  <>
                    {t('eventFrom')}{' '}
                    <DateValue value={status.oldestPendingAt} />
                  </>
                )
              }
              tone={status.oldestPendingAt === null ? 'plain' : 'warn'}
              value={
                status.oldestPendingAt === null
                  ? '—'
                  : waitedFor(status.oldestPendingAt, locale)
              }
            />
            <Kpi
              label={t('kpiExhausted')}
              meta={
                status.deadLetters === 0
                  ? t('noErrors')
                  : t('manualRetryNeeded')
              }
              tone={status.deadLetters === 0 ? 'plain' : 'warn'}
              unit={t('events', { count: status.deadLetters })}
              value={String(status.deadLetters)}
            />
          </KpiStrip>

          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <section
              aria-label={t('exhaustedTitle')}
              className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-6 pt-5 pb-4">
                <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
                  {t('exhaustedTitle')}
                </h2>
                {status.deadLetterIds.length > 0 && (
                  <Button
                    aria-busy={busy === 'retry'}
                    disabled={busy !== null}
                    onClick={() => void retryAll(status.deadLetterIds)}
                  >
                    {t('retryAll')}
                  </Button>
                )}
              </div>
              {status.deadLetterIds.length === 0 ? (
                <div className="border-app-line grid justify-items-center gap-2 border-t px-6 py-10 text-center">
                  <p className="text-[17px] font-bold tracking-[-0.01em] text-white">
                    {t('noProcessingErrors')}
                  </p>
                  <p className="text-app-muted max-w-[44ch] text-[13px] leading-5 text-pretty">
                    {t('listExplain')}
                  </p>
                </div>
              ) : (
                <>
                  <ul className="divide-app-line border-app-line grid divide-y border-t">
                    {status.deadLetterIds.map((eventId) => (
                      <li
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5"
                        key={eventId}
                      >
                        <span
                          className="text-app-muted min-w-0 flex-1 truncate font-mono text-[13px]"
                          title={t('noEventDetail')}
                        >
                          {t('eventLabel', { id: eventId.slice(0, 8) })}
                        </span>
                        <Button
                          aria-busy={retrying === eventId}
                          disabled={busy !== null}
                          onClick={() => void retryOne(eventId)}
                        >
                          {retrying === eventId ? t('retrying') : t('retry')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="text-app-dim border-app-line border-t px-6 py-4 text-[13px] leading-5 text-pretty"
                    title={t('noEventDetail')}
                  >
                    {t('deadListNote')}
                  </p>
                </>
              )}
            </section>

            <Card title={t('secretCard')}>
              {editingSecret ? (
                <form
                  className="grid gap-3.5"
                  noValidate
                  onSubmit={(event) => void saveSecret(event)}
                >
                  <Field hint={t('secretHint')} label={t('newSecret')} required>
                    <TextInput
                      autoComplete="off"
                      className="font-mono"
                      onChange={(event) => setSecret(event.target.value)}
                      value={secret}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      aria-busy={busy === 'secret'}
                      disabled={busy !== null || secret.trim() === ''}
                      type="submit"
                      variant="primary"
                    >
                      {t('saveSecret')}
                    </Button>
                    <Button
                      disabled={busy !== null}
                      onClick={() => {
                        setEditingSecret(false)
                        setSecret('')
                      }}
                    >
                      {tc('cancel')}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="border-app-line bg-app-input flex flex-wrap items-center gap-3 rounded-[11px] border px-3.5 py-3">
                    <span className="text-app-muted min-w-0 font-mono text-[15px] tracking-[0.12em]">
                      {status.enabled
                        ? '••••••••••••••••'
                        : t('secretNotSaved')}
                    </span>
                    {status.enabled && (
                      <span className="text-state-ok ml-auto text-[12px] font-bold">
                        {tc('saved')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      disabled={busy !== null}
                      onClick={() => setEditingSecret(true)}
                      variant={status.enabled ? 'ghost' : 'primary'}
                    >
                      {status.enabled ? t('replaceSecret') : t('addSecret')}
                    </Button>
                    <Button
                      disabled={busy !== null || receiveUrl === null}
                      onClick={() => void copyUrl()}
                    >
                      {t('copyUrl')}
                    </Button>
                  </div>
                </>
              )}
              <Notice tone="warn">{t('secretWarn')}</Notice>
              <p
                className="text-app-dim text-[12.5px] leading-5 text-pretty"
                title={t('noFeedStats')}
              >
                {t('feedStatsNote')}
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
