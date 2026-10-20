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
  StatusPill,
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
    <section className="rz-card min-w-0">
      <header className="rz-card__head">
        <h2 className="rz-h-card">{title}</h2>
      </header>
      <div className="rz-card__body grid gap-3">{children}</div>
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
    return <p className="rz-muted m-0">{t('pickBusinessDiagnostics')}</p>
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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="rz-muted m-0 max-w-[62ch] text-pretty">
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
            className="text-brand-text cursor-pointer border-0 bg-transparent p-0 underline underline-offset-4"
            onClick={reload}
            type="button"
          >
            {t('tryAgainLower')}
          </button>
          .
        </Notice>
      )}

      {state.kind === 'loading' && (
        <p className="rz-muted m-0" role="status">
          {t('queueLoading')}
        </p>
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

          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <section
              aria-label={t('exhaustedTitle')}
              className="rz-card min-w-0"
            >
              <header className="rz-card__head">
                <h2 className="rz-h-card">{t('exhaustedTitle')}</h2>
                {status.deadLetterIds.length > 0 && (
                  <Button
                    aria-busy={busy === 'retry'}
                    disabled={busy !== null}
                    onClick={() => void retryAll(status.deadLetterIds)}
                    size="sm"
                  >
                    {t('retryAll')}
                  </Button>
                )}
              </header>
              {status.deadLetterIds.length === 0 ? (
                <div className="rz-state min-h-0 py-8">
                  <p className="rz-state__title">{t('noProcessingErrors')}</p>
                  <p className="rz-state__body text-pretty">
                    {t('listExplain')}
                  </p>
                </div>
              ) : (
                <>
                  <ul className="divide-app-line m-0 grid list-none divide-y p-0">
                    {status.deadLetterIds.map((eventId) => (
                      <li
                        className="flex min-h-row flex-wrap items-center gap-x-4 gap-y-2 px-[var(--rz-card-p)] py-1.5"
                        key={eventId}
                      >
                        <span
                          className="rz-mono text-app-muted min-w-0 flex-1 truncate"
                          title={t('noEventDetail')}
                        >
                          {t('eventLabel', { id: eventId.slice(0, 8) })}
                        </span>
                        <Button
                          aria-busy={retrying === eventId}
                          disabled={busy !== null}
                          onClick={() => void retryOne(eventId)}
                          size="sm"
                        >
                          {retrying === eventId ? t('retrying') : t('retry')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="rz-card__foot rz-caption m-0 text-pretty"
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
                  className="grid gap-3"
                  noValidate
                  onSubmit={(event) => void saveSecret(event)}
                >
                  <Field hint={t('secretHint')} label={t('newSecret')} required>
                    <TextInput
                      autoComplete="off"
                      className="rz-mono"
                      onChange={(event) => setSecret(event.target.value)}
                      value={secret}
                    />
                  </Field>
                  <div className="rz-btn-row">
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
                  <div className="rz-inset flex flex-wrap items-center gap-3">
                    <span className="rz-mono text-app-muted min-w-0">
                      {status.enabled
                        ? '••••••••••••••••'
                        : t('secretNotSaved')}
                    </span>
                    {status.enabled && (
                      <StatusPill className="ml-auto" tone="ok">
                        {tc('saved')}
                      </StatusPill>
                    )}
                  </div>
                  <div className="rz-btn-row">
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
                className="rz-caption m-0 text-pretty"
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
