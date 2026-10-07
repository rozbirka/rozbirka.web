import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Amount,
  Button,
  DateValue,
  ErrorState,
  Notice,
  SkeletonRows,
  StatusPill,
  useOperation,
  useToast,
} from '@/components/app'
import {
  billingApi,
  canStartWebCheckout,
  resolveProviderManagement,
  type ProviderAwareSubscriptionDto,
} from '@/api/billing'
import { normalizeApiProblem } from '@/api/errors'
import type { PagedResult, PaymentDto, SubscriptionDto } from '@/api/types'
import { ModuleAccessDeniedError } from '../policy'
import { tenantRequestScope } from '../tenant-request-scope'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { BillingCard, BillingDead, BillingShell } from './billing-shell'
import { commonMessages, translate, useLocale, useT, type Locale } from '@/i18n'
import { paymentStatusMeta, paymentTypeLabel } from './billing-vocabulary'
import { billingMessages } from './messages'
import { paymentsMessages } from './payments-messages'
import {
  billingManagementUnavailable,
  BillingManagementUnavailableError,
  BillingMutationGate,
  useBillingMutation,
} from './billing-layout'

type PaymentsState =
  | { kind: 'loading'; generation: number | undefined; attempt: number }
  | { kind: 'empty'; generation: number | undefined; attempt: number }
  | {
      kind: 'ready'
      generation: number | undefined
      attempt: number
      page: PagedResult<PaymentDto>
    }
  | {
      kind: 'error'
      generation: number | undefined
      attempt: number
      error: unknown
    }

/** A result that arrived for a tenant we have already left changes nothing. */
type MutationOutcome = 'applied' | 'stale'

const PAYMENT_SEGMENTS = [
  { key: 'all', message: 'segmentAll' },
  { key: 'success', message: 'segmentSuccess' },
  { key: 'pending', message: 'segmentPending' },
  { key: 'failed', message: 'segmentFailed' },
] as const

type PaymentSubscription = Readonly<
  Pick<SubscriptionDto, 'cardBrand' | 'cardLast4'>
> &
  Partial<Pick<ProviderAwareSubscriptionDto, 'source' | 'manageVia'>>

