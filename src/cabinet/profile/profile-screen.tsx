import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { LogOut } from 'lucide-react'
import { Button, Field, Notice, TextInput } from '@/components/app'
import { useAuth } from '@/auth/AuthContext'
import { AccountDeletion } from '@/components/account/account-deletion'
import { useCabinet } from '../CabinetContext'
import { RedesignShell, RedesignTitle } from '../redesign-shell'

type SaveState = 'idle' | 'pending' | 'success' | 'error'

const FORM_ID = 'profile-form'

const NO_PHONE_EDIT =
  'Телефон змінити не можна: це логін. Редагується тільки імʼя.'

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
  return (
    <RedesignShell crumb="Налаштування · Профіль">
      <RedesignTitle lead="Особисті дані та доступ." title="Профіль" />

      {saveState === 'success' && (
        <Notice tone="ok">Ім’я успішно оновлено.</Notice>
      )}
      {saveState === 'error' && (
        <Notice tone="danger">
          Не вдалося зберегти ім’я. Спробуйте ще раз.
        </Notice>
      )}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Особисті дані">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="bg-brand/12 text-brand inline-flex size-14 shrink-0 items-center justify-center rounded-[16px] text-[18px] font-extrabold"
            >
              {initials(normalizedName)}
            </span>
            <div className="min-w-0">
              <p className="text-app-ink truncate text-[17px] font-bold">
                {normalizedName || 'Без імені'}
              </p>
              <p className="text-app-dim mt-1 text-[13px]">
                {phone ?? 'Телефон не вказано'}
              </p>
            </div>
          </div>

          <form
            className="mt-5 grid gap-4"
            id={FORM_ID}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <div className="border-app-line flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                disabled={busy || normalizedName === savedName}
                onClick={() => handleNameChange(savedName)}
                type="button"
              >
                Скасувати зміни
              </Button>
              <Button
                className="px-5 text-sm font-bold"
                disabled={!canSave}
                type="submit"
                variant="primary"
              >
                {busy ? 'Зберігаємо…' : 'Зберегти'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="grid min-w-0 content-start gap-5">
          <Card title="Доступ">
            <dl className="grid gap-3 text-[13.5px]">
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
            </dl>
            <div className="border-app-line mt-4 border-t pt-4">
              <Button
                className="w-full justify-center"
                onClick={() => void auth.signOut()}
              >
                <LogOut aria-hidden />
                Вийти з системи
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
    <section
      aria-label={title}
      className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5"
    >
      <h2 className="text-app-ink text-[15px] font-bold">{title}</h2>
      <div className="mt-3.5">{children}</div>
    </section>
  )
}
