import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import {
  novaPoshtaSetupApi,
  type NovaPoshtaConnection,
  type NovaPoshtaRecoveredAccess,
} from '@/api/nova-poshta-setup'
import { normalizeApiProblem } from '@/api/errors'
import { commonMessages, useLocale, useT } from '@/i18n'
import { integrationProblemMessage } from './integration-labels'
import { NpChecks } from './np-checks'
import { npRecoveryMessages } from './np-recovery-messages'
import { isRejectedKey, problemCode } from './np-setup-model'

/** A waybill of the lost cabinet the caller already knows by number. */
export interface NpRecoveryWaybill {
  number: string
  /** `#342 · Відправлено` — the order and the last known status. */
  caption: string
}

export interface NpAccessRecoverySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId: string
  /** The cabinet whose key no longer works (`hasVerifiedAccess: false`). */
  connection: NovaPoshtaConnection
  /** Up to three are listed; the rest are counted from `waybillCount`. */
  waybills?: readonly NpRecoveryWaybill[]
  /** «Налаштування інтеграцій» (`team.manage`); without it only the reason is shown. */
  canRecover: boolean
  /**
   * Core has re-keyed the cabinet. Runs once, on «Застосувати» or on closing
   * after success; the caller refreshes the waybill and shows the toast.
   */
  onRecovered: (result: NovaPoshtaRecoveredAccess, waybillCount: number) => void
  /** Return focus to the control that opened the sheet. */
  onCloseAutoFocus?: (event: Event) => void
}

type Outcome =
  | { kind: 'idle' }
  | { kind: 'ok'; result: NovaPoshtaRecoveredAccess }
  | { kind: 'unconfirmed' }
  | { kind: 'rejected' }
  | { kind: 'carrier' }
  | { kind: 'error'; text: string }

const CARRIER_FAILURES = new Set([
  'nova_poshta_unavailable',
  'nova_poshta_ratelimited',
  'nova_poshta_invalidresponse',
  'nova_poshta_notsubmitted',
  'np_historical_access_unavailable',
  'integration_provider_unavailable',
])

/**
 * «Відновити доступ» (module 46 §3.3–3.10): the key of an earlier carrier
 * cabinet, checked by Core against every waybill and sender of that cabinet.
 * Success is shown only after Core confirmed it; a key of another cabinet,
 * an unconfirmed scope or a carrier failure never pass for one.
 *
 * Shared by the order delivery block and the waybill card.
 */
