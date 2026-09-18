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
import {
  dayWord,
  daysUntil,
  featureLabel,
  LIMIT_LABELS,
  paymentStatusMeta,
  paymentTypeLabel,
} from './billing-vocabulary'
import {
  BILLING_MANAGEMENT_UNAVAILABLE,
  BillingManagementUnavailableError,
  BillingMutationGate,
  BillingUnavailableNotice,
  EmptyBillingPanel,
  useBillingMutation,
} from './billing-layout'

type SubscriptionMutation = 'checkout' | 'cancel'

/** How many payments the overview shows before sending the reader to the ledger. */
const HISTORY_SIZE = 4

/** What the billing endpoints do not carry, said where the design asks for it. */
const NO_CARD_MANAGEMENT =
  'Замінити картку тут не можна: у кабінеті є оформлення, скасування й історія платежів.'
const NO_CARD_EXPIRY =
  'Строку дії картки кабінет не показує — лише бренд і останні чотири цифри.'
const NO_CYCLE_DISCOUNT =
  'Річних циклів зі знижкою тут не позначено: у тарифі є сума, валюта й період, і жодного відсотка економії. Що є — видно в «Усіх тарифах».'
const NO_RETENTION_POLICY =
  'Скільки днів дані живуть після скасування — питання до підтримки: у кабінеті цього строку немає.'

/** A result that arrived for a tenant we have already left changes nothing. */
type MutationOutcome = 'applied' | 'stale'

