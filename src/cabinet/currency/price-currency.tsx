import type { ComponentProps, ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Button, Notice, TextInput } from '@/components/app'
import { useT, type SupportedCurrency } from '@/i18n'
import { cn } from '@/lib/utils'
import type { PriceGate } from './accounting-currency'
import { currencyMessages } from './messages'
import { currencySettingsHref } from './return-path'
import type { PriceCheck } from './use-accounting-currency'

/**
 * A price input with the accounting currency's ISO code as a suffix. The code
 * is decoration (`aria-hidden`); the field hint carries the currency name for
 * assistive tech (see `usePriceHint`). With no currency the suffix is a dash.
 */
export function MoneyInput({
  currency,
  className,
  ...props
}: ComponentProps<typeof TextInput> & {
  /** ISO code, `null` (a dash: no currency yet) or `'none'` (no suffix). */
  currency: string | null
}) {
  return (
    <div className="relative">
      <TextInput
        inputMode="decimal"
        {...props}
        className={cn(currency === 'none' ? '' : 'pr-14', className)}
      />
      {currency === 'none' ? null : (
        <span
          aria-hidden
          className="text-app-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[13px] font-semibold"
        >
          {currency ?? '—'}
        </span>
      )}
    </div>
  )
}

/**
 * Why a price field is disabled when no accounting currency is chosen
 * (board 2b): the owner gets a link to the setting, everyone else is told to
 * ask the owner. Renders nothing when prices can be typed.
 */
export function PriceCurrencyNote({
  gate,
  settingsPath,
  draftKept = false,
  onLeave,
  className,
}: {
  gate: PriceGate
  settingsPath: string | null
  /** The form stores its draft before leaving and restores it on return. */
  draftKept?: boolean
  /** Called right before navigating to the setting (save the draft here). */
  onLeave?: () => void
  className?: string
}) {
  if (gate.kind !== 'blocked') return null
  return (
    <BlockedPriceNote
      className={className}
      draftKept={draftKept}
      onLeave={onLeave}
      reason={gate.reason}
      settingsPath={settingsPath}
    />
  )
}

function BlockedPriceNote({
  reason,
  settingsPath,
  draftKept,
  onLeave,
  className,
}: {
  reason: 'choose' | 'ask-owner'
  settingsPath: string | null
  draftKept: boolean
  onLeave: (() => void) | undefined
  className: string | undefined
}) {
  const t = useT(currencyMessages)
  const location = useLocation()
  return (
    <Notice block className={className ?? ''} tone="warn">
      <p className="font-semibold">{t('needCurrency')}</p>
      {reason === 'choose' && settingsPath !== null ? (
        <>
          <Link
            className="text-brand mt-1.5 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
            onClick={onLeave}
            to={currencySettingsHref(
              settingsPath,
              `${location.pathname}${location.search}`,
            )}
          >
            {t('chooseLink')} →
          </Link>
          {draftKept ? (
            <p className="text-app-muted text-[13px]">{t('draftKept')}</p>
          ) : null}
        </>
      ) : (
        <p className="text-app-muted mt-1 text-[13px]">{t('askOwner')}</p>
      )}
    </Notice>
  )
}

/**
 * What sits next to the save action of a price form: the will-lock warning
 * before the first price (2a), and the pre-save check outcome — currency
 * still missing, check failed, or changed while the form was open (2c).
 */
export function PriceSaveNotes({
  willLock,
  check,
  onAccept,
  onDismiss,
  className,
}: {
  willLock: SupportedCurrency | null
  check: PriceCheck
  /** «Save in EUR»: accept the new currency and save again. */
  onAccept: () => void
  onDismiss: () => void
  className?: string
}) {
  const t = useT(currencyMessages)
  let body: ReactNode = null
  if (check.kind === 'conflict') {
    body = (
      <Notice
        action={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button onClick={onDismiss}>{t('cancel')}</Button>
            <Button onClick={onAccept} variant="primary">
              {t('saveIn', { code: check.to })}
            </Button>
          </div>
        }
        block
        role="alert"
        tone="warn"
      >
        <p className="font-semibold">{t('conflictTitle')}</p>
        <p className="text-app-muted mt-1 text-[13px] text-pretty">
          {t('conflictBody', { from: check.from, to: check.to })}
        </p>
      </Notice>
    )
  } else if (check.kind === 'need-currency') {
    body = <Notice tone="danger">{t('needCurrency')}</Notice>
  } else if (check.kind === 'failed') {
    body = <Notice tone="danger">{t('precheckFailed')}</Notice>
  } else if (willLock !== null) {
    body = (
      <p
        className="text-state-warn text-[13px] leading-5 text-pretty"
        role="status"
      >
        {t('willLock', { code: willLock })}
      </p>
    )
  }
  if (body === null) return null
  return <div className={cn('grid gap-2', className)}>{body}</div>
}
