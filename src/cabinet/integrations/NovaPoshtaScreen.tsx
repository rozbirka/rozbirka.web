import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Link2Off } from 'lucide-react'
import {
  Button,
  StateScreen,
  StatusPill,
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
import { useLocale, useT } from '@/i18n'
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
import { npConnectMessages } from './np-connect-messages'
import { NpDisconnectDialog } from './np-disconnect-dialog'
import { npDisconnectMessages } from './np-disconnect-messages'
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

/**
 * One carrier, four tabs: what it is doing, where parcels leave from, whether
 * its status feed arrives, and what new waybills dispatch with. The key is
 * replaced only through the setup wizard. Each tab is its own
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
  const ts = useT(npSettingsMessages)
  const td = useT(npDisconnectMessages)
  const tn = useT(npConnectMessages)
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
  const [busy, setBusy] = useState<
    null | 'verify' | 'reconnect' | 'disconnect'
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingOff, setConfirmingOff] = useState(false)
  const [offOpenings, setOffOpenings] = useState(0)
  const [offError, setOffError] = useState<string | null>(null)
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
  const off = integration.status === 'inactive'
  const configured = integration.configured

  const apply = (updated: Integration) => {
    if (!mountedRef.current) return
    setLoaded({ key: scopeKey, state: { kind: 'ready', integration: updated } })
  }

  const run = async (
    kind: 'verify' | 'reconnect',
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

  // Core checks the stored key with the carrier again before switching back
  // on; a key that stopped working leaves the integration off and says why.
  const reconnect = () =>
    void run(
      'reconnect',
      () => integrationsApi.activate(integration.id),
      tn('connected'),
    )

  const disconnect = async () => {
    if (busy !== null) return
    try {
      requireLatestMutation()
    } catch {
      setOffError(t('noAccess'))
      return
    }
    setBusy('disconnect')
    setOffError(null)
    try {
      apply(await integrationsApi.deactivate(integration.id))
      if (!mountedRef.current) return
      setConfirmingOff(false)
      setDiagnostics(null)
      toast?.show({ tone: 'info', message: td('done') })
    } catch (problem) {
      if (mountedRef.current)
        setOffError(
          integrationProblemMessage(normalizeApiProblem(problem), locale),
        )
    } finally {
      if (mountedRef.current) setBusy(null)
    }
  }

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
        tab === 'settings' && configured && !off && rights.integrations
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
          <StatusPill tone={off ? 'neutral' : status.tone}>
            {active ? t('stateOn') : off ? td('headOff') : status.label}
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

      {off && (
        <Notice block>
          <p className="rz-strong m-0 font-semibold">{td('offTitle')}</p>
          <p className="m-0 mt-1">{td('offText')}</p>
        </Notice>
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
          onDisconnect={() => {
            setOffError(null)
            setOffOpenings((count) => count + 1)
            setConfirmingOff(true)
          }}
          onReconnect={reconnect}
          onVerify={() => void verify()}
          reconnecting={busy === 'reconnect'}
          rights={rights}
          settings={delivery.state}
          updated={updated}
          verifying={busy === 'verify'}
        />
      )}

      <NpDisconnectDialog
        error={offError}
        integrationId={integration.id}
        key={offOpenings}
        onConfirm={() => void disconnect()}
        onOpenChange={setConfirmingOff}
        open={confirmingOff}
        pending={busy === 'disconnect'}
      />

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
            {/* A setup session would switch it back on behind the reader's
                back, so a switched-off integration is changed only after
                «Підключити знову». */}
            {configured && !off && rights.integrations ? editor.body : null}
            <DeliveryDepositPanel key={scopeKey} />
          </div>
          <NpRightsCard className="max-lg:hidden" {...rights} />
        </div>
      )}
    </RedesignShell>
  )
}
