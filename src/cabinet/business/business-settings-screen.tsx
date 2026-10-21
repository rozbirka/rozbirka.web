import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Button,
  Field,
  Notice,
  TextInput,
  useOptionalToast,
} from '@/components/app'
import { businessApi } from '@/api/business'
import { tenantsApi } from '@/api/tenants'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import { useCabinet } from '../CabinetContext'
import {
  RecordColumns,
  RecordHead,
  RecordShell,
} from '../billing/billing-shell'
import { useOptionalAuth } from '@/auth/AuthContext'
import { useT } from '@/i18n/hooks'
import { businessMessages } from './business-messages'
import { RegionSettings } from './region-settings'
import { cabinetModules } from '../module-registry'
import { useHashTarget } from '../use-hash-target'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { AccountingCurrencySection } from './accounting-currency-section'
import { AccountingCurrencySummary } from './accounting-currency-summary'

type SaveState =
  | 'idle'
  | 'pending'
  | 'checking'
  | 'success'
  | 'error'
  | 'not-saved'
  | 'unknown'
  | 'denied'

const FORM_ID = 'business-form'

/** A numbered `.rz-card` section of the settings page. */
function Step({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="rz-card min-w-0">
      <header className="rz-card__head py-2.5">
        <div className="flex min-w-0 items-baseline gap-2">
          {/* The design's numbered group: a mono number in brand text. */}
          <span aria-hidden className="rz-mono text-caption text-brand-text">
            {number}
          </span>
          <h2 className="rz-h-card">{title}</h2>
        </div>
      </header>
      <div className="rz-card__body grid gap-3">{children}</div>
    </section>
  )
}

