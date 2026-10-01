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
import {
  dayWord,
  featureLabel,
  intervalLabel,
  LIMIT_LABELS,
} from './billing-vocabulary'
import {
  BILLING_MANAGEMENT_UNAVAILABLE,
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
      message: string
    }

/** A result that arrived for a tenant we have already left changes nothing. */
type MutationOutcome = 'applied' | 'stale'

/** What the plan catalogue does not carry, said where the design asks for it. */
const NO_PRORATION =
  'Залишок оплаченого періоду кабінет не перераховує — оплата починається з нового рахунку.'
const NO_PLAN_COPY =
  'Опису «кому цей тариф» і позначок знижки в тарифах теж немає: є назва, сума, валюта, період, ліміти й перелік можливостей.'

export function PlansScreen() {
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
          message: plansFailureMessage(error),
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
    { errorMessage: checkoutFailureMessage },
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
        <SkeletonRows columns={3} label="Завантажуємо тарифи…" rows={3} />
      </PlansFrame>
    )
  }
  if (currentPlansState.kind === 'error') {
    return (
      <PlansFrame>
        <ErrorState
          description={currentPlansState.message}
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
          title="Тарифи не завантажилися"
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
            aria-label="Період оплати"
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
                {intervalLabel(one).replace(/^за /, '')}
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
          Цією підпискою керує {management.label}. Змінюйте або скасовуйте її в
          налаштуваннях магазину.
        </Notice>
      )}
      {management.kind === 'unavailable' && !canCheckout && (
        <BillingUnavailableNotice />
      )}

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
                  <StatusPill tone="info">Обрано</StatusPill>
                ) : isCurrent ? (
                  <StatusPill tone="ok">Поточний тариф</StatusPill>
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
                    {intervalLabel(plan.interval)}
                  </span>
                </p>
                <p className="text-app-dim mt-2 text-[12.5px]">
                  {plan.trialDays > 0
                    ? `${String(plan.trialDays)} ${dayWord(plan.trialDays)} безкоштовно`
                    : 'Без пробного періоду'}
                </p>
              </div>
              <dl className="border-app-line grid gap-1.5 border-t pt-3.5">
                {LIMIT_LABELS.map((limit) => (
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
                    Фото на позицію
                  </dt>
                  <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                    {plan.limits.photosPerPart ?? '∞'}
                  </dd>
                </div>
              </dl>
              <ul className="border-app-line grid gap-1.5 border-t pt-3.5">
                {allFeatures.length === 0 ? (
                  <li className="text-app-dim text-[12.5px]">
                    Можливостей тариф не перелічує.
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
                            aria-label="є в тарифі"
                            className="text-state-ok mt-0.5 size-4 shrink-0"
                          />
                        ) : (
                          <Minus
                            aria-label="немає в тарифі"
                            className="text-app-dim mt-0.5 size-4 shrink-0"
                          />
                        )}
                        {featureLabel(code)}
                      </li>
                    )
                  })
                )}
              </ul>
              <div className="mt-auto pt-1">
                {isCurrent ? (
                  <p className="text-app-dim text-[13px]">Цей тариф уже діє.</p>
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
                      Обрати
                    </Button>
                  </BillingMutationGate>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <BillingCard title="Що входить у кожен тариф">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <caption className="sr-only">Порівняння тарифів</caption>
            <thead>
              <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                <th className="py-2.5 pr-3 text-left">Можливість</th>
                {plans.map((plan) => (
                  <th className="px-3 py-2.5 text-right" key={plan.code}>
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIMIT_LABELS.map((limit) => (
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
                    {featureLabel(code)}
                  </td>
                  {plans.map((plan) => (
                    <td className="px-3 py-2.5 text-right" key={plan.code}>
                      {plan.features.includes(code) ? (
                        <Check
                          aria-label="є"
                          className="text-state-ok ml-auto size-4"
                        />
                      ) : (
                        <Minus
                          aria-label="немає"
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
          {NO_PRORATION} {NO_PLAN_COPY}
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
  return (
    <BillingShell
      actions={actions}
      crumb="Налаштування · Підписка · Тарифи"
      lead="Порівняйте ліміти й можливості, перш ніж міняти тариф."
      title="Тарифи"
    >
      {children}
    </BillingShell>
  )
}

function plansFailureMessage(error: unknown): string {
  const problem = normalizeApiProblem(error)
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return 'Не вдалося завантажити тарифи: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.'
  }
  if (problem.kind === 'forbidden') {
    return 'У вас немає доступу до тарифів цієї розбірки. Попросіть власника надати доступ до білінгу.'
  }
  return 'Не вдалося завантажити тарифи. Спробуйте ще раз.'
}

function checkoutFailureMessage(error: unknown): string {
  if (error instanceof BillingManagementUnavailableError) {
    return BILLING_MANAGEMENT_UNAVAILABLE
  }
  if (error instanceof ModuleAccessDeniedError) {
    return 'Дія більше недоступна: права або стан підписки змінилися. Оновіть сторінку.'
  }
  const problem = normalizeApiProblem(error)
  if (problem.kind === 'forbidden') {
    return 'У вас більше немає права змінювати підписку. Попросіть власника розбірки надати доступ до білінгу.'
  }
  if (problem.kind === 'conflict') {
    return 'Підписка вже змінилася. Оновіть сторінку та спробуйте ще раз.'
  }
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return 'Не вдалося розпочати оплату: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.'
  }
  return 'Не вдалося розпочати оплату. Спробуйте ще раз.'
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
