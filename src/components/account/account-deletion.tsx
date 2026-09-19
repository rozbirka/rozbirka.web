import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { credentials } from '@/api/credentials'
import { profileApi } from '@/api/profile'
import { tenantPreference } from '@/api/tenant-preference'
import { Button, Notice } from '@/components/app'

export function AccountDeletion() {
  const auth = useAuth()
  const [deleteState, setDeleteState] = useState<
    'idle' | 'confirming' | 'pending' | 'error'
  >('idle')
  const mounted = useRef(true)
  const active = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const handleDelete = async () => {
    if (deleteState !== 'confirming' || active.current) return
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
  return (
    <section className="border-state-danger/30 bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
      <h2 className="text-app-ink text-[15px] font-bold">Видалити акаунт</h2>
      <p className="text-app-muted mt-2.5 text-[13px] leading-5 text-pretty">
        Цю дію неможливо скасувати. Будуть видалені ваші ім’я, телефон, сеанси
        та членства в розбірках. Спільні записи, документи й фото компанії
        залишаться. Видалення акаунта не скасовує підписки компанії або магазину
        застосунків.
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
              Видалення акаунта… Дочекайтеся підтвердження.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDeleteState('idle')}>Скасувати</Button>
              <Button onClick={() => void handleDelete()} variant="danger">
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
  )
}
