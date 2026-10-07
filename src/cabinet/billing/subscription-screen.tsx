import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import {
  Amount,
  Button,
  ConfirmDialog,
  DateValue,
  Notice,
  StatusPill,
  useOperation,
  useToast,
  type StatusTone,
} from '@/components/app'
import {
  billingApi,
  canStartWebCheckout,
  isContractManagedSubscription,
  resolveProviderManagement,
  type ProviderAwareSubscriptionDto,
} from '@/api/billing'
import { normalizeApiProblem } from '@/api/errors'
import type { BillingState, PaymentDto, SubscriptionDto } from '@/api/types'
import type { TenantAccessSnapshot } from '../access-types'
import { cn } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import { ModuleAccessDeniedError } from '../policy'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { BillingCard, BillingDead, BillingShell } from './billing-shell'
import { translate, useLocale, useT, type Locale } from '@/i18n'
import {
  daysText,
  daysUntil,
  featureLabel,
  limitLabels,
  paymentStatusMeta,
  paymentTypeLabel,
} from './billing-vocabulary'
import { billingMessages } from './messages'
import { subscriptionMessages } from './subscription-messages'
import {
  billingManagementUnavailable,
  BillingContractNotice,
  BillingManagementUnavailableError,
  BillingMutationGate,
  BillingUnavailableNotice,
  EmptyBillingPanel,
  useBillingMutation,
} from './billing-layout'

type SubscriptionMutation = 'checkout' | 'cancel'

/** How many payments the overview shows before sending the reader to the ledger. */
const HISTORY_SIZE = 4

/** A result that arrived for a tenant we have already left changes nothing. */
type MutationOutcome = 'applied' | 'stale'

