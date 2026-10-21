import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { Button, Card, Field, Notice, TextInput } from '@/components/app'
import { useAuth } from '@/auth/AuthContext'
import { AccountDeletion } from '@/components/account/account-deletion'
import { useT } from '@/i18n/hooks'
import { useCabinet } from '../CabinetContext'
import {
  RecordColumns,
  RecordHead,
  RecordShell,
} from '../billing/billing-shell'
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
  const personalId = useId()
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
    <RecordShell crumb={t('crumb')}>
      <RecordHead title={t('title')} />

      {saveState === 'success' && <Notice tone="ok">{t('nameSaved')}</Notice>}
      {saveState === 'error' && <Notice tone="danger">{t('nameError')}</Notice>}

      <RecordColumns
        aside={
          <>
            <Card bodyClassName="grid gap-0 pb-0" title={t('settings')}>
              <LanguageCard embedded />

              {/* Business settings remain read-only for every member here. */}
              <details className="border-app-line group -mx-[var(--rz-card-p)] mt-4 border-t px-[var(--rz-card-p)]">
                <summary className="rz-strong flex min-h-control-lg cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                  {t('docCardTitle')}
                  <ChevronDown
                    aria-hidden
                    className="text-app-dim size-4 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="grid gap-3 pb-4">
                  <p className="rz-muted m-0">{t('docCardBody')}</p>
                  {cabinet.targetTenant ? (
                    <RegionSummary tenant={cabinet.targetTenant} />
                  ) : (
                    <dl className="rz-facts px-0 py-0">
                      <div>
                        <dt>{t('docLang')}</dt>
                        <dd>{t('docLangUnknown')}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </details>
            </Card>

            <AccountDeletion compact key={auth.user?.id} />
          </>
        }
        main={
          <section aria-labelledby={personalId} className="rz-card min-w-0">
            <header className="rz-card__head py-2.5">
              <h2 className="rz-h-card" id={personalId}>
                {t('personal')}
              </h2>
            </header>
            <div className="rz-card__body grid gap-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="rz-avatar rz-avatar--round size-10 text-body"
                >
                  {initials(normalizedName)}
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <p className="rz-h-title m-0 truncate">
                    {normalizedName || t('noName')}
                  </p>
                  <p className="rz-dim rz-mono m-0">{phone ?? t('noPhone')}</p>
                </div>
              </div>

              <form
                className="rz-form-grid"
                id={FORM_ID}
                onSubmit={(event) => void handleSubmit(event)}
              >
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
              </form>

              <div className="grid gap-1">
                <h3 className="rz-h-card">{t('access')}</h3>
                <dl className="rz-facts px-0 py-0">
                  <div>
                    <dt>{t('role')}</dt>
                    <dd>{roleLabel}</dd>
                  </div>
                  <div>
                    <dt>{t('cabinet')}</dt>
                    <dd>{cabinet.targetTenant?.name ?? t('cabinetNone')}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="rz-card__foot flex-wrap items-center justify-end gap-2">
              <Button className="mr-auto" onClick={() => void auth.signOut()}>
                <LogOut aria-hidden />
                {t('signOut')}
              </Button>
              <Button
                disabled={busy || normalizedName === savedName}
                onClick={() => handleNameChange(savedName)}
                type="button"
              >
                {t('cancelChanges')}
              </Button>
              <Button
                disabled={!canSave}
                form={FORM_ID}
                type="submit"
                variant="primary"
              >
                {busy ? t('saving') : t('save')}
              </Button>
            </div>
          </section>
        }
      />
    </RecordShell>
  )
}
