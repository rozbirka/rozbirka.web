import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Button, DateValue, Notice, StatusPill } from '@/components/app'
import {
  integrationsApi,
  type Integration,
  type IntegrationDefinition,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useLocale, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { RedesignShell, RedesignTitle } from '../redesign-shell'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { moduleLabel, navigationGroupLabel } from '../module-messages'
import {
  integrationErrorMessage,
  integrationKind,
  integrationMark,
  integrationProblemMessage,
  integrationStatusPresentation,
  isNovaPoshtaAvailable,
  NOVA_POSHTA,
} from './integration-labels'
import { integrationsMessages } from './integrations-messages'
import { NovaPoshtaUnavailable } from './nova-poshta-unavailable'

type LoadState =
  | { kind: 'loading' }
  | {
      kind: 'ready'
      items: Integration[]
      definitions: IntegrationDefinition[]
    }
  | { kind: 'error' }

/** A control the design asks for and the API cannot back: shown, not faked. */
function Dead({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Button disabled title={title}>
      {children}
    </Button>
  )
}

/** The breadcrumb trail of `.rz-crumbs`: parents, a chevron, the current page. */
export function IntegrationCrumbs({
  parents,
  current,
}: {
  parents: string[]
  current: string
}) {
  return (
    <>
      {parents.map((part) => (
        <Fragment key={part}>
          <span>{part}</span>
          <ChevronRight aria-hidden className="size-3 shrink-0" />
        </Fragment>
      ))}
      <span aria-current="page">{current}</span>
    </>
  )
}

export function Mark({
  code,
  large = false,
}: {
  code: string
  large?: boolean
}) {
  const { locale } = useLocale()
  return (
    <span
      aria-hidden
      className={`border-app-line bg-app-input text-app-muted inline-grid shrink-0 place-items-center rounded-control border font-mono ${
        large ? 'size-10 text-body' : 'size-8 text-caption'
      }`}
    >
      {integrationMark(code, locale)}
    </span>
  )
}

export function IntegrationsScreen() {
  const cabinet = useCabinet()
  const navigate = useNavigate()
  const { locale } = useLocale()
  const t = useT(integrationsMessages)
  const { countryCode } = useTenantSettings()
  const novaPoshtaAvailable = isNovaPoshtaAvailable(countryCode)
  const tenant = cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const scopeKey = `${generation ?? ''}:${tenant?.id ?? ''}`
  const [loaded, setLoaded] = useState<{
    key: string
    state: LoadState
  } | null>(null)
  // Derived during render, so switching tenants shows loading immediately.
  const state: LoadState =
    loaded?.key === scopeKey ? loaded.state : { kind: 'loading' }
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      integrationsApi.list({ signal: controller.signal }),
      integrationsApi.definitions({ signal: controller.signal }),
    ]).then(
      ([items, definitions]) => {
        if (!controller.signal.aborted) {
          setLoaded({
            key: scopeKey,
            state: { kind: 'ready', items, definitions },
          })
        }
      },
      () => {
        if (!controller.signal.aborted)
          setLoaded({ key: scopeKey, state: { kind: 'error' } })
      },
    )
    return () => controller.abort()
  }, [scopeKey])

  if (tenant === null) {
    return (
      <div className="rz-page">
        <p className="rz-muted m-0">{t('pickBusinessList')}</p>
      </div>
    )
  }

  const slug = tenant.slug
  const items = state.kind === 'ready' ? state.items : []
  const definitions = state.kind === 'ready' ? state.definitions : []
  const connected = new Set(items.map((item) => item.definitionId))
  // Core already hides NP outside Ukraine; a stale or older catalogue must
  // still not offer it.
  const available = definitions.filter(
    (item) =>
      !connected.has(item.id) &&
      (novaPoshtaAvailable || item.code !== NOVA_POSHTA),
  )
  const catalogSize = novaPoshtaAvailable
    ? definitions.length
    : definitions.filter((item) => item.code !== NOVA_POSHTA).length
  const failing = items.filter((item) => item.status === 'error')
  const lastVerified = items
    .map((item) => item.verifiedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1)

  const connect = async (definitionId: string) => {
    if (connecting !== null) return
    setConnecting(definitionId)
    setConnectError(null)
    try {
      const created = await integrationsApi.create(definitionId)
      if (!mountedRef.current) return
      void navigate(cabinetPath(slug, 'integrations', created.id))
    } catch (error) {
      if (mountedRef.current)
        setConnectError(
          integrationProblemMessage(normalizeApiProblem(error), locale),
        )
    } finally {
      if (mountedRef.current) setConnecting(null)
    }
  }

  return (
    <RedesignShell
      actions={<Dead title={t('noExchangeLog')}>{t('exchangeLog')}</Dead>}
      crumb={
        <IntegrationCrumbs
          current={moduleLabel('integrations', locale)}
          parents={[navigationGroupLabel('settings', locale) ?? '']}
        />
      }
    >
      <RedesignTitle
        lead={
          state.kind === 'ready'
            ? t('leadReady', {
                connected: items.length,
                total: Math.max(catalogSize, items.length),
              })
            : t('leadLoading')
        }
        title={moduleLabel('integrations', locale)}
      />

      {state.kind === 'error' && (
        <Notice tone="danger">{t('loadError')}</Notice>
      )}
      {connectError !== null && <Notice tone="danger">{connectError}</Notice>}

      <KpiStrip>
        <Kpi
          label={t('kpiConnected')}
          meta={
            state.kind !== 'ready'
              ? t('kpiCatalogLoading')
              : t('kpiCatalog', { count: catalogSize })
          }
          value={String(items.length)}
        />
        <Kpi
          label={t('kpiAttention')}
          meta={
            failing.length > 0
              ? failing.map((item) => item.displayName).join(', ')
              : t('kpiNoErrors')
          }
          tone={failing.length > 0 ? 'warn' : 'plain'}
          value={String(failing.length)}
        />
        <Kpi
          label={t('kpiLastCheck')}
          meta={
            lastVerified === undefined ? t('kpiNeverChecked') : t('kpiFreshest')
          }
          value={
            lastVerified === undefined ? (
              <span className="text-app-dim">—</span>
            ) : (
              <DateValue value={lastVerified} withTime={false} />
            )
          }
        />
      </KpiStrip>

      <section aria-label={t('connectedTitle')} className="rz-card">
        <header className="rz-card__head">
          <h2 className="rz-h-card">{t('connectedTitle')}</h2>
          <p className="rz-caption m-0">{t('connectedHint')}</p>
        </header>
        {state.kind === 'loading' ? (
          <p className="rz-muted rz-card__body m-0">{t('loading')}</p>
        ) : items.length === 0 ? (
          <p className="rz-muted rz-card__body m-0">{t('noneConnected')}</p>
        ) : (
          <ul className="divide-app-line m-0 grid list-none divide-y p-0">
            {items.map((item) => {
              const status = integrationStatusPresentation(item.status, locale)
              // Outside Ukraine an NP connection stays readable as history,
              // but there is nothing left to open or configure.
              const locked = !novaPoshtaAvailable && item.code === NOVA_POSHTA
              const rowClass =
                'flex min-h-row flex-wrap items-center gap-x-3 gap-y-2 px-[var(--rz-card-p)] py-2 text-app-muted'
              const row = (
                <>
                  <Mark code={item.code} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium text-app-strong">
                      {item.displayName}
                    </span>
                    <span className="rz-caption truncate">
                      {integrationKind(item.code, locale) ??
                        t('serviceFallback')}
                    </span>
                  </span>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  <span className="rz-num min-w-[104px] text-app-muted">
                    {item.verifiedAt === null ? (
                      <span className="text-app-dim">{t('neverChecked')}</span>
                    ) : (
                      <DateValue value={item.verifiedAt} withTime={false} />
                    )}
                  </span>
                </>
              )
              return (
                <li key={item.id}>
                  {locked ? (
                    <div className={rowClass}>{row}</div>
                  ) : (
                    <Link
                      className={`${rowClass} hover:bg-app-hover`}
                      to={cabinetPath(slug, 'integrations', item.id)}
                    >
                      {row}
                    </Link>
                  )}
                  {item.lastErrorCode !== null && (
                    <p className="text-state-danger m-0 px-[var(--rz-card-p)] pb-2.5 text-pretty">
                      {integrationErrorMessage(item.lastErrorCode, locale)}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {!novaPoshtaAvailable && <NovaPoshtaUnavailable />}

      {available.length > 0 && (
        <section aria-label={t('availableTitle')} className="rz-card">
          <header className="rz-card__head">
            <h2 className="rz-h-card">{t('availableTitle')}</h2>
          </header>
          <ul className="divide-app-line m-0 grid list-none divide-y p-0">
            {available.map((definition) => (
              <li
                className="flex min-h-row flex-wrap items-center gap-x-3 gap-y-2 px-[var(--rz-card-p)] py-2"
                key={definition.id}
              >
                <Mark code={definition.code} />
                <span className="grid min-w-0 flex-1">
                  <span className="font-medium text-app-strong">
                    {definition.displayName}
                  </span>
                  <span className="rz-caption">
                    {integrationKind(definition.code, locale) ??
                      t('serviceFallback')}
                  </span>
                </span>
                <Button
                  aria-busy={connecting === definition.id}
                  disabled={connecting !== null}
                  onClick={() => void connect(definition.id)}
                  size="sm"
                >
                  {connecting === definition.id
                    ? t('connecting')
                    : t('connect')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </RedesignShell>
  )
}
