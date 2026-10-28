import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Link2Off } from 'lucide-react'
import {
  Button,
  Field,
  StateScreen,
  StatusPill,
  TextInput,
  Notice,
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
import { CabinetLoadingContent } from '../loading-screen'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { DeliveryDepositPanel } from './delivery-deposit-panel'
import { DispatchPointsPanel } from './dispatch-points-panel'
import { TrackingSubscriptionPanel } from './tracking-panel'
import { WebhookPanel } from './webhook-panel'
import {
  integrationProblemMessage,
  integrationStatusPresentation,
  isCountryUnavailableProblem,
  isNovaPoshtaAvailable,
} from './integration-labels'
import { integrationsMessages } from './integrations-messages'
import { IntegrationCrumbs } from './IntegrationsScreen'
import { NovaPoshtaUnavailable } from './nova-poshta-unavailable'
import { NpOverview, NpRightsCard } from './np-overview'
import { useNpSettingsEditor } from './np-settings-editor'
import { npSettingsMessages } from './np-settings-messages'
import { useNpDeliverySettings } from './use-np-delivery-settings'

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
  return (
    <section className="rz-card">
      <header className="rz-card__head">
        <h2
          className={`rz-h-card ${tone === 'danger' ? 'text-state-danger' : ''}`}
        >
          {title}
        </h2>
      </header>
      <div className="rz-card__body grid gap-3">{children}</div>
    </section>
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
  const navigate = useNavigate()
  const integrationId = params['integrationId'] ?? ''
  const { locale } = useLocale()
  const t = useT(integrationsMessages)
  const tc = useT(commonMessages)
  const ts = useT(npSettingsMessages)
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
  const routeTab: Tab = location.pathname.endsWith('/dispatch-points')
    ? 'points'
    : location.pathname.endsWith('/webhook')
      ? 'statuses'
      : location.pathname.endsWith('/settings')
        ? 'settings'
        : 'overview'
  const configuredNow = state.kind === 'ready' && state.integration.configured
  // Tabs exist only once Nova Poshta is connected (1.22): before that the
  // page is the call to connect, whatever tab the address names.
  const tab: Tab = configuredNow ? routeTab : 'overview'
  const delivery = useNpDeliverySettings(
    integrationId,
    !countryBlocked &&
      configuredNow &&
      (tab === 'overview' || tab === 'settings'),
  )
  const permissions = cabinet.snapshot?.permissions
  const rights = {
    integrations: permissions?.has('team.manage') === true,
    orders: permissions?.has('orders.manage') === true,
    finance: permissions?.has('finance.manage') === true,
  }
  // «Оновлено» on the dispatch card right after a save (2.5).
  const updated =
    (location.state as { npUpdated?: boolean } | null)?.npUpdated === true
  const tabPathFor = (target: Tab) =>
    cabinetPath(
      tenant?.slug ?? '',
      'integrations',
      TAB_SUFFIX[target] === ''
        ? integrationId
        : `${integrationId}/${TAB_SUFFIX[target]}`,
    )
  const editor = useNpSettingsEditor({
    integrationId,
    onCancel: () => void navigate(tabPathFor('overview')),
    onSaved: () => {
      delivery.reload()
      toast?.show({ tone: 'ok', message: ts('saved') })
      void navigate(tabPathFor('overview'), { state: { npUpdated: true } })
    },
    reload: delivery.reload,
    requireLatestMutation: () => requireLatestMutation(),
    settings: delivery.state,
  })

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
    if (integrationId === '' || countryBlocked || !configuredNow) return
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
  }, [configuredNow, countryBlocked, integrationId, scopeKey])

  if (tenant === null) {
    return (
      <div className="rz-page">
        <p className="rz-muted m-0">{t('pickBusinessOne')}</p>
      </div>
    )
  }

  const settingsLabel = navigationGroupLabel('settings', locale) ?? ''

  const listPath = cabinetPath(tenant.slug, 'integrations')
  const tabPath = tabPathFor

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
        crumb={
          <IntegrationCrumbs
            current={t('crumbIntegration')}
            parents={[settingsLabel]}
          />
        }
      >
        <NovaPoshtaUnavailable />
      </RedesignShell>
    )
  }

  if (state.kind !== 'ready') {
    return (
      <RedesignShell
        crumb={
          <IntegrationCrumbs
            current={t('crumbIntegration')}
            parents={[settingsLabel]}
          />
        }
      >
        {state.kind === 'loading' ? (
          <CabinetLoadingContent module="integrations" label={t('loading')} />
        ) : (
          <StateScreen
            actions={
              <Button asChild>
                <Link to={listPath}>{t('backToList')}</Link>
              </Button>
            }
            icon={<Link2Off aria-hidden />}
            role="alert"
            title={t('openError')}
            tone="danger"
          />
        )}
      </RedesignShell>
    )
  }

  const integration = state.integration
  const status = integrationStatusPresentation(integration.status, locale)
  const active = integration.status === 'active'
  const configured = integration.configured

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
      actions={
        tab === 'settings' && configured && rights.integrations
          ? editor.actions
          : backToList
      }
      crumb={
        <IntegrationCrumbs
          current={integration.displayName}
          parents={[settingsLabel, moduleLabel('integrations', locale)]}
        />
      }
    >
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="rz-h-page">{integration.displayName}</h1>
          <span className="rz-muted">{ts('headSub')}</span>
        </div>
        <div>
          <StatusPill tone={status.tone}>
            {active ? t('stateOn') : status.label}
          </StatusPill>
        </div>
      </div>
      {configured && (
        <nav aria-label={t('sectionsNav')} className="rz-tabs">
          {tabs.map((item) => (
            <Link
              aria-current={tab === item.id ? 'page' : undefined}
              key={item.id}
              to={tabPath(item.id)}
            >
              {item.label}
              {item.badge !== undefined && (
                <span
                  className={
                    item.danger === true
                      ? 'rz-count rz-count--danger'
                      : 'rz-count'
                  }
                >
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}

      {error !== null && <Notice tone="danger">{error}</Notice>}

      {tab === 'overview' && (
        <NpOverview
          connectPath={cabinetPath(
            tenant.slug,
            'integrations',
            `${integrationId}/connect`,
          )}
          diagnostics={diagnostics}
          editPath={tabPath('settings')}
          integration={integration}
          onVerify={() => void verify()}
          rights={rights}
          settings={delivery.state}
          updated={updated}
          verifying={busy === 'verify'}
        />
      )}

      {tab === 'points' && (
        <DispatchPointsPanel
          integrationId={integration.id}
          onPointsChange={setPoints}
        />
      )}

      {tab === 'statuses' && (
        <div className="rz-form-page grid gap-4">
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
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rz-form-page grid min-w-0 gap-4">
            {configured && rights.integrations ? editor.body : null}
            <DeliveryDepositPanel key={scopeKey} />
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
                  className="grid gap-3"
                  noValidate
                  onSubmit={(event) => void saveKey(event)}
                >
                  <Field
                    hint={t('newKeyHint')}
                    label={t('newKeyLabel')}
                    required
                  >
                    <TextInput
                      autoComplete="off"
                      className="rz-mono"
                      onChange={(event) => setKey(event.target.value)}
                      placeholder={t('keyPlaceholder')}
                      value={key}
                    />
                  </Field>
                  <div className="rz-btn-row">
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
                  <div className="rz-inset flex flex-wrap items-center gap-3">
                    <span className="rz-mono text-app-muted min-w-0">
                      {configured ? '••••••••••••••••' : t('keyNotSaved')}
                    </span>
                    {configured && (
                      <StatusPill className="ml-auto" tone="ok">
                        {tc('saved')}
                      </StatusPill>
                    )}
                  </div>
                  <p className="rz-caption m-0 text-pretty">
                    {t('keyHiddenNote')}
                  </p>
                  <div className="rz-btn-row">
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
                      {busy === 'verify'
                        ? t('verifying')
                        : t('verifyConnection')}
                    </Button>
                  </div>
                </>
              )}
            </Card>

            <Card
              title={active ? t('disableCard') : t('enableCard')}
              tone={active ? 'danger' : 'plain'}
            >
              <p className="rz-muted m-0 text-pretty">
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
          <NpRightsCard className="max-lg:hidden" {...rights} />
        </div>
      )}
    </RedesignShell>
  )
}
