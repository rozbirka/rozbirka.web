import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { LogOut } from 'lucide-react'
import { Button, DateValue, Notice } from '@/components/app'
import { useAuth } from '@/auth/AuthContext'
import { credentials } from '@/api/credentials'
import { profileApi } from '@/api/profile'
import { tenantPreference } from '@/api/tenant-preference'
import { useCabinet } from '../CabinetContext'

type SaveState = 'idle' | 'pending' | 'success' | 'error'
type DeleteState = 'idle' | 'confirming' | 'pending' | 'error'

const FORM_ID = 'profile-form'

const LANGUAGES = ['Українська', 'English', 'Polski'] as const
const START_SCREENS = ['Дашборд', 'Склад', 'Сканер'] as const
const NOTIFICATIONS = [
  { label: 'Мало залишку', hint: 'Коли деталь падає нижче мінімуму' },
  {
    label: 'Нові замовлення',
    hint: 'Сповіщення при створенні замовлення менеджером',
  },
  { label: 'Тижневий звіт поштою', hint: 'Щопонеділка — гроші й склад' },
] as const

/** What the identity service does not offer, said where the design asks for it. */
const NO_AVATAR =
  'Фото профілю сервер не зберігає: у відповіді є лише імʼя, телефон і роль, тож замість аватара — ініціали.'
const NO_PHONE_EDIT =
  'Телефон змінити не можна: це логін, і сервер дозволяє редагувати лише імʼя.'
const NO_EMAIL =
  'Пошти в обліковому записі немає — вхід іде за номером телефону й одноразовим кодом.'
const NO_PREFERENCES =
  'Ні мови, ні стартового екрана сервер не зберігає — ендпоінта налаштувань користувача немає.'
const NO_NOTIFICATIONS =
  'Налаштувань сповіщень сервер не тримає: увімкнути чи вимкнути їх нема через що.'
const NO_PASSWORD =
  'Пароля в системі немає взагалі — вхід підтверджується одноразовим кодом, тож і міняти нічого.'
const NO_SESSIONS =
  'Переліку сеансів сервер не віддає: ні пристроїв, ні міст, ні кнопки завершити чужий вхід.'
const NO_JOINED_AT = 'Дати реєстрації користувача у відповіді немає.'
const NO_LAST_LOGIN = 'Сервер ще не повідомив дату останнього входу.'

