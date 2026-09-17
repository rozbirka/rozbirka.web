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
  resolveProviderManagement,
  type ProviderAwareSubscriptionDto,
} from '@/api/billing'
import { normalizeApiProblem } from '@/api/errors'
import type { PagedResult, PaymentDto, SubscriptionDto } from '@/api/types'
import { ModuleAccessDeniedError } from '../policy'
import { tenantRequestScope } from '../tenant-request-scope'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { BillingCard, BillingDead, BillingShell } from './billing-shell'
import { paymentStatusMeta, paymentTypeLabel } from './billing-vocabulary'
import {
  BILLING_MANAGEMENT_UNAVAILABLE,
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
      message: string
    }

/** A result that arrived for a tenant we have already left changes nothing. */
type MutationOutcome = 'applied' | 'stale'

const PAYMENT_SEGMENTS = [
  { key: 'all', label: 'Усі' },
  { key: 'success', label: 'Оплачені' },
  { key: 'pending', label: 'Очікують' },
  { key: 'failed', label: 'Невдалі' },
] as const

/** What the billing endpoints do not carry, said where the design asks for it. */
const NO_RECEIPT_FILE =
  'Файлу чи посилання на чек сервер не віддає — у платежі є лише номер рахунку провайдера.'
const NO_STATUS_FILTER =
  'Сервер не фільтрує платежі за статусом: сегменти впорядковують завантажену сторінку, і лічильники рахують її ж.'
const NO_CARD_LIST =
  'Кількох карток білінг не тримає: у підписці є одна — бренд і чотири цифри. Ні додати другу, ні зробити основною, ні видалити через API не можна.'
const NO_PAYMENTS_EXPORT =
  'Вивантаження платежів у файл сервер не робить — є тільки сторінковий перелік.'
const NO_INVOICE_DETAILS =
  'Реквізитів для чеків — назви платника, коду й адреси — у білінгу немає, і змінювати їх нема де. Чеки формує Mono за даними картки.'

type PaymentSubscription = Readonly<
  Pick<SubscriptionDto, 'cardBrand' | 'cardLast4'>
> &
  Partial<Pick<ProviderAwareSubscriptionDto, 'source' | 'manageVia'>>

