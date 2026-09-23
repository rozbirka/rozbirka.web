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
} from '@/components/app'
import {
  integrationsApi,
  type Integration,
  type IntegrationDiagnostics,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { cabinetModules } from '../module-registry'
import { RedesignShell } from '../redesign-shell'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { DispatchPointsPanel } from './dispatch-points-panel'
import { WebhookPanel } from './webhook-panel'
import { Switch } from './dispatch-point-form'
import {
  diagnosticCheckLabel,
  integrationErrorMessage,
  integrationMark,
  integrationStatusPresentation,
} from './integration-labels'

const NO_RENAME =
  'Перейменувати підключення не можна — назву задає каталог сервісів.'

const NO_SHIPMENT_TOTALS =
  'Скільки доставок за місяць і скільки їх у дорозі — сервіс не рахує: відправлення читаються по одному замовленню.'

const FACTS = [
  'Оформлення доставки Україною між відділеннями просто з картки замовлення.',
  'Розрахунок орієнтовної вартості доставки за даними Нової пошти.',
  'Створення ТТН і збереження номера в замовленні.',
  'Оновлення статусу відправлення. Статус оплати замовлення змінюється окремо, вручну.',
]

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
  | { kind: 'error' }

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
      .getById(integrationId, { signal: controller.signal })
      .then(
        (integration) => {
          if (!controller.signal.aborted)
            setLoaded({ key: scopeKey, state: { kind: 'ready', integration } })
        },
        () => {
          if (!controller.signal.aborted)
            setLoaded({ key: scopeKey, state: { kind: 'error' } })
        },
      )
    return () => controller.abort()
  }, [integrationId, scopeKey])

  // Tab counters, read once for the header: a badge must not wait for its own
  // tab to be opened. Each panel reports its number back after a change.
  useEffect(() => {
    if (integrationId === '') return
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
  }, [integrationId, scopeKey])

  if (tenant === null) {
    return (
      <p className="text-app-muted text-sm">
        Оберіть розбірку, щоб відкрити інтеграцію.
      </p>
    )
  }

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

  if (state.kind !== 'ready') {
    return (
      <RedesignShell crumb="Налаштування · Інтеграція">
        {state.kind === 'loading' ? (
          <p className="text-app-muted text-sm">Завантажуємо…</p>
        ) : (
          <Notice tone="danger">
            Не вдалося відкрити інтеграцію.{' '}
            <Link className="underline underline-offset-4" to={listPath}>
              Повернутися до списку
            </Link>
          </Notice>
        )}
      </RedesignShell>
    )
  }

  const integration = state.integration
  const status = integrationStatusPresentation(integration.status)
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
  ) => {
    if (busy !== null) return
    try {
      requireLatestMutation()
    } catch {
      setError('Дія недоступна: немає прав на налаштування команди.')
      return
    }
    setBusy(kind)
    setError(null)
    try {
      apply(await action())
      if (kind === 'save' && mountedRef.current) {
        setEditingKey(false)
        setKey('')
      }
    } catch (problem) {
      if (mountedRef.current) setError(normalizeApiProblem(problem).message)
    } finally {
      if (mountedRef.current) setBusy(null)
    }
  }

  const verify = async () => {
    await run('verify', () => integrationsApi.verify(integration.id))
    if (!mountedRef.current) return
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
    await run('save', () =>
      integrationsApi.saveNovaPoshtaKey(integration.id, value),
    )
  }

  const toggle = () =>
    void run('toggle', () =>
      active
        ? integrationsApi.deactivate(integration.id)
        : integrationsApi.activate(integration.id),
    )

  const tabs: {
    id: Tab
    label: string
    badge?: string
    danger?: boolean
  }[] = [
    { id: 'overview', label: 'Огляд' },
    {
      id: 'points',
      label: 'Точки відправлення',
      ...(points === null ? {} : { badge: String(points) }),
    },
    {
      id: 'statuses',
      label: 'Статуси',
      ...(failures !== null && failures > 0
        ? { badge: `${failures} з помилкою`, danger: true }
        : {}),
    },
    { id: 'settings', label: 'Налаштування' },
  ]

  return (
    <RedesignShell
      actions={
        <Button asChild>
          <Link to={listPath}>
            <ArrowLeft aria-hidden />
            Інтеграції
          </Link>
        </Button>
      }
      crumb={`Налаштування · ${integration.displayName}`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="border-app-line text-app-muted inline-flex size-14 shrink-0 items-center justify-center rounded-[15px] border font-mono text-[15px]"
        >
          {integrationMark(integration.code)}
        </span>
        <div className="min-w-0 flex-[1_1_300px]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white sm:text-[38px]">
              {integration.displayName}
            </h1>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
          <p className="text-app-muted mt-2.5 max-w-[62ch] text-[14px] leading-6 text-pretty">
            Доставка Україною між відділеннями. Керування доступне тим, кому
            відкриті налаштування команди.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <span
            className={`text-[14px] font-semibold ${active ? 'text-app-ink' : 'text-app-muted'}`}
          >
            {active ? 'Увімкнена' : 'Вимкнена'}
          </span>
          <Switch
            checked={active}
            disabled={busy !== null || (!active && !configured)}
            label="Інтеграція увімкнена"
            onChange={toggle}
            title={
              !active && !configured
                ? 'Спершу збережіть ключ доступу.'
                : undefined
            }
          />
        </div>
      </div>

      <nav aria-label="Розділи інтеграції">
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
            title="Стан підключення"
            tone={failing ? 'danger' : active ? 'ok' : 'plain'}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p
                className={`text-[16px] font-bold ${failing ? 'text-state-danger' : 'text-app-ink'}`}
              >
                {failing
                  ? 'Сервіс відхилив підключення'
                  : configured
                    ? active
                      ? 'Підключення працює'
                      : 'Інтеграція вимкнена'
                    : 'Ключ доступу ще не збережено'}
              </p>
              <p className="text-app-dim font-mono text-[12px]">
                {integration.verifiedAt === null ? (
                  'ще не перевірялося'
                ) : (
                  <>
                    перевірено <DateValue value={integration.verifiedAt} />
                  </>
                )}
              </p>
            </div>
            <p className="text-app-muted text-[13px] leading-5 text-pretty">
              {integration.lastErrorCode === null
                ? configured
                  ? 'Ключ приймається сервісом. Довідники міст і відділень доступні.'
                  : 'Додайте ключ доступу в «Налаштуваннях», щоб перевірити підключення.'
                : integrationErrorMessage(integration.lastErrorCode)}
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
                        {diagnosticCheckLabel(check.code)}
                      </span>
                      {check.errorCode !== null && (
                        <span className="text-app-muted mt-0.5 block text-[12.5px] text-pretty">
                          {integrationErrorMessage(check.errorCode)}
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
                title={
                  configured
                    ? undefined
                    : 'Спершу збережіть ключ доступу — перевіряти поки нічого.'
                }
              >
                {busy === 'verify' ? 'Перевіряємо…' : 'Перевірити ще раз'}
              </Button>
              {(failing || !configured) && (
                <Button asChild variant="primary">
                  <Link to={tabPath('settings')}>
                    {configured ? 'Замінити ключ' : 'Додати ключ'}
                  </Link>
                </Button>
              )}
            </div>
          </Card>

          <div className="grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <Stat
              label="Точок відправлення"
              note="Звідки можна відправляти посилки"
              value={points === null ? '—' : String(points)}
            />
            <Stat
              label="Помилок обробки"
              note={
                failures === null || failures === 0
                  ? 'Події перевізника обробляються'
                  : 'Подій не прийнято — див. «Статуси»'
              }
              tone={failures !== null && failures > 0 ? 'danger' : 'plain'}
              value={failures === null ? '—' : String(failures)}
            />
            <Stat
              label="Доставок за 30 днів"
              note="Сервіс не рахує відправлення по розбірці"
              title={NO_SHIPMENT_TOTALS}
              value="—"
            />
          </div>

          <Card title="Що робить інтеграція">
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
                  {fact}
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
        <WebhookPanel
          integrationId={integration.id}
          onFailuresChange={setFailures}
        />
      )}

      {tab === 'settings' && (
        <div className="grid max-w-[640px] gap-5">
          <Card title="Підключення">
            <Field hint={NO_RENAME} label="Назва підключення">
              <TextInput
                disabled
                readOnly
                title={NO_RENAME}
                value={integration.displayName}
              />
            </Field>

            {editingKey ? (
              <form
                className="grid gap-3.5"
                noValidate
                onSubmit={(event) => void saveKey(event)}
              >
                <Field
                  hint="Після збереження ключ буде приховано. Старий ключ перестане діяти одразу."
                  label="Новий ключ доступу"
                  required
                >
                  <TextInput
                    autoComplete="off"
                    className="font-mono"
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="Вставте ключ з кабінету Нової пошти"
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
                    {busy === 'save' ? 'Зберігаємо…' : 'Зберегти ключ'}
                  </Button>
                  <Button
                    disabled={busy !== null}
                    onClick={() => {
                      setEditingKey(false)
                      setKey('')
                    }}
                  >
                    Скасувати
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="border-app-line bg-app-input flex flex-wrap items-center gap-3 rounded-[11px] border px-3.5 py-3">
                  <span className="text-app-muted min-w-0 font-mono text-[15px] tracking-[0.12em]">
                    {configured ? '••••••••••••••••' : 'ключ не збережено'}
                  </span>
                  {configured && (
                    <span className="text-state-ok ml-auto text-[12px] font-bold">
                      Збережено
                    </span>
                  )}
                </div>
                <p className="text-app-dim text-[12.5px] leading-5 text-pretty">
                  Збережений ключ не показуємо відкритим текстом — його можна
                  тільки замінити на новий.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    disabled={busy !== null}
                    onClick={() => setEditingKey(true)}
                    variant={configured ? 'ghost' : 'primary'}
                  >
                    {configured ? 'Замінити ключ' : 'Додати ключ'}
                  </Button>
                  <Button
                    aria-busy={busy === 'verify'}
                    disabled={busy !== null || !configured}
                    onClick={() => void verify()}
                    title={
                      configured
                        ? undefined
                        : 'Спершу збережіть ключ доступу — перевіряти поки нічого.'
                    }
                  >
                    Перевірити підключення
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Card
            title={active ? 'Вимкнення' : 'Увімкнення'}
            tone={active ? 'danger' : 'plain'}
          >
            <p className="text-app-muted text-[13px] leading-5 text-pretty">
              {active
                ? 'Створені ТТН залишаться дійсними, але оформити нову доставку й отримати оновлення статусів буде неможливо.'
                : 'Після ввімкнення доставку можна буде оформити просто з картки замовлення. Спершу збережіть і перевірте ключ доступу.'}
            </p>
            <div>
              <Button
                aria-busy={busy === 'toggle'}
                disabled={busy !== null || (!active && !configured)}
                onClick={toggle}
                title={
                  !active && !configured
                    ? 'Спершу збережіть ключ доступу.'
                    : undefined
                }
                variant={active ? 'danger' : 'primary'}
              >
                {active ? 'Вимкнути інтеграцію' : 'Увімкнути інтеграцію'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </RedesignShell>
  )
}
