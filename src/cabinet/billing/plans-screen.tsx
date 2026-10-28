import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CabinetLoadingContent } from '../loading-screen'
import { useSearchParams } from 'react-router'
import {
  Amount,
  Button,
  DataTable,
  ErrorState,
  Notice,
  Segmented,
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
import { commonMessages, translate, useLocale, useT, type Locale } from '@/i18n'
import { daysText, intervalLabel, intervalName } from './billing-vocabulary'
import { billingMessages } from './messages'
import { plansMessages } from './plans-messages'
import { subscriptionDesignMessages } from './subscription-design-messages'
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
  const td = useT(subscriptionDesignMessages)
  const tc = useT(commonMessages)
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
        <CabinetLoadingContent
          module="plans"
          heading={false}
          label={t('loading')}
        />
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

      <BillingCard title={t('title')} bodyClassName="p-0">
        <DataTable
          caption={t('title')}
          embedded
          rowKey={(plan) => plan.code}
          rows={plans}
          columns={[
            {
              key: 'plan',
              label: td('plan'),
              variant: 'primary',
              cell: (plan) => {
                const isCurrent =
                  plan.code === currentCode &&
                  (providerSubscription?.canCancel === true ||
                    (!providerSubscription?.canSubscribe &&
                      !providerSubscription?.canReactivate))
                return (
                  <div className="rz-cell-main flex-wrap">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={cn(
                          'rz-h-card',
                          plan.code === selectedPlanCode && 'text-brand',
                        )}
                      >
                        {plan.name}
                      </h3>
                      {plan.code === selectedPlanCode ? (
                        <StatusPill tone="info">{t('selected')}</StatusPill>
                      ) : isCurrent ? (
                        <StatusPill tone="ok">{t('currentPlan')}</StatusPill>
                      ) : null}
                    </div>
                    {plan.trialDays > 0 && (
                      <span className="rz-caption">
                        {t('trialFree', {
                          days: daysText(plan.trialDays, locale),
                        })}
                      </span>
                    )}
                  </div>
                )
              },
            },
            {
              key: 'parts',
              label: td('parts'),
              align: 'end',
              cell: (plan) => (
                <span className="rz-mono">{plan.limits.parts ?? '∞'}</span>
              ),
            },
            {
              key: 'users',
              label: td('users'),
              align: 'end',
              cell: (plan) => (
                <span className="rz-mono">{plan.limits.users ?? '∞'}</span>
              ),
            },
            {
              key: 'price',
              label: td('price'),
              align: 'end',
              cell: (plan) => (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <Amount currency={plan.currency} value={plan.amount} />
                  <span className="rz-caption">
                    {intervalLabel(plan.interval, locale)}
                  </span>
                </span>
              ),
            },
            {
              key: 'actions',
              label: tc('actions'),
              headerHidden: true,
              cell: (plan) => {
                const isCurrent =
                  plan.code === currentCode &&
                  (providerSubscription?.canCancel === true ||
                    (!providerSubscription?.canSubscribe &&
                      !providerSubscription?.canReactivate))
                return (
                  <div className="flex w-full justify-end">
                    {!isCurrent && canCheckout && (
                      <BillingMutationGate decision={controlDecision}>
                        <Button
                          {...checkout.triggerProps}
                          disabled={checkout.pending}
                          onClick={() => {
                            planCodeRef.current = plan.code
                            checkout.run()
                          }}
                          variant="primary"
                        >
                          {t('choose')}
                        </Button>
                      </BillingMutationGate>
                    )}
                  </div>
                )
              },
            },
          ]}
        />
      </BillingCard>
      <Notice tone="info">{t('noProration')}</Notice>
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
    <BillingShell actions={actions} crumb={t('crumb')} title={t('title')}>
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
