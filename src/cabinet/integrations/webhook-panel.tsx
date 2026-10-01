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
import { plural } from '@/lib/utils'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

const NO_EVENT_DETAIL =
  'Сервіс повертає тільки ідентифікатори подій — ні номера накладної, ні причини, ні часу по кожній з них немає.'

const NO_FEED_STATS =
  'Скільки подій оброблено за добу й скільки відхилено через підпис — сервіс не рахує.'

const EVENTS: [string, string, string] = ['подія', 'події', 'подій']

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

/** Minutes are what an operator reads here, not a timestamp. */
function waitedFor(from: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - Date.parse(from)) / 60000),
  )
  if (minutes < 60) return `${minutes} хв`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} год` : `${Math.floor(hours / 24)} дн`
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
      <p className="text-app-muted text-sm">
        Оберіть розбірку, щоб відкрити діагностику.
      </p>
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
      setError('Дія недоступна: немає прав на налаштування команди.')
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
      if (mountedRef.current) setError(normalizeApiProblem(problem).message)
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
      if (mountedRef.current) setError(normalizeApiProblem(problem).message)
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
          ? `Повторено подій: ${done}.`
          : `Повторено ${done} із ${ids.length}. Не вдалося: ${failed}.`,
    })
    reload()
  }

  const copyUrl = async () => {
    if (receiveUrl === null) return
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(receiveUrl)
      toast.show({ tone: 'ok', message: 'Адресу прийому скопійовано.' })
    } catch {
      setError('Не вдалося скопіювати адресу прийому.')
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-app-muted max-w-[62ch] text-[14px] leading-6 text-pretty">
          Чи Rozbirka отримує події Нової пошти і що сталося з необробленими.
          Технічний блок для адміністратора.
        </p>
        <Button disabled={busy !== null} onClick={reload}>
          Оновити дані
        </Button>
      </div>

      {error !== null && <Notice tone="danger">{error}</Notice>}

      {state.kind === 'error' && (
        <Notice tone="danger">
          Не вдалося прочитати стан черги подій. На вже створені накладні це не
          впливає —{' '}
          <button
            className="underline underline-offset-4"
            onClick={reload}
            type="button"
          >
            спробувати ще раз
          </button>
          .
        </Notice>
      )}

      {state.kind === 'loading' && (
        <p className="text-app-muted text-sm">Збираємо дані про черги подій…</p>
      )}

      {status !== null && (
        <>
          {status.enabled ? (
            status.deadLetters > 0 ? (
              <Notice tone="warn">
                Прийом подій налаштований, але{' '}
                {plural(status.deadLetters, [
                  'одну подію',
                  `${status.deadLetters} події`,
                  `${status.deadLetters} подій`,
                ])}{' '}
                не вдалося обробити після всіх спроб. Статуси цих відправлень
                оновлюються лише вручну.
              </Notice>
            ) : (
              <Notice tone="ok">
                Прийом подій налаштований, черга чиста. Статуси відправлень
                оновлюються самі.
              </Notice>
            )
          ) : (
            <Notice tone="danger">
              Прийом подій не налаштований. Rozbirka не отримує події Нової
              пошти — статуси відправлень оновлюються тільки вручну, з картки
              замовлення.
            </Notice>
          )}

          <KpiStrip>
            <Kpi
              label="Прийом подій"
              meta={
                status.enabled
                  ? 'Секрет збережено, підпис перевіряється'
                  : 'Секрет не збережено'
              }
              tone={status.enabled ? 'plain' : 'warn'}
              value={status.enabled ? 'Так' : 'Ні'}
            />
            <Kpi
              label="Очікують обробки"
              meta={
                status.pending === 0
                  ? 'Черга порожня'
                  : 'Обробляються за чергою'
              }
              unit={plural(status.pending, EVENTS)}
              value={String(status.pending)}
            />
            <Kpi
              label="Найстаріша необроблена"
              meta={
                status.oldestPendingAt === null ? (
                  'Необроблених подій немає'
                ) : (
                  <>
                    Подія від <DateValue value={status.oldestPendingAt} />
                  </>
                )
              }
              tone={status.oldestPendingAt === null ? 'plain' : 'warn'}
              value={
                status.oldestPendingAt === null
                  ? '—'
                  : waitedFor(status.oldestPendingAt)
              }
            />
            <Kpi
              label="Спроби вичерпані"
              meta={
                status.deadLetters === 0
                  ? 'Без помилок'
                  : 'Потрібне ручне повторення'
              }
              tone={status.deadLetters === 0 ? 'plain' : 'warn'}
              unit={plural(status.deadLetters, EVENTS)}
              value={String(status.deadLetters)}
            />
          </KpiStrip>

          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <section
              aria-label="Події з вичерпаними спробами"
              className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-6 pt-5 pb-4">
                <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
                  Події з вичерпаними спробами
                </h2>
                {status.deadLetterIds.length > 0 && (
                  <Button
                    aria-busy={busy === 'retry'}
                    disabled={busy !== null}
                    onClick={() => void retryAll(status.deadLetterIds)}
                  >
                    Повторити всі
                  </Button>
                )}
              </div>
              {status.deadLetterIds.length === 0 ? (
                <div className="border-app-line grid justify-items-center gap-2 border-t px-6 py-10 text-center">
                  <p className="text-[17px] font-bold tracking-[-0.01em] text-white">
                    Помилок обробки немає
                  </p>
                  <p className="text-app-muted max-w-[44ch] text-[13px] leading-5 text-pretty">
                    Список заповнюється лише тоді, коли спроби обробити подію
                    вичерпані.
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
                          title={NO_EVENT_DETAIL}
                        >
                          Подія {eventId.slice(0, 8)}
                        </span>
                        <Button
                          aria-busy={retrying === eventId}
                          disabled={busy !== null}
                          onClick={() => void retryOne(eventId)}
                        >
                          {retrying === eventId ? 'Повторюємо…' : 'Повторити'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="text-app-dim border-app-line border-t px-6 py-4 text-[13px] leading-5 text-pretty"
                    title={NO_EVENT_DETAIL}
                  >
                    Сервіс не повідомляє, якої накладної стосується подія і чому
                    її не вдалося обробити. Показано до 20 найстаріших.
                  </p>
                </>
              )}
            </section>

            <Card title="Секрет для перевірки підпису">
              {editingSecret ? (
                <form
                  className="grid gap-3.5"
                  noValidate
                  onSubmit={(event) => void saveSecret(event)}
                >
                  <Field
                    hint="Після збереження секрет буде приховано."
                    label="Новий секрет"
                    required
                  >
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
                      Зберегти секрет
                    </Button>
                    <Button
                      disabled={busy !== null}
                      onClick={() => {
                        setEditingSecret(false)
                        setSecret('')
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
                      {status.enabled
                        ? '••••••••••••••••'
                        : 'секрет не збережено'}
                    </span>
                    {status.enabled && (
                      <span className="text-state-ok ml-auto text-[12px] font-bold">
                        Збережено
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      disabled={busy !== null}
                      onClick={() => setEditingSecret(true)}
                      variant={status.enabled ? 'ghost' : 'primary'}
                    >
                      {status.enabled ? 'Замінити секрет' : 'Додати секрет'}
                    </Button>
                    <Button
                      disabled={busy !== null || receiveUrl === null}
                      onClick={() => void copyUrl()}
                    >
                      Скопіювати адресу прийому
                    </Button>
                  </div>
                </>
              )}
              <Notice tone="warn">
                Збереження секрету в Rozbirka не реєструє підписку в Новій пошті
                — її налаштовують окремо, у кабінеті перевізника.
              </Notice>
              <p
                className="text-app-dim text-[12.5px] leading-5 text-pretty"
                title={NO_FEED_STATS}
              >
                Скільки подій оброблено за добу й скільки відхилено через підпис
                — тут не показуємо: сервіс цього не рахує.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
