import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Amount,
  Button,
  DataTable,
  DateValue,
  ErrorState,
  Notice,
  SkeletonRows,
  StatusPill,
  useOperation,
  useToast,
  type DataColumn,
} from '@/components/app'
import {
  billingApi,
  canStartWebCheckout,
  resolveProviderManagement,
  type ProviderAwareSubscriptionDto,
} from '@/api/billing'
import { normalizeApiProblem } from '@/api/errors'
import type { PagedResult, PaymentDto } from '@/api/types'
import { ModuleAccessDeniedError } from '../policy'
import { tenantRequestScope } from '../tenant-request-scope'
import { BillingShell } from './billing-shell'
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

  const provider = cabinet.snapshot?.subscription
    ? resolveProviderManagement(
        cabinet.snapshot.subscription as ProviderAwareSubscriptionDto,
      )
    : { kind: 'unavailable' as const }
  const paymentMethod =
    provider.kind === 'provider' ? (
      <Notice tone="info">
        {t('methodByProvider', { provider: provider.label })}
      </Notice>
    ) : null
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
  const columns: DataColumn<PaymentDto>[] = [
    {
      key: 'date',
      label: t('columnDate'),
      variant: 'primary',
      cell: (item) => (
        <span className="font-mono">
          <DateValue value={item.createdAt} withTime={false} />
        </span>
      ),
    },
    {
      key: 'description',
      label: t('columnDescription'),
      cell: (item) => (
        <span className="grid min-w-0">
          <span className="rz-strong">
            {paymentTypeLabel(item.type, locale)}
          </span>
          <span className="rz-caption">
            {item.providerInvoiceId ?? tb('noInvoiceNumber')}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      label: t('columnStatus'),
      cell: (item) => {
        const status = paymentStatusMeta(item.status, locale)
        return <StatusPill tone={status.tone}>{status.label}</StatusPill>
      },
    },
    {
      key: 'amount',
      label: t('columnAmount'),
      align: 'end',
      cell: (item) => <Amount currency={item.currency} value={item.amount} />,
    },
    ...(actionable
      ? [
          {
            key: 'actions',
            label: tc('actions'),
            align: 'end' as const,
            headerHidden: true,
            cell: (item: PaymentDto) =>
              canManageMonoPayments && item.status === 'pending' ? (
                <span className="flex min-w-0 flex-wrap justify-end gap-2">
                  {item.checkoutUrl && isCheckoutCurrent(item) && (
                    <BillingMutationGate decision={controlDecision}>
                      <Button asChild size="sm">
                        <a
                          href={item.checkoutUrl}
                          onClick={(event) => guardCheckout(event, item)}
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
                      size="sm"
                      variant="danger"
                    >
                      {tc('cancel')}
                    </Button>
                  </BillingMutationGate>
                </span>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <PaymentsFrame>
      {mutationError === null ? null : (
        <Notice tone="danger">{mutationError}</Notice>
      )}

      {/* The ledger runs the full width, as the module page draws it; the
          card and receipt details sit under it. */}
      <section aria-label={t('history')} className="grid min-w-0 gap-3">
        <div className="rz-toolbar">
          <div
            aria-label={t('paymentStatus')}
            className="rz-seg flex-wrap"
            role="group"
            title={t('noStatusFilter')}
          >
            {PAYMENT_SEGMENTS.map((one) => (
              <button
                aria-pressed={segment === one.key}
                key={one.key}
                onClick={() => setSegment(one.key)}
                type="button"
              >
                {t(one.message)}
                <span className="rz-count">{counts[one.key]}</span>
              </button>
            ))}
          </div>
          <p className="rz-toolbar__end rz-dim m-0">
            {t('shownOnPage', { shown: shown.length, total: items.length })}
          </p>
        </div>

        <div className="rz-table-wrap">
          <div className="rz-card__head py-2.5">
            <h2 className="rz-h-card">{t('history')}</h2>
          </div>
          {shown.length === 0 ? (
            <p className="rz-muted m-0 px-[var(--rz-card-p)] py-8">
              {items.length === 0 ? tb('noPayments') : t('noneForFilter')}
            </p>
          ) : (
            <DataTable
              caption={t('history')}
              columns={columns}
              embedded
              rowKey={(item) => item.id}
              rows={shown}
            />
          )}
        </div>
      </section>
      {paymentMethod}
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
    <BillingShell actions={actions} crumb={t('crumb')} title={t('title')}>
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

function isCheckoutCurrent(payment: PaymentDto): boolean {
  return (
    payment.status === 'pending' &&
    (payment.checkoutExpiresAt === null ||
      Date.parse(payment.checkoutExpiresAt) > Date.now())
  )
}
