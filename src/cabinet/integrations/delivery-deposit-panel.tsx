import { useEffect, useRef, useState } from 'react'
import { businessApi } from '@/api/business'
import { tenantsApi } from '@/api/tenants'
import type { Tenant } from '@/api/types'
import { useOptionalAuth } from '@/auth/AuthContext'
import { Button, Card, Notice, useOptionalToast } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { Switch } from './dispatch-point-form'
import { deliveryDepositMessages } from './delivery-deposit-messages'

type SaveState =
  | 'idle'
  | 'pending'
  | 'checking'
  | 'error'
  | 'denied'
  | 'not-saved'
  | 'unknown'

/** The control lives with Nova Poshta, but the policy still belongs to the business. */
export function DeliveryDepositPanel() {
  const cabinet = useCabinet()
  const auth = useOptionalAuth()
  const tenant =
    auth?.tenants.find((item) => item.id === cabinet.targetTenant?.id) ??
    cabinet.targetTenant
  const t = useT(deliveryDepositMessages)
  const tc = useT(commonMessages)
  const tl = useT(lostResponseMessages)
  const toast = useOptionalToast()
  const [saved, setSaved] = useState(tenant?.requireDeliveryDeposit ?? true)
  const [deposit, setDeposit] = useState(saved)
  const [state, setState] = useState<SaveState>('idle')
  const mounted = useRef(true)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.business,
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  if (!tenant) return null
  const owner = cabinet.snapshot?.role?.toLowerCase() === 'owner'
  const busy = state === 'pending' || state === 'checking'
  const changed = deposit !== saved

  const save = async () => {
    if (busy || !changed) return
    let scope: ReturnType<typeof requireLatestMutation>
    try {
      scope = requireLatestMutation({ quota: false })
      // The tenant endpoint is owner-only, even for a manager with team.manage.
      if (cabinet.snapshot?.role?.toLowerCase() !== 'owner')
        throw new Error('owner required')
    } catch {
      setState('denied')
      return
    }
    const current = () => mounted.current && !scope.signal.aborted
    const applied = (updated: Tenant) => {
      if (!current()) return
      setSaved(updated.requireDeliveryDeposit)
      setDeposit(updated.requireDeliveryDeposit)
      setState('idle')
      auth?.mergeTenantSettings?.([updated])
      toast?.show({ tone: 'ok', message: t('saved') })
      void Promise.resolve(cabinet.switchTenant(updated.id)).catch(
        () => undefined,
      )
    }
    setState('pending')
    try {
      applied(
        await businessApi.update(
          tenant.id,
          { requireDeliveryDeposit: deposit },
          { signal: scope.signal },
        ),
      )
    } catch (error) {
      if (!current()) return
      if (!isLostResponse(error)) {
        setState('error')
        return
      }
      setState('checking')
      try {
        const fresh = (await tenantsApi.list({ signal: scope.signal })).find(
          (item) => item.id === tenant.id,
        )
        if (!current()) return
        if (fresh?.requireDeliveryDeposit === deposit) applied(fresh)
        else setState('not-saved')
      } catch {
        if (current()) setState('unknown')
      }
    }
  }

  return (
    <Card title={t('title')}>
      <div className="grid gap-3">
        {state === 'checking' && <Notice tone="info">{tl('checking')}</Notice>}
        {state === 'error' && <Notice tone="danger">{t('error')}</Notice>}
        {state === 'denied' && <Notice tone="danger">{t('denied')}</Notice>}
        {state === 'not-saved' && (
          <Notice tone="danger">{tl('notSaved')}</Notice>
        )}
        {state === 'unknown' && (
          <Notice tone="danger">{tl('checkFailed')}</Notice>
        )}
        <div className="rz-inset flex items-start gap-3">
          <Switch
            checked={deposit}
            disabled={busy || !owner}
            label={t('label')}
            onChange={(next) => {
              setDeposit(next)
              setState('idle')
            }}
          />
          <span className="grid min-w-0 gap-0.5">
            <span className="rz-strong font-medium">{t('label')}</span>
            <span className="rz-caption text-pretty">
              {deposit ? t('on') : t('off')}
            </span>
          </span>
        </div>
        {!owner && <p className="rz-caption m-0">{t('ownerOnly')}</p>}
        {owner && (
          <div className="rz-btn-row justify-end">
            <Button
              disabled={busy || !changed}
              onClick={() => {
                setDeposit(saved)
                setState('idle')
              }}
            >
              {tc('cancel')}
            </Button>
            <Button
              aria-busy={busy}
              disabled={busy || !changed}
              onClick={() => void save()}
              variant="primary"
            >
              {busy ? tc('saving') : tc('save')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
