import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BadgeDollarSign, Check, ReceiptText } from 'lucide-react'
import {
  Amount,
  Button,
  ConfirmDialog,
  DataTable,
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
import { PaymentHistorySkeleton } from '../overview-skeletons'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { BillingCard, BillingShell, RecordColumns } from './billing-shell'
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
import { paymentsMessages } from './payments-messages'
import { plansMessages } from './plans-messages'
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

  if (!subscription || !cabinet.targetTenant)
    return (
      <BillingShell
        crumb={translate(subscriptionMessages, locale, 'crumb')}
        title={translate(subscriptionMessages, locale, 'title')}
      >
        <EmptyBillingPanel />
      </BillingShell>
    )

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
  const tp = useT(paymentsMessages)
  const tplans = useT(plansMessages)
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

  const summary = (
    <>
      <div className="grid min-w-0 flex-[1_1_320px] gap-1">
        <p className="rz-h-title m-0">
          {daysLeft === null
            ? t('noNextChargeDate')
            : daysLeft >= 0
              ? t('daysToCharge', { days: daysText(daysLeft, locale) })
              : t('overdueBy', { days: daysText(-daysLeft, locale) })}
        </p>
        <p className="rz-muted m-0 text-pretty">
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
              <span className="rz-mono">{subscription.cardLast4}</span>.{' '}
              <span title={t('noCardExpiry')}>{t('expiryHidden')}</span>
            </>
          ) : (
            t('noCardLinked')
          )}
        </p>
      </div>
      <div className="rz-btn-row">
        {canCheckout && (
          <BillingMutationGate decision={manageDecision}>
            <Button aria-busy={busy} disabled={busy} onClick={onSubscribe}>
              {t('payNow')}
            </Button>
          </BillingMutationGate>
        )}
      </div>
    </>
  )
  const alarming = state.tone === 'danger' || state.tone === 'warn'

  return (
    <BillingShell
      actions={
        <>
          <Button asChild>
            <Link to={plansPath}>
              <BadgeDollarSign aria-hidden />
              {tplans('title')}
            </Link>
          </Button>
          <Button asChild>
            <Link to={paymentsPath}>
              <ReceiptText aria-hidden />
              {t('payments')}
            </Link>
          </Button>
          {canCheckout && (
            <BillingMutationGate decision={manageDecision}>
              <Button
                aria-busy={busy}
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
      banner={
        alarming ? (
          <div
            className={cn(
              'rz-banner gap-y-2 py-2.5',
              state.tone === 'danger' ? 'rz-banner--danger' : 'rz-banner--warn',
            )}
          >
            {summary}
          </div>
        ) : undefined
      }
      chips={<StatusPill tone={state.tone}>{stateLabel}</StatusPill>}
      crumb={t('crumb')}
      title={t('title')}
    >
      {mutationError === null ? null : (
        <Notice tone="danger">{mutationError}</Notice>
      )}
      {management.kind === 'provider' && (
        <Notice tone="info">
          {t('managedByProvider', { provider: management.label })}{' '}
          <a href={management.url} rel="noopener noreferrer" target="_blank">
            {t('manageIn', { provider: management.label })}
          </a>
        </Notice>
      )}
      {contractManaged && <BillingContractNotice />}
      {management.kind === 'unavailable' &&
        !canCheckout &&
        !contractManaged && <BillingUnavailableNotice />}

      <KpiStrip>
        <Kpi label={t('currentPlan')} meta={null} value={planLabel} />
        <Kpi
          label={
            subscription.state === 'trial' ? t('kpiTrialDays') : t('nextCharge')
          }
          meta={
            daysLeft === null
              ? t('kpiNoChargeDate')
              : daysLeft >= 0
                ? t('daysToCharge', { days: daysText(daysLeft, locale) })
                : t('overdueBy', { days: daysText(-daysLeft, locale) })
          }
          tone={daysLeft !== null && daysLeft < 0 ? 'warn' : 'plain'}
          value={
            subscription.state === 'trial' ? (
              daysLeft == null ? (
                '—'
              ) : (
                String(daysLeft)
              )
            ) : nextChargeAt === null ? (
              '—'
            ) : (
              <DateValue value={nextChargeAt} withTime={false} />
            )
          }
        />
        <Kpi
          label={t('kpiPeriodPrice')}
          meta={
            subscription.cardLast4 ? (
              <>
                {t('card', {
                  brand: (subscription.cardBrand ?? 'Card').toUpperCase(),
                })}{' '}
                <span className="rz-mono">{subscription.cardLast4}</span>
              </>
            ) : (
              t('noCardLinked')
            )
          }
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
      </KpiStrip>

      <RecordColumns
        aside={
          <section className="rz-card min-w-0">
            <header className="rz-card__head gap-y-1 py-2.5">
              <div className="grid min-w-0 gap-0.5">
                <p className="rz-eyebrow m-0">{t('currentPlan')}</p>
                <h2 className="rz-h-title">{planLabel}</h2>
              </div>
              <p className="m-0 grid justify-items-end gap-0.5">
                <span className="rz-mono rz-strong text-title font-semibold">
                  {typeof subscription.amount === 'number' ? (
                    <Amount
                      currency={subscription.currency}
                      value={subscription.amount}
                    />
                  ) : (
                    '—'
                  )}
                </span>
                <span className="rz-caption">{t('perPeriod')}</span>
              </p>
            </header>
            <div className="rz-card__body grid gap-3">
              <ul className="m-0 grid list-none gap-2 p-0">
                {features.length === 0 ? (
                  <li className="rz-dim">{t('noFeatures')}</li>
                ) : (
                  features.map((code) => (
                    <li className="flex items-start gap-2.5" key={code}>
                      <Check
                        aria-hidden
                        className="text-state-ok mt-0.5 size-3.5 shrink-0"
                      />
                      {featureLabel(code, locale)}
                    </li>
                  ))
                )}
              </ul>
              <p className="rz-caption m-0 text-pretty">
                {t('noCycleDiscount')}
              </p>
            </div>
            <div className="rz-card__foot flex-wrap">
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
          </section>
        }
        main={
          <>
            <BillingCard title={t('planLimits')}>
              {overLimits.length > 0 && (
                <Notice
                  action={
                    <Button onClick={onSeePlans} size="sm">
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
              <dl className="rz-facts px-0 py-0">
                {limits.map((item) => {
                  const max = item.data.max
                  const over = max != null && item.data.used > max
                  return (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>
                        <span className="flex items-baseline justify-between gap-3">
                          <span
                            className={cn(
                              'rz-mono',
                              over ? 'text-state-warn' : 'rz-strong',
                            )}
                          >
                            {item.data.used} / {max ?? '∞'}
                          </span>
                          <span className="rz-caption">
                            {max == null
                              ? t('unlimited')
                              : t('remaining', {
                                  count: Math.max(max - item.data.used, 0),
                                })}
                          </span>
                        </span>
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </BillingCard>

            <BillingCard
              aside={<Link to={paymentsPath}>{t('allPayments')}</Link>}
              bodyClassName={
                history !== null && history.length > 0 ? 'p-0' : ''
              }
              footer={t('noRetentionPolicy')}
              title={t('history')}
            >
              {history === null ? (
                <PaymentHistorySkeleton label={tb('loadingPayments')} />
              ) : history.length === 0 ? (
                <p className="rz-muted m-0">{tb('noPayments')}</p>
              ) : (
                <DataTable
                  caption={t('history')}
                  columns={[
                    {
                      key: 'date',
                      label: tp('columnDate'),
                      variant: 'primary',
                      cell: (payment) => (
                        <span className="font-mono">
                          <DateValue
                            value={payment.createdAt}
                            withTime={false}
                          />
                        </span>
                      ),
                    },
                    {
                      key: 'description',
                      label: tp('columnDescription'),
                      cell: (payment) => (
                        <span className="grid min-w-0">
                          <span className="rz-strong">
                            {paymentTypeLabel(payment.type, locale)}
                          </span>
                          <span className="rz-caption">
                            {payment.providerInvoiceId ?? tb('noInvoiceNumber')}
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: 'amount',
                      label: tp('columnAmount'),
                      align: 'end',
                      cell: (payment) => (
                        <Amount
                          currency={payment.currency}
                          value={payment.amount}
                        />
                      ),
                    },
                    {
                      key: 'status',
                      label: tp('columnStatus'),
                      cell: (payment) => {
                        const status = paymentStatusMeta(payment.status, locale)
                        return (
                          <StatusPill tone={status.tone}>
                            {status.label}
                          </StatusPill>
                        )
                      },
                    },
                  ]}
                  embedded
                  rowKey={(payment) => payment.id}
                  rows={history}
                />
              )}
            </BillingCard>
          </>
        }
      />

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
