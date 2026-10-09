import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import {
  Button,
  DateValue,
  Field,
  Notice,
  StatusPill,
  TextInput,
  useOptionalToast,
} from '@/components/app'
import {
  integrationsApi,
  type Integration,
  type IntegrationDiagnostics,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { commonMessages, useLocale, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { moduleLabel, navigationGroupLabel } from '../module-messages'
import { cabinetModules } from '../module-registry'
import { RedesignShell } from '../redesign-shell'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { DeliveryPreferencesPanel } from './delivery-preferences-panel'
import { DispatchPointsPanel } from './dispatch-points-panel'
import { TrackingSubscriptionPanel } from './tracking-panel'
import { WebhookPanel } from './webhook-panel'
import { Switch } from './dispatch-point-form'
import {
  diagnosticCheckLabel,
  integrationErrorMessage,
  integrationMark,
  integrationProblemMessage,
  integrationStatusPresentation,
  isCountryUnavailableProblem,
  isNovaPoshtaAvailable,
} from './integration-labels'
import { integrationsMessages } from './integrations-messages'
import { NovaPoshtaUnavailable } from './nova-poshta-unavailable'

const FACTS = ['fact1', 'fact2', 'fact3', 'fact4'] as const

type Tab = 'overview' | 'points' | 'statuses' | 'settings'

const TAB_SUFFIX: Record<Tab, string> = {
  overview: '',
  points: 'dispatch-points',
  statuses: 'webhook',
  settings: 'settings',
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; integration: Integration }
  /** `unavailable`: Core refused NP for this business's country. */
  | { kind: 'error'; unavailable: boolean }

function Card({
  title,
  tone,
  children,
}: {
  title: ReactNode
  tone?: 'plain' | 'danger' | 'ok'
  children: ReactNode
}) {
  const border =
    tone === 'danger'
      ? 'border-state-danger/30'
      : tone === 'ok'
        ? 'border-state-ok/25'
        : 'border-app-line'
  return (
    <section
      className={`bg-app-raised min-w-0 rounded-[20px] border px-6 py-5 ${border}`}
    >
      <h2
        className={`text-[17px] font-bold tracking-[-0.01em] ${
          tone === 'danger' ? 'text-state-danger' : 'text-white'
        }`}
      >
        {title}
      </h2>
      <div className="mt-4 grid gap-3.5">{children}</div>
    </section>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
  title,
}: {
  label: string
  value: ReactNode
  note: string
  tone?: 'plain' | 'danger'
  title?: string
}) {
  return (
    <div
      className="border-app-line bg-app-raised min-w-0 rounded-[18px] border px-5 py-4.5"
      title={title}
    >
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p
        className={`mt-3 text-[26px] leading-none font-extrabold tracking-[-0.02em] ${
          tone === 'danger' ? 'text-state-danger' : 'text-app-ink'
        }`}
      >
        {value}
      </p>
      <p className="text-app-dim mt-1.5 text-[12px] leading-[1.45] text-pretty">
        {note}
      </p>
    </div>
  )
}

/**
 * One carrier, four tabs: what it is doing, where parcels leave from, whether
 * its status feed arrives, and the key it all hangs on. Each tab is its own
 * route, so a link into the diagnostics still opens the diagnostics.
 */
export function NovaPoshtaScreen() {
  const cabinet = useCabinet()
  const params = useParams()
  const location = useLocation()
  const integrationId = params['integrationId'] ?? ''
  const { locale } = useLocale()
  const t = useT(integrationsMessages)
  const tc = useT(commonMessages)
  const { countryCode } = useTenantSettings()
  // Outside Ukraine nothing is read: Core would refuse every request anyway.
  const countryBlocked = !isNovaPoshtaAvailable(countryCode)
  const tenant = cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const scopeKey = `${generation ?? ''}:${tenant?.id ?? ''}:${integrationId}`
  const [loaded, setLoaded] = useState<{
    key: string
    state: LoadState
  } | null>(null)
  const [diagnostics, setDiagnostics] = useState<IntegrationDiagnostics | null>(
    null,
  )
  const [points, setPoints] = useState<number | null>(null)
  const [failures, setFailures] = useState<number | null>(null)
  const [editingKey, setEditingKey] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'verify' | 'toggle'>(null)
  const [error, setError] = useState<string | null>(null)
  const toast = useOptionalToast()
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
    if (integrationId === '' || countryBlocked) return
    const controller = new AbortController()
    void integrationsApi
      .getById(integrationId, { signal: controller.signal })
      .then(
        (integration) => {
          if (!controller.signal.aborted)
            setLoaded({ key: scopeKey, state: { kind: 'ready', integration } })
        },
        (problem: unknown) => {
          if (!controller.signal.aborted)
            setLoaded({
              key: scopeKey,
              state: {
                kind: 'error',
                unavailable: isCountryUnavailableProblem(
                  normalizeApiProblem(problem),
                ),
              },
            })
        },
      )
    return () => controller.abort()
  }, [countryBlocked, integrationId, scopeKey])

  // Tab counters, read once for the header: a badge must not wait for its own
  // tab to be opened. Each panel reports its number back after a change.
  useEffect(() => {
    if (integrationId === '' || countryBlocked) return
    const controller = new AbortController()
    void integrationsApi
      .dispatchPoints(integrationId, { signal: controller.signal })
      .then(
        (list) => {
          if (!controller.signal.aborted) setPoints(list.length)
        },
        () => undefined,
      )
    void integrationsApi
      .webhookStatus(integrationId, { signal: controller.signal })
      .then(
        (status) => {
          if (!controller.signal.aborted) setFailures(status.deadLetters)
        },
        () => undefined,
      )
    return () => controller.abort()
  }, [countryBlocked, integrationId, scopeKey])

  if (tenant === null) {
    return <p className="text-app-muted text-sm">{t('pickBusinessOne')}</p>
  }

  const settingsLabel = navigationGroupLabel('settings', locale) ?? ''

  const listPath = cabinetPath(tenant.slug, 'integrations')
  const tabPath = (target: Tab) =>
    cabinetPath(
      tenant.slug,
      'integrations',
      TAB_SUFFIX[target] === ''
        ? integrationId
        : `${integrationId}/${TAB_SUFFIX[target]}`,
    )
  const tab: Tab = location.pathname.endsWith('/dispatch-points')
    ? 'points'
    : location.pathname.endsWith('/webhook')
      ? 'statuses'
      : location.pathname.endsWith('/settings')
        ? 'settings'
        : 'overview'

  const backToList = (
    <Button asChild>
      <Link to={listPath}>
        <ArrowLeft aria-hidden />
        {moduleLabel('integrations', locale)}
      </Link>
    </Button>
  )

  if (countryBlocked || (state.kind === 'error' && state.unavailable)) {
    return (
      <RedesignShell
        actions={backToList}
        crumb={`${settingsLabel} · ${t('crumbIntegration')}`}
      >
        <NovaPoshtaUnavailable />
      </RedesignShell>
    )
  }

  if (state.kind !== 'ready') {
    return (
      <RedesignShell crumb={`${settingsLabel} · ${t('crumbIntegration')}`}>
        {state.kind === 'loading' ? (
          <p className="text-app-muted text-sm">{t('loading')}</p>
        ) : (
          <Notice tone="danger">
            {t('openError')}{' '}
            <Link className="underline underline-offset-4" to={listPath}>
              {t('backToList')}
            </Link>
          </Notice>
        )}
      </RedesignShell>
    )
  }

  const integration = state.integration
  const status = integrationStatusPresentation(integration.status, locale)
  const active = integration.status === 'active'
  const configured = integration.configured
  const failing = integration.status === 'error'

  const apply = (updated: Integration) => {
    if (!mountedRef.current) return
    setLoaded({ key: scopeKey, state: { kind: 'ready', integration: updated } })
  }

  const run = async (
    kind: 'save' | 'verify' | 'toggle',
    action: () => Promise<Integration>,
    successMessage: string,
  ): Promise<boolean> => {
    if (busy !== null) return false
    try {
      requireLatestMutation()
    } catch {
      setError(t('noAccess'))
      return false
    }
    setBusy(kind)
    setError(null)
    try {
      apply(await action())
      if (kind === 'save' && mountedRef.current) {
        setEditingKey(false)
        setKey('')
      }
      toast?.show({ tone: 'ok', message: successMessage })
      return true
    } catch (problem) {
      if (mountedRef.current)
        setError(
          integrationProblemMessage(normalizeApiProblem(problem), locale),
        )
      return false
    } finally {
      if (mountedRef.current) setBusy(null)
    }
  }

  const verify = async () => {
    const verified = await run(
      'verify',
      () => integrationsApi.verify(integration.id),
      t('verified'),
    )
    if (!verified || !mountedRef.current) return
    try {
      setDiagnostics(await integrationsApi.diagnose(integration.id))
    } catch {
      // The verification result already stands on its own; a missing
      // per-check breakdown is not a second failure to report.
      if (mountedRef.current) setDiagnostics(null)
    }
  }

  const saveKey = async (event: FormEvent) => {
    event.preventDefault()
    const value = key.trim()
    if (value === '') return
    await run(
      'save',
      () => integrationsApi.saveNovaPoshtaKey(integration.id, value),
      t('keySaved'),
    )
  }

  const toggle = () =>
    void run(
      'toggle',
      () =>
        active
          ? integrationsApi.deactivate(integration.id)
          : integrationsApi.activate(integration.id),
      active ? t('turnedOff') : t('turnedOn'),
    )

  const tabs: {
    id: Tab
    label: string
    badge?: string
    danger?: boolean
  }[] = [
    { id: 'overview', label: t('tabOverview') },
    {
      id: 'points',
      label: t('tabPoints'),
      ...(points == null ? {} : { badge: String(points) }),
    },
    {
      id: 'statuses',
      label: t('tabStatuses'),
      ...(failures !== null && failures > 0
        ? { badge: t('failuresBadge', { count: failures }), danger: true }
        : {}),
    },
    { id: 'settings', label: t('tabSettings') },
  ]

  return (
    <RedesignShell
      actions={backToList}
      crumb={`${settingsLabel} · ${integration.displayName}`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="border-app-line text-app-muted inline-flex size-14 shrink-0 items-center justify-center rounded-[15px] border font-mono text-[15px]"
        >
          {integrationMark(integration.code, locale)}
        </span>
        <div className="min-w-0 flex-[1_1_300px]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white sm:text-[38px]">
              {integration.displayName}
            </h1>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
          <p className="text-app-muted mt-2.5 max-w-[62ch] text-[14px] leading-6 text-pretty">
            {t('intro')}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <span
            className={`text-[14px] font-semibold ${active ? 'text-app-ink' : 'text-app-muted'}`}
          >
            {active ? t('stateOn') : t('stateOff')}
          </span>
          <Switch
            checked={active}
            disabled={busy !== null || (!active && !configured)}
            label={t('switchLabel')}
            onChange={toggle}
            title={!active && !configured ? t('saveKeyFirst') : undefined}
          />
        </div>
      </div>

      <nav aria-label={t('sectionsNav')}>
        <ul className="border-app-line-2 flex flex-wrap items-end gap-1 border-b">
          {tabs.map((item) => (
            <li key={item.id}>
              <Link
                aria-current={tab === item.id ? 'page' : undefined}
                className={`-mb-px flex min-h-11 items-center gap-2.5 border-b-2 px-3.5 text-[14px] font-bold ${
                  tab === item.id
                    ? 'border-brand text-white'
                    : 'text-app-muted hover:text-app-ink border-transparent'
                }`}
                to={tabPath(item.id)}
              >
                {item.label}
                {item.badge !== undefined && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-normal ${
                      item.danger === true
                        ? 'bg-state-danger-soft text-state-danger'
                        : 'text-app-muted bg-white/[0.06]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {error !== null && <Notice tone="danger">{error}</Notice>}

      {tab === 'overview' && (
        <div className="grid gap-5">
          <Card
            title={t('statusCard')}
            tone={failing ? 'danger' : active ? 'ok' : 'plain'}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p
                className={`text-[16px] font-bold ${failing ? 'text-state-danger' : 'text-app-ink'}`}
              >
                {failing
                  ? t('rejected')
                  : configured
                    ? active
                      ? t('working')
                      : t('integrationOff')
                    : t('noKeyYet')}
              </p>
              <p className="text-app-dim font-mono text-[12px]">
                {integration.verifiedAt === null ? (
                  t('notCheckedYet')
                ) : (
                  <>
                    {t('checkedPrefix')}{' '}
                    <DateValue value={integration.verifiedAt} />
                  </>
                )}
              </p>
            </div>
            <p className="text-app-muted text-[13px] leading-5 text-pretty">
              {integration.lastErrorCode === null
                ? configured
                  ? t('keyAccepted')
                  : t('addKeyHint')
                : integrationErrorMessage(integration.lastErrorCode, locale)}
            </p>
            {diagnostics !== null && (
              <ul className="grid gap-2.5">
                {diagnostics.checks.map((check) => (
                  <li
                    className="flex items-start gap-2.5 text-[13.5px] leading-5"
                    key={check.code}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        check.status === 'passed'
                          ? 'bg-state-ok'
                          : 'bg-state-danger'
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="text-app-ink block">
                        {diagnosticCheckLabel(check.code, locale)}
                      </span>
                      {check.errorCode !== null && (
                        <span className="text-app-muted mt-0.5 block text-[12.5px] text-pretty">
                          {integrationErrorMessage(check.errorCode, locale)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2.5">
              <Button
                aria-busy={busy === 'verify'}
                disabled={busy !== null || !configured}
                onClick={() => void verify()}
                title={configured ? undefined : t('nothingToVerify')}
              >
                {busy === 'verify' ? t('verifying') : t('verifyAgain')}
              </Button>
              {(failing || !configured) && (
                <Button asChild variant="primary">
                  <Link to={tabPath('settings')}>
                    {configured ? t('replaceKey') : t('addKey')}
                  </Link>
                </Button>
              )}
            </div>
          </Card>

          <div className="grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <Stat
              label={t('statPoints')}
              note={t('statPointsNote')}
              value={points == null ? '—' : String(points)}
            />
            <Stat
              label={t('statFailures')}
              note={
                failures === null || failures === 0
                  ? t('statFailuresOk')
                  : t('statFailuresBad')
              }
              tone={failures !== null && failures > 0 ? 'danger' : 'plain'}
              value={failures == null ? '—' : String(failures)}
            />
            <Stat
              label={t('statDeliveries')}
              note={t('statDeliveriesNote')}
              title={t('noShipmentTotals')}
              value="—"
            />
          </div>

          <Card title={t('factsTitle')}>
            <ul className="grid gap-3">
              {FACTS.map((fact) => (
                <li
                  className="text-app-muted flex items-start gap-2.5 text-[13.5px] leading-5 text-pretty"
                  key={fact}
                >
                  <span
                    aria-hidden
                    className="bg-app-line-2 mt-2 size-1.5 shrink-0 rounded-full"
                  />
                  {t(fact)}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'points' && (
        <DispatchPointsPanel
          integrationId={integration.id}
          onPointsChange={setPoints}
        />
      )}

      {tab === 'statuses' && (
        <div className="grid gap-5">
          {/* The managed subscription first: whether the carrier is asked to
              send anything at all. The queue below is a separate question —
              what happened to the events that did arrive. */}
          <TrackingSubscriptionPanel integrationId={integration.id} />
          <WebhookPanel
            integrationId={integration.id}
            onFailuresChange={setFailures}
          />
        </div>
      )}

      {tab === 'settings' && (
        <div className="grid max-w-[640px] gap-5">
          <DeliveryPreferencesPanel integrationId={integration.id} />
          <Card title={t('connectionCard')}>
            <Field hint={t('noRename')} label={t('nameLabel')}>
              <TextInput
                disabled
                readOnly
                title={t('noRename')}
                value={integration.displayName}
              />
            </Field>

            {editingKey ? (
              <form
                className="grid gap-3.5"
                noValidate
                onSubmit={(event) => void saveKey(event)}
              >
                <Field hint={t('newKeyHint')} label={t('newKeyLabel')} required>
                  <TextInput
                    autoComplete="off"
                    className="font-mono"
                    onChange={(event) => setKey(event.target.value)}
                    placeholder={t('keyPlaceholder')}
                    value={key}
                  />
                </Field>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    aria-busy={busy === 'save'}
                    disabled={busy !== null || key.trim() === ''}
                    type="submit"
                    variant="primary"
                  >
                    {busy === 'save' ? tc('saving') : t('saveKey')}
                  </Button>
                  <Button
                    disabled={busy !== null}
                    onClick={() => {
                      setEditingKey(false)
                      setKey('')
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
                    {configured ? '••••••••••••••••' : t('keyNotSaved')}
                  </span>
                  {configured && (
                    <span className="text-state-ok ml-auto text-[12px] font-bold">
                      {tc('saved')}
                    </span>
                  )}
                </div>
                <p className="text-app-dim text-[12.5px] leading-5 text-pretty">
                  {t('keyHiddenNote')}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    disabled={busy !== null}
                    onClick={() => setEditingKey(true)}
                    variant={configured ? 'ghost' : 'primary'}
                  >
                    {configured ? t('replaceKey') : t('addKey')}
                  </Button>
                  <Button
                    aria-busy={busy === 'verify'}
                    disabled={busy !== null || !configured}
                    onClick={() => void verify()}
                    title={configured ? undefined : t('nothingToVerify')}
                  >
                    {busy === 'verify' ? t('verifying') : t('verifyConnection')}
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Card
            title={active ? t('disableCard') : t('enableCard')}
            tone={active ? 'danger' : 'plain'}
          >
            <p className="text-app-muted text-[13px] leading-5 text-pretty">
              {active ? t('disableText') : t('enableText')}
            </p>
            <div>
              <Button
                aria-busy={busy === 'toggle'}
                disabled={busy !== null || (!active && !configured)}
                onClick={toggle}
                title={!active && !configured ? t('saveKeyFirst') : undefined}
                variant={active ? 'danger' : 'primary'}
              >
                {active ? t('disableButton') : t('enableButton')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </RedesignShell>
  )
}
