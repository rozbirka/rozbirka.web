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
import { useT } from '@/i18n/hooks'
import { useCabinet } from '../CabinetContext'
import { RedesignShell, RedesignTitle } from '../redesign-shell'
import { LanguageCard } from './language-card'
import { RegionSummary } from '../business/region-settings'
import { profileMessages } from './profile-messages'

type SaveState = 'idle' | 'pending' | 'success' | 'error'

const FORM_ID = 'profile-form'

/** Two letters standing in for the photo the API does not keep. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '—'

const roleKeys = {
  owner: 'roleOwner',
  manager: 'roleManager',
  master: 'roleMaster',
} as const

export function ProfileScreen() {
  const auth = useAuth()
  const cabinet = useCabinet()
  const t = useT(profileMessages)
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
  const roleKey = role
    ? roleKeys[role.toLowerCase() as keyof typeof roleKeys]
    : undefined
  const roleLabel = role ? (roleKey ? t(roleKey) : role) : t('roleUnknown')
  const phone = auth.user?.phone ?? null
  return (
    <RedesignShell crumb={t('crumb')}>
      <RedesignTitle lead={t('lead')} title={t('title')} />

      {saveState === 'success' && <Notice tone="ok">{t('nameSaved')}</Notice>}
      {saveState === 'error' && <Notice tone="danger">{t('nameError')}</Notice>}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <Card title={t('personal')}>
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="bg-brand/12 text-brand inline-flex size-14 shrink-0 items-center justify-center rounded-[16px] text-[18px] font-extrabold"
            >
              {initials(normalizedName)}
            </span>
            <div className="min-w-0">
              <p className="text-app-ink truncate text-[17px] font-bold">
                {normalizedName || t('noName')}
              </p>
              <p className="text-app-dim mt-1 text-[13px]">
                {phone ?? t('noPhone')}
              </p>
            </div>
          </div>

          <form
            className="mt-5"
            id={FORM_ID}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('nameLabel')} required>
                <TextInput
                  autoComplete="name"
                  disabled={busy}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder={t('namePlaceholder')}
                  value={name}
                />
              </Field>
              <Field label={t('phoneLabel')}>
                <TextInput
                  disabled
                  readOnly
                  title={t('phoneReadOnly')}
                  value={phone ?? t('phoneMissing')}
                />
              </Field>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="text-app-ink text-[15px] font-bold">
              {t('access')}
            </h3>
            <dl className="mt-3 grid gap-3 text-[13.5px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">{t('role')}</dt>
                <dd className="text-app-ink text-right font-medium">
                  {roleLabel}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">{t('cabinet')}</dt>
                <dd className="text-app-ink text-right font-medium">
                  {cabinet.targetTenant?.name ?? t('cabinetNone')}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-app-line mt-5 grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:items-center">
            <Button
              className="col-span-2 w-full justify-center sm:mr-auto sm:w-auto"
              onClick={() => void auth.signOut()}
            >
              <LogOut aria-hidden />
              {t('signOut')}
            </Button>
            <Button
              className="justify-center"
              disabled={busy || normalizedName === savedName}
              onClick={() => handleNameChange(savedName)}
              type="button"
            >
              {t('cancelChanges')}
            </Button>
            <Button
              className="justify-center px-5 text-sm font-bold"
              disabled={!canSave}
              form={FORM_ID}
              type="submit"
              variant="primary"
            >
              {busy ? t('saving') : t('save')}
            </Button>
          </div>
        </Card>

        <div className="grid min-w-0 content-start gap-5">
          <Card title={t('settings')}>
            <LanguageCard embedded />

            {/* Business settings remain read-only for every member here. */}
            <details className="border-app-line group mt-5 border-t pt-4">
              <summary className="text-app-ink flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                {t('docCardTitle')}
                <span
                  aria-hidden
                  className="text-app-dim transition-transform group-open:rotate-180"
                >
                  ⌄
                </span>
              </summary>
              <div className="pt-2 pb-1">
                <p className="text-app-muted text-[13.5px]">
                  {t('docCardBody')}
                </p>
                {cabinet.targetTenant ? (
                  <div className="mt-3 grid gap-3 text-[13.5px]">
                    <RegionSummary tenant={cabinet.targetTenant} />
                  </div>
                ) : (
                  <dl className="mt-3 flex items-baseline justify-between gap-4 text-[13.5px]">
                    <dt className="text-app-muted">{t('docLang')}</dt>
                    <dd className="text-app-ink text-right font-medium">
                      {t('docLangUnknown')}
                    </dd>
                  </dl>
                )}
              </div>
            </details>
          </Card>

          <AccountDeletion compact key={auth.user?.id} />
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
