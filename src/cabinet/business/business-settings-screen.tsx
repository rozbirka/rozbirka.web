import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import {
  Button,
  Field,
  Notice,
  StatusPill,
  TextInput,
  useOptionalToast,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { Switch } from '../integrations/dispatch-point-form'
import { businessApi } from '@/api/business'
import { tenantsApi } from '@/api/tenants'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import { inventoryApi, type Warehouse } from '@/api/inventory'
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

const LEGAL_FORMS = ['legalSole', 'legalLlc', 'legalNone'] as const
const COSTING = [
  { label: 'costWeight', hint: 'costWeightHint' },
  { label: 'costManual', hint: 'costManualHint' },
] as const
const RULES = [
  { label: 'ruleMinStock', hint: 'ruleMinStockHint' },
  { label: 'ruleVin', hint: 'ruleVinHint' },
  { label: 'ruleNegative', hint: 'ruleNegativeHint' },
] as const

/** A numbered `.rz-card` section of the settings page. */
function Step({
  number,
  title,
  action,
  footer,
  bodyClassName,
  children,
}: {
  number: string
  title: string
  action?: ReactNode
  footer?: ReactNode
  bodyClassName?: string
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
        {action}
      </header>
      <div className={cn('rz-card__body grid gap-3', bodyClassName)}>
        {children}
      </div>
      {footer === undefined ? null : (
        <div className="rz-card__foot">{footer}</div>
      )}
    </section>
  )
}

/** A control the design asks for and the API cannot back: shown, not faked. */
function Dead({ children, title }: { children: ReactNode; title: string }) {
  return (
    <button className="rz-btn" disabled title={title} type="button">
      {children}
    </button>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rz-caption m-0 text-pretty">{children}</p>
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
  const warehousesPath = `/app/${tenant?.slug ?? ''}/warehouses`
  const generation = cabinet.snapshot?.generation
  const [name, setName] = useState(tenant?.name ?? '')
  const [city, setCity] = useState(tenant?.city ?? '')
  const [deposit, setDeposit] = useState(tenant?.requireDeliveryDeposit ?? true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null)
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
    setDeposit(tenant?.requireDeliveryDeposit ?? true)
    setSaveState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reset is intentionally keyed by the cabinet scope.
  }, [generation, tenant?.id])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void inventoryApi
      .getWarehouses({ signal: controller.signal })
      .then((list) => {
        if (!controller.signal.aborted) setWarehouses(list)
      })
      .catch(() => {
        // The warehouse list is read-only context here; the settings form
        // still works without it, so a failure stays quiet.
        if (!controller.signal.aborted) setWarehouses([])
      })
    return () => controller.abort()
  }, [generation, tenant?.id])

  if (!tenant) {
    return <p className="rz-muted m-0 p-5">{t('noTenant')}</p>
  }

  const normalizedName = name.trim()
  const normalizedCity = city.trim()
  const busy = saveState === 'pending' || saveState === 'checking'
  const canSave = !busy && normalizedName.length >= 2
  const changed =
    normalizedName !== tenant.name ||
    normalizedCity !== (tenant.city ?? '') ||
    deposit !== tenant.requireDeliveryDeposit

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
          requireDeliveryDeposit: deposit,
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
      setDeposit(updated.requireDeliveryDeposit)
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
          (fresh.city ?? '') === normalizedCity &&
          fresh.requireDeliveryDeposit === deposit
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
    setDeposit(tenant.requireDeliveryDeposit)
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
                <div>
                  <dt>{t('warehouseCount')}</dt>
                  <dd className="rz-mono">
                    {warehouses === null ? '…' : warehouses.length}
                  </dd>
                </div>
                <AccountingCurrencySummary />
                <div>
                  <dt>{t('costSummary')}</dt>
                  <dd className="rz-dim" title={t('noCosting')}>
                    —
                  </dd>
                </div>
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

            <section className="rz-card min-w-0">
              <header className="rz-card__head py-2.5">
                <h2 className="rz-h-card">{t('dataTitle')}</h2>
              </header>
              <div className="rz-card__body grid gap-3">
                <p className="rz-muted m-0 text-pretty">{t('dataBody')}</p>
                <div className="rz-btn-row">
                  <Dead title={t('noExport')}>{t('exportAll')}</Dead>
                  <Dead title={t('noTenantDelete')}>{t('deleteCabinet')}</Dead>
                </div>
              </div>
              <div className="rz-card__foot">
                <Note>
                  {t('noExport')} {t('noTenantDelete')}
                </Note>
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
              <div className="rz-form-grid">
                <div className="rz-field">
                  <p className="rz-label m-0">{t('legalForm')}</p>
                  <div className="rz-seg flex-wrap self-start">
                    {LEGAL_FORMS.map((key) => (
                      <button
                        disabled
                        key={key}
                        title={t('noLegalForm')}
                        type="button"
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label={t('taxId')}>
                  <TextInput
                    disabled
                    placeholder={t('notStored')}
                    title={t('noTaxId')}
                    value=""
                  />
                </Field>
                <Field label={t('phone')}>
                  <TextInput
                    disabled
                    placeholder={t('notStored')}
                    title={t('noPhone')}
                    value=""
                  />
                </Field>
                <Field label={t('address')}>
                  <TextInput
                    disabled
                    placeholder={t('onlyCity')}
                    title={t('noAddress')}
                    value=""
                  />
                </Field>
              </div>
              <Note>
                {t('noLegalForm')} {t('noAddress')}
              </Note>
            </Step>

            <RegionSettings
              onSaved={(updated) => {
                auth?.mergeTenantSettings?.([updated])
              }}
              role={cabinet.snapshot?.role}
              tenant={tenant}
            />

            <AccountingCurrencySection />

            <Step
              action={
                <Button asChild size="sm">
                  <Link to={warehousesPath}>
                    <Plus aria-hidden />
                    {t('addWarehouse')}
                  </Link>
                </Button>
              }
              bodyClassName="p-0"
              footer={
                <Note>
                  {t('warehousesNote')} {t('noWarehouseParts')}
                </Note>
              }
              number="04"
              title={t('warehouses')}
            >
              {warehouses === null ? (
                <div className="rz-card__body">
                  <Note>{t('warehousesLoading')}</Note>
                </div>
              ) : warehouses.length === 0 ? (
                <div className="rz-card__body">
                  <Note>{t('warehousesEmpty')}</Note>
                </div>
              ) : (
                <ul className="m-0 grid list-none p-0">
                  {warehouses.map((warehouse) => (
                    <li
                      className="border-app-line flex min-h-row flex-wrap items-center gap-x-4 gap-y-2 border-t px-[var(--rz-card-p)] py-2 first:border-t-0"
                      key={warehouse.id}
                    >
                      <div className="grid min-w-0 flex-[1_1_200px] gap-0.5">
                        <p className="m-0 flex flex-wrap items-center gap-2">
                          <span className="rz-strong font-medium">
                            {warehouse.name}
                          </span>
                          {warehouse.isSystemDefault && (
                            <StatusPill>{t('warehouseMain')}</StatusPill>
                          )}
                          {!warehouse.isActive && (
                            <StatusPill>{t('warehouseArchived')}</StatusPill>
                          )}
                        </p>
                        <p className="rz-caption m-0">
                          <span className="rz-mono">{warehouse.code}</span> ·{' '}
                          {t('zones', { count: warehouse.zoneCount })}
                        </p>
                      </div>
                      <span
                        className="rz-dim ml-auto"
                        title={t('noWarehouseParts')}
                      >
                        {t('partsNotCounted')}
                      </span>
                      <Button asChild size="sm">
                        <Link to={warehousesPath}>{t('change')}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Step>

            <Step number="05" title={t('accounting')}>
              <div className="rz-field">
                <p className="rz-label m-0">{t('partCost')}</p>
                <div className="flex flex-wrap gap-2">
                  {COSTING.map((option) => (
                    <button
                      className="rz-choice-card min-w-0 flex-[1_1_200px] cursor-not-allowed flex-col gap-0.5 bg-transparent text-left opacity-50"
                      disabled
                      key={option.label}
                      title={t('noCosting')}
                      type="button"
                    >
                      <span className="rz-strong font-medium">
                        {t(option.label)}
                      </span>
                      <span className="rz-caption">{t(option.hint)}</span>
                    </button>
                  ))}
                </div>
                <Note>{t('noCosting')}</Note>
              </div>
              {/* The one rule in this step the service actually keeps. It sits
                  above the rest so a real control is not mistaken for the dead
                  ones below it. */}
              <div className="rz-inset flex items-start gap-3">
                <Switch
                  checked={deposit}
                  disabled={busy}
                  label={t('deposit')}
                  onChange={setDeposit}
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="rz-strong font-medium">{t('deposit')}</span>
                  <span className="rz-caption rz-muted text-pretty">
                    {deposit ? t('depositOn') : t('depositOff')}
                  </span>
                </span>
              </div>
              <ul className="border-app-line rounded-control m-0 grid list-none border p-0">
                {RULES.map((rule) => (
                  <li
                    className="border-app-line flex items-start gap-3 border-t px-3 py-2.5 first:border-t-0"
                    key={rule.label}
                    title={t('noRules')}
                  >
                    <span
                      aria-hidden
                      className="rz-switch mt-0.5 inline-block shrink-0 cursor-not-allowed opacity-40"
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="rz-dim font-medium">
                        {t(rule.label)}
                      </span>
                      <span className="rz-caption">{t(rule.hint)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Note>{t('noRules')}</Note>
            </Step>
          </>
        }
      />
    </RecordShell>
  )
}
