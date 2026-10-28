import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  BadgeDollarSign,
  CreditCard,
  ReceiptText,
  RefreshCw,
} from 'lucide-react'
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
import { evaluateModuleAccess, ModuleAccessDeniedError } from '../policy'
import { cabinetModules, type CabinetModuleKey } from '../module-registry'
import { subscriptionDesignMessages } from './subscription-design-messages'
import { failedRenewal, scheduledCharge } from './subscription-presentation'
import { PaymentHistorySkeleton } from '../overview-skeletons'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { BillingCard, BillingShell, RecordColumns } from './billing-shell'
import { translate, useFormat, useLocale, useT, type Locale } from '@/i18n'
import {
  daysText,
  daysUntil,
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
  const checkoutStageRef = useRef<'checkout' | 'cancel' | 'refresh'>('checkout')
  const [refreshedSubscription, setRefreshedSubscription] = useState<{
    generation: number
    value: NonNullable<typeof snapshotSubscription>
  } | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [historyState, setHistoryState] = useState<{
    generation: number | undefined
    items: PaymentDto[] | null
    failed: boolean
  } | null>(null)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const history =
    historyState !== null && historyState.generation === generation
      ? historyState.items
      : null
  const historyFailed =
    historyState !== null &&
    historyState.generation === generation &&
    historyState.failed
  const retryHistory = () => {
    setHistoryState(null)
    setHistoryAttempt((value) => value + 1)
  }
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
        if (!controller.signal.aborted)
          setHistoryState({ generation, items: page.items, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setHistoryState({ generation, items: null, failed: true })
      })
    return () => controller.abort()
  }, [generation, historyAttempt])

  const checkout = useOperation<MutationOutcome>(
    async () => {
      checkoutStageRef.current = 'checkout'
      const scope = requireLatestMutation()
      let current = subscription
      if (
        !canStartWebCheckout(latestSnapshotRef.current?.subscription) ||
        !canStartWebCheckout(current) ||
        hasUnexpiredCancelledMonoPeriod(current)
      ) {
        throw new BillingManagementUnavailableError()
      }
      let checkoutUrl: string
      try {
        if (canRecoverWithAnotherCard(current)) {
          const planCode = current?.planCode
          current = await billingApi.getSubscription({ signal: scope.signal })
          if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
          setRefreshedSubscription({
            generation: scope.generation,
            value: current,
          })
          if (!isExpiredMonoPeriod(current) || current.planCode !== planCode) {
            throw new BillingRecoveryChangedError()
          }
          if (current.canCancel) {
            checkoutStageRef.current = 'cancel'
            await billingApi.cancel(
              {
                recovery: {
                  planCode: current.planCode!,
                  currentPeriodEnd: current.currentPeriodEnd!,
                },
              },
              { signal: scope.signal },
            )
            if (!isCurrentScope(scope, latestSnapshotRef.current))
              return 'stale'
            checkoutStageRef.current = 'refresh'
            current = await billingApi.getSubscription({ signal: scope.signal })
            if (!isCurrentScope(scope, latestSnapshotRef.current))
              return 'stale'
            setRefreshedSubscription({
              generation: scope.generation,
              value: current,
            })
          }
          if (
            !isExpiredMonoPeriod(current) ||
            current.planCode !== planCode ||
            current.canCancel ||
            !current.canSubscribe
          ) {
            throw new BillingRecoveryChangedError()
          }
          checkoutStageRef.current = 'checkout'
        }
        const request =
          hasMonoManagement(current) &&
          current?.planCode &&
          current.planCode !== 'trial'
            ? { planCode: current.planCode }
            : undefined
        ;({ checkoutUrl } = await billingApi.subscribe(request, {
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
      errorMessage: (error) => {
        if (error instanceof BillingRecoveryChangedError) {
          return translate(billingMessages, locale, 'subscriptionChanged')
        }
        if (checkoutStageRef.current === 'refresh') {
          return translate(
            subscriptionMessages,
            locale,
            'cancelledButRefreshFailed',
          )
        }
        return subscriptionFailureMessage(
          checkoutStageRef.current === 'cancel' ? 'cancel' : 'checkout',
          error,
          locale,
        )
      },
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
      historyFailed={historyFailed}
      onHistoryRetry={retryHistory}
      snapshot={cabinet.snapshot!}
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

export function SubscriptionPanel({
  subscription,
  snapshot,
  busy,
  cancelError,
  cancelPending,
  confirmingCancel,
  history,
  historyFailed,
  onHistoryRetry,
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
  snapshot: TenantAccessSnapshot
  busy: boolean
  cancelError: string | null
  cancelPending: boolean
  confirmingCancel: boolean
  history: PaymentDto[] | null
  historyFailed: boolean
  onHistoryRetry: () => void
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
  const format = useFormat()
  const t = useT(subscriptionMessages)
  const td = useT(subscriptionDesignMessages)
  const tb = useT(billingMessages)
  const tp = useT(paymentsMessages)
  const tplans = useT(plansMessages)
  const accessEnded = subscription.state === 'blocked'
  const management = resolveProviderManagement(
    subscription as ProviderAwareSubscriptionDto,
  )
  const contractManaged = isContractManagedSubscription(
    subscription as ProviderAwareSubscriptionDto,
  )
  const state = stateMeta[subscription.state]
  const planLabel =
    subscription.planName ??
    (subscription.state === 'trial' ? t('trialAccess') : t('noPlan'))
  const isMono = management.kind === 'mono'
  const canRecover = canRecoverWithAnotherCard(subscription)
  const canReactivate = subscription.canReactivate && !accessEnded
  const canCheckout =
    canStartWebCheckout(subscription) &&
    !hasUnexpiredCancelledMonoPeriod(subscription) &&
    (canRecover ||
      subscription.canSubscribe ||
      canReactivate ||
      (subscription.canReactivate && !isMono))
  const renewalStopped = subscription.state === 'cancelled'
  const nextChargeAt = scheduledCharge(subscription)
  const failed = failedRenewal(subscription, history)
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
  const amount = failed?.amount ?? subscription.amount
  const currency = failed?.currency ?? subscription.currency
  const money = format.money(amount, currency)
  const card = subscription.cardLast4
    ? `${(subscription.cardBrand ?? 'Card').toUpperCase()} •••• ${subscription.cardLast4}`
    : null
  const knownPrice =
    !!subscription.planCode &&
    subscription.planCode !== 'trial' &&
    typeof subscription.amount === 'number' &&
    subscription.amount > 0
  const payMoney = format.money(subscription.amount, subscription.currency)
  const payLabel =
    accessEnded && knownPrice && payMoney
      ? td('payAmount', { amount: payMoney })
      : canRecover
        ? t('payWithAnotherCard')
        : canReactivate
          ? t('reactivate')
          : accessEnded
            ? t('subscribe')
            : t('renew')
  const pay = (primary = false) =>
    canCheckout ? (
      <BillingMutationGate decision={manageDecision}>
        <Button
          aria-busy={busy}
          disabled={busy}
          onClick={onSubscribe}
          variant={primary ? 'primary' : 'quiet'}
          className={primary ? undefined : 'text-brand'}
        >
          {primary && <RefreshCw aria-hidden />}
          {payLabel}
        </Button>
      </BillingMutationGate>
    ) : null
  const banner = accessEnded
    ? {
        title: failed
          ? td('failedTitle', { date: format.date(failed.createdAt) ?? '—' })
          : td('blockedTitle'),
        body: failed
          ? td('failedBody', {
              amount: money ?? '—',
              card: card ? td('fromCard', { card }) : '',
            })
          : td('blockedBody'),
      }
    : subscription.state === 'pastDue'
      ? { title: td('pastDueTitle'), body: td('pastDueBody') }
      : renewalStopped
        ? { title: td('cancelledTitle'), body: td('cancelledBody') }
        : subscription.state === 'none'
          ? { title: td('noneTitle'), body: td('noneBody') }
          : null
  const accessRows: { key: CabinetModuleKey; label: string }[] = accessEnded
    ? [
        { key: 'parts', label: td('stock') },
        { key: 'orders', label: td('orders') },
        { key: 'reports', label: td('reports') },
        { key: 'billing', label: td('billing') },
      ]
    : [
        { key: 'parts', label: td('stock') },
        { key: 'reports', label: td('reports') },
        { key: 'team', label: td('team') },
      ]
  const metrics = (
    <KpiStrip>
      <Kpi
        label={td('plan')}
        value={planLabel}
        meta={accessEnded ? td('paused') : null}
      />
      <Kpi
        label={
          failed
            ? td('notCharged')
            : renewalStopped
              ? t('accessUntil')
              : accessEnded
                ? td('periodEnd')
                : subscription.state === 'trial'
                  ? t('kpiTrialDays')
                  : t('nextCharge')
        }
        tone={failed ? 'warn' : 'plain'}
        value={
          failed ? (
            format.dateWith(failed.createdAt, {
              day: '2-digit',
              month: '2-digit',
            })
          ) : subscription.state === 'trial' ? (
            (subscription.trialDaysRemaining ?? '—')
          ) : (
            <DateValue
              value={
                renewalStopped || accessEnded
                  ? subscription.currentPeriodEnd
                  : nextChargeAt
              }
              withTime={false}
            />
          )
        }
        meta={
          failed
            ? td('attemptFailed')
            : renewalStopped
              ? t('renewalStopped')
              : accessEnded
                ? td('accessEnded')
                : daysLeft === null
                  ? t('kpiNoChargeDate')
                  : daysLeft >= 0
                    ? t('daysToCharge', { days: daysText(daysLeft, locale) })
                    : t('overdueBy', { days: daysText(-daysLeft, locale) })
        }
      />
      <Kpi
        label={failed ? td('amountDue') : t('kpiPeriodPrice')}
        value={
          amount === null ? '—' : <Amount currency={currency} value={amount} />
        }
        meta={card ?? t('noCardLinked')}
      />
    </KpiStrip>
  )
  const historyCard = (
    <BillingCard
      title={td('recentCharges')}
      aside={
        <Button asChild size="sm">
          <Link to={paymentsPath}>{t('allPayments')}</Link>
        </Button>
      }
      bodyClassName={history?.length ? 'p-0' : ''}
    >
      {historyFailed ? (
        <Notice
          tone="danger"
          action={
            <Button onClick={onHistoryRetry} size="sm">
              {td('retry')}
            </Button>
          }
        >
          {td('loadingHistoryFailed')}
        </Notice>
      ) : history === null ? (
        <PaymentHistorySkeleton label={tb('loadingPayments')} />
      ) : history.length === 0 ? (
        <p className="rz-muted m-0">{tb('noPayments')}</p>
      ) : (
        <DataTable
          caption={td('recentCharges')}
          embedded
          rowKey={(payment) => payment.id}
          rows={history}
          columns={[
            {
              key: 'date',
              label: tp('columnDate'),
              variant: 'primary',
              cell: (payment) => (
                <span className="font-mono">
                  <DateValue value={payment.createdAt} withTime={false} />
                </span>
              ),
            },
            {
              key: 'description',
              label: tp('columnDescription'),
              cell: (payment) => (
                <span className="rz-muted">
                  {paymentTypeLabel(payment.type, locale)}
                </span>
              ),
            },
            {
              key: 'amount',
              label: tp('columnAmount'),
              align: 'end',
              cell: (payment) => (
                <Amount currency={payment.currency} value={payment.amount} />
              ),
            },
            {
              key: 'status',
              label: tp('columnStatus'),
              cell: (payment) => {
                const meta = paymentStatusMeta(payment.status, locale)
                return (
                  <StatusPill tone={meta.tone}>
                    {payment.id === failed?.id ? td('notCharged') : meta.label}
                  </StatusPill>
                )
              },
            },
          ]}
        />
      )}
    </BillingCard>
  )
  return (
    <BillingShell
      crumb={t('crumb')}
      title={t('title')}
      chips={<StatusPill tone={state.tone}>{t(state.message)}</StatusPill>}
      actions={
        accessEnded ? (
          <>
            {canRecover && (
              <BillingMutationGate decision={manageDecision}>
                <Button
                  aria-label={t('payWithAnotherCard')}
                  title={td('chooseCardHint')}
                  disabled={busy}
                  onClick={onSubscribe}
                >
                  <CreditCard aria-hidden />
                  {td('changeCard')}
                </Button>
              </BillingMutationGate>
            )}
            {pay(true)}
          </>
        ) : (
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
            {pay(true)}
          </>
        )
      }
      banner={
        banner ? (
          <div
            className={cn(
              'rz-banner items-start gap-y-2 py-2.5',
              accessEnded || subscription.state === 'pastDue'
                ? 'rz-banner--warn'
                : 'rz-banner--info',
            )}
          >
            <StatusPill
              tone={
                accessEnded || subscription.state === 'pastDue'
                  ? 'warn'
                  : 'info'
              }
            >
              {t(state.message)}
            </StatusPill>
            <p className="m-0 min-w-0 flex-[1_1_320px] text-pretty">
              <strong className="text-app-strong">{banner.title}</strong>{' '}
              <span className="text-app-muted">{banner.body}</span>
            </p>
            {knownPrice &&
              (accessEnded || subscription.state === 'pastDue') &&
              pay()}
          </div>
        ) : undefined
      }
    >
      {mutationError !== null && <Notice tone="danger">{mutationError}</Notice>}
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
      <RecordColumns
        compactAside
        main={
          <>
            {metrics}
            {accessEnded ? (
              <>
                {historyCard}
                <BillingCard title={td('savedData')} bodyClassName="p-0">
                  <dl className="rz-facts">
                    {(['parts', 'cars', 'users', 'cashRegisters'] as const).map(
                      (key) => (
                        <div key={key}>
                          <dt>{td(key)}</dt>
                          <dd className="rz-mono">
                            {format.number(subscription.usage[key].used)}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </BillingCard>
              </>
            ) : (
              <BillingCard title={t('planLimits')}>
                {overLimits.length > 0 && (
                  <Notice
                    tone="warn"
                    action={
                      <Button onClick={onSeePlans} size="sm">
                        {t('upgrade')}
                      </Button>
                    }
                  >
                    {t('limitReached', {
                      limits: overLimits
                        .map(
                          (item) =>
                            `${item.label} ${item.data.used}/${item.data.max ?? '∞'}`,
                        )
                        .join(', '),
                    })}
                  </Notice>
                )}
                <dl className="rz-facts px-0 py-0">
                  {limits.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>
                        <span className="rz-mono rz-strong">
                          {format.number(item.data.used)} /{' '}
                          {item.data.max ?? '∞'}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </BillingCard>
            )}
          </>
        }
        aside={
          <>
            <BillingCard title={td('availableNow')} bodyClassName="p-0">
              <dl className="rz-facts">
                {accessRows.map((row) => {
                  const allowed =
                    evaluateModuleAccess(
                      cabinetModules[row.key],
                      { status: 'ready', snapshot, error: null },
                      'view',
                    ).kind === 'allowed'
                  return (
                    <div key={row.key}>
                      <dt>{row.label}</dt>
                      <dd>
                        {allowed
                          ? td('available')
                          : accessEnded
                            ? td('closed')
                            : td('denied')}
                      </dd>
                    </div>
                  )
                })}
              </dl>
              {(accessEnded || (isMono && subscription.canCancel)) && (
                <div className="border-app-line flex flex-wrap gap-2 border-t px-4 py-3">
                  {accessEnded && (
                    <Button asChild>
                      <Link to={plansPath}>{t('allPlans')}</Link>
                    </Button>
                  )}
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
              )}
            </BillingCard>
            {failed && (
              <BillingCard title={td('reasonTitle')}>
                <p className="rz-muted m-0 text-pretty">{td('reasonBody')}</p>
              </BillingCard>
            )}
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

class BillingRecoveryChangedError extends Error {}

type RecoverySubscription = Pick<
  SubscriptionDto,
  'state' | 'planCode' | 'currentPeriodEnd' | 'canCancel'
>

function isExpiredMonoPeriod(
  subscription: RecoverySubscription | null | undefined,
) {
  return (
    !!subscription &&
    hasMonoManagement(subscription) &&
    !!subscription.planCode &&
    subscription.planCode !== 'trial' &&
    Date.parse(subscription.currentPeriodEnd ?? '') <= Date.now()
  )
}

function canRecoverWithAnotherCard(
  subscription: RecoverySubscription | null | undefined,
) {
  return (
    isExpiredMonoPeriod(subscription) &&
    subscription?.canCancel === true &&
    (subscription.state === 'pastDue' || subscription.state === 'blocked')
  )
}

function hasUnexpiredCancelledMonoPeriod(
  subscription: RecoverySubscription | null | undefined,
) {
  return (
    subscription?.state === 'cancelled' &&
    hasMonoManagement(subscription) &&
    Date.parse(subscription.currentPeriodEnd ?? '') > Date.now()
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
  if (
    mutation === 'cancel' &&
    problem.code?.toLowerCase() === 'billing.cancellation_unconfirmed'
  ) {
    return translate(subscriptionMessages, locale, 'cancelUnconfirmed')
  }
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
