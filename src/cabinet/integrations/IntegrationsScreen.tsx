import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, DateValue, Notice, StatusPill } from '@/components/app'
import {
  integrationsApi,
  type Integration,
  type IntegrationDefinition,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { RedesignShell, RedesignTitle } from '../redesign-shell'
import { Kpi, KpiStrip } from '../redesign-kpi'
import {
  integrationErrorMessage,
  integrationKind,
  integrationMark,
  integrationStatusPresentation,
} from './integration-labels'

const NO_EXCHANGE_LOG =
  'Журналу обміну немає: сервіс зберігає стан підключення, а не історію кожного запиту.'

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
    <button
      className="border-app-line text-app-dim inline-flex min-h-11 cursor-not-allowed items-center rounded-[10px] border px-3.5 text-[13px] font-medium"
      disabled
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

function Mark({ code }: { code: string }) {
  return (
    <span
      aria-hidden
      className="border-app-line text-app-muted inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border font-mono text-[12px]"
    >
      {integrationMark(code)}
    </span>
  )
}

export function IntegrationsScreen() {
  const cabinet = useCabinet()
  const navigate = useNavigate()
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
      <p className="text-app-muted text-sm">
        Оберіть розбірку, щоб побачити її інтеграції.
      </p>
    )
  }

  const slug = tenant.slug
  const items = state.kind === 'ready' ? state.items : []
  const definitions = state.kind === 'ready' ? state.definitions : []
  const connected = new Set(items.map((item) => item.definitionId))
  const available = definitions.filter((item) => !connected.has(item.id))
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
        setConnectError(normalizeApiProblem(error).message)
    } finally {
      if (mountedRef.current) setConnecting(null)
    }
  }

  return (
    <RedesignShell
      actions={<Dead title={NO_EXCHANGE_LOG}>Журнал обміну</Dead>}
      crumb="Налаштування · Інтеграції"
    >
      <RedesignTitle
        lead={
          state.kind === 'ready'
            ? `Підключено ${items.length} із ${definitions.length} доступних сервісів. Керує ними той, кому відкриті налаштування команди.`
            : 'Сервіси, які працюють разом з вашою розбіркою.'
        }
        title="Інтеграції"
      />

      {state.kind === 'error' && (
        <Notice tone="danger">
          Не вдалося завантажити інтеграції. Перевірте зв’язок і оновіть
          сторінку.
        </Notice>
      )}
      {connectError !== null && <Notice tone="danger">{connectError}</Notice>}

      <KpiStrip>
        <Kpi
          label="Підключено"
          meta={
            definitions.length > 0
              ? `Сервісів у каталозі: ${definitions.length}`
              : 'Каталог сервісів ще завантажується'
          }
          value={String(items.length)}
        />
        <Kpi
          label="Потребують уваги"
          meta={
            failing.length > 0
              ? failing.map((item) => item.displayName).join(', ')
              : 'Помилок підключення немає'
          }
          tone={failing.length > 0 ? 'warn' : 'plain'}
          value={String(failing.length)}
        />
        <Kpi
          label="Остання перевірка"
          meta={
            lastVerified === undefined
              ? 'Жодне підключення ще не перевірялося'
              : 'Найсвіжіша серед усіх підключень'
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

      <section
        aria-label="Підключені сервіси"
        className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-6 pt-5 pb-4">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
            Підключені сервіси
          </h2>
          <p className="text-app-dim text-[13px]">
            Оберіть рядок, щоб відкрити налаштування
          </p>
        </div>
        {state.kind === 'loading' ? (
          <p className="text-app-muted border-app-line border-t px-6 py-4 text-sm">
            Завантажуємо…
          </p>
        ) : items.length === 0 ? (
          <p className="text-app-muted border-app-line border-t px-6 py-4 text-sm">
            Жодного сервісу ще не підключено.
          </p>
        ) : (
          <ul className="divide-app-line border-app-line grid divide-y border-t">
            {items.map((item) => {
              const status = integrationStatusPresentation(item.status)
              return (
                <li key={item.id}>
                  <Link
                    className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-6 py-3.5 hover:bg-white/[0.03]"
                    to={cabinetPath(slug, 'integrations', item.id)}
                  >
                    <Mark code={item.code} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold tracking-[-0.01em] text-white">
                        {item.displayName}
                      </span>
                      <span className="text-app-dim mt-0.5 block truncate text-xs">
                        {integrationKind(item.code) ?? 'Сервіс'}
                      </span>
                    </span>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    <span className="text-app-muted min-w-[104px] text-right font-mono text-[13px]">
                      {item.verifiedAt === null ? (
                        <span className="text-app-dim">не перевірялася</span>
                      ) : (
                        <DateValue value={item.verifiedAt} withTime={false} />
                      )}
                    </span>
                  </Link>
                  {item.lastErrorCode !== null && (
                    <p className="text-state-danger px-6 pb-3.5 text-[13px] leading-5 text-pretty">
                      {integrationErrorMessage(item.lastErrorCode)}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {available.length > 0 && (
        <section
          aria-label="Доступні до підключення"
          className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
        >
          <div className="px-6 pt-5 pb-4">
            <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
              Доступні до підключення
            </h2>
          </div>
          <ul className="divide-app-line border-app-line grid divide-y border-t">
            {available.map((definition) => (
              <li
                className="flex flex-wrap items-center gap-x-3.5 gap-y-3 px-6 py-4"
                key={definition.id}
              >
                <Mark code={definition.code} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold tracking-[-0.01em] text-white">
                    {definition.displayName}
                  </span>
                  <span className="text-app-dim mt-0.5 block text-xs">
                    {integrationKind(definition.code) ?? 'Сервіс'}
                  </span>
                </span>
                <Button
                  aria-busy={connecting === definition.id}
                  disabled={connecting !== null}
                  onClick={() => void connect(definition.id)}
                >
                  {connecting === definition.id ? 'Підключаємо…' : 'Підключити'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </RedesignShell>
  )
}
