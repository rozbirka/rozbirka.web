import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Check, Minus, PackageOpen } from 'lucide-react'
import { Amount, Button, StateScreen } from '@/components/app'
import { billingApi } from '@/api/billing'
import type { BillingState, PublicPlanDto } from '@/api/types'
import { useFormat, useLocale, useT, type MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'
import { accessMessages } from '../access-messages'
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
      className="min-h-[50dvh] content-center"
      description={t('unavailableBody', {
        module: moduleLabel(definition.key, locale),
      })}
      icon={<PackageOpen aria-hidden />}
      title={t('unavailableTitle')}
      tone="neutral"
    />
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
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="mx-auto grid w-full max-w-[880px] gap-6 px-4 pt-14 pb-16 sm:px-6 md:px-8 md:pt-18 lg:px-12">
        <div>
          <span className="border-state-warn/30 bg-state-warn/10 text-state-warn inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-bold">
            <span aria-hidden className="bg-state-warn size-1.5 rounded-full" />
            {currentPlan === null
              ? t('notInCurrentPlan')
              : t('notInPlan', { plan: currentPlan })}
          </span>
          <h1 className="mt-3.5 text-[32px] leading-[1.04] font-extrabold tracking-[-0.03em] text-white sm:text-[40px]">
            {unlocking === null
              ? t('notIncludedTitle', { module: label })
              : t('includedInTitle', { module: label, plan: unlocking.name })}
          </h1>
          <p className="text-app-muted mt-3 max-w-[64ch] text-[14.5px] leading-6 text-pretty">
            {t('planLockedBody')}
          </p>
        </div>

        <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {unlocking === null ? t('planWithModule') : t('planRequired')}
              </p>
              {unlocking === null ? (
                <p className="text-app-dim mt-2.5 max-w-[52ch] text-[13.5px] leading-5 text-pretty">
                  {plans === null ? t('findingPlan') : t('noPlanInCatalogue')}
                </p>
              ) : (
                <>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
                    <span className="text-app-ink text-[24px] leading-tight font-extrabold tracking-[-0.02em]">
                      {unlocking.name}
                    </span>
                    <Amount
                      className="text-app-muted text-[15px]"
                      currency={unlocking.currency}
                      value={unlocking.amount}
                    />
                  </p>
                  <p className="text-app-dim mt-2 max-w-[52ch] text-[12.5px] leading-5 text-pretty">
                    {currentPlan === null
                      ? ''
                      : `${t('currentPlan', { plan: currentPlan })} `}
                    {t('noProration')}
                  </p>
                </>
              )}
            </div>
            {targetTenant === null ? null : (
              <div className="flex flex-wrap gap-2.5">
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
          </div>
          {unlocking === null ? null : (
            <ul className="border-app-line mt-5 grid gap-2 border-t pt-4">
              {unlocking.features.map((code) => (
                <li
                  className="text-app-muted flex items-start gap-2.5 text-[13.5px]"
                  key={code}
                >
                  <Check
                    aria-hidden
                    className="text-state-ok mt-0.5 size-4 shrink-0"
                  />
                  {code === required ? (
                    <span className="text-app-ink font-medium">
                      {featureLabel(code)}
                    </span>
                  ) : (
                    featureLabel(code)
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-app-dim mt-4 text-[12.5px] leading-5 text-pretty">
            {t('noPlanPitch')}
          </p>
        </section>

        <p className="text-app-dim text-[13px]">
          {t('onlyThisModule')}{' '}
          <a
            className="text-brand underline underline-offset-4"
            href={`mailto:${SUPPORT_MAIL}`}
          >
            {t('writeToUs')}
          </a>{' '}
          {t('weWillHelp')}
        </p>
      </div>
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

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="mx-auto grid w-full max-w-[880px] gap-6 px-4 pt-14 pb-16 sm:px-6 md:px-8 md:pt-18 lg:px-12">
        <div role="alert">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-bold',
              state === 'blocked'
                ? 'border-state-danger/30 bg-state-danger/10 text-state-danger'
                : 'border-state-warn/30 bg-state-warn/10 text-state-warn',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                state === 'blocked' ? 'bg-state-danger' : 'bg-state-warn',
              )}
            />
            {copy.chip}
          </span>
          <h1 className="mt-3.5 text-[32px] leading-[1.04] font-extrabold tracking-[-0.03em] text-white sm:text-[40px]">
            {copy.title}
          </h1>
          <p className="text-app-muted mt-3 max-w-[64ch] text-[14.5px] leading-6 text-pretty">
            {copy.body}{' '}
            {t('triedToOpen', { module: moduleLabel(definition.key, locale) })}
          </p>
        </div>

        <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {t('amountDue')}
              </dt>
              <dd className="text-app-ink mt-2 text-[20px] font-extrabold tracking-[-0.02em]">
                {typeof subscription?.amount === 'number' ? (
                  <Amount
                    currency={subscription.currency}
                    value={subscription.amount}
                  />
                ) : (
                  <span className="text-app-dim">—</span>
                )}
              </dd>
              <dd className="text-app-dim mt-1 text-[12.5px]">
                {subscription?.planName ?? t('planNotSet')}
              </dd>
            </div>
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {t('nextCharge')}
              </dt>
              <dd className="text-app-ink mt-2 text-[20px] font-extrabold tracking-[-0.02em]">
                {subscription?.nextChargeAt === null ||
                subscription?.nextChargeAt === undefined ? (
                  <span className="text-app-dim" title={noRetryDate}>
                    —
                  </span>
                ) : (
                  format.date(subscription.nextChargeAt)
                )}
              </dd>
              <dd className="text-app-dim mt-1 text-[12.5px]">{noRetryDate}</dd>
            </div>
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {t('accessUntil')}
              </dt>
              <dd className="text-app-ink mt-2 text-[20px] font-extrabold tracking-[-0.02em]">
                {subscription?.currentPeriodEnd === null ||
                subscription?.currentPeriodEnd === undefined ? (
                  <span className="text-app-dim">—</span>
                ) : (
                  format.date(subscription.currentPeriodEnd)
                )}
              </dd>
              <dd className="text-app-dim mt-1 text-[12.5px]">
                {t('noRetention')}
              </dd>
            </div>
          </dl>
          {targetTenant === null ? null : (
            <div className="border-app-line mt-5 flex flex-wrap gap-2.5 border-t pt-4">
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

        <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5">
          <h2 className="text-app-ink text-[15px] font-bold">
            {t('availableNow')}
          </h2>
          <ul className="mt-3.5 grid gap-2 sm:grid-cols-2">
            {modules.map((one) => (
              <li
                className={cn(
                  'flex items-start gap-2.5 text-[13.5px]',
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
          <p className="text-app-dim mt-4 text-[12.5px] leading-5 text-pretty">
            {t('availableNowNote')}
          </p>
        </section>

        <p className="text-app-dim text-[13px]">
          {t('paymentQuestions')}{' '}
          <a
            className="text-brand underline underline-offset-4"
            href={`mailto:${SUPPORT_MAIL}`}
          >
            {SUPPORT_MAIL}
          </a>
          .
        </p>
      </div>
    </div>
  )
}
