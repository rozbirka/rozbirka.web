import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Check, Minus } from 'lucide-react'
import {
  Amount,
  Button,
  DataTable,
  ErrorState,
  Notice,
  Segmented,
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

  const comparisonRows = [
    ...limits.map((limit) => ({
      key: `limit-${limit.key}`,
      label: limit.label,
      value: (plan: PublicPlanDto): ReactNode => (
        <span className="rz-strong">{plan.limits[limit.key] ?? '∞'}</span>
      ),
    })),
    ...allFeatures.map((code) => ({
      key: `feature-${code}`,
      label: featureLabel(code, locale),
      value: (plan: PublicPlanDto): ReactNode =>
        plan.features.includes(code) ? (
          <Check
            aria-label={t('included')}
            className="text-state-ok ml-auto size-3.5"
          />
        ) : (
          <Minus
            aria-label={t('notIncluded')}
            className="text-app-dim ml-auto size-3.5"
          />
        ),
    })),
  ]

  return (
    <PlansFrame
      actions={
        intervals.length > 1 ? (
          <Segmented
            as="toggle"
            label={t('billingPeriod')}
            name="billing-period"
            onChange={setInterval}
            options={intervals.map((one) => ({
              value: one,
              label: intervalName(one, locale),
            }))}
            value={activeInterval ?? ''}
          />
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
        className="m-0 grid min-w-0 list-none items-start gap-4 p-0 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]"
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
                'rz-card flex min-w-0 flex-col',
                // The plan the reader arrived for is the current selection.
                isSelected && 'border-brand',
              )}
              key={plan.code}
            >
              <header className="rz-card__head py-2.5">
                <h2 className="rz-h-card">{plan.name}</h2>
                {isSelected ? (
                  <StatusPill tone="info">{t('selected')}</StatusPill>
                ) : isCurrent ? (
                  <StatusPill tone="ok">{t('currentPlan')}</StatusPill>
                ) : null}
              </header>
              <div className="rz-card__body grid gap-3">
                <div className="grid gap-1">
                  <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                    <Amount
                      className="rz-strong text-page font-semibold"
                      currency={plan.currency}
                      value={plan.amount}
                    />
                    <span className="rz-dim">
                      {intervalLabel(plan.interval, locale)}
                    </span>
                  </p>
                  <p className="rz-caption m-0">
                    {plan.trialDays > 0
                      ? t('trialFree', {
                          days: daysText(plan.trialDays, locale),
                        })
                      : t('noTrial')}
                  </p>
                </div>
                <dl className="rz-facts px-0 py-0">
                  {limits.map((limit) => (
                    <div key={limit.key}>
                      <dt>{limit.label}</dt>
                      <dd className="rz-num">
                        {plan.limits[limit.key] ?? '∞'}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>{t('photosPerItem')}</dt>
                    <dd className="rz-num">
                      {plan.limits.photosPerPart ?? '∞'}
                    </dd>
                  </div>
                </dl>
                <ul className="border-app-line m-0 grid list-none gap-1.5 border-t p-0 pt-3">
                  {allFeatures.length === 0 ? (
                    <li className="rz-caption">{t('noFeaturesListed')}</li>
                  ) : (
                    allFeatures.map((code) => {
                      const included = plan.features.includes(code)
                      return (
                        <li
                          className={cn(
                            'flex items-start gap-2',
                            included ? 'rz-muted' : 'rz-dim',
                          )}
                          key={code}
                        >
                          {included ? (
                            <Check
                              aria-label={t('includedInPlan')}
                              className="text-state-ok mt-0.5 size-3.5 shrink-0"
                            />
                          ) : (
                            <Minus
                              aria-label={t('notInPlan')}
                              className="text-app-dim mt-0.5 size-3.5 shrink-0"
                            />
                          )}
                          {featureLabel(code, locale)}
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
              {isCurrent ? (
                <div className="rz-card__foot mt-auto">
                  <p className="rz-dim m-0">{t('alreadyActive')}</p>
                </div>
              ) : canCheckout ? (
                <div className="rz-card__foot mt-auto">
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
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <BillingCard
        bodyClassName="p-0"
        footer={`${t('noProration')} ${t('noPlanCopy')}`}
        title={t('whatsIncluded')}
      >
        <DataTable
          caption={t('comparison')}
          columns={[
            {
              key: 'feature',
              label: t('feature'),
              variant: 'primary',
              cell: (row) => row.label,
            },
            ...plans.map((plan) => ({
              key: plan.code,
              label: plan.name,
              align: 'end' as const,
              cell: (row: (typeof comparisonRows)[number]) => row.value(plan),
            })),
          ]}
          embedded
          rowKey={(row) => row.key}
          rows={comparisonRows}
        />
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