export function PaymentsScreen() {
  const { locale } = useLocale()
  const t = useT(paymentsMessages)
  const tb = useT(billingMessages)
  const tc = useT(commonMessages)
  const toast = useToast()
  const { cabinet, controlDecision, requireLatestMutation } =
    useBillingMutation('payments')
  const generation = cabinet.snapshot?.generation
  const [paymentsState, setPaymentsState] = useState<PaymentsState>({
    kind: 'loading',
    generation,
    attempt: 0,
  })
  const [guardError, setGuardError] = useState<{
    generation: number | undefined
    reason: 'expired' | 'unavailable'
  } | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [segment, setSegment] =
    useState<(typeof PAYMENT_SEGMENTS)[number]['key']>('all')
  const latestSnapshotRef = useRef(cabinet.snapshot)
  const paymentIdRef = useRef<string | null>(null)
  const cancelStageRef = useRef<'cancel' | 'reload'>('cancel')

  useEffect(() => {
    latestSnapshotRef.current = cabinet.snapshot
  }, [cabinet.snapshot])

  useEffect(() => {
    const signal = tenantRequestScope.signal
    let current = true
    void billingApi
      .getPayments(1, 10, { signal })
      .then((loaded) => {
        if (!current || signal.aborted) return
        setPaymentsState(paymentsStateFrom(loaded, generation, loadAttempt))
      })
      .catch((error: unknown) => {
        if (!current || signal.aborted) return
        setPaymentsState({
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

  const cancelPayment = useOperation<MutationOutcome>(
    async () => {
      cancelStageRef.current = 'cancel'
      const paymentId = paymentIdRef.current
      const scope = requireLatestMutation()
      if (
        paymentId === null ||
        !canStartWebCheckout(latestSnapshotRef.current?.subscription)
      ) {
        throw new BillingManagementUnavailableError()
      }
      try {
        await billingApi.cancelPayment(paymentId, { signal: scope.signal })
      } catch (error) {
        if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
        throw error
      }
      if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
      cancelStageRef.current = 'reload'
      let loaded: PagedResult<PaymentDto>
      try {
        loaded = await billingApi.getPayments(1, 10, { signal: scope.signal })
      } catch (error) {
        if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
        throw error
      }
      if (!isCurrentScope(scope, latestSnapshotRef.current)) return 'stale'
      setPaymentsState(paymentsStateFrom(loaded, generation, loadAttempt))
      return 'applied'
    },
    {
      errorMessage: (error) =>
        cancelStageRef.current === 'reload'
          ? translate(paymentsMessages, locale, 'cancelledButReloadFailed')
          : paymentCancellationFailureMessage(error, locale),
      onSuccess: (outcome) => {
        setCancellingId(null)
        if (outcome === 'applied') {
          toast.show({ message: t('cancelled'), tone: 'ok' })
        }
      },
      onError: () => setCancellingId(null),
    },
  )

  const resetCancel = cancelPayment.reset
  useEffect(() => {
    // A failure describes one snapshot of access. When that snapshot is
    // replaced, so is the message.
    resetCancel()
  }, [generation, resetCancel])

  const currentPaymentsState =
    paymentsState.generation === generation &&
    paymentsState.attempt === loadAttempt
      ? paymentsState
      : ({ kind: 'loading', generation, attempt: loadAttempt } as const)

  const paymentMethod = (
    <PaymentMethod subscription={cabinet.snapshot?.subscription ?? null} />
  )
  const actionable =
    currentPaymentsState.kind === 'ready' &&
    currentPaymentsState.page.items.some(
      (item) =>
        canStartWebCheckout(cabinet.snapshot?.subscription ?? null) &&
        item.status === 'pending',
    )
  const canManageMonoPayments = canStartWebCheckout(
    cabinet.snapshot?.subscription ?? null,
  )
  const mutationError =
    (guardError !== null && guardError.generation === generation
      ? guardError.reason === 'expired'
        ? t('checkoutExpired')
        : billingManagementUnavailable(locale)
      : null) ?? cancelPayment.error

  if (currentPaymentsState.kind === 'loading') {
    return (
      <PaymentsFrame>
        {paymentMethod}
        <SkeletonRows columns={4} label={tb('loadingPayments')} rows={3} />
      </PaymentsFrame>
    )
  }

  if (currentPaymentsState.kind === 'error') {
    return (
      <PaymentsFrame>
        {paymentMethod}
        <ErrorState
          description={paymentsFailureMessage(
            currentPaymentsState.error,
            locale,
          )}
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
          title={t('loadFailedTitle')}
        />
      </PaymentsFrame>
    )
  }

  const items =
    currentPaymentsState.kind === 'ready' ? currentPaymentsState.page.items : []
  const total =
    currentPaymentsState.kind === 'ready'
      ? currentPaymentsState.page.total
      : items.length
  const guardCheckout = (
    event: { preventDefault: () => void },
    payment: PaymentDto,
  ) => {
    if (!isCheckoutCurrent(payment)) {
      event.preventDefault()
      setGuardError({
        generation,
        reason: 'expired',
      })
      return
    }
    try {
      requireLatestMutation()
      if (!canStartWebCheckout(latestSnapshotRef.current?.subscription)) {
        event.preventDefault()
        resetCancel()
        setGuardError({ generation, reason: 'unavailable' })
      }
    } catch {
      event.preventDefault()
    }
  }
  const startCancel = (paymentId: string) => {
    setGuardError(null)
    setCancellingId(paymentId)
    paymentIdRef.current = paymentId
    cancelPayment.run()
  }
  const counts = {
    all: items.length,
    success: items.filter((item) => item.status === 'success').length,
    pending: items.filter((item) => item.status === 'pending').length,
    failed: items.filter(
      (item) => item.status === 'failed' || item.status === 'reversed',
    ).length,
  }
  const shown = items.filter((item) => {
    if (segment === 'all') return true
    if (segment === 'failed')
      return item.status === 'failed' || item.status === 'reversed'
    return item.status === segment
  })
  const paid = items
    .filter((item) => item.status === 'success')
    .reduce((sum, item) => sum + item.amount, 0)
  const paidCurrency = items.find((item) => item.status === 'success')?.currency
  const mixedCurrency =
    new Set(
      items.filter((item) => item.status === 'success').map((i) => i.currency),
    ).size > 1

  return (
    <PaymentsFrame>
      {mutationError === null ? null : (
        <Notice tone="danger">{mutationError}</Notice>
      )}

      <KpiStrip>
        <Kpi
          label={t('kpiTotal')}
          meta={
            total === items.length
              ? t('kpiTotalAll')
              : t('kpiTotalNewest', { count: items.length })
          }
          value={String(total)}
        />
        <Kpi
          label={t('kpiPaid')}
          meta={mixedCurrency ? t('kpiPaidMixed') : t('kpiPaidMeta')}
          value={
            mixedCurrency || paidCurrency === undefined ? (
              '—'
            ) : (
              <Amount currency={paidCurrency} value={paid} />
            )
          }
        />
        <Kpi
          label={t('kpiPending')}
          meta={
            counts.pending === 0 ? t('kpiPendingNone') : t('kpiPendingSome')
          }
          tone={counts.pending === 0 ? 'plain' : 'warn'}
          value={String(counts.pending)}
        />
      </KpiStrip>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
        <PaymentMethod subscription={cabinet.snapshot?.subscription ?? null} />
        <BillingCard title={t('invoiceDetails')}>
          <p className="text-app-muted text-[13.5px] leading-5 text-pretty">
            {t('noInvoiceDetails')}
          </p>
          <div className="mt-3.5">
            <BillingDead title={t('noInvoiceDetails')}>
              {t('changeInvoiceDetails')}
            </BillingDead>
          </div>
        </BillingCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div
          aria-label={t('paymentStatus')}
          className="border-app-line bg-app-raised flex min-w-0 flex-wrap gap-1 rounded-[14px] border p-1"
          role="group"
          title={t('noStatusFilter')}
        >
          {PAYMENT_SEGMENTS.map((one) => (
            <button
              aria-pressed={segment === one.key}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-bold whitespace-nowrap',
                segment === one.key
                  ? 'text-app-ink bg-white/[0.08]'
                  : 'text-app-muted hover:text-app-ink',
              )}
              key={one.key}
              onClick={() => setSegment(one.key)}
              type="button"
            >
              {t(one.message)}
              <span className="text-app-dim font-mono text-[12px]">
                {counts[one.key]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-app-dim text-[13px]">
          {t('shownOnPage', { shown: shown.length, total: items.length })}
        </p>
      </div>

      <section
        aria-label={t('history')}
        className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
      >
        {shown.length === 0 ? (
          <p className="text-app-muted px-5.5 py-8 text-[14px]">
            {items.length === 0 ? tb('noPayments') : t('noneForFilter')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{t('history')}</caption>
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">{t('columnDate')}</th>
                  <th className="px-3 py-2.5 text-left">
                    {t('columnDescription')}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {t('columnAmount')}
                  </th>
                  <th className="px-3 py-2.5 text-left">{t('columnStatus')}</th>
                  <th
                    className="px-3 py-2.5 text-left"
                    title={t('noReceiptFile')}
                  >
                    {t('columnReceipt')}
                  </th>
                  {actionable && (
                    <th className="relative px-5.5 py-2.5 text-right">
                      <span className="sr-only">{tc('actions')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const status = paymentStatusMeta(item.status, locale)
                  return (
                    <tr className="border-app-line border-b" key={item.id}>
                      <td className="text-app-dim px-5.5 py-3.5 font-mono text-[13px] whitespace-nowrap">
                        <DateValue value={item.createdAt} withTime={false} />
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-app-ink block font-medium">
                          {paymentTypeLabel(item.type, locale)}
                        </span>
                        <span className="text-app-dim mt-0.5 block text-[12.5px]">
                          {item.providerInvoiceId ?? tb('noInvoiceNumber')}
                        </span>
                      </td>
                      <td className="text-app-ink px-3 py-3.5 text-right font-mono tabular-nums">
                        <Amount currency={item.currency} value={item.amount} />
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusPill tone={status.tone}>
                          {status.label}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className="text-app-dim text-[13px]"
                          title={t('noReceiptFile')}
                        >
                          —
                        </span>
                      </td>
                      {actionable && (
                        <td className="px-5.5 py-3.5">
                          {canManageMonoPayments &&
                          item.status === 'pending' ? (
                            <span className="flex min-w-0 flex-wrap justify-end gap-2">
                              {item.checkoutUrl && isCheckoutCurrent(item) && (
                                <BillingMutationGate decision={controlDecision}>
                                  <Button asChild variant="ghost">
                                    <a
                                      href={item.checkoutUrl}
                                      onClick={(event) =>
                                        guardCheckout(event, item)
                                      }
                                      rel="noopener noreferrer"
                                      target="_blank"
                                    >
                                      {t('continuePayment')}
                                    </a>
                                  </Button>
                                </BillingMutationGate>
                              )}
                              <BillingMutationGate decision={controlDecision}>
                                <Button
                                  {...cancelPayment.triggerProps}
                                  aria-busy={cancellingId === item.id}
                                  onClick={() => startCancel(item.id)}
                                  variant="danger"
                                >
                                  {tc('cancel')}
                                </Button>
                              </BillingMutationGate>
                            </span>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-app-dim border-app-line border-t px-5.5 py-3.5 text-[13px] leading-5 text-pretty">
          {t('noReceiptFile')} {t('noStatusFilter')}
        </p>
      </section>
    </PaymentsFrame>
  )
}

function PaymentsFrame({
  actions,
  children,
}: {
  actions?: ReactNode
  children: ReactNode
}) {
  const t = useT(paymentsMessages)
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

function paymentsStateFrom(
  loaded: PagedResult<PaymentDto>,
  generation: number | undefined,
  attempt: number,
): PaymentsState {
  return loaded.items.length > 0
    ? { kind: 'ready', generation, attempt, page: loaded }
    : { kind: 'empty', generation, attempt }
}

function paymentsFailureMessage(error: unknown, locale: Locale): string {
  const problem = normalizeApiProblem(error)
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return translate(paymentsMessages, locale, 'loadNetwork')
  }
  if (problem.kind === 'forbidden') {
    return translate(paymentsMessages, locale, 'loadForbidden')
  }
  return translate(paymentsMessages, locale, 'loadFailed')
}

function paymentCancellationFailureMessage(
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
    return translate(paymentsMessages, locale, 'cancelForbidden')
  }
  if (problem.kind === 'conflict') {
    return translate(paymentsMessages, locale, 'cancelConflict')
  }
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return translate(paymentsMessages, locale, 'cancelNetwork')
  }
  return translate(paymentsMessages, locale, 'cancelFailed')
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

function PaymentMethod({
  subscription,
}: {
  subscription: PaymentSubscription | null
}) {
  const management = subscription
    ? resolveProviderManagement(
        subscription as unknown as Pick<
          ProviderAwareSubscriptionDto,
          'source' | 'manageVia'
        >,
      )
    : { kind: 'unavailable' as const }
  const hasCard = Boolean(subscription?.cardLast4)
  const t = useT(paymentsMessages)

  return (
    <BillingCard title={t('paymentMethod')}>
      {management.kind === 'provider' ? (
        <p className="text-app-muted text-sm">
          {t('methodByProvider', { provider: management.label })}
        </p>
      ) : management.kind === 'unavailable' ? (
        <p className="text-app-muted text-sm">{t('methodUnavailable')}</p>
      ) : hasCard ? (
        <div className="flex items-center gap-3">
          <span className="bg-brand/[0.12] text-brand grid size-11 shrink-0 place-items-center rounded-xl">
            <CreditCard aria-hidden className="size-5" />
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="text-sm font-medium tabular-nums text-white">
              {(subscription?.cardBrand ?? 'Card').toUpperCase()} ••••{' '}
              {subscription?.cardLast4}
            </span>
            <span className="text-app-dim text-[13.5px]">
              {t('cardAuthorised')}
            </span>
          </span>
        </div>
      ) : (
        <p className="text-app-muted text-sm">{t('noCard')}</p>
      )}
      <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
        {t('noCardList')}
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <BillingDead title={t('noCardList')}>
          {t('addPaymentMethod')}
        </BillingDead>
        <BillingDead title={t('noPaymentsExport')}>
          {t('exportCsv')}
        </BillingDead>
      </div>
    </BillingCard>
  )
}

function isCheckoutCurrent(payment: PaymentDto): boolean {
  return (
    payment.status === 'pending' &&
    (payment.checkoutExpiresAt === null ||
      Date.parse(payment.checkoutExpiresAt) > Date.now())
  )
}