export function PaymentsScreen() {
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
    message: string
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
          message: paymentsFailureMessage(error),
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
        !hasMonoManagement(latestSnapshotRef.current?.subscription)
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
          ? 'Платіж скасовано, але не вдалося оновити список. Оновіть сторінку, щоб побачити актуальні платежі.'
          : paymentCancellationFailureMessage(error),
      onSuccess: (outcome) => {
        setCancellingId(null)
        if (outcome === 'applied') {
          toast.show({ message: 'Платіж скасовано.', tone: 'ok' })
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
        hasMonoManagement(cabinet.snapshot?.subscription ?? null) &&
        item.status === 'pending',
    )
  const canManageMonoPayments = hasMonoManagement(
    cabinet.snapshot?.subscription ?? null,
  )
  const mutationError =
    (guardError !== null && guardError.generation === generation
      ? guardError.message
      : null) ?? cancelPayment.error

  if (currentPaymentsState.kind === 'loading') {
    return (
      <PaymentsFrame>
        {paymentMethod}
        <SkeletonRows columns={4} label="Завантажуємо платежі…" rows={3} />
      </PaymentsFrame>
    )
  }

  if (currentPaymentsState.kind === 'error') {
    return (
      <PaymentsFrame>
        {paymentMethod}
        <ErrorState
          description={currentPaymentsState.message}
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
          title="Платежі не завантажилися"
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
  const guardCheckout = (event: { preventDefault: () => void }) => {
    try {
      requireLatestMutation()
      if (!hasMonoManagement(latestSnapshotRef.current?.subscription)) {
        event.preventDefault()
        resetCancel()
        setGuardError({ generation, message: BILLING_MANAGEMENT_UNAVAILABLE })
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
          label="Платежів усього"
          meta={
            total === items.length
              ? 'усі, що повернув сервер'
              : `показано ${String(items.length)} найновіших`
          }
          value={String(total)}
        />
        <Kpi
          label="Сплачено на сторінці"
          meta={
            mixedCurrency
              ? 'на сторінці кілька валют — сума не складається'
              : 'сума успішних платежів цієї сторінки'
          }
          value={
            mixedCurrency || paidCurrency === undefined ? (
              '—'
            ) : (
              <Amount currency={paidCurrency} value={paid} />
            )
          }
        />
        <Kpi
          label="Очікують оплати"
          meta={
            counts.pending === 0
              ? 'незавершених рахунків немає'
              : 'рахунок можна доплатити або скасувати'
          }
          tone={counts.pending === 0 ? 'plain' : 'warn'}
          value={String(counts.pending)}
        />
      </KpiStrip>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
        <PaymentMethod subscription={cabinet.snapshot?.subscription ?? null} />
        <BillingCard title="Реквізити для чеків">
          <p className="text-app-muted text-[13.5px] leading-5 text-pretty">
            {NO_INVOICE_DETAILS}
          </p>
          <div className="mt-3.5">
            <BillingDead title={NO_INVOICE_DETAILS}>
              Змінити реквізити
            </BillingDead>
          </div>
        </BillingCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div
          aria-label="Статус платежу"
          className="border-app-line bg-app-raised flex min-w-0 flex-wrap gap-1 rounded-[14px] border p-1"
          role="group"
          title={NO_STATUS_FILTER}
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
              {one.label}
              <span className="text-app-dim font-mono text-[12px]">
                {counts[one.key]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-app-dim text-[13px]">
          Показано {shown.length} з {items.length} на цій сторінці
        </p>
      </div>

      <section
        aria-label="Історія платежів"
        className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
      >
        {shown.length === 0 ? (
          <p className="text-app-muted px-5.5 py-8 text-[14px]">
            {items.length === 0
              ? 'Платежів ще не було.'
              : 'Платежів за цим фільтром на цій сторінці немає.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">Історія платежів</caption>
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">Дата</th>
                  <th className="px-3 py-2.5 text-left">Опис</th>
                  <th className="px-3 py-2.5 text-right">Сума</th>
                  <th className="px-3 py-2.5 text-left">Статус</th>
                  <th className="px-3 py-2.5 text-left" title={NO_RECEIPT_FILE}>
                    Чек
                  </th>
                  {actionable && (
                    <th className="relative px-5.5 py-2.5 text-right">
                      <span className="sr-only">Дії</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const status = paymentStatusMeta[item.status]
                  return (
                    <tr className="border-app-line border-b" key={item.id}>
                      <td className="text-app-dim px-5.5 py-3.5 font-mono text-[13px] whitespace-nowrap">
                        <DateValue value={item.createdAt} withTime={false} />
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-app-ink block font-medium">
                          {paymentTypeLabel(item.type)}
                        </span>
                        <span className="text-app-dim mt-0.5 block text-[12.5px]">
                          {item.providerInvoiceId ??
                            'номер рахунку не повернувся'}
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
                          title={NO_RECEIPT_FILE}
                        >
                          —
                        </span>
                      </td>
                      {actionable && (
                        <td className="px-5.5 py-3.5">
                          {canManageMonoPayments &&
                          item.status === 'pending' ? (
                            <span className="flex min-w-0 flex-wrap justify-end gap-2">
                              {item.checkoutUrl && (
                                <BillingMutationGate decision={controlDecision}>
                                  <Button asChild variant="ghost">
                                    <a
                                      href={item.checkoutUrl}
                                      onClick={guardCheckout}
                                      rel="noopener noreferrer"
                                      target="_blank"
                                    >
                                      Продовжити оплату
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
                                  Скасувати
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
          {NO_RECEIPT_FILE} {NO_STATUS_FILTER}
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
  return (
    <BillingShell
      actions={actions}
      crumb="Налаштування · Підписка · Платежі"
      lead="Оплати за підписку, їх стан і спосіб оплати."
      title="Платежі"
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

function paymentsFailureMessage(error: unknown): string {
  const problem = normalizeApiProblem(error)
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return 'Не вдалося завантажити платежі: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.'
  }
  if (problem.kind === 'forbidden') {
    return 'У вас немає доступу до платежів цієї розбірки. Попросіть власника надати доступ до білінгу.'
  }
  return 'Не вдалося завантажити платежі. Спробуйте ще раз.'
}

function paymentCancellationFailureMessage(error: unknown): string {
  if (error instanceof BillingManagementUnavailableError) {
    return BILLING_MANAGEMENT_UNAVAILABLE
  }
  if (error instanceof ModuleAccessDeniedError) {
    return 'Дія більше недоступна: права або стан підписки змінилися. Оновіть сторінку.'
  }
  const problem = normalizeApiProblem(error)
  if (problem.kind === 'forbidden') {
    return 'У вас більше немає права скасувати цей платіж. Попросіть власника розбірки надати доступ до білінгу.'
  }
  if (problem.kind === 'conflict') {
    return 'Статус платежу вже змінився. Оновіть список платежів.'
  }
  if (problem.kind === 'network' || problem.kind === 'timeout') {
    return 'Не вдалося скасувати платіж: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.'
  }
  return 'Не вдалося скасувати платіж. Спробуйте ще раз.'
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

  return (
    <BillingCard title="Спосіб оплати">
      {management.kind === 'provider' ? (
        <p className="text-app-muted text-sm">
          Спосіб оплати керується {management.label}. Змініть картку в
          налаштуваннях магазину.
        </p>
      ) : management.kind === 'unavailable' ? (
        <p className="text-app-muted text-sm">
          Інформація про спосіб оплати наразі недоступна. Оновіть сторінку.
        </p>
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
              Авторизована для регулярних списань
            </span>
          </span>
        </div>
      ) : (
        <p className="text-app-muted text-sm">
          Картка ще не привʼязана. Активуйте підписку — і карту запитає Monobank
          під час оплати.
        </p>
      )}
      <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
        {NO_CARD_LIST}
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <BillingDead title={NO_CARD_LIST}>Додати спосіб оплати</BillingDead>
        <BillingDead title={NO_PAYMENTS_EXPORT}>Експорт CSV</BillingDead>
      </div>
    </BillingCard>
  )
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
