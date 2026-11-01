import { useRef, useState } from 'react'
import type { CustomerDetail } from '@/api/customers'
import {
  Button,
  Card,
  DateValue,
  Field,
  Notice,
  Sheet,
  StatusPill,
  TextArea,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { deliveryTrustMessages } from './delivery-trust-messages'

export function CustomerDeliveryTrust({
  customer,
  canManage,
  onSave,
}: {
  customer: CustomerDetail
  canManage: boolean
  onSave: (isTrusted: boolean, reason: string) => Promise<void>
}) {
  const t = useT(deliveryTrustMessages)
  const tc = useT(commonMessages)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)
  const supported = typeof customer.isTrustedForDelivery === 'boolean'
  const trusted = customer.isTrustedForDelivery === true
  const allowed = canManage && customer.isActive && supported

  const save = async () => {
    if (!allowed || busy || reason.trim() === '') return
    setBusy(true)
    setFailed(false)
    try {
      await onSave(!trusted, reason.trim())
      setOpen(false)
    } catch {
      setFailed(true)
      window.requestAnimationFrame(() => alertRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card title={t('title')}>
        <div className="grid gap-3">
          <StatusPill tone={trusted ? 'ok' : 'neutral'}>
            {t(trusted ? 'trusted' : 'ordinary')}
          </StatusPill>
          <p className="rz-caption m-0">
            {t(supported ? 'hint' : 'unavailable')}
          </p>
          {customer.deliveryTrustReason ? (
            <p className="rz-caption m-0 break-words">
              {t('reason')}: {customer.deliveryTrustReason}
            </p>
          ) : null}
          {customer.deliveryTrustUpdatedAt ? (
            <p className="rz-caption m-0">
              {t('updated')}:{' '}
              <DateValue value={customer.deliveryTrustUpdatedAt} />
            </p>
          ) : null}
          {allowed ? (
            <div>
              <Button
                onClick={() => {
                  setReason('')
                  setFailed(false)
                  setOpen(true)
                }}
              >
                {t(trusted ? 'revoke' : 'grant')}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
      {open ? (
        <Sheet
          open
          onOpenChange={(value) => {
            if (!busy) setOpen(value)
          }}
          pending={busy}
          title={t(trusted ? 'revoke' : 'grant')}
          description={customer.name}
          footer={
            <>
              <Button disabled={busy} onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button
                aria-busy={busy}
                disabled={busy || !allowed || reason.trim() === ''}
                onClick={() => void save()}
                variant="primary"
              >
                {t('save')}
              </Button>
            </>
          }
        >
          {failed ? (
            <div ref={alertRef} tabIndex={-1}>
              <Notice tone="danger">{t('error')}</Notice>
            </div>
          ) : null}
          <Field label={t('reason')} hint={t('reasonHint')} required>
            <TextArea
              autoFocus
              maxLength={500}
              value={reason}
              readOnly={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </Sheet>
      ) : null}
    </>
  )
}