export function SubscriptionScreen() {
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
      if (!hasMonoManagement(latestSnapshotRef.current?.subscription)) {
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
    { errorMessage: (error) => subscriptionFailureMessage('checkout', error) },
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
          ? 'Підписку скасовано, але не вдалося оновити її стан. Оновіть сторінку, щоб побачити актуальний статус.'
          : subscriptionFailureMessage('cancel', error),
      onSuccess: (outcome) => {
        setConfirmingCancel(false)
        if (outcome === 'applied') {
          toast.show({
            message:
              'Підписку скасовано. Доступ діє до кінця сплаченого періоду.',
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
  const accessEnded = subscription.state === 'blocked'
  const providerSubscription = subscription as ProviderAwareSubscriptionDto
  const management = resolveProviderManagement(providerSubscription)
  const state = stateMeta[subscription.state]
  const planLabel = accessEnded
    ? 'Доступ закрито'
    : subscription.state === 'trial'
      ? (subscription.planName ?? 'Пробний доступ')
      : (subscription.planName ?? 'Без тарифу')
  const canReactivate =
    subscription.canReactivate && subscription.state !== 'blocked'
  const isMono = management.kind === 'mono'
  const nextChargeAt =
    subscription.nextChargeAt ?? subscription.currentPeriodEnd
  const daysLeft =
    subscription.state === 'trial'
      ? subscription.trialDaysRemaining
      : daysUntil(nextChargeAt)
  const limits = LIMIT_LABELS.map((limit) => ({
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
            <Link to={paymentsPath}>Платежі</Link>
          </Button>
          {isMono && (subscription.canSubscribe || canReactivate) && (
            <BillingMutationGate decision={manageDecision}>
              <Button
                aria-busy={busy}
                className="px-5 text-sm font-bold"
                disabled={busy}
                onClick={onSubscribe}
                variant="primary"
              >
                {accessEnded
                  ? 'Оформити підписку'
                  : canReactivate
                    ? 'Поновити підписку'
                    : 'Продовжити підписку'}
              </Button>
            </BillingMutationGate>
          )}
        </>
      }
      crumb="Налаштування · Підписка"
      lead="Поточний тариф, ліміти й дата продовження."
      title="Підписка"
    >
      {mutationError === null ? null : (
        <Notice tone="danger">{mutationError}</Notice>
      )}
      {management.kind === 'provider' && (
        <Notice tone="info">
          Цією підпискою керує {management.label}. Змінюйте або скасовуйте її
          там.{' '}
          <a
            className="text-brand underline underline-offset-4"
            href={management.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Керувати в {management.label}
          </a>
        </Notice>
      )}
      {management.kind === 'unavailable' && <BillingUnavailableNotice />}

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
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
            <span className="text-app-ink text-[15px] font-bold">
              {daysLeft === null
                ? 'Дати наступного списання немає'
                : daysLeft >= 0
                  ? `${String(daysLeft)} ${dayWord(daysLeft)} до списання`
                  : `Прострочено на ${String(-daysLeft)} ${dayWord(daysLeft)}`}
            </span>
          </p>
          <p className="text-app-muted mt-2 text-[13.5px] leading-5 text-pretty">
            {nextChargeAt === null ? (
              'Наступної дати списання поки немає.'
            ) : (
              <>
                Наступне списання{' '}
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
                Картка {(subscription.cardBrand ?? 'Card').toUpperCase()} ••••{' '}
                {subscription.cardLast4}.{' '}
                <span title={NO_CARD_EXPIRY}>Строку дії не показуємо.</span>
              </>
            ) : (
              'Картка ще не привʼязана.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <BillingDead title={NO_CARD_MANAGEMENT}>Змінити карту</BillingDead>
          {isMono && (subscription.canSubscribe || canReactivate) && (
            <BillingMutationGate decision={manageDecision}>
              <Button
                aria-busy={busy}
                disabled={busy}
                onClick={onSubscribe}
                variant="primary"
              >
                Оплатити зараз
              </Button>
            </BillingMutationGate>
          )}
        </div>
      </div>

      <KpiStrip>
        <Kpi
          label={
            subscription.state === 'trial'
              ? 'Днів пробного'
              : 'Днів до списання'
          }
          meta={
            nextChargeAt === null
              ? 'дати списання поки немає'
              : 'до наступного списання'
          }
          tone={daysLeft !== null && daysLeft < 0 ? 'warn' : 'plain'}
          value={daysLeft === null ? '—' : String(daysLeft)}
        />
        <Kpi
          label="Вартість періоду"
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
          label="Лімітів вичерпано"
          meta={
            overLimits.length === 0
              ? 'усі ліміти тарифу з запасом'
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
                Поточний тариф
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
                за період
              </span>
            </p>
          </div>
          <ul className="mt-4 grid gap-2">
            {features.length === 0 ? (
              <li className="text-app-dim text-[13.5px]">
                Перелік можливостей цього тарифу порожній.
              </li>
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
                  {featureLabel(code)}
                </li>
              ))
            )}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild>
              <Link to={plansPath}>Усі тарифи</Link>
            </Button>
            {isMono && subscription.canCancel && (
              <BillingMutationGate decision={manageDecision}>
                <Button
                  disabled={busy}
                  onClick={onCancelRequest}
                  variant="danger"
                >
                  Скасувати підписку
                </Button>
              </BillingMutationGate>
            )}
          </div>
          <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
            {NO_CYCLE_DISCOUNT}
          </p>
        </BillingCard>

        <BillingCard title="Ліміти тарифу">
          {overLimits.length > 0 && (
            <Notice
              action={
                <Button onClick={onSeePlans} variant="primary">
                  Підвищити тариф
                </Button>
              }
              tone="warn"
            >
              Ліміт вичерпано:{' '}
              {overLimits
                .map(
                  (item) =>
                    `${item.label} ${String(item.data.used)}/${item.data.max == null ? '∞' : String(item.data.max)}`,
                )
                .join(', ')}
              . Наявні дані лишаються на місці, але додавати нові не вийде.
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
                      ? 'без обмеження'
                      : `лишилось ${String(Math.max(max - item.data.used, 0))}`}
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
            Усі платежі
          </Link>
        }
        title="Історія підписки"
      >
        {history === null ? (
          <p className="text-app-dim text-[13.5px]">Завантажуємо платежі…</p>
        ) : history.length === 0 ? (
          <p className="text-app-muted text-[13.5px]">Платежів ще не було.</p>
        ) : (
          <ul className="grid gap-2.5">
            {history.map((payment) => {
              const status = paymentStatusMeta[payment.status]
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
                      {paymentTypeLabel(payment.type)}
                    </span>
                    <span className="text-app-dim block text-[12.5px]">
                      {payment.providerInvoiceId ??
                        'номер рахунку не повернувся'}
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
          {NO_RETENTION_POLICY}
        </p>
      </BillingCard>

      <ConfirmDialog
        cancelLabel="Залишити підписку"
        confirmLabel="Так, скасувати підписку"
        consequence="Списань більше не буде, доступ до кабінету діятиме до кінця сплаченого періоду, а далі закриється. Оформити підписку знову можна будь-коли."
        error={cancelError}
        onConfirm={onCancelConfirm}
        onOpenChange={(open) => {
          if (!open) onCancelDismiss()
        }}
        open={confirmingCancel}
        pending={cancelPending}
        title="Скасувати підписку?"
      />
    </BillingShell>
  )
}

const stateMeta: Record<BillingState, { label: string; tone: StatusTone }> = {
  none: { label: 'Початок', tone: 'neutral' },
  trial: { label: 'Пробний період', tone: 'info' },
  active: { label: 'Активна', tone: 'ok' },
  pastDue: { label: 'Прострочена', tone: 'warn' },
  cancelled: { label: 'Скасована', tone: 'neutral' },
  blocked: { label: 'Доступ закрито', tone: 'danger' },
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
): string {
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
    return mutation === 'cancel'
      ? 'Не вдалося скасувати підписку: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.'
      : 'Не вдалося розпочати оплату: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.'
  }
  return mutation === 'cancel'
    ? 'Не вдалося скасувати підписку. Спробуйте ще раз.'
    : 'Не вдалося розпочати оплату. Спробуйте ще раз.'
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