export function NpAccessRecoverySheet({
  canRecover,
  connection,
  integrationId,
  onCloseAutoFocus,
  onOpenChange,
  onRecovered,
  open,
  waybills = [],
}: NpAccessRecoverySheetProps) {
  const { locale } = useLocale()
  const t = useT(npRecoveryMessages)
  const tc = useT(commonMessages)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const total = connection.waybillCount
  const shown = waybills.slice(0, 3)
  const rest = Math.max(0, total - shown.length)

  // Section 11: the sheet opens on its one required field.
  useEffect(() => {
    if (!open || !canRecover) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [canRecover, open])

  useEffect(() => {
    if (outcome.kind === 'rejected') inputRef.current?.focus()
    if (
      outcome.kind === 'unconfirmed' ||
      outcome.kind === 'carrier' ||
      outcome.kind === 'error'
    )
      alertRef.current?.focus()
  }, [outcome])

  const finish = (result: NovaPoshtaRecoveredAccess) => {
    setOutcome({ kind: 'idle' })
    setKey('')
    onRecovered(result, total)
  }

  const close = (next: boolean) => {
    if (next || busy) {
      onOpenChange(next)
      return
    }
    // Access is already restored on Core's side; closing is applying it.
    if (outcome.kind === 'ok') finish(outcome.result)
    else {
      setOutcome({ kind: 'idle' })
      setKey('')
    }
    onOpenChange(false)
  }

  const check = async () => {
    const value = key.trim()
    if (value === '' || busy) return
    setBusy(true)
    setOutcome({ kind: 'idle' })
    try {
      const result = await novaPoshtaSetupApi.recover(
        integrationId,
        connection.id,
        connection.version,
        value,
      )
      setOutcome({ kind: 'ok', result })
    } catch (problem) {
      const normalized = normalizeApiProblem(problem)
      const code = problemCode(normalized)
      if (code === 'np_historical_scope_unverified')
        setOutcome({ kind: 'unconfirmed' })
      else if (CARRIER_FAILURES.has(code) || normalized.kind === 'network')
        setOutcome({ kind: 'carrier' })
      else if (isRejectedKey(normalized)) setOutcome({ kind: 'rejected' })
      else
        setOutcome({
          kind: 'error',
          text: integrationProblemMessage(normalized, locale),
        })
    } finally {
      setBusy(false)
    }
  }

  const ok = outcome.kind === 'ok'
  const top =
    outcome.kind === 'unconfirmed' ? (
      <Notice role="alert" tone="warn">
        {t('notConfirmed', { count: total })}
      </Notice>
    ) : outcome.kind === 'carrier' ? (
      <Notice tone="danger">{t('npFailed')}</Notice>
    ) : outcome.kind === 'error' ? (
      <Notice tone="danger">{outcome.text}</Notice>
    ) : null

  return (
    <Sheet
      description={t('lead')}
      footer={
        canRecover ? (
          <>
            {ok ? (
              <span className="text-state-ok mr-auto" role="status">
                {t('confirmed')}
              </span>
            ) : null}
            <Button disabled={busy} onClick={() => close(false)} size="lg">
              {tc('cancel')}
            </Button>
            {ok ? (
              <Button
                onClick={() => {
                  finish(outcome.result)
                  onOpenChange(false)
                }}
                size="lg"
                variant="primary"
              >
                {t('apply')}
              </Button>
            ) : (
              <Button
                aria-busy={busy}
                disabled={
                  busy || key.trim() === '' || outcome.kind === 'unconfirmed'
                }
                onClick={() => void check()}
                size="lg"
                variant="primary"
              >
                {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {busy ? t('checking') : t('check')}
              </Button>
            )}
          </>
        ) : (
          <Button onClick={() => close(false)} size="lg">
            {tc('close')}
          </Button>
        )
      }
      {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
      onOpenChange={close}
      open={open}
      title={t('title')}
    >
      {top === null ? null : (
        <div className="outline-none" ref={alertRef} tabIndex={-1}>
          {top}
        </div>
      )}

      {!canRecover ? (
        <Notice block tone="danger">
          <p className="rz-strong m-0 font-semibold">{t('lostTitle')}</p>
          <p className="m-0 mt-1">{t('noRight')}</p>
        </Notice>
      ) : (
        <>
          <section aria-labelledby="np-lost-list" className="grid gap-2">
            <h3 className="rz-h-card" id="np-lost-list">
              {t('listTitle', { count: total })}
            </h3>
            {shown.length === 0 ? null : (
              <ul className="rz-inset m-0 grid list-none gap-0 p-0">
                {shown.map((waybill) => (
                  <li
                    className="border-app-line grid gap-0.5 border-t px-3 py-2 first:border-t-0"
                    key={waybill.number}
                  >
                    <span className="rz-strong font-mono font-semibold">
                      {waybill.number}
                    </span>
                    <span className="rz-caption font-mono">
                      {waybill.caption}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {rest > 0 && shown.length > 0 ? (
              <p className="rz-caption m-0">{t('more', { count: rest })}</p>
            ) : null}
          </section>

          <Notice tone="info">{t('readOnlyNote')}</Notice>

          <Field
            error={outcome.kind === 'rejected' ? t('keyRejected') : undefined}
            label={t('keyLabel')}
            required
          >
            <TextInput
              autoComplete="off"
              className="rz-mono"
              onChange={(event) => {
                setKey(event.target.value)
                if (outcome.kind !== 'idle') setOutcome({ kind: 'idle' })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void check()
                }
              }}
              placeholder={t('keyPlaceholder')}
              readOnly={busy || ok}
              ref={inputRef}
              spellCheck={false}
              value={key}
            />
          </Field>

          {ok || outcome.kind === 'unconfirmed' ? (
            <section
              aria-labelledby="np-recovery-result"
              className="grid gap-2"
            >
              <h3 className="rz-h-card" id="np-recovery-result">
                {t('resultTitle')}
              </h3>
              <div className="rz-inset px-3 py-0">
                <NpChecks
                  items={[
                    { label: t('keyAccepted'), value: t('yes'), state: 'ok' },
                    {
                      label: t('cabinetMatches'),
                      value: t('matchCount', {
                        matched: ok ? total : 0,
                        total,
                      }),
                      state: ok ? 'ok' : 'fail',
                    },
                  ]}
                />
              </div>
            </section>
          ) : null}
        </>
      )}
    </Sheet>
  )
}
