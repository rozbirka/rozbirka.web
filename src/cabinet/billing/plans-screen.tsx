import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Check, Minus } from 'lucide-react'
import {
  Amount,
  Button,
  ErrorState,
  Notice,
  SkeletonRows,
  StatusPill,
  useOperation,
} from '@/components/app'
import {
  billingApi,
  canStartWebCheckout,
  isContractManagedSubscription,
  resolveProviderManagement,
  type ProviderAwareSubscriptionDto,
} from '@/api/billing'
import { normalizeApiProblem } from '@/api/errors'
import type { PublicPlanDto } from '@/api/types'
import { readPlanCode } from '@/lib/plan-selection'
import { cn } from '@/lib/utils'
import { ModuleAccessDeniedError } from '../policy'
import { tenantRequestScope } from '../tenant-request-scope'
import { BillingCard, BillingShell } from './billing-shell'
import { translate, useLocale, useT, type Locale } from '@/i18n'
import {
  daysText,
  featureLabel,
  intervalLabel,
  intervalName,
  limitLabels,
} from './billing-vocabulary'
import { billingMessages } from './messages'
import { plansMessages } from './plans-messages'
import {
  billingManagementUnavailable,
  BillingContractNotice,
  BillingManagementUnavailableError,
  BillingMutationGate,
  BillingUnavailableNotice,
  EmptyBillingPanel,
  useBillingMutation,
} from './billing-layout'

type PlansState =
  | { kind: 'loading'; generation: number | undefined; attempt: number }
  | { kind: 'empty'; generation: number | undefined; attempt: number }
  | {
      kind: 'ready'
      generation: number | undefined
      attempt: number
      plans: PublicPlanDto[]
    }
  | {
      kind: 'error'
      generation: number | undefined
      attempt: number
      error: unknown
    }

/** A result that arrived for a tenant we have already left changes nothing. */
type MutationOutcome = 'applied' | 'stale'