export function SubscriptionScreen() {
  const { locale } = useLocale()
  const navigate = useNavigate()
  const toast = useToast()
  const { cabinet, controlDecision, requireLatestMutation } =
    useBillingMutation('billing')
  const snapshotSubscription = cabinet.snapshot?.subscription ?? null
  const generation = cabinet.snapshot?.generation
  const latestSnapshotRef = useRef(cabinet.snapshot)
  const cancelStageRef = useRef<'cancel' | 'refresh'>('cancel')
  const [refreshedSubscription, setRefreshedSubscription] = useState<{
    generation: number
    value: SubscriptionDto
  } | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [history, setHistory] = useState<PaymentDto[] | null>(null)
  const subscription =
    refreshedSubscription !== null &&
    refreshedSubscription.generation === generation
      ? refreshedSubscription.value
      : snapshotSubscription

  useEffect(() => {
    latestSnapshotRef.current = cabinet.snapshot
  }, [cabinet.snapshot])

  useEffect(() => {
    const controller = new AbortController()
    void billingApi
      .getPayments(1, HISTORY_SIZE, { signal: controller.signal })
      .then((page) => {
        if (!controller.signal.aborted) setHistory(page.items)
      })
      .catch(() => {
        // The history strip is context, not the point of the screen: a
        // failure leaves it empty instead of taking the page down.
        if (!controller.signal.aborted) setHistory([])
      })
    return () => controller.abort()
  }, [generation])

  const checkout = useOperation<MutationOutcome>(
    async () => {
      const scope = requireLatestMutation()
      if (!canStartWebCheckout(latestSnapshotRef.current?.subscription)) {
        throw new BillingManagementUnavailableError()
      }
      let checkoutUrl: string
      try {
        ;({ checkoutUrl } = await billingApi.subscribe(undefined, {
          signal: scope.signal,
        }))
      } catch (error) {
        if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
        throw error
      }
      if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
      window.location.assign(checkoutUrl)
      return 'applied'
    },
    // No success toast: a checkout leaves the app for the Mono pay page.
    {
      errorMessage: (error) =>
        subscriptionFailureMessage('checkout', error, locale),
    },
  )

  const cancelSubscription = useOperation<MutationOutcome>(
    async () => {
      cancelStageRef.current = 'cancel'
      const scope = requireLatestMutation()
      if (!hasMonoManagement(latestSnapshotRef.current?.subscription)) {
        throw new BillingManagementUnavailableError()
      }
      try {
        await billingApi.cancel(undefined, { signal: scope.signal })
      } catch (error) {
        if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
        throw error
      }
      if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
      cancelStageRef.current = 'refresh'
      let refreshed: SubscriptionDto
      try {
        refreshed = await billingApi.getSubscription({ signal: scope.signal })
      } catch (error) {
        if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
        throw error
      }
      if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
      setRefreshedSubscription({
        generation: scope.generation,
        value: refreshed,
      })
      return 'applied'
    },
    {
      errorMessage: (error) =>
        cancelStageRef.current === 'refresh'
          ? translate(subscriptionMessages, locale, 'cancelledButRefreshFailed')
          : subscriptionFailureMessage('cancel', error, locale),
      onSuccess: (outcome) => {
        setConfirmingCancel(false)
        if (outcome === 'applied') {
          toast.show({
            message: translate(subscriptionMessages, locale, 'cancelledToast'),
            tone: 'ok',
          })
        }
      },
    },
  )

  const resetCheckout = checkout.reset
  const resetCancel = cancelSubscription.reset
  useEffect(() => {
    // A failure describes one snapshot of access. When that snapshot is
    // replaced, so is the message.
    resetCheckout()
    resetCancel()
  }, [generation, resetCancel, resetCheckout])

  if (!subscription || !cabinet.targetTenant) return <EmptyBillingPanel />

  const goToPlans = () =>
    void navigate(cabinetPath(cabinet.targetTenant!.slug, 'plans'))

  return (
    <SubscriptionPanel
      busy={checkout.pending || cancelSubscription.pending}
      cancelError={cancelSubscription.error}
      cancelPending={cancelSubscription.pending}
      confirmingCancel={confirmingCancel}
      history={history}
      manageDecision={controlDecision}
      mutationError={
        confirmingCancel
          ? checkout.error
          : (checkout.error ?? cancelSubscription.error)
      }
      onCancelDismiss={() => setConfirmingCancel(false)}
      onCancelConfirm={cancelSubscription.run}
      onCancelRequest={() => setConfirmingCancel(true)}
      onSeePlans={goToPlans}
      onSubscribe={checkout.run}
      paymentsPath={cabinetPath(cabinet.targetTenant.slug, 'payments')}
      plansPath={cabinetPath(cabinet.targetTenant.slug, 'plans')}
      subscription={subscription}
    />
  )
}

