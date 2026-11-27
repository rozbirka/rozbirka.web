import { useEffect, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { LoaderCircle, Settings } from 'lucide-react'
import {
  Button,
  DateValue,
  EmptyState,
  Fact,
  FactList,
  ErrorState,
  Field,
  Notice,
  PanelFooter,
  SelectInput,
  SectionPanel,
  SkeletonRows,
  StatusPill,
  TextArea,
  useOptionalToast,
} from '@/components/app'
import { PartSearchPicker } from '@/components/parts/PartSearchPicker'
import {
  olxApi,
  launchOlxOAuth,
  type OlxConnection,
  type OlxContent,
  type OlxPublication,
} from '@/api/olx'
import { normalizeApiProblem } from '@/api/errors'
import {
  olxListingSettingsApi,
  type OlxListingSettingsView,
} from '@/api/olx-listing-settings'
import { useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import type { TenantAccessSnapshot } from '../access-types'
import { cabinetPath } from '../cabinet-paths'
import { Crumbs, RedesignShell, RedesignTitle } from '../redesign-shell'
import { IntegrationCrumbs } from '../integrations/IntegrationsScreen'
import { canCreateOrder } from '../orders/order-create-access'
import { tenantRequestScope } from '../tenant-request-scope'
import {
  OlxConnectionPanel,
  OlxPermissionsCard,
  type ConnectionAction,
} from './OlxConnectionPanel'
import { olxConnectionMessages } from './olx-connection-messages'
import { olxBatchMessages } from './olx-batch-messages'
import { OlxPublicationQueue } from './OlxPublicationQueue'
import { OlxCatalogPanel } from './OlxCatalogPanel'
import { olxCatalogMessages } from './olx-catalog-messages'
import { olxChatMessages } from './olx-chat-messages'
import { olxError, olxStatus } from './olx-messages'
import { OlxLiveWorkspace } from './OlxLiveWorkspace'
import { OlxListingSettingsPanel } from './OlxListingSettingsPanel'
import { OlxMessagesWorkspace } from './OlxMessagesWorkspace'
import { OlxMessagesSkeleton } from './OlxMessagesSkeleton'
import { OlxPublicationReadiness } from './OlxPublicationReadiness'
import { OlxReconciliationPanel } from './OlxReconciliationPanel'
import { olxReconciliationMessages } from './olx-reconciliation-messages'
import { updateOlxNavigation } from './olx-navigation-presence'
import {
  clearOlxPartReturn,
  olxPartOutcome,
  readOlxPartReturn,
} from './olx-part-oauth-return'

type OlxSection =
  | 'account'
  | 'sales'
  | 'listing'
  | 'reconcile'
  | 'queue'
  | 'messages'

export function OlxAlphaScreen() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '')
  const last = path.split('/').at(-1)
  const section: OlxSection = path.includes('/settings/integrations/olx')
    ? last === 'listing'
      ? 'listing'
      : 'account'
    : last === 'messages' || last === 'reconcile' || last === 'queue'
      ? last
      : last === 'olx'
        ? 'sales'
        : 'account'
  return <OlxScreen section={section} />
}

export function OlxSalesScreen() {
  return <OlxScreen section="sales" />
}

export function OlxReconciliationScreen() {
  return <OlxScreen section="reconcile" />
}

export function OlxQueueScreen() {
  return <OlxScreen section="queue" />
}

export function OlxMessagesScreen() {
  return <OlxScreen section="messages" />
}

export const OlxListingSettingsScreen = OlxAlphaScreen

export function OlxLegacyRedirect() {
  const { targetTenant, snapshot } = useCabinet()
  const { search, hash } = useLocation()
  if (!targetTenant) return null
  const params = new URLSearchParams(search)
  const outcome = olxPartOutcome(params.get('olx'))
  if (
    outcome &&
    snapshot?.tenantId === targetTenant.id &&
    snapshot.permissions.has('parts.view') &&
    snapshot.permissions.has('olx.publications.manage')
  ) {
    const pending = readOlxPartReturn(snapshot)
    if (pending)
      return (
        <Navigate
          replace
          to={cabinetPath(targetTenant.slug, 'parts', `${pending.partId}/olx`)}
          state={{ olxPartOutcome: outcome }}
        />
      )
  }
  const sales = !params.has('olx') && params.get('view') === 'adverts'
  params.delete('view')
  return (
    <Navigate
      replace
      to={{
        pathname: sales
          ? cabinetPath(targetTenant.slug, 'olx')
          : cabinetPath(targetTenant.slug, 'integrations', 'olx'),
        search: params.toString(),
        hash,
      }}
    />
  )
}