/** Two letters standing in for the photo the API does not keep. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '—'

const roleLabels: Record<string, string> = {
  owner: 'Власник',
  manager: 'Менеджер',
  master: 'Майстер',
}

export function ProfileScreen() {
  const auth = useAuth()
  const cabinet = useCabinet()
  const currentName = auth.user?.displayName ?? ''
  const [name, setName] = useState(currentName)
  const [savedName, setSavedName] = useState(currentName.trim())
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const mountedRef = useRef(true)
  const deleteRequestRef = useRef<AbortController | null>(null)
  const deletionDispatchedRef = useRef(false)
  const privateStateClearedRef = useRef(false)
  const authRef = useRef(auth)
  const profileGenerationRef = useRef(0)

  function clearPrivateState() {
    if (privateStateClearedRef.current) return
    privateStateClearedRef.current = true
    credentials.clear()
    tenantPreference.clear()
    void auth.signOut({ silent: true }).catch(() => undefined)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (deletionDispatchedRef.current) {
        deleteRequestRef.current?.abort('profile-unmounted')
        deleteRequestRef.current = null
        clearPrivateState()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup must run only on unmount, using the latest render closure is not required after deletion dispatch.
  }, [])

  useEffect(() => {
    authRef.current = auth
    profileGenerationRef.current += 1
    const nextName = auth.user?.displayName ?? ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state is intentionally reset at the authenticated-user boundary.
    setName(nextName)
    setSavedName(nextName.trim())
    setSaveState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reset is keyed only to identity transitions.
  }, [auth.status, auth.user?.id])

  const normalizedName = name.trim()
  const busy = saveState === 'pending'
  const canSave =
    !busy && normalizedName.length >= 2 && normalizedName !== savedName

  const handleNameChange = (nextName: string) => {
    setName(nextName)
    if (saveState !== 'pending') setSaveState('idle')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return

    const requestUserId = auth.user?.id
    const requestGeneration = profileGenerationRef.current
    setSaveState('pending')
    try {
      await auth.updateName(normalizedName)
      if (
        !mountedRef.current ||
        profileGenerationRef.current !== requestGeneration ||
        authRef.current.status !== 'authenticated' ||
        authRef.current.user?.id !== requestUserId
      ) {
        return
      }
      setName(normalizedName)
      setSavedName(normalizedName)
      setSaveState('success')
    } catch {
      if (
        !mountedRef.current ||
        profileGenerationRef.current !== requestGeneration ||
        authRef.current.user?.id !== requestUserId
      ) {
        return
      }
      setSaveState('error')
    }
  }

  const handleDelete = async () => {
    if (deleteState !== 'confirming') return

    const controller = new AbortController()
    deleteRequestRef.current = controller
    deletionDispatchedRef.current = true
    setDeleteState('pending')
    let deletionFailed = false
    try {
      await profileApi.deleteAccount({ signal: controller.signal })
    } catch {
      deletionFailed = true
    } finally {
      clearPrivateState()
      if (deleteRequestRef.current === controller) {
        deleteRequestRef.current = null
      }
    }
    if (deletionFailed && mountedRef.current) setDeleteState('error')
  }

  const role = cabinet.snapshot?.role
  const roleLabel = role
    ? (roleLabels[role.toLowerCase()] ?? role)
    : 'Не вказано'
  const phone = auth.user?.phone ?? null
  const lastLoginAt = auth.user?.lastLoginAt ?? null

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              Налаштування · Профіль
            </p>
            <h1 className="mt-1.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              Профіль
            </h1>
            <p className="text-app-muted mt-2.5 max-w-[62ch] text-[14.5px] leading-6 text-pretty">
              Ваші особисті дані та вхід у систему.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              disabled={busy || normalizedName === savedName}
              onClick={() => handleNameChange(savedName)}
            >
              Скасувати зміни
            </Button>
            <Button
              className="px-5 text-sm font-bold"
              disabled={!canSave}
              form={FORM_ID}
              type="submit"
              variant="primary"
            >
              {busy ? 'Зберігаємо…' : 'Зберегти'}
            </Button>
          </div>
        </div>

        {saveState === 'success' && (
          <Notice tone="ok">Ім’я успішно оновлено.</Notice>
        )}
        {saveState === 'error' && (
          <Notice tone="danger">
            Не вдалося зберегти ім’я. Спробуйте ще раз.
          </Notice>
        )}

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 content-start gap-5">
            <Card title="Особисті дані">
              <div className="flex flex-wrap items-center gap-4">
                <span
                  aria-hidden
                  className="border-app-line text-app-muted inline-flex size-16 shrink-0 items-center justify-center rounded-full border text-[18px] font-bold"
                >
                  {initials(normalizedName)}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Dead title={NO_AVATAR}>Завантажити фото</Dead>
                  <Dead title={NO_AVATAR}>Прибрати</Dead>
                </div>
              </div>
              <p className="text-app-dim mt-3 text-[12.5px] leading-5 text-pretty">
                {NO_AVATAR}
              </p>
              <form
                className="mt-5 grid gap-4 sm:grid-cols-2"
                id={FORM_ID}
                onSubmit={(event) => void handleSubmit(event)}
              >
                <div className="grid gap-2">
                  <label
                    className="text-app-muted text-[13px] font-medium"
                    htmlFor="profile-name"
                  >
                    Ім’я та прізвище
                  </label>
                  <input
                    autoComplete="name"
                    className="bg-app-input border-app-line-2 rounded-control text-app-ink focus-visible:border-brand min-h-11 w-full border px-3 text-sm outline-none transition-colors disabled:opacity-55"
                    disabled={busy}
                    id="profile-name"
                    onChange={(event) => handleNameChange(event.target.value)}
                    placeholder="Дмитро Кравець"
                    value={name}
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-app-muted text-[13px] font-medium"
                    htmlFor="profile-phone"
                  >
                    Телефон
                  </label>
                  <input
                    className="bg-app-input border-app-line rounded-control text-app-dim min-h-11 w-full cursor-not-allowed border px-3 text-sm outline-none"
                    disabled
                    id="profile-phone"
                    readOnly
                    title={NO_PHONE_EDIT}
                    value={phone ?? 'не вказано'}
                  />
                </div>
              </form>
              <p className="text-app-dim mt-3 text-[12.5px] leading-5 text-pretty">
                {NO_PHONE_EDIT}
              </p>
              <div className="border-app-line mt-5 border-t pt-5">
                <p className="text-app-muted text-[13px] font-medium">
                  Вхід у систему
                </p>
                <p className="text-app-ink mt-2 text-[14px]">
                  {phone ?? '—'}
                  <span
                    className="border-app-line text-app-dim ml-2.5 rounded-full border px-2.5 py-0.5 align-middle text-[11px]"
                    title={NO_EMAIL}
                  >
                    код у SMS
                  </span>
                </p>
                <p className="text-app-dim mt-2 text-[12.5px] leading-5 text-pretty">
                  {NO_EMAIL}
                </p>
              </div>
            </Card>

            <Card title="Інтерфейс">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-app-muted text-[13px] font-medium">Мова</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LANGUAGES.map((label) => (
                      <Dead key={label} title={NO_PREFERENCES}>
                        {label}
                      </Dead>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-app-muted text-[13px] font-medium">
                    Стартовий екран
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {START_SCREENS.map((label) => (
                      <Dead key={label} title={NO_PREFERENCES}>
                        {label}
                      </Dead>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
                {NO_PREFERENCES}
              </p>
            </Card>

            <Card title="Повідомлення">
              <div className="grid gap-2">
                {NOTIFICATIONS.map((item) => (
                  <div
                    className="border-app-line flex items-start gap-3 rounded-[14px] border px-3.5 py-3"
                    key={item.label}
                    title={NO_NOTIFICATIONS}
                  >
                    <span
                      aria-hidden
                      className="bg-app-line mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5"
                    >
                      <span className="bg-app-dim size-4 rounded-full" />
                    </span>
                    <span className="min-w-0">
                      <span className="text-app-dim block text-[13.5px] font-medium">
                        {item.label}
                      </span>
                      <span className="text-app-dim mt-0.5 block text-[12.5px]">
                        {item.hint}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
                {NO_NOTIFICATIONS}
              </p>
            </Card>

            <Card title="Безпека">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label
                    className="text-app-dim text-[13px] font-medium"
                    htmlFor="profile-password"
                  >
                    Новий пароль
                  </label>
                  <input
                    autoComplete="new-password"
                    className="bg-app-input border-app-line rounded-control text-app-dim min-h-11 w-full cursor-not-allowed border px-3 text-sm outline-none"
                    disabled
                    id="profile-password"
                    placeholder="паролів у системі немає"
                    title={NO_PASSWORD}
                    type="password"
                    value=""
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-app-dim text-[13px] font-medium"
                    htmlFor="profile-password-repeat"
                  >
                    Повторіть пароль
                  </label>
                  <input
                    autoComplete="new-password"
                    className="bg-app-input border-app-line rounded-control text-app-dim min-h-11 w-full cursor-not-allowed border px-3 text-sm outline-none"
                    disabled
                    id="profile-password-repeat"
                    placeholder="—"
                    title={NO_PASSWORD}
                    type="password"
                    value=""
                  />
                </div>
              </div>
              <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
                {NO_PASSWORD}
              </p>
            </Card>
          </div>

          <div className="grid min-w-0 content-start gap-5">
            <Card title="Ваш доступ">
              <dl className="grid gap-2.5 text-[13.5px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Роль</dt>
                  <dd className="text-app-ink text-right font-medium">
                    {roleLabel}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Кабінет</dt>
                  <dd className="text-app-ink text-right font-medium">
                    {cabinet.targetTenant?.name ?? 'Не вибрано'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">У системі з</dt>
                  <dd className="text-app-dim text-right" title={NO_JOINED_AT}>
                    —
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Останній вхід</dt>
                  <dd className="text-app-ink text-right font-medium">
                    {lastLoginAt === null ? (
                      <span className="text-app-dim" title={NO_LAST_LOGIN}>
                        —
                      </span>
                    ) : (
                      <DateValue value={lastLoginAt} />
                    )}
                  </dd>
                </div>
              </dl>
              <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
                Роль і кабінет змінює власник розбірки в розділі «Команда».
              </p>
            </Card>

            <Card title="Активні сеанси">
              <p className="text-[24px] leading-none font-extrabold">
                <span className="text-app-dim" title={NO_SESSIONS}>
                  —
                </span>
              </p>
              <p className="text-app-dim mt-3 text-[12.5px] leading-5 text-pretty">
                {NO_SESSIONS}
              </p>
              <div className="mt-3.5">
                <Dead title={NO_SESSIONS}>Завершити інші сеанси</Dead>
              </div>
            </Card>

            <Card title="Сеанс">
              <Button
                className="w-full justify-center"
                onClick={() => void auth.signOut()}
              >
                <LogOut aria-hidden />
                Вийти з системи
              </Button>
              <p className="text-app-dim mt-3 text-[12.5px] leading-5 text-pretty">
                Вихід діє лише в цьому браузері — інші сеанси сервер завершити
                не дає.
              </p>
            </Card>

            <section className="border-state-danger/30 bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
              <h2 className="text-app-ink text-[15px] font-bold">
                Видалити акаунт
              </h2>
              <p className="text-app-muted mt-2.5 text-[13px] leading-5 text-pretty">
                Цю дію неможливо скасувати. Ви втратите доступ до всіх розбірок.
              </p>
              {deleteState === 'error' && (
                <div className="mt-3">
                  <Notice tone="danger">
                    Не вдалося видалити акаунт. Спробуйте ще раз.
                  </Notice>
                </div>
              )}
              {deleteState === 'confirming' || deleteState === 'pending' ? (
                <div
                  aria-labelledby="delete-account-title"
                  aria-live="polite"
                  className="border-state-danger/30 rounded-panel mt-3.5 grid gap-3 border p-4"
                  role="group"
                >
                  <p className="text-sm text-white" id="delete-account-title">
                    Підтвердіть видалення акаунта. Ця дія незворотна.
                  </p>
                  {deleteState === 'pending' ? (
                    <p className="text-app-muted text-sm" role="status">
                      Видалення розпочато. Локальний вихід буде виконано для
                      безпеки.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setDeleteState('idle')}>
                        Скасувати
                      </Button>
                      <Button
                        onClick={() => void handleDelete()}
                        variant="danger"
                      >
                        Так, видалити акаунт
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  className="mt-3.5 w-full justify-center"
                  onClick={() => setDeleteState('confirming')}
                  variant="danger"
                >
                  Видалити акаунт
                </Button>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
      <h2 className="text-app-ink text-[15px] font-bold">{title}</h2>
      <div className="mt-3.5">{children}</div>
    </section>
  )
}

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
