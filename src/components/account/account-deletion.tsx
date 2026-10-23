import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { credentials } from '@/api/credentials'
import { profileApi } from '@/api/profile'
import { tenantPreference } from '@/api/tenant-preference'
import { Button, Field, Notice, TextInput } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { accountMessages } from './account-messages'

const CONFIRMATION_DELAY_SECONDS = 5

export function AccountDeletion({ compact = false }: { compact?: boolean }) {
  const auth = useAuth()
  const t = useT(accountMessages)
  const tc = useT(commonMessages)
  const confirmationPhrase = t('confirmPhrase')
  const [deleteState, setDeleteState] = useState<
    'idle' | 'confirming' | 'pending' | 'error'
  >('idle')
  const [confirmation, setConfirmation] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(CONFIRMATION_DELAY_SECONDS)
  const titleId = useId()
  const mounted = useRef(true)
  const active = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (deleteState !== 'confirming') return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [deleteState])
  const handleDelete = async () => {
    if (
      deleteState !== 'confirming' ||
      confirmation !== confirmationPhrase ||
      secondsLeft > 0 ||
      active.current
    )
      return
    const owner = credentials.getSessionGeneration()
    active.current = true
    setDeleteState('pending')
    try {
      // Let the confirmed deletion settle even when the screen is left.
      await profileApi.deleteAccount()
      if (owner !== credentials.getSessionGeneration()) return
      tenantPreference.clear()
      credentials.clear()
      await auth.signOut({ silent: true }).catch(() => undefined)
    } catch {
      if (mounted.current && owner === credentials.getSessionGeneration())
        setDeleteState('error')
    } finally {
      active.current = false
    }
  }
  const startButton = (
    <Button
      className={compact ? undefined : 'rz-btn--block mt-3'}
      onClick={() => {
        setConfirmation('')
        setSecondsLeft(CONFIRMATION_DELAY_SECONDS)
        setDeleteState('confirming')
      }}
      variant="danger"
    >
      {t('deleteTitle')}
    </Button>
  )
  const flow = (
    <>
      {(!compact || deleteState !== 'idle') && (
        <p
          className={
            compact
              ? 'text-app-muted m-0 text-pretty'
              : 'text-app-muted mt-2 mb-0 text-pretty'
          }
        >
          {t('deleteBody')}
        </p>
      )}
      {deleteState === 'error' && (
        <div className={compact ? undefined : 'mt-3'}>
          <Notice tone="danger">{t('deleteFailed')}</Notice>
        </div>
      )}
      {deleteState === 'confirming' || deleteState === 'pending' ? (
        <div
          aria-labelledby="delete-account-title"
          aria-live="polite"
          className={cn(
            'rz-inset bg-state-danger-soft grid gap-3',
            !compact && 'mt-3',
          )}
          role="group"
        >
          <p
            className="text-app-strong m-0 font-medium"
            id="delete-account-title"
          >
            {t('confirmPrompt')}
          </p>
          {deleteState === 'pending' ? (
            <p className="text-app-muted m-0" role="status">
              {t('deleting')}
            </p>
          ) : (
            <div className="grid gap-3">
              <Field label={t('typeToConfirm', { phrase: confirmationPhrase })}>
                <TextInput
                  autoComplete="off"
                  onChange={(event) => setConfirmation(event.target.value)}
                  value={confirmation}
                />
              </Field>
              <p className="rz-caption m-0" role="status">
                {secondsLeft > 0
                  ? t('waitSeconds', { seconds: secondsLeft })
                  : t('waitOver')}
              </p>
              <div className="rz-btn-row">
                <Button
                  onClick={() => {
                    setDeleteState('idle')
                    setConfirmation('')
                    setSecondsLeft(CONFIRMATION_DELAY_SECONDS)
                  }}
                >
                  {tc('cancel')}
                </Button>
                <Button
                  disabled={
                    confirmation !== confirmationPhrase || secondsLeft > 0
                  }
                  onClick={() => void handleDelete()}
                  variant="danger"
                >
                  {t('confirmDelete')}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : compact ? null : (
        startButton
      )}
    </>
  )

  if (compact) {
    // In the cabinet the deletion is an aside card, as the module page has
    // it: the title and the way in on the head band, the consequence and the
    // confirmation in the body only once it has been asked for.
    const idle = deleteState === 'idle'
    return (
      <section aria-labelledby={titleId} className="rz-card min-w-0">
        <header className="rz-card__head py-2.5">
          <h2 className="rz-h-card" id={titleId}>
            {t('deleteTitle')}
          </h2>
          {idle ? startButton : null}
        </header>
        {idle ? null : <div className="rz-card__body grid gap-3">{flow}</div>}
      </section>
    )
  }

  return (
    <section
      aria-label={t('deleteTitle')}
      className="rz-card rz-card__body min-w-0"
    >
      <h2 className="rz-h-card">{t('deleteTitle')}</h2>
      {flow}
    </section>
  )
}