export function BusinessSettingsScreen() {
  // `#region` / `#accounting-currency` open that section (business-anchors).
  useHashTarget()
  const cabinet = useCabinet()
  const auth = useOptionalAuth()
  const t = useT(businessMessages)
  const tl = useT(lostResponseMessages)
  const toast = useOptionalToast()
  // The auth list holds the tenant as last saved; the cabinet keeps the
  // object it committed at the switch.
  const tenant =
    auth?.tenants.find(
      (candidate) => candidate.id === cabinet.targetTenant?.id,
    ) ?? cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const [name, setName] = useState(tenant?.name ?? '')
  const [city, setCity] = useState(tenant?.city ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const mountedRef = useRef(true)
  const latestCabinetRef = useRef(cabinet)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.business,
  )

  useEffect(() => {
    latestCabinetRef.current = cabinet
  }, [cabinet])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafts reset only at a tenant scope boundary.
    setName(tenant?.name ?? '')
    setCity(tenant?.city ?? '')
    setSaveState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reset is intentionally keyed by the cabinet scope.
  }, [generation, tenant?.id])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  if (!tenant) {
    return <p className="rz-muted m-0 p-5">{t('noTenant')}</p>
  }

  const normalizedName = name.trim()
  const normalizedCity = city.trim()
  const busy = saveState === 'pending' || saveState === 'checking'
  const canSave = !busy && normalizedName.length >= 2
  const changed =
    normalizedName !== tenant.name || normalizedCity !== (tenant.city ?? '')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    let scope: ReturnType<typeof requireLatestMutation>
    try {
      scope = requireLatestMutation({ quota: false })
    } catch {
      setSaveState('denied')
      return
    }

    setSaveState('pending')
    try {
      const updated = await businessApi.update(
        tenant.id,
        {
          name: normalizedName,
          city: normalizedCity || null,
        },
        { signal: scope.signal },
      )
      const latest = latestCabinetRef.current
      const latestSnapshot = latest.snapshot
      if (
        !mountedRef.current ||
        scope.signal.aborted ||
        latestSnapshot?.generation !== scope.generation ||
        latestSnapshot?.tenantId !== scope.tenantId
      ) {
        return
      }
      setName(updated.name)
      setCity(updated.city ?? '')
      setSaveState('success')
      toast?.show({ tone: 'ok', message: t('saved') })
      auth?.mergeTenantSettings?.([updated])
      void Promise.resolve(cabinet.switchTenant(updated.id)).catch(
        () => undefined,
      )
    } catch (error) {
      if (!mountedRef.current || scope.signal.aborted) return
      if (!isLostResponse(error)) {
        setSaveState('error')
        return
      }
      // The PATCH may have landed: read the business back first; saving the
      // same details again is safe.
      setSaveState('checking')
      try {
        const fresh = (await tenantsApi.list({ signal: scope.signal })).find(
          (item) => item.id === tenant.id,
        )
        if (!mountedRef.current || scope.signal.aborted) return
        if (
          fresh?.name === normalizedName &&
          (fresh.city ?? '') === normalizedCity
        ) {
          setSaveState('success')
          toast?.show({ tone: 'ok', message: t('saved') })
          auth?.mergeTenantSettings?.([fresh])
          void Promise.resolve(cabinet.switchTenant(fresh.id)).catch(
            () => undefined,
          )
        } else setSaveState('not-saved')
      } catch {
        if (mountedRef.current && !scope.signal.aborted) setSaveState('unknown')
      }
    }
  }

  const reset = () => {
    setName(tenant.name)
    setCity(tenant.city ?? '')
    setSaveState('idle')
  }

  return (
    <RecordShell
      actions={
        <>
          <Button disabled={busy || !changed} onClick={reset}>
            {t('cancelChanges')}
          </Button>
          <Button
            disabled={!canSave || !changed}
            form={FORM_ID}
            type="submit"
            variant="primary"
          >
            {busy ? t('saving') : t('save')}
          </Button>
        </>
      }
      crumb={t('crumb')}
    >
      <RecordHead title={t('title')} />

      {saveState === 'denied' && <Notice tone="danger">{t('denied')}</Notice>}
      {saveState === 'error' && <Notice tone="danger">{t('error')}</Notice>}
      {saveState === 'checking' && (
        <Notice tone="info">{tl('checking')}</Notice>
      )}
      {saveState === 'not-saved' && (
        <Notice tone="danger">{tl('notSaved')}</Notice>
      )}
      {saveState === 'unknown' && (
        <Notice tone="danger">{tl('checkFailed')}</Notice>
      )}

      <RecordColumns
        aside={
          <>
            <section className="rz-card min-w-0">
              <header className="rz-card__head py-2.5">
                <h2 className="rz-h-card">{t('summary')}</h2>
              </header>
              <div className="rz-card__body grid gap-1">
                <p
                  className={
                    normalizedName.length > 1
                      ? 'rz-h-title m-0'
                      : 'rz-h-title rz-dim m-0'
                  }
                >
                  {normalizedName.length > 1 ? normalizedName : t('nameLabel')}
                </p>
                <p className="rz-muted m-0">
                  {normalizedCity === '' ? t('cityMissing') : normalizedCity}
                </p>
              </div>
              <dl className="rz-facts border-app-line border-t">
                <AccountingCurrencySummary />
              </dl>
              <div className="rz-card__foot grid justify-stretch gap-2">
                <Button
                  disabled={!canSave || !changed}
                  form={FORM_ID}
                  size="wide"
                  type="submit"
                >
                  {busy ? t('saving') : t('save')}
                </Button>
                <p className="rz-caption m-0 text-pretty">
                  {normalizedName.length > 1
                    ? t('summaryHint')
                    : t('nameRequired')}
                </p>
              </div>
            </section>
          </>
        }
        main={
          <>
            <Step number="01" title={t('details')}>
              <form
                className="rz-form-grid"
                id={FORM_ID}
                onSubmit={(event) => void save(event)}
              >
                <Field hint={t('nameHint')} label={t('nameLabel')} required>
                  <TextInput
                    disabled={busy}
                    onChange={(event) => {
                      setName(event.target.value)
                      if (!busy) setSaveState('idle')
                    }}
                    placeholder={t('namePlaceholder')}
                    value={name}
                  />
                </Field>
                <Field label={t('cityLabel')}>
                  <TextInput
                    disabled={busy}
                    onChange={(event) => {
                      setCity(event.target.value)
                      if (!busy) setSaveState('idle')
                    }}
                    placeholder={t('cityPlaceholder')}
                    value={city}
                  />
                </Field>
              </form>
            </Step>

            <RegionSettings
              onSaved={(updated) => {
                auth?.mergeTenantSettings?.([updated])
              }}
              role={cabinet.snapshot?.role}
              tenant={tenant}
            />

            <AccountingCurrencySection />
          </>
        }
      />
    </RecordShell>
  )
}
