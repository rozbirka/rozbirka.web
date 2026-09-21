import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useParams } from 'react-router'
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
import { RedesignShell, RedesignTitle } from '../redesign-shell'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  diagnosticCheckLabel,
  integrationErrorMessage,
  integrationMark,
  integrationStatusPresentation,
} from './integration-labels'

const NO_RENAME =
  'Перейменувати підключення не можна — назву задає каталог сервісів.'

const FACTS = [
  'Оформлення доставки Україною між відділеннями просто з картки замовлення.',
  'Розрахунок орієнтовної вартості доставки за даними Нової пошти.',
  'Створення ТТН і збереження номера в замовленні.',
  'Оновлення статусу відправлення. Статус оплати замовлення змінюється окремо, вручну.',
]

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
  tone?: 'plain' | 'danger'
  children: ReactNode
}) {
  return (
    <section
      className={`bg-app-raised min-w-0 rounded-[20px] border px-6 py-5 ${
        tone === 'danger' ? 'border-state-danger/30' : 'border-app-line'
      }`}
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

export function NovaPoshtaScreen() {
  const cabinet = useCabinet()
  const params = useParams()
  const integrationId = params['integrationId'] ?? ''
  const tenant = cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const scopeKey = `${generation ?? ''}:${tenant?.id ?? ''}:${integrationId}`
  const [loaded, setLoaded] = useState<{
    key: string
    state: LoadState
  } | null>(null)
  // Derived during render: a scope change shows the loading state without a
  // second pass through the effect.
  const state: LoadState =
    loaded?.key === scopeKey ? loaded.state : { kind: 'loading' }
  const [diagnostics, setDiagnostics] = useState<IntegrationDiagnostics | null>(
    null,
  )
  const [editingKey, setEditingKey] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'verify' | 'toggle'>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.integrations,
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

  if (tenant === null) {
    return (
      <p className="text-app-muted text-sm">
        Оберіть розбірку, щоб відкрити інтеграцію.
      </p>
    )
  }

  const backTo = cabinetPath(tenant.slug, 'integrations')

  if (state.kind !== 'ready') {
    return (
      <RedesignShell crumb="Налаштування · Інтеграція">
        <RedesignTitle title="Інтеграція" />
        {state.kind === 'loading' ? (
          <p className="text-app-muted text-sm">Завантажуємо…</p>
        ) : (
          <Notice tone="danger">
            Не вдалося відкрити інтеграцію.{' '}
            <Link className="underline underline-offset-4" to={backTo}>
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
  const settings = integration.settings

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

  return (
    <RedesignShell
      actions={
        <>
          <Button asChild>
            <Link to={backTo}>
              <ArrowLeft aria-hidden />
              Інтеграції
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link
              to={cabinetPath(
                tenant.slug,
                'integrations',
                `${integration.id}/dispatch-points`,
              )}
            >
              Точки відправлення
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link
              to={cabinetPath(
                tenant.slug,
                'integrations',
                `${integration.id}/webhook`,
              )}
            >
              Діагностика статусів
            </Link>
          </Button>
        </>
      }
      crumb={`Налаштування · ${integration.displayName}`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="border-app-line text-app-muted inline-flex size-14 shrink-0 items-center justify-center rounded-[16px] border font-mono text-[16px]"
        >
          {integrationMark(integration.code)}
        </span>
        <div className="min-w-0 flex-1">
          <RedesignTitle
            aside={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
            lead="Доставка Україною між відділеннями. Керування доступне тим, кому відкриті налаштування команди."
            title={integration.displayName}
          />
        </div>
      </div>

      {error !== null && <Notice tone="danger">{error}</Notice>}
      {integration.lastErrorCode !== null && (
        <Notice tone="danger">
          {integrationErrorMessage(integration.lastErrorCode)}
        </Notice>
      )}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="grid min-w-0 content-start gap-5">
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
                    {busy === 'verify'
                      ? 'Перевіряємо…'
                      : 'Перевірити підключення'}
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Card title="Перевірка підключення">
            <dl className="grid gap-2.5 text-[13.5px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Остання успішна перевірка</dt>
                <dd className="text-app-ink text-right font-medium">
                  {integration.verifiedAt === null ? (
                    <span className="text-app-dim">ще не перевірялося</span>
                  ) : (
                    <DateValue value={integration.verifiedAt} />
                  )}
                </dd>
              </div>
              {settings?.activeDispatchPoints !== undefined && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">
                    Активних точок відправлення
                  </dt>
                  <dd className="text-app-ink text-right font-medium tabular-nums">
                    {settings.activeDispatchPoints}
                  </dd>
                </div>
              )}
            </dl>
            {diagnostics === null ? (
              <p className="text-app-dim text-[12.5px] leading-5 text-pretty">
                Перевірка запитує довідники Нової пошти під вашим ключем і
                показує, на якому кроці підключення зупиняється.
              </p>
            ) : (
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
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-5">
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
                className="w-full justify-center"
                disabled={busy !== null || (!active && !configured)}
                onClick={() =>
                  void run('toggle', () =>
                    active
                      ? integrationsApi.deactivate(integration.id)
                      : integrationsApi.activate(integration.id),
                  )
                }
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
      </div>
    </RedesignShell>
  )
}
