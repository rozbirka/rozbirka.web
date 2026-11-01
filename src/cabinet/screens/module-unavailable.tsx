import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Check, Lock, Minus, PackageOpen } from 'lucide-react'
import { Amount, Button, StateScreen, StatusPill } from '@/components/app'
import { billingApi } from '@/api/billing'
import type { BillingState, PublicPlanDto } from '@/api/types'
import { useFormat, useLocale, useT, type MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'
import { accessMessages } from '../access-messages'
import { evaluateModuleAccess } from '../policy'
import { featureLabel } from '../billing/billing-vocabulary'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import { moduleLabel } from '../module-messages'
import {
  cabinetModules,
  type CabinetModuleDefinition,
  type CabinetModuleKey,
} from '../module-registry'

/** The support address the cabinet already hands out for billing questions. */
const SUPPORT_MAIL = 'support@rozbirka.app'

export function ModuleUnavailableScreen({
  definition,
}: {
  definition: CabinetModuleDefinition
}) {
  const { targetTenant } = useCabinet()
  const { locale } = useLocale()
  const t = useT(accessMessages)

  return (
    <div className="rz-page">
      <StateScreen
        actions={
          targetTenant === null ? undefined : (
            <Button asChild variant="primary">
              <Link to={cabinetPath(targetTenant.slug, 'dashboard')}>
                {t('toDashboard')}
              </Link>
            </Button>
          )
        }
        className="min-h-[50dvh]"
        description={t('unavailableBody', {
          module: moduleLabel(definition.key, locale),
        })}
        icon={<PackageOpen aria-hidden />}
        title={t('unavailableTitle')}
        tone="neutral"
      />
    </div>
  )
}

/**
 * The paywall. What the module gives is read from the registry, and which plan
 * unlocks it — from the public catalogue: the cheapest plan whose feature list
 * carries this module's `requiredFeature`. Nothing about price or savings is
 * invented; where the catalogue is silent, the screen says so.
 */
export function FeatureUnavailableScreen({
  definition,
}: {
  definition: CabinetModuleDefinition
}) {
  const { targetTenant, snapshot } = useCabinet()
  const { locale } = useLocale()
  const t = useT(accessMessages)
  const [plans, setPlans] = useState<PublicPlanDto[] | null>(null)
  const required = definition.requiredFeature

  useEffect(() => {
    const controller = new AbortController()
    void billingApi
      .getPlans({ signal: controller.signal })
      .then((loaded) => {
        if (!controller.signal.aborted) setPlans(loaded)
      })
      .catch(() => {
        // Without the catalogue the screen still says what is locked and where
        // to look; it just cannot name the plan that unlocks it.
        if (!controller.signal.aborted) setPlans([])
      })
    return () => controller.abort()
  }, [])

  const currentPlan = snapshot?.subscription?.planName ?? null
  const unlocking =
    required === undefined || plans === null
      ? null
      : (plans
          .filter((plan) => plan.features.includes(required))
          .sort((a, b) => a.amount - b.amount)[0] ?? null)
  const label = moduleLabel(definition.key, locale)

  return (
    <div className="rz-page">
      <section className="rz-card rz-state">
        <StatusPill>
          <Lock aria-hidden className="size-3" />
          {currentPlan === null
            ? t('notInCurrentPlan')
            : t('notInPlan', { plan: currentPlan })}
        </StatusPill>
        <h1 className="rz-state__title">
          {unlocking === null
            ? t('notIncludedTitle', { module: label })
            : t('includedInTitle', { module: label, plan: unlocking.name })}
        </h1>
        <p className="rz-state__body text-pretty">{t('planLockedBody')}</p>
        {targetTenant === null ? null : (
          <div className="rz-btn-row mt-1.5 justify-center">
            <Button asChild>
              <Link to={cabinetPath(targetTenant.slug, 'plans')}>
                {t('comparePlans')}
              </Link>
            </Button>
            {unlocking !== null && (
              <Button asChild variant="primary">
                <Link
                  to={`${cabinetPath(targetTenant.slug, 'plans')}?plan=${encodeURIComponent(unlocking.code)}`}
                >
                  {t('switchToPlan', { plan: unlocking.name })}
                </Link>
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rz-card">
        <header className="rz-card__head">
          <h2 className="rz-h-card">
            {unlocking === null ? t('planWithModule') : t('planRequired')}
          </h2>
        </header>
        <div className="rz-card__body grid gap-3">
          {unlocking === null ? (
            <p className="rz-muted m-0 max-w-[52ch] text-pretty">
              {plans === null ? t('findingPlan') : t('noPlanInCatalogue')}
            </p>
          ) : (
            <>
              <p className="m-0 flex flex-wrap items-baseline gap-x-2.5">
                <span className="rz-h-title">{unlocking.name}</span>
                <Amount
                  className="text-app-muted"
                  currency={unlocking.currency}
                  value={unlocking.amount}
                />
              </p>
              <p className="rz-caption m-0 max-w-[52ch] text-pretty">
                {currentPlan === null
                  ? ''
                  : `${t('currentPlan', { plan: currentPlan })} `}
                {t('noProration')}
              </p>
              <ul className="border-app-line m-0 grid list-none gap-2 border-t p-0 pt-3">
                {unlocking.features.map((code) => (
                  <li
                    className="text-app-muted flex items-start gap-2.5"
                    key={code}
                  >
                    <Check
                      aria-hidden
                      className="text-state-ok mt-0.5 size-4 shrink-0"
                    />
                    {code === required ? (
                      <span className="text-app-ink font-medium">
                        {featureLabel(code, locale)}
                      </span>
                    ) : (
                      featureLabel(code, locale)
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="rz-caption m-0 text-pretty">{t('noPlanPitch')}</p>
        </div>
      </section>

      <p className="rz-muted m-0">
        {t('onlyThisModule')}{' '}
        <a href={`mailto:${SUPPORT_MAIL}`}>{t('writeToUs')}</a>{' '}
        {t('weWillHelp')}
      </p>
    </div>
  )
}

type StateCopyKey = 'pastDue' | 'blocked' | 'cancelled' | 'none' | 'other'

const stateCopyKeys: ReadonlySet<BillingState> = new Set<BillingState>([
  'pastDue',
  'blocked',
  'cancelled',
  'none',
])

function stateCopyKey(state: BillingState): StateCopyKey {
  return stateCopyKeys.has(state) ? (state as StateCopyKey) : 'other'
}

type AccessKey = MessageKey<typeof accessMessages>

/**
 * Стан підписки на весь екран. The «що доступно зараз» list is not a promise:
 * it is read from the module registry, which is the same table the router uses
 * to let a module through in this billing state.
 */
export function SubscriptionStateScreen({
  definition,
  state,
}: {
  definition: CabinetModuleDefinition
  state: BillingState
}) {
  const { targetTenant, snapshot } = useCabinet()
  const subscription = snapshot?.subscription ?? null
  const canViewBilling =
    snapshot !== null &&
    evaluateModuleAccess(
      cabinetModules.billing,
      { status: 'ready', snapshot, error: null },
      'view',
    ).kind === 'allowed'
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(accessMessages)
  const copyKey = stateCopyKey(state)
  const copy = {
    chip: t(`state.${copyKey}.chip` satisfies AccessKey),
    title: t(`state.${copyKey}.title` satisfies AccessKey),
    body: t(`state.${copyKey}.body` satisfies AccessKey),
  }
  const noRetryDate = t('noRetryDate')
  const modules = (Object.keys(cabinetModules) as CabinetModuleKey[])
    .map((key) => cabinetModules[key])
    .filter(
      (one) =>
        one.navigation !== undefined &&
        (one.viewPermission === undefined ||
          snapshot?.permissions.has(one.viewPermission) === true),
    )
    .map((one) => ({
      label: moduleLabel(one.key, locale),
      open:
        one.allowedSubscriptionStates === undefined ||
        one.allowedSubscriptionStates.includes(state),
    }))

  const tone = state === 'blocked' ? 'danger' : 'warn'

  return (
    <div className="rz-page max-w-[1240px]">
      <div className="grid gap-2" role="alert">
        <div className="rz-page-head items-center">
          <h1 className="rz-h-page">
            {canViewBilling ? copy.title : copy.chip}
          </h1>
          <StatusPill tone={tone}>{copy.chip}</StatusPill>
        </div>
        <p className="rz-muted m-0 max-w-[64ch] text-pretty">
          {copy.body}{' '}
          {t('triedToOpen', { module: moduleLabel(definition.key, locale) })}
        </p>
      </div>

      {canViewBilling ? (
        <section className="rz-card">
          <dl className="rz-kpis m-0 rounded-none border-0">
            <div className="rz-kpi">
              <dt className="rz-kpi__label">{t('amountDue')}</dt>
              <dd className="rz-kpi__value m-0">
                <span className="rz-display">
                  {typeof subscription?.amount === 'number' ? (
                    <Amount
                      currency={subscription.currency}
                      value={subscription.amount}
                    />
                  ) : (
                    <span className="rz-dim">—</span>
                  )}
                </span>
              </dd>
              <dd className="rz-kpi__meta m-0">
                {subscription?.planName ?? t('planNotSet')}
              </dd>
            </div>
            <div className="rz-kpi">
              <dt className="rz-kpi__label">{t('nextCharge')}</dt>
              <dd className="rz-kpi__value m-0">
                <span className="rz-display">
                  {subscription?.nextChargeAt === null ||
                  subscription?.nextChargeAt === undefined ? (
                    <span className="rz-dim" title={noRetryDate}>
                      —
                    </span>
                  ) : (
                    format.date(subscription.nextChargeAt)
                  )}
                </span>
              </dd>
              <dd className="rz-kpi__meta m-0">{noRetryDate}</dd>
            </div>
            <div className="rz-kpi">
              <dt className="rz-kpi__label">{t('accessUntil')}</dt>
              <dd className="rz-kpi__value m-0">
                <span className="rz-display">
                  {subscription?.currentPeriodEnd === null ||
                  subscription?.currentPeriodEnd === undefined ? (
                    <span className="rz-dim">—</span>
                  ) : (
                    format.date(subscription.currentPeriodEnd)
                  )}
                </span>
              </dd>
              <dd className="rz-kpi__meta m-0">{t('noRetention')}</dd>
            </div>
          </dl>
          {targetTenant === null ? null : (
            <div className="rz-card__foot flex-wrap justify-start">
              <Button asChild variant="primary">
                <Link to={cabinetPath(targetTenant.slug, 'billing')}>
                  {t('toSubscription')}
                </Link>
              </Button>
              <Button asChild>
                <Link to={cabinetPath(targetTenant.slug, 'plans')}>
                  {t('comparePlans')}
                </Link>
              </Button>
              <Button asChild>
                <Link to={cabinetPath(targetTenant.slug, 'payments')}>
                  {t('paymentHistory')}
                </Link>
              </Button>
            </div>
          )}
        </section>
      ) : (
        <section className="rz-card">
          <div className="rz-card__body">
            <p className="rz-muted m-0 text-pretty">
              {t('renewalRequiresPermission')}
            </p>
          </div>
        </section>
      )}

      <section className="rz-card">
        <header className="rz-card__head">
          <h2 className="rz-h-card">{t('availableNow')}</h2>
        </header>
        <div className="rz-card__body grid gap-3">
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {modules.map((one) => (
              <li
                className={cn(
                  'flex items-start gap-2.5',
                  one.open ? 'text-app-muted' : 'text-app-dim',
                )}
                key={one.label}
              >
                {one.open ? (
                  <Check
                    aria-label={t('moduleOpen')}
                    className="text-state-ok mt-0.5 size-4 shrink-0"
                  />
                ) : (
                  <Minus
                    aria-label={t('moduleClosed')}
                    className="text-app-dim mt-0.5 size-4 shrink-0"
                  />
                )}
                {one.label}
              </li>
            ))}
          </ul>
          <p className="rz-caption m-0 text-pretty">{t('availableNowNote')}</p>
        </div>
      </section>

      <p className="rz-muted m-0">
        {t('paymentQuestions')}{' '}
        <a
          className="underline underline-offset-2"
          href={`mailto:${SUPPORT_MAIL}`}
        >
          {SUPPORT_MAIL}
        </a>
        .
      </p>
    </div>
  )
}