function SubscriptionPanel({
  subscription,
  busy,
  cancelError,
  cancelPending,
  confirmingCancel,
  history,
  mutationError,
  manageDecision,
  onCancelConfirm,
  onCancelDismiss,
  onCancelRequest,
  onSeePlans,
  onSubscribe,
  paymentsPath,
  plansPath,
}: {
  subscription: NonNullable<TenantAccessSnapshot['subscription']>
  busy: boolean
  cancelError: string | null
  cancelPending: boolean
  confirmingCancel: boolean
  /** The newest few payments, straight from `GET /billing/payments`. */
  history: PaymentDto[] | null
  mutationError: string | null
  manageDecision: ReturnType<typeof useBillingMutation>['controlDecision']
  onCancelConfirm: () => void
  onCancelDismiss: () => void
  onCancelRequest: () => void
  onSeePlans: () => void
  onSubscribe: () => void
  paymentsPath: string
  plansPath: string
}) {
  const { locale } = useLocale()
  const t = useT(subscriptionMessages)
  const tb = useT(billingMessages)
  const accessEnded = subscription.state === 'blocked'
  const providerSubscription = subscription as ProviderAwareSubscriptionDto
  const management = resolveProviderManagement(providerSubscription)
  const contractManaged = isContractManagedSubscription(providerSubscription)
  const state = stateMeta[subscription.state]
  const stateLabel = t(state.message)
  const planLabel = accessEnded
    ? t('accessClosed')
    : subscription.state === 'trial'
      ? (subscription.planName ?? t('trialAccess'))
      : (subscription.planName ?? t('noPlan'))
  const canReactivate =
    subscription.canReactivate && subscription.state !== 'blocked'
  const isMono = management.kind === 'mono'
  const canCheckout =
    canStartWebCheckout(subscription) &&
    (subscription.canSubscribe ||
      canReactivate ||
      (subscription.canReactivate && !isMono))
  const nextChargeAt =
    subscription.nextChargeAt ?? subscription.currentPeriodEnd
  const daysLeft =
    subscription.state === 'trial'
      ? subscription.trialDaysRemaining
      : daysUntil(nextChargeAt)
  const limits = limitLabels(locale).map((limit) => ({
    label: limit.label,
    data: subscription.usage[limit.key],
  }))
  const overLimits = limits.filter(
    (item) => item.data.max != null && item.data.used >= item.data.max,
  )
  const features = subscription.features

  return (
    <BillingShell
      actions={
        <>
          <Button asChild>
            <Link to={paymentsPath}>{t('payments')}</Link>
          </Button>
          {canCheckout && (
            <BillingMutationGate decision={manageDecision}>
              <Button
                aria-busy={busy}
                className="px-5 text-sm font-bold"
                disabled={busy}
                onClick={onSubscribe}
                variant="primary"
              >
                {accessEnded
                  ? t('subscribe')
                  : canReactivate
                    ? t('reactivate')
                    : t('renew')}
              </Button>
            </BillingMutationGate>
          )}
        </>
      }
      crumb={t('crumb')}
      lead={t('lead')}
      title={t('title')}
    >
      {mutationError === null ? null : (
        <Notice tone="danger">{mutationError}</Notice>
      )}
      {management.kind === 'provider' && (
        <Notice tone="info">
          {t('managedByProvider', { provider: management.label })}{' '}
          <a
            className="text-brand underline underline-offset-4"
            href={management.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('manageIn', { provider: management.label })}
          </a>
        </Notice>
      )}
      {contractManaged && <BillingContractNotice />}
      {management.kind === 'unavailable' &&
        !canCheckout &&
        !contractManaged && <BillingUnavailableNotice />}

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[20px] border px-5.5 py-4.5',
          state.tone === 'danger'
            ? 'border-state-danger/35 bg-state-danger/10'
            : state.tone === 'warn'
              ? 'border-state-warn/35 bg-state-warn/10'
              : 'border-app-line bg-app-raised',
        )}
      >
        <div className="min-w-0 flex-[1_1_320px]">
          <p className="flex flex-wrap items-center gap-2.5">
            <StatusPill tone={state.tone}>{stateLabel}</StatusPill>
            <span className="text-app-ink text-[15px] font-bold">
              {daysLeft === null
                ? t('noNextChargeDate')
                : daysLeft >= 0
                  ? t('daysToCharge', { days: daysText(daysLeft, locale) })
                  : t('overdueBy', { days: daysText(-daysLeft, locale) })}
            </span>
          </p>
          <p className="text-app-muted mt-2 text-[13.5px] leading-5 text-pretty">
            {nextChargeAt === null ? (
              t('noNextChargeYet')
            ) : (
              <>
                {t('nextCharge')}{' '}
                <DateValue value={nextChargeAt} withTime={false} />
                {typeof subscription.amount === 'number' && (
                  <>
                    {' — '}
                    <Amount
                      currency={subscription.currency}
                      value={subscription.amount}
                    />
                  </>
                )}
                .{' '}
              </>
            )}
            {subscription.cardLast4 ? (
              <>
                {t('card', {
                  brand: (subscription.cardBrand ?? 'Card').toUpperCase(),
                })}{' '}
                {subscription.cardLast4}.{' '}
                <span title={t('noCardExpiry')}>{t('expiryHidden')}</span>
              </>
            ) : (
              t('noCardLinked')
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <BillingDead title={t('noCardManagement')}>
            {t('changeCard')}
          </BillingDead>
          {canCheckout && (
            <BillingMutationGate decision={manageDecision}>
              <Button
                aria-busy={busy}
                disabled={busy}
                onClick={onSubscribe}
                variant="primary"
              >
                {t('payNow')}
              </Button>
            </BillingMutationGate>
          )}
        </div>
      </div>

      <KpiStrip>
        <Kpi
          label={
            subscription.state === 'trial'
              ? t('kpiTrialDays')
              : t('kpiDaysToCharge')
          }
          meta={
            nextChargeAt === null
              ? t('kpiNoChargeDate')
              : t('kpiUntilNextCharge')
          }
          tone={daysLeft !== null && daysLeft < 0 ? 'warn' : 'plain'}
          value={daysLeft === null ? '—' : String(daysLeft)}
        />
        <Kpi
          label={t('kpiPeriodPrice')}
          meta={planLabel}
          value={
            typeof subscription.amount === 'number' ? (
              <Amount
                currency={subscription.currency}
                value={subscription.amount}
              />
            ) : (
              '—'
            )
          }
        />
        <Kpi
          label={t('kpiLimitsReached')}
          meta={
            overLimits.length === 0
              ? t('kpiLimitsOk')
              : overLimits.map((item) => item.label).join(', ')
          }
          tone={overLimits.length === 0 ? 'plain' : 'warn'}
          value={String(overLimits.length)}
        />
      </KpiStrip>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BillingCard>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {t('currentPlan')}
              </p>
              <h2 className="text-app-ink mt-2 text-[24px] leading-tight font-extrabold tracking-[-0.02em]">
                {planLabel}
              </h2>
            </div>
            <p className="text-right">
              <span className="text-app-ink text-[24px] leading-tight font-extrabold tracking-[-0.02em]">
                {typeof subscription.amount === 'number' ? (
                  <Amount
                    currency={subscription.currency}
                    value={subscription.amount}
                  />
                ) : (
                  '—'
                )}
              </span>
              <span className="text-app-dim mt-1 block text-[12.5px]">
                {t('perPeriod')}
              </span>
            </p>
          </div>
          <ul className="mt-4 grid gap-2">
            {features.length === 0 ? (
              <li className="text-app-dim text-[13.5px]">{t('noFeatures')}</li>
            ) : (
              features.map((code) => (
                <li
                  className="text-app-muted flex items-start gap-2.5 text-[13.5px]"
                  key={code}
                >
                  <Check
                    aria-hidden
                    className="text-state-ok mt-0.5 size-4 shrink-0"
                  />
                  {featureLabel(code, locale)}
                </li>
              ))
            )}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild>
              <Link to={plansPath}>{t('allPlans')}</Link>
            </Button>
            {isMono && subscription.canCancel && (
              <BillingMutationGate decision={manageDecision}>
                <Button
                  disabled={busy}
                  onClick={onCancelRequest}
                  variant="danger"
                >
                  {t('cancelSubscription')}
                </Button>
              </BillingMutationGate>
            )}
          </div>
          <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
            {t('noCycleDiscount')}
          </p>
        </BillingCard>

        <BillingCard title={t('planLimits')}>
          {overLimits.length > 0 && (
            <Notice
              action={
                <Button onClick={onSeePlans} variant="primary">
                  {t('upgrade')}
                </Button>
              }
              tone="warn"
            >
              {t('limitReached', {
                limits: overLimits
                  .map(
                    (item) =>
                      `${item.label} ${String(item.data.used)}/${item.data.max == null ? '∞' : String(item.data.max)}`,
                  )
                  .join(', '),
              })}
            </Notice>
          )}
          <ul className="grid gap-3" role="list">
            {limits.map((item) => {
              const max = item.data.max
              const over = max != null && item.data.used > max
              const ratio =
                max == null
                  ? 1
                  : max === 0
                    ? 0
                    : Math.min(item.data.used / max, 1)
              return (
                <li key={item.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-app-muted text-[13.5px]">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[13px] tabular-nums',
                        over ? 'text-state-warn' : 'text-app-ink',
                      )}
                    >
                      {item.data.used} / {max ?? '∞'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn(
                        'h-full transition-all duration-500',
                        max == null
                          ? 'bg-brand/40'
                          : ratio >= 1
                            ? 'bg-state-danger'
                            : ratio >= 0.8
                              ? 'bg-state-warn'
                              : 'bg-brand',
                      )}
                      style={{ width: `${String(ratio * 100)}%` }}
                    />
                  </div>
                  <p className="text-app-dim mt-1 text-[12px]">
                    {max == null
                      ? t('unlimited')
                      : t('remaining', {
                          count: Math.max(max - item.data.used, 0),
                        })}
                  </p>
                </li>
              )
            })}
          </ul>
        </BillingCard>
      </div>

      <BillingCard
        aside={
          <Link
            className="text-brand text-[13px] font-bold underline-offset-4 hover:underline"
            to={paymentsPath}
          >
            {t('allPayments')}
          </Link>
        }
        title={t('history')}
      >
        {history === null ? (
          <p className="text-app-dim text-[13.5px]">{tb('loadingPayments')}</p>
        ) : history.length === 0 ? (
          <p className="text-app-muted text-[13.5px]">{tb('noPayments')}</p>
        ) : (
          <ul className="grid gap-2.5">
            {history.map((payment) => {
              const status = paymentStatusMeta(payment.status, locale)
              return (
                <li
                  className="border-app-line flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] border px-4 py-3.5"
                  key={payment.id}
                >
                  <span className="text-app-dim font-mono text-[13px] whitespace-nowrap">
                    <DateValue value={payment.createdAt} withTime={false} />
                  </span>
                  <span className="min-w-0 flex-[1_1_180px]">
                    <span className="text-app-ink block font-medium">
                      {paymentTypeLabel(payment.type, locale)}
                    </span>
                    <span className="text-app-dim block text-[12.5px]">
                      {payment.providerInvoiceId ?? tb('noInvoiceNumber')}
                    </span>
                  </span>
                  <span className="text-app-ink ml-auto font-mono tabular-nums">
                    <Amount
                      currency={payment.currency}
                      value={payment.amount}
                    />
                  </span>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
          {t('noRetentionPolicy')}
        </p>
      </BillingCard>

      <ConfirmDialog
        cancelLabel={t('keepSubscription')}
        confirmLabel={t('confirmCancel')}
        consequence={t('cancelConsequence')}
        error={cancelError}
        onConfirm={onCancelConfirm}
        onOpenChange={(open) => {
          if (!open) onCancelDismiss()
        }}
        open={confirmingCancel}
        pending={cancelPending}
        title={t('cancelTitle')}
      />
    </BillingShell>
  )
}

const stateMeta: Record<
  BillingState,
  {
    message: keyof (typeof subscriptionMessages)['uk']
    tone: StatusTone
  }
> = {
  none: { message: 'stateNone', tone: 'neutral' },
  trial: { message: 'stateTrial', tone: 'info' },
  active: { message: 'stateActive', tone: 'ok' },
  pastDue: { message: 'statePastDue', tone: 'warn' },
  cancelled: { message: 'stateCancelled', tone: 'neutral' },
  blocked: { message: 'stateBlocked', tone: 'danger' },
}

function hasMonoManagement(subscription: unknown) {
  return (
    subscription !== null &&
    subscription !== undefined &&
    resolveProviderManagement(
      subscription as Pick<
        ProviderAwareSubscriptionDto,
        'source' | 'manageVia'
      >,
    ).kind === 'mono'
  )
}

function subscriptionFailureMessage(
  mutation: SubscriptionMutation,
  error: unknown,
  locale: Locale,
): string {
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
    return mutation === 'cancel'
      ? translate(subscriptionMessages, locale, 'cancelNetwork')
      : translate(billingMessages, locale, 'checkoutNetwork')
  }
  return mutation === 'cancel'
    ? translate(subscriptionMessages, locale, 'cancelFailed')
    : translate(billingMessages, locale, 'checkoutFailed')
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