export function PlansScreen() {
  const { locale } = useLocale()
  const t = useT(plansMessages)
  const limits = limitLabels(locale)
  const [searchParams] = useSearchParams()
  const { cabinet, controlDecision, requireLatestMutation } =
    useBillingMutation('plans')
  const generation = cabinet.snapshot?.generation
  const [plansState, setPlansState] = useState<PlansState>({
    kind: 'loading',
    generation,
    attempt: 0,
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const latestSnapshotRef = useRef(cabinet.snapshot)
  const planCodeRef = useRef<string | null>(null)
  const selectedPlanCode = readPlanCode(`?${searchParams.toString()}`)
  const [interval, setInterval] = useState<string | null>(null)

  useEffect(() => {
    latestSnapshotRef.current = cabinet.snapshot
  }, [cabinet.snapshot])

  useEffect(() => {
    const signal = tenantRequestScope.signal
    let current = true
    void billingApi
      .getPlans({ signal })
      .then((loaded) => {
        if (!current || signal.aborted) return
        setPlansState(
          loaded.length > 0
            ? {
                kind: 'ready',
                generation,
                attempt: loadAttempt,
                plans: loaded,
              }
            : { kind: 'empty', generation, attempt: loadAttempt },
        )
      })
      .catch((error: unknown) => {
        if (!current || signal.aborted) return
        setPlansState({
          kind: 'error',
          generation,
          attempt: loadAttempt,
          error,
        })
      })
    return () => {
      current = false
    }
  }, [generation, loadAttempt])

  const checkout = useOperation<MutationOutcome>(
    async () => {
      const planCode = planCodeRef.current
      const scope = requireLatestMutation()
      if (
        planCode === null ||
        !canStartWebCheckout(latestSnapshotRef.current?.subscription)
      ) {
        throw new BillingManagementUnavailableError()
      }
      let checkoutUrl: string
      try {
        ;({ checkoutUrl } = await billingApi.subscribe(
          { planCode },
          { signal: scope.signal },
        ))
      } catch (error) {
        if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
        throw error
      }
      if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
      window.location.assign(checkoutUrl)
      return 'applied'
    },
    // No success toast: a checkout leaves the app for the Mono pay page.
    { errorMessage: (error) => checkoutFailureMessage(error, locale) },
  )

  const resetCheckout = checkout.reset
  useEffect(() => {
    // A failure describes one snapshot of access. When that snapshot is
    // replaced, so is the message.
    resetCheckout()
  }, [generation, resetCheckout])

  const currentPlansState =
    plansState.generation === generation && plansState.attempt === loadAttempt
      ? plansState
      : ({ kind: 'loading', generation, attempt: loadAttempt } as const)

  if (currentPlansState.kind === 'loading') {
    return (
      <PlansFrame>
        <SkeletonRows columns={3} label={t('loading')} rows={3} />
      </PlansFrame>
    )
  }
  if (currentPlansState.kind === 'error') {
    return (
      <PlansFrame>
        <ErrorState
          description={plansFailureMessage(currentPlansState.error, locale)}
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
          title={t('loadFailedTitle')}
        />
      </PlansFrame>
    )
  }
  if (currentPlansState.kind === 'empty') {
    return (
      <PlansFrame>
        <EmptyBillingPanel />
      </PlansFrame>
    )
  }

  const currentCode = cabinet.snapshot?.subscription?.planCode
  const providerSubscription = cabinet.snapshot
    ?.subscription as ProviderAwareSubscriptionDto | null
  const management = providerSubscription
    ? resolveProviderManagement(providerSubscription)
    : { kind: 'unavailable' as const }
  const contractManaged = providerSubscription
    ? isContractManagedSubscription(providerSubscription)
    : false
  const canCheckout = canStartWebCheckout(providerSubscription)
  const recommendedCode = 'pro_monthly'
  const allPlans = currentPlansState.plans
  const intervals = [...new Set(allPlans.map((plan) => plan.interval))]
  const activeInterval =
    interval !== null && intervals.includes(interval)
      ? interval
      : (intervals[0] ?? null)
  const plans =
    activeInterval === null
      ? allPlans
      : allPlans.filter((plan) => plan.interval === activeInterval)
  // Every feature any plan sells, so a plan can also say what it does not give.
  const allFeatures = [...new Set(allPlans.flatMap((plan) => plan.features))]

  return (
    <PlansFrame
      actions={
        intervals.length > 1 ? (
          <div
            aria-label={t('billingPeriod')}
            className="border-app-line bg-app-raised flex min-w-0 flex-wrap gap-1 rounded-[14px] border p-1"
            role="group"
          >
            {intervals.map((one) => (
              <button
                aria-pressed={one === activeInterval}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-bold whitespace-nowrap',
                  one === activeInterval
                    ? 'text-app-ink bg-white/[0.08]'
                    : 'text-app-muted hover:text-app-ink',
                )}
                key={one}
                onClick={() => setInterval(one)}
                type="button"
              >
                {intervalName(one, locale)}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {checkout.error === null ? null : (
        <Notice tone="danger">{checkout.error}</Notice>
      )}
      {management.kind === 'provider' && (
        <Notice tone="info">
          {t('managedByProvider', { provider: management.label })}
        </Notice>
      )}
      {contractManaged && <BillingContractNotice />}
      {management.kind === 'unavailable' &&
        !canCheckout &&
        !contractManaged && <BillingUnavailableNotice />}

      <ul
        className="grid min-w-0 items-start gap-5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]"
        role="list"
      >
        {plans.map((plan) => {
          const isCurrent =
            plan.code === currentCode &&
            (providerSubscription?.canCancel === true ||
              (!providerSubscription?.canSubscribe &&
                !providerSubscription?.canReactivate))
          const isSelected = plan.code === selectedPlanCode
          return (
            <li
              className={cn(
                'border-app-line bg-app-raised flex min-w-0 flex-col gap-4 rounded-[20px] border px-5 py-5',
                plan.code === recommendedCode && 'border-brand/35',
                isSelected && 'ring-brand ring-1',
              )}
              key={plan.code}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-app-ink text-[17px] font-bold">
                  {plan.name}
                </h2>
                {isSelected ? (
                  <StatusPill tone="info">{t('selected')}</StatusPill>
                ) : isCurrent ? (
                  <StatusPill tone="ok">{t('currentPlan')}</StatusPill>
                ) : null}
              </div>
              <div>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Amount
                    className="text-[30px] leading-none font-extrabold tracking-[-0.03em] text-white"
                    currency={plan.currency}
                    value={plan.amount}
                  />
                  <span className="text-app-dim text-[13px]">
                    {intervalLabel(plan.interval, locale)}
                  </span>
                </p>
                <p className="text-app-dim mt-2 text-[12.5px]">
                  {plan.trialDays > 0
                    ? t('trialFree', {
                        days: daysText(plan.trialDays, locale),
                      })
                    : t('noTrial')}
                </p>
              </div>
              <dl className="border-app-line grid gap-1.5 border-t pt-3.5">
                {limits.map((limit) => (
                  <div
                    className="flex items-baseline justify-between gap-3"
                    key={limit.key}
                  >
                    <dt className="text-app-muted text-[13px]">
                      {limit.label}
                    </dt>
                    <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                      {plan.limits[limit.key] ?? '∞'}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-app-muted text-[13px]">
                    {t('photosPerItem')}
                  </dt>
                  <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                    {plan.limits.photosPerPart ?? '∞'}
                  </dd>
                </div>
              </dl>
              <ul className="border-app-line grid gap-1.5 border-t pt-3.5">
                {allFeatures.length === 0 ? (
                  <li className="text-app-dim text-[12.5px]">
                    {t('noFeaturesListed')}
                  </li>
                ) : (
                  allFeatures.map((code) => {
                    const included = plan.features.includes(code)
                    return (
                      <li
                        className={cn(
                          'flex items-start gap-2 text-[13px]',
                          included ? 'text-app-muted' : 'text-app-dim',
                        )}
                        key={code}
                      >
                        {included ? (
                          <Check
                            aria-label={t('includedInPlan')}
                            className="text-state-ok mt-0.5 size-4 shrink-0"
                          />
                        ) : (
                          <Minus
                            aria-label={t('notInPlan')}
                            className="text-app-dim mt-0.5 size-4 shrink-0"
                          />
                        )}
                        {featureLabel(code, locale)}
                      </li>
                    )
                  })
                )}
              </ul>
              <div className="mt-auto pt-1">
                {isCurrent ? (
                  <p className="text-app-dim text-[13px]">
                    {t('alreadyActive')}
                  </p>
                ) : canCheckout ? (
                  <BillingMutationGate decision={controlDecision}>
                    <Button
                      onClick={() => {
                        planCodeRef.current = plan.code
                        checkout.run()
                      }}
                      size="wide"
                      variant="primary"
                      {...checkout.triggerProps}
                    >
                      {t('choose')}
                    </Button>
                  </BillingMutationGate>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <BillingCard title={t('whatsIncluded')}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <caption className="sr-only">{t('comparison')}</caption>
            <thead>
              <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                <th className="py-2.5 pr-3 text-left">{t('feature')}</th>
                {plans.map((plan) => (
                  <th className="px-3 py-2.5 text-right" key={plan.code}>
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {limits.map((limit) => (
                <tr className="border-app-line border-b" key={limit.key}>
                  <td className="text-app-muted py-2.5 pr-3">{limit.label}</td>
                  {plans.map((plan) => (
                    <td
                      className="text-app-ink px-3 py-2.5 text-right font-mono tabular-nums"
                      key={plan.code}
                    >
                      {plan.limits[limit.key] ?? '∞'}
                    </td>
                  ))}
                </tr>
              ))}
              {allFeatures.map((code) => (
                <tr className="border-app-line border-b" key={code}>
                  <td className="text-app-muted py-2.5 pr-3">
                    {featureLabel(code, locale)}
                  </td>
                  {plans.map((plan) => (
                    <td className="px-3 py-2.5 text-right" key={plan.code}>
                      {plan.features.includes(code) ? (
                        <Check
                          aria-label={t('included')}
                          className="text-state-ok ml-auto size-4"
                        />
                      ) : (
                        <Minus
                          aria-label={t('notIncluded')}
                          className="text-app-dim ml-auto size-4"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
          {t('noProration')} {t('noPlanCopy')}
        </p>
      </BillingCard>
    </PlansFrame>
  )
}

function PlansFrame({
  actions,
  children,
}: {
  actions?: ReactNode
  children: ReactNode
}) {
  const t = useT(plansMessages)
  return (
    <BillingShell
      actions={actions}
      crumb={t('crumb')}
      lead={t('lead')}
      title={t('title')}
    >
      {children}
    </BillingShell>
  )
}

function plansFailureMessage(error: unknown, locale: Locale): string {
  const problem = normalizeApiProblem(error)
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return translate(plansMessages, locale, 'loadNetwork')
  }
  if (problem.kind === 'forbidden') {
    return translate(plansMessages, locale, 'loadForbidden')
  }
  return translate(plansMessages, locale, 'loadFailed')
}

function checkoutFailureMessage(error: unknown, locale: Locale): string {
  if (error instanceof BillingManagementUnavailableError) {
    return billingManagementUnavailable(locale)
  }
  if (error instanceof ModuleAccessDeniedError) {
    return translate(billingMessages, locale, 'actionUnavailable')
  }
  const problem = normalizeApiProblem(error)
  if (problem.kind === 'forbidden') {
    return translate(billingMessages, locale, 'noRightToChange')
  }
  if (problem.kind === 'conflict') {
    return translate(billingMessages, locale, 'subscriptionChanged')
  }
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return translate(billingMessages, locale, 'checkoutNetwork')
  }
  return translate(billingMessages, locale, 'checkoutFailed')
}

function isCurrentScope(
  scope: ReturnType<
    ReturnType<typeof useBillingMutation>['requireLatestMutation']
  >,
  snapshot: ReturnType<typeof useBillingMutation>['cabinet']['snapshot'],
): boolean {
  return (
    !scope.signal.aborted &&
    snapshot?.tenantId === scope.tenantId &&
    snapshot.generation === scope.generation
  )
}
