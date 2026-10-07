import { useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Lock } from 'lucide-react'
import { Button, Field, Notice, Skeleton } from '@/components/app'
import { businessApi } from '@/api/business'
import { normalizeApiProblem } from '@/api/errors'
import { tenantSettings, type TenantSettings } from '@/api/tenant-settings'
import { useOptionalAuth } from '@/auth/AuthContext'
import { currencyName, useLocale, useT, type SupportedCurrency } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  accountingCurrencyStatus,
  currencySettingsView,
  isCurrencyLockedError,
  isUnknownOutcome,
} from '../currency/accounting-currency'
import { CurrencyCombobox } from '../currency/currency-combobox'
import { currencyMessages } from '../currency/messages'
import { currencyReturnPath } from '../currency/return-path'
import { useAccountingCurrency } from '../currency/use-accounting-currency'

type LoadState = 'loading' | 'ready' | 'error'
type SaveState =
  | 'idle'
  | 'pending'
  | 'checking'
  | 'check-failed'
  | 'refused'
  | 'locked-meanwhile'
  | 'denied'
  | 'saved'

/**
 * «Валюта обліку» (ROZ-162 board 1a–1g). The block re-reads the tenant before
 * showing anything, so a lock set by a first price elsewhere is never hidden
 * behind a stale «Змінити»; until the read answers no currency is guessed.
 */
