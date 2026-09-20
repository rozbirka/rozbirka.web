import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { LogOut } from 'lucide-react'
import { Button, DateValue, Field, Notice, TextInput } from '@/components/app'
import { useAuth } from '@/auth/AuthContext'
import { AccountDeletion } from '@/components/account/account-deletion'
import { useCabinet } from '../CabinetContext'
import { RedesignShell, RedesignTitle } from '../redesign-shell'

type SaveState = 'idle' | 'pending' | 'success' | 'error'

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
  'Фото профілю не зберігається: обліковий запис знає імʼя, телефон і роль, тож замість аватара — ініціали.'
const NO_PHONE_EDIT =
  'Телефон змінити не можна: це логін. Редагується тільки імʼя.'
const NO_EMAIL =
  'Пошти в обліковому записі немає — вхід іде за номером телефону й одноразовим кодом.'
const NO_PREFERENCES = 'Ні мова, ні стартовий екран поки не зберігаються.'
const NO_NOTIFICATIONS =
  'Налаштувань сповіщень поки немає — увімкнути чи вимкнути їх нема де.'
const NO_PASSWORD =
  'Пароля в системі немає взагалі — вхід підтверджується одноразовим кодом, тож і міняти нічого.'
const NO_SESSIONS =
  'Переліку сеансів поки немає: ні пристроїв, ні міст, ні можливості завершити чужий вхід.'
const NO_JOINED_AT = 'Дата реєстрації не зберігається.'
const NO_LAST_LOGIN = 'Дата останнього входу ще не відома.'

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
  const mountedRef = useRef(true)
  const authRef = useRef(auth)
  const profileGenerationRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
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

  const role = cabinet.snapshot?.role
  const roleLabel = role
    ? (roleLabels[role.toLowerCase()] ?? role)
    : 'Не вказано'
  const phone = auth.user?.phone ?? null
  const lastLoginAt = auth.user?.lastLoginAt ?? null

  return (
    <RedesignShell
      actions={
        <>
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
        </>
      }
      crumb="Налаштування · Профіль"
    >
      <RedesignTitle
        lead="Ваші особисті дані та вхід у систему."
        title="Профіль"
      />

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
              <Field label="Ім’я та прізвище" required>
                <TextInput
                  autoComplete="name"
                  disabled={busy}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="Дмитро Кравець"
                  value={name}
                />
              </Field>
              <Field label="Телефон">
                <TextInput
                  disabled
                  readOnly
                  title={NO_PHONE_EDIT}
                  value={phone ?? 'не вказано'}
                />
              </Field>
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
              <Field label="Новий пароль">
                <TextInput
                  autoComplete="new-password"
                  disabled
                  placeholder="паролів у системі немає"
                  title={NO_PASSWORD}
                  type="password"
                  value=""
                />
              </Field>
              <Field label="Повторіть пароль">
                <TextInput
                  autoComplete="new-password"
                  disabled
                  placeholder="—"
                  title={NO_PASSWORD}
                  type="password"
                  value=""
                />
              </Field>
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
              Вихід діє лише в цьому браузері — завершити інші сеанси поки не
              можна.
            </p>
          </Card>

          <Card title="Особистий акаунт">
            <p className="text-app-muted text-[13px] leading-5 text-pretty">
              Окрема сторінка з тими самими діями над акаунтом. Вона
              відкривається навіть тоді, коли доступу до розбірки немає.
            </p>
            <div className="mt-3.5">
              <Button asChild className="w-full justify-center">
                <Link to="/account/security">Відкрити</Link>
              </Button>
            </div>
          </Card>

          <AccountDeletion key={auth.user?.id} />
        </div>
      </div>
    </RedesignShell>
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