function OlxScreen({ section }: { section: OlxSection }) {
  const { targetTenant, snapshot } = useCabinet()
  if (!targetTenant || !snapshot) return null
  return (
    <div className="min-h-dvh bg-app-canvas text-app-ink">
      <OlxWorkspace
        key={`${targetTenant.id}:${snapshot.userId}:${snapshot.generation}`}
        section={section}
        slug={targetTenant.slug}
        snapshot={snapshot}
        currency={targetTenant.accountingCurrency ?? null}
      />
    </div>
  )
}

function OlxWorkspace({
  section,
  snapshot,
  slug,
  currency,
}: {
  section: OlxSection
  snapshot: TenantAccessSnapshot
  slug: string
  currency: string | null
}) {
  const { permissions } = snapshot
  const t = useT(olxConnectionMessages)
  const tr = useT(olxReconciliationMessages)
  const tb = useT(olxBatchMessages)
  const tcatalog = useT(olxCatalogMessages)
  const tm = useT(olxChatMessages)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useOptionalToast()
  const reconcile = section === 'reconcile'
  const queue = section === 'queue'
  const messages = section === 'messages'
  const sales = section === 'sales' || reconcile || queue || messages
  const listing = section === 'listing'
  const setupLocation = listing && params.get('setup') === 'location'
  const accountHref = cabinetPath(slug, 'integrations', 'olx')
  const salesHref = cabinetPath(slug, 'olx')
  const catalogHref = `${salesHref}?view=catalog`
  const queueHref = cabinetPath(slug, 'olx', 'queue')
  const messagesHref = cabinetPath(slug, 'olx', 'messages')
  const reconcileHref = cabinetPath(slug, 'olx', 'reconcile')
  const listingHref = cabinetPath(slug, 'integrations', 'olx/listing')
  const [outcome, setOutcome] = useState(() =>
    section === 'account' ? olxPartOutcome(params.get('olx')) : null,
  )
  const canManage = permissions.has('olx.integration.manage')
  const canPublish = permissions.has('olx.publications.manage')
  const canRead = sales ? canPublish : canManage || canPublish
  const canReadParts = permissions.has('parts.view')
  const catalog =
    section === 'sales' && canReadParts && params.get('view') === 'catalog'
  const canEdit = permissions.has('parts.manage')
  const canReadQueue = canPublish && canReadParts && canEdit
  const queueOwner = `${snapshot.tenantId}:${snapshot.userId}:${snapshot.generation}`
  const [connection, setConnection] = useState<OlxConnection | null>(null)
  const [listingSettings, setListingSettings] =
    useState<OlxListingSettingsView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const [tenantSignal] = useState(() => tenantRequestScope.signal)
  const [query, setQuery] = useState('')
  const [part, setPart] = useState<{ id: string; name: string } | null>(null)
  const [listingActions, setListingActions] = useState<HTMLDivElement | null>(
    null,
  )
  const life = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const showedConnectionToast = useRef(false)
  const returnVerified =
    connection?.mode === 'oauth' &&
    connection.available &&
    connection.connected &&
    !connection.reconnectRequired
  const verifyingReturn =
    canManage && outcome === 'connected' && !connection && !loadError
  const unconfirmedReturn =
    canManage && outcome === 'connected' && connection && !returnVerified
  useEffect(() => {
    if (
      outcome === 'connected' &&
      canManage &&
      returnVerified &&
      !showedConnectionToast.current
    ) {
      showedConnectionToast.current = true
      toast?.show({ tone: 'ok', message: t('connectionSuccess') })
    }
  }, [canManage, outcome, returnVerified, toast, t])
  useEffect(() => {
    if (section !== 'account' || !params.has('olx')) return
    const clearOutcome = () =>
      setParams(
        (current) => {
          current.delete('olx')
          return current
        },
        { replace: true },
      )

    if (params.get('olx') !== 'connected' || !canManage) {
      clearOutcome()
      return
    }
    if (!connection) return
    if (!returnVerified) {
      clearOutcome()
      return
    }

    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    void olxListingSettingsApi.get({ signal }).then(
      (settings) => {
        if (signal.aborted) return
        if (settings.cityId === null) {
          void navigate(
            { pathname: listingHref, search: '?setup=location' },
            { replace: true },
          )
        } else {
          clearOutcome()
        }
      },
      () => {
        if (!signal.aborted) clearOutcome()
      },
    )
    return () => controller.abort()
  }, [
    canManage,
    connection,
    listingHref,
    navigate,
    params,
    returnVerified,
    section,
    setParams,
    tenantSignal,
  ])
  useEffect(() => {
    const controller = new AbortController()
    life.current = controller
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    if (canRead)
      void olxApi.connection({ signal }).then(
        (value) => {
          if (signal.aborted) return
          setConnection(value)
          updateOlxNavigation(snapshot, value)
        },
        () => {
          if (!signal.aborted) setLoadError(true)
        },
      )
    return () => controller.abort()
  }, [canRead, attempt, snapshot, tenantSignal])
  async function changeConnection(
    action: ConnectionAction,
    account = '',
  ): Promise<boolean> {
    const currentLife = life.current
    if (!canManage || inFlight.current || !currentLife) return false
    const signal = AbortSignal.any([currentLife.signal, tenantSignal])
    if (signal.aborted) return false
    inFlight.current = true
    setBusy(true)
    setError(null)
    if (action === 'connect' || action === 'write') setOutcome(null)
    try {
      if (
        (action === 'connect' || action === 'write') &&
        connection?.mode === 'oauth'
      ) {
        const start = await (action === 'write'
          ? olxApi.startWriteOAuth({ signal })
          : olxApi.startOAuth({ signal }))
        if (signal.aborted) return false
        clearOlxPartReturn()
        launchOlxOAuth(start)
        return true
      }
      const next =
        action === 'disconnect'
          ? await olxApi.disconnect({ signal })
          : action === 'verify'
            ? await olxApi.verifyConnection({ signal })
            : await olxApi.connect(account, { signal })
      if (signal.aborted) return false
      setConnection(next)
      updateOlxNavigation(snapshot, next)
      setPart(null)
      if (action === 'disconnect' && !next.connected) {
        setOutcome(null)
        setDisconnected(true)
        toast?.show({ tone: 'info', message: t('disconnectedNoticeTitle') })
      }
      return true
    } catch (problem) {
      const code = normalizeApiProblem(problem).code
      if (!signal.aborted)
        setError(
          t(
            code === 'OLX_ACCOUNT_IN_USE'
              ? 'accountInUse'
              : code === 'OLX_RATE_LIMITED'
                ? 'rateLimited'
                : code === 'OLX_BUSY'
                  ? 'busy'
                  : code === 'OLX_RECONNECT_REQUIRED'
                    ? 'reconnectHint'
                    : 'errorHint',
          ),
        )
      if (action === 'verify' && !signal.aborted) {
        try {
          const current = await olxApi.connection({ signal })
          if (!signal.aborted) {
            setConnection(current)
            updateOlxNavigation(snapshot, current)
          }
        } catch {
          // Keep the original action error if saved status cannot be read.
        }
      }
      return false
    } finally {
      inFlight.current = false
      if (!signal.aborted) setBusy(false)
    }
  }
  const real = connection?.mode === 'oauth'
  const canBrowse = Boolean(
    connection?.available &&
    connection.connected &&
    !connection.reconnectRequired &&
    canPublish,
  )
  const outcomeMessage =
    outcome === 'cancelled'
      ? 'cancelled'
      : outcome === 'account_in_use'
        ? 'accountInUse'
        : outcome === 'already_connected'
          ? 'alreadyConnected'
          : outcome === 'access_changed' || outcome === 'connection_changed'
            ? 'accessChanged'
            : 'failed'
  if ((reconcile || messages) && connection && !real)
    return <Navigate replace to={salesHref} />
  const salesTabs = sales && real && (canBrowse || (queue && canReadQueue)) && (
    <nav aria-label={tr('tabs')} className="rz-tabs flex-wrap">
      <Link
        to={salesHref}
        aria-current={section === 'sales' && !catalog ? 'page' : undefined}
      >
        {tr('advertsTab')}
      </Link>
      <Link to={messagesHref} aria-current={messages ? 'page' : undefined}>
        {tm('tab')}
      </Link>
      <Link to={reconcileHref} aria-current={reconcile ? 'page' : undefined}>
        {tr('tab')}
      </Link>
      {canReadParts && (
        <Link to={catalogHref} aria-current={catalog ? 'page' : undefined}>
          {tcatalog('title')}
        </Link>
      )}
      {canReadQueue && (
        <Link to={queueHref} aria-current={queue ? 'page' : undefined}>
          {tb('queueTab')}
        </Link>
      )}
    </nav>
  )

  return (
    <RedesignShell
      crumb={
        !sales && permissions.has('team.manage') ? (
          <Crumbs
            items={[
              t('settings'),
              <Link key="integrations" to={cabinetPath(slug, 'integrations')}>
                {t('integrations')}
              </Link>,
              t('title'),
            ]}
          />
        ) : (
          <IntegrationCrumbs
            current={t('title')}
            parents={sales ? [t('sales')] : [t('settings'), t('integrations')]}
          />
        )
      }
      actions={
        sales && canRead ? (
          <Button asChild>
            <Link to={accountHref}>
              <Settings aria-hidden />
              {t('openSettings')}
            </Link>
          </Button>
        ) : listing && canManage ? (
          <div
            className="flex flex-wrap items-center gap-2"
            ref={setListingActions}
          />
        ) : undefined
      }
    >
      <header>
        <RedesignTitle
          title={t('title')}
          aside={
            sales && !messages && real && (canBrowse || queue) ? (
              <StatusPill>{t('manualMode')}</StatusPill>
            ) : undefined
          }
        />
      </header>
      {!sales && canRead && (listing || (real && connection.connected)) && (
        <nav aria-label={t('settingsTabs')} className="rz-tabs">
          <Link to={accountHref} aria-current={!listing ? 'page' : undefined}>
            {t('accountTab')}
          </Link>
          <Link to={listingHref} aria-current={listing ? 'page' : undefined}>
            {t('listingTab')}
          </Link>
        </nav>
      )}
      {salesTabs}
      {(!canRead || (queue && !canReadQueue)) && (
        <Notice tone="danger">{t('noAccess')}</Notice>
      )}
      {connection && (listing || (section === 'sales' && canBrowse)) && (
        <OlxPublicationReadiness
          connection={connection}
          canManage={canManage}
          onGrant={() => void changeConnection('write')}
          busy={busy}
          error={error}
          showReady={listing}
        />
      )}
      {listing && canRead && connection?.available && (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_20rem]">
          <OlxListingSettingsPanel
            canManage={canManage}
            actionsHost={listingActions}
            initialSettings={listingSettings}
            onSettingsChange={setListingSettings}
            {...(setupLocation
              ? {
                  setupLocation: {
                    accountHref,
                    onSaved: () => {
                      setParams(
                        (current) => {
                          current.delete('setup')
                          return current
                        },
                        { replace: true },
                      )
                    },
                  },
                }
              : {})}
          />
          <OlxPermissionsCard canManage={canManage} canPublish={canPublish} />
        </div>
      )}
      {listing && connection?.available === false && (
        <Notice tone="warn">{t('unavailableHint')}</Notice>
      )}
      {loadError && (
        <ErrorState
          title={t('error')}
          description={t('errorHint')}
          onRetry={() => {
            setLoadError(false)
            setAttempt((value) => value + 1)
          }}
        />
      )}
      {verifyingReturn && (
        <EmptyState
          className="rz-card"
          title={t('returnVerifying')}
          description={t('returnVerifyingHint')}
          icon={
            <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
          }
        />
      )}
      {!loadError &&
        canRead &&
        !connection &&
        !verifyingReturn &&
        (messages ? (
          <OlxMessagesSkeleton canReadParts={canReadParts} />
        ) : (
          <SkeletonRows label={t('loading')} rows={3} />
        ))}
      {canManage && outcome && outcome !== 'connected' && (
        <Notice tone={outcome === 'failed' ? 'danger' : 'warn'} role="status">
          {t(outcomeMessage)}
        </Notice>
      )}
      {unconfirmedReturn && (
        <Notice tone="warn" role="status">
          {t('returnUnconfirmed')}
        </Notice>
      )}
      {connection && !listing && (
        <>
          {!real && (
            <Notice tone="warn" block>
              <p className="m-0 font-medium">{t('simulator')}</p>
              <p className="m-0 mt-1">{t('simulatorHint')}</p>
            </Notice>
          )}
          {!sales && (
            <OlxConnectionPanel
              connection={connection}
              canManage={canManage}
              canPublish={canPublish}
              busy={busy}
              error={error}
              onAction={changeConnection}
              retryConnection={Boolean(outcome && outcome !== 'connected')}
              disconnected={disconnected}
              {...(canBrowse ? { workspaceHref: salesHref } : {})}
            />
          )}
          {sales && !queue && !canBrowse && (
            <EmptyState
              className="rz-card"
              title={t(
                connection.reconnectRequired
                  ? 'reconnect'
                  : 'salesDisconnected',
              )}
              description={t(
                !connection.available
                  ? 'unavailableHint'
                  : connection.reconnectRequired
                    ? 'reconnectHint'
                    : 'salesConnectHint',
              )}
              actions={
                messages && canManage ? (
                  <Button asChild>
                    <Link to={accountHref}>{tm('settings')}</Link>
                  </Button>
                ) : undefined
              }
            />
          )}
          {messages && real && canBrowse && connection.accountId && (
            <OlxMessagesWorkspace
              key={connection.accountId}
              accountId={connection.accountId}
              accountHref={accountHref}
              canManageConnection={canManage}
              canReadParts={canReadParts}
              partsHref={cabinetPath(slug, 'parts')}
              newOrderHref={
                canCreateOrder(snapshot)
                  ? cabinetPath(slug, 'orders', 'new')
                  : undefined
              }
            />
          )}
          {queue && real && canReadQueue && (
            <OlxPublicationQueue
              canSeeDiagnostics={canManage}
              owner={queueOwner}
              queueHref={queueHref}
              listingHref={listingHref}
              activeAccountId={
                canBrowse &&
                connection.writesAvailable === true &&
                connection.scope?.split(' ').includes('write')
                  ? connection.accountId
                  : null
              }
              partsHref={cabinetPath(slug, 'parts')}
            />
          )}
          {section === 'sales' && !catalog && real && canBrowse && (
            <OlxLiveWorkspace
              canSeeDiagnostics={canManage}
              key={connection.accountId}
              canReadParts={canReadParts}
              canEditParts={canEdit}
              {...(connection.accountId
                ? { accountId: connection.accountId }
                : {})}
              canWrite={
                connection.writesAvailable === true &&
                connection.scope?.split(' ').includes('write') === true
              }
              partsHref={cabinetPath(slug, 'parts')}
              reconcileHref={reconcileHref}
              currency={currency}
              onOpenPart={(id) =>
                void navigate(
                  `${cabinetPath(slug, 'parts')}/${encodeURIComponent(id)}/olx`,
                )
              }
              onJobStarted={(job, review) =>
                void navigate(
                  `${queueHref}?job=${encodeURIComponent(job.id)}`,
                  {
                    state: { owner: queueOwner, jobId: job.id, review },
                  },
                )
              }
            />
          )}
          {catalog &&
            real &&
            canBrowse &&
            (connection.accountId && connection.reconciliationCompletedAt ? (
              <OlxCatalogPanel
                key={connection.accountId}
                accountId={connection.accountId}
                owner={queueOwner}
                queueHref={queueHref}
                canPrepare={
                  canEdit &&
                  connection.writesAvailable === true &&
                  connection.scope?.split(' ').includes('write') === true
                }
                partsHref={cabinetPath(slug, 'parts')}
              />
            ) : (
              <EmptyState
                title={tr('title')}
                description={tr('intro')}
                actions={
                  <Button asChild>
                    <Link to={reconcileHref}>{tr('tab')}</Link>
                  </Button>
                }
              />
            ))}
          {reconcile && real && canBrowse && connection.accountId && (
            <OlxReconciliationPanel
              key={connection.accountId}
              accountId={connection.accountId}
              initialCompletedAt={connection.reconciliationCompletedAt ?? null}
              canManage={canManage}
              canReadParts={canReadParts}
              canWrite={connection.scope?.split(' ').includes('write') ?? false}
              tabs={null}
              showHeader={false}
              onCompleted={(completedAt) => {
                setConnection((current) =>
                  current && current.accountId === connection.accountId
                    ? { ...current, reconciliationCompletedAt: completedAt }
                    : current,
                )
              }}
            />
          )}
          {sales && !queue && !real && canBrowse && canReadParts && (
            <SectionPanel title={t('part')} className="overflow-visible">
              <PartSearchPicker
                includeUnavailable
                value={part}
                query={query}
                onQueryChange={setQuery}
                onSelect={(value) => {
                  setPart(value)
                  setQuery(value.name)
                }}
                onClear={() => setPart(null)}
                disabled={!connection.connected}
              />
              {part && connection.connected && (
                <PartPanel
                  key={`${connection.accountId}:${part.id}`}
                  id={part.id}
                  name={part.name}
                  canEdit={canEdit}
                  canSimulate={canManage}
                />
              )}
            </SectionPanel>
          )}
        </>
      )}
    </RedesignShell>
  )
}