export function AccountingCurrencySection() {
  const t = useT(currencyMessages)
  const { locale } = useLocale()
  const titleId = useId()
  const cabinet = useCabinet()
  const auth = useOptionalAuth()
  const { owner, refresh } = useAccountingCurrency()
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.business,
  )
  const [searchParams] = useSearchParams()
  const tenant = cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<LoadState>('loading')
  const [fresh, setFresh] = useState<TenantSettings | null>(null)
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<SupportedCurrency | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const changeRef = useRef<HTMLButtonElement | null>(null)
  const focusChange = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- every (re)read starts from «unknown».
    setLoad('loading')
    refresh(controller.signal).then(
      (settings) => {
        if (controller.signal.aborted) return
        setFresh(settings)
        setLoad('ready')
      },
      () => {
        if (!controller.signal.aborted) setLoad('error')
      },
    )
    return () => controller.abort()
  }, [attempt, generation, refresh])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
    else if (focusChange.current) {
      focusChange.current = false
      changeRef.current?.focus()
    }
  }, [editing])

  if (!tenant) return null

  const status = fresh === null ? null : accountingCurrencyStatus(fresh)
  const view = status === null ? 'unknown' : currencySettingsView(status, owner)
  const current = fresh?.accountingCurrency ?? null
  const busy = save === 'pending' || save === 'checking'
  const returnPath =
    save === 'saved'
      ? currencyReturnPath(searchParams, `/app/${tenant.slug}`)
      : null

  const accept = (settings: TenantSettings) => {
    setFresh(settings)
    setEditing(false)
    setPicked(null)
    setSave('saved')
  }

  const verify = async (target: SupportedCurrency) => {
    setSave('checking')
    try {
      const settings = await refresh()
      if (settings.accountingCurrency === target) {
        accept(settings)
        return
      }
      setFresh(settings)
      if (settings.currencyLocked === true) {
        setEditing(false)
        setSave('locked-meanwhile')
      } else setSave('refused')
    } catch {
      setSave('check-failed')
    }
  }

  const submit = async () => {
    if (busy || picked === null || picked === current) return
    let scope: ReturnType<typeof requireLatestMutation>
    try {
      scope = requireLatestMutation({ quota: false })
    } catch {
      setSave('denied')
      return
    }
    const target = picked
    setSave('pending')
    try {
      const updated = await businessApi.update(
        tenant.id,
        { accountingCurrency: target },
        { signal: scope.signal },
      )
      if (scope.signal.aborted) return
      auth?.mergeTenantSettings?.([updated])
      const settings = tenantSettings(updated)
      if (settings.accountingCurrency === target) accept(settings)
      // A reply without the field: the server's contract is older than this
      // block, so what was stored is unknown — read it back.
      else await verify(target)
    } catch (error: unknown) {
      if (scope.signal.aborted) return
      if (isUnknownOutcome(error)) {
        await verify(target)
        return
      }
      if (isCurrencyLockedError(error)) {
        await verify(target)
        return
      }
      setSave(
        normalizeApiProblem(error).kind === 'forbidden' ? 'denied' : 'refused',
      )
    }
  }

  const value = (code: SupportedCurrency | null) =>
    code === null ? (
      <p className="text-app-muted text-[15px]">{t('notSet')}</p>
    ) : (
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-app-ink font-mono text-[15px] font-bold">
          {code}
        </span>
        <span className="text-app-ink text-[15px]">
          {currencyName(code, locale)}
        </span>
      </p>
    )

  const feedback = (() => {
    switch (save) {
      case 'saved':
        return (
          <Notice
            action={
              returnPath === null ? undefined : (
                <Link
                  className="text-brand font-semibold underline-offset-4 hover:underline"
                  to={returnPath}
                >
                  {t('backToForm')} →
                </Link>
              )
            }
            tone="ok"
          >
            {t('saved')}
          </Notice>
        )
      case 'refused':
        return <Notice tone="danger">{t('refused')}</Notice>
      case 'locked-meanwhile':
        return <Notice tone="warn">{t('lockedMeanwhile')}</Notice>
      case 'denied':
        return <Notice tone="danger">{t('denied')}</Notice>
      case 'checking':
        return <Notice tone="info">{t('checking')}</Notice>
      case 'check-failed':
        return (
          <Notice
            action={
              picked === null ? undefined : (
                <Button onClick={() => void verify(picked)}>
                  {t('checkAgain')}
                </Button>
              )
            }
            tone="danger"
          >
            {t('checkFailed')}
          </Notice>
        )
      default:
        return null
    }
  })()

  const picker = (
    <form
      className="grid gap-3.5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Field label={t('field')}>
        <CurrencyCombobox
          autoOpen={editing}
          disabled={busy}
          inputRef={inputRef}
          onChange={(code) => {
            setPicked(code)
            if (!busy) setSave('idle')
          }}
          value={picked ?? current}
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-2.5">
        {editing ? (
          <Button
            disabled={busy}
            onClick={() => {
              focusChange.current = true
              setEditing(false)
              setPicked(null)
              setSave('idle')
            }}
          >
            {t('cancel')}
          </Button>
        ) : null}
        <Button
          aria-busy={busy}
          disabled={busy || picked === null || picked === current}
          type="submit"
          variant="primary"
        >
          {save === 'pending' ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  )

  let body
  if (load === 'loading') {
    body = (
      <div aria-busy className="grid gap-2" role="status">
        <span className="sr-only">{t('loading')}</span>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  } else if (load === 'error' || view === 'unknown') {
    body = (
      <Notice
        action={
          <Button onClick={() => setAttempt((count) => count + 1)}>
            {t('retry')}
          </Button>
        }
        tone="danger"
      >
        {t('loadError')}
      </Notice>
    )
  } else if (view === 'locked') {
    body = (
      <>
        <div className="flex flex-wrap items-center gap-3">
          {value(current)}
          <span className="border-app-line-2 text-app-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold">
            <Lock aria-hidden className="size-3" />
            {t('badge')}
          </span>
        </div>
        <p className="text-app-muted text-[13px] leading-5 text-pretty">
          {t('lockedHint')}
        </p>
      </>
    )
  } else if (view === 'read-only') {
    body = (
      <>
        {value(current)}
        <p className="text-app-muted text-[13px] leading-5 text-pretty">
          {t('noRights')}
        </p>
      </>
    )
  } else if (view === 'choose' || editing) {
    body = (
      <>
        <p className="text-app-muted text-[13px] leading-5 text-pretty">
          {t('hint')}
        </p>
        {picker}
      </>
    )
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {value(current)}
          <Button
            onClick={() => {
              setPicked(null)
              setSave('idle')
              setEditing(true)
            }}
            ref={changeRef}
          >
            {t('change')}
          </Button>
        </div>
        <p className="text-state-warn text-[13px] leading-5 text-pretty">
          {t('hint')}
        </p>
      </>
    )
  }

  return (
    <section
      aria-labelledby={titleId}
      className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-5"
    >
      <h2 className="text-app-ink text-[15px] font-bold" id={titleId}>
        {t('title')}
      </h2>
      <div className="mt-4 grid gap-3.5">
        {feedback}
        {body}
      </div>
    </section>
  )
}