function PartPanel({
  id,
  name,
  canEdit,
  canSimulate,
}: {
  id: string
  name: string
  canEdit: boolean
  canSimulate: boolean
}) {
  const [view, setView] = useState<OlxPublication | null>(null)
  const [content, setContent] = useState<OlxContent>({
    publicDescription: '',
    categoryId: null,
    categoryConfirmed: false,
    attributes: {},
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [eventApplied, setEventApplied] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const life = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    life.current = controller
    void (async () => {
      try {
        let value = await olxApi.get(id, { signal: controller.signal })
        if (value.advertId || value.syncState === 'unknown')
          value = await olxApi.refresh(id, { signal: controller.signal })
        if (!controller.signal.aborted) {
          setView(value)
          setContent(
            value.content ?? {
              publicDescription: '',
              categoryId: null,
              categoryConfirmed: false,
              attributes: {},
            },
          )
          setError(false)
        }
      } catch {
        if (!controller.signal.aborted) setError(true)
      }
    })()
    return () => controller.abort()
  }, [id, attempt])
  async function act(
    action: 'save' | 'publish' | 'refresh' | 'exclude' | 'restore' | 'simulate',
    status?: string,
  ) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(false)
    setEventApplied(false)
    const signal = life.current?.signal
    if (!signal) return
    const options = { signal }
    try {
      const next =
        action === 'save'
          ? await olxApi.save(id, content, options)
          : action === 'exclude'
            ? await olxApi.exclude(id, !view?.excluded, options)
            : action === 'simulate'
              ? await olxApi.simulate(id, status ?? 'active', options)
              : await olxApi[action](id, options)
      if (!options.signal?.aborted) {
        setView(next)
        if (action === 'simulate') setEventApplied(true)
      }
    } catch {
      if (!options.signal?.aborted) setError(true)
    } finally {
      inFlight.current = false
      if (!options.signal?.aborted) setBusy(false)
    }
  }
  const editable = canEdit && view?.coreStatus === 'available'
  return (
    <div className="grid gap-4" aria-busy={busy}>
      <h3 className="text-title font-semibold">{name}</h3>
      {error ? (
        <Notice
          tone="danger"
          action={
            <Button onClick={() => setAttempt((value) => value + 1)}>
              Повторити
            </Button>
          }
        >
          Не вдалося виконати дію. Введені дані збережені у формі.
        </Notice>
      ) : null}
      {!view && !error ? <p role="status">Завантаження оголошення…</p> : null}
      {view ? (
        <>
          <FactList columns={2}>
            <Fact label="Запчастина в Розбірці">
              {olxStatus(view.coreStatus)}
            </Fact>
            <Fact label="Останній статус OLX">
              <StatusPill
                tone={view.observedStatus === 'active' ? 'ok' : 'neutral'}
              >
                {olxStatus(view.observedStatus)}
              </StatusPill>
            </Fact>
            <Fact label="Синхронізація">{olxStatus(view.syncState)}</Fact>
            <Fact label="Перевірено">
              <DateValue value={view.observedAt} fallback="Ще не перевірено" />
            </Fact>
          </FactList>
          {view.advertId ? (
            <p className="text-caption text-app-muted break-all">
              Тестове оголошення: {view.advertId}
            </p>
          ) : null}
          {view.error ? (
            <Notice tone="danger">{olxError(view.error)}</Notice>
          ) : null}
          {view.autoRestoreBlocked ? (
            <Notice tone="warn">
              Причина зняття зовнішня або невідома. Автоматичне відновлення
              вимкнене.
            </Notice>
          ) : null}
          {view.excluded ? (
            <Notice>Запчастину виключено з публікації.</Notice>
          ) : null}
          <Field
            label="Публічний опис"
            hint="Внутрішні нотатки запчастини сюди не копіюються."
          >
            <TextArea
              value={content.publicDescription ?? ''}
              disabled={!editable || busy}
              maxLength={10000}
              onChange={(event) =>
                setContent({
                  ...content,
                  publicDescription: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Категорія тестового каталогу">
            <SelectInput
              disabled={!editable || busy}
              value={content.categoryId ?? ''}
              onChange={(event) =>
                setContent({
                  ...content,
                  categoryId: event.target.value || null,
                  categoryConfirmed: false,
                })
              }
            >
              <option value="">Вибери категорію</option>
              <option value="car-parts">Автозапчастини</option>
              <option value="engine">Двигуни</option>
            </SelectInput>
          </Field>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={content.categoryConfirmed ?? false}
              disabled={!editable || busy || !content.categoryId}
              onChange={(event) =>
                setContent({
                  ...content,
                  categoryConfirmed: event.target.checked,
                })
              }
            />
            Підтверджую категорію
          </label>
          <Field label="Стан для оголошення">
            <SelectInput
              disabled={!editable || busy}
              value={content.attributes?.['condition'] ?? ''}
              onChange={(event) =>
                setContent({
                  ...content,
                  attributes: {
                    ...content.attributes,
                    condition: event.target.value,
                  },
                })
              }
            >
              <option value="">Вибери стан</option>
              <option value="used">Вживана</option>
              <option value="new">Нова</option>
            </SelectInput>
          </Field>
          <p className="text-caption text-app-muted">
            Категорії та обмеження імітатора — тестові. Ціна й фото беруться з
            картки запчастини.
          </p>
          <PanelFooter>
            <Button
              disabled={busy || !editable}
              onClick={() => void act('save')}
            >
              Зберегти дані OLX
            </Button>
            <Button
              variant="primary"
              disabled={
                busy ||
                view.excluded ||
                view.coreStatus !== 'available' ||
                !!view.advertId ||
                view.syncState === 'unknown'
              }
              onClick={() => void act('publish')}
            >
              Опублікувати
            </Button>
            <Button disabled={busy} onClick={() => void act('refresh')}>
              Оновити статус
            </Button>
            <Button disabled={busy} onClick={() => void act('exclude')}>
              {view.excluded ? 'Повернути до публікації' : 'Виключити'}
            </Button>
            <Button
              disabled={
                busy ||
                !view.advertId ||
                view.excluded ||
                view.coreStatus !== 'available'
              }
              onClick={() => void act('restore')}
            >
              Відновити
            </Button>
          </PanelFooter>
          {canSimulate ? (
            <fieldset
              className="grid gap-3 rounded-control border border-app-line p-4"
              disabled={busy}
            >
              <legend className="px-1 font-semibold">Події імітатора</legend>
              <p className="text-caption text-app-muted">
                Змінюють стан на стороні імітатора. Натисни «Оновити статус»,
                щоб Розбірка побачила зміну.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  ['active', 'Пройшла модерацію'],
                  ['rejected', 'Відхилено модерацією'],
                  ['inactive', 'Знято вручну на OLX'],
                  ['payment_required', 'Потрібна оплата'],
                  ['timeout_next_create', 'Втратити відповідь створення'],
                ].map(([status, label]) => (
                  <Button
                    key={status}
                    disabled={
                      busy ||
                      (status === 'timeout_next_create'
                        ? !!view.advertId
                        : !view.advertId)
                    }
                    onClick={() => void act('simulate', status)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {eventApplied ? (
                <Notice>
                  Подію застосовано на стороні імітатора. Останній перевірений
                  статус не змінено.
                </Notice>
              ) : null}
            </fieldset>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
