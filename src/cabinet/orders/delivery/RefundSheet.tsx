import { useEffect, useRef, useState } from 'react'
import {
  Button,
  ConfirmDialog,
  Field,
  Notice,
  SearchInput,
  SelectInput,
  Sheet,
  TextInput,
  TextArea,
} from '@/components/app'
import { cashApi, type CashRegister, type CashTransaction } from '@/api/cash'
import type {
  DeliveryOrder,
  DeliveryFullRefundInput,
  DeliveryRefundSource,
} from '@/api/delivery'
import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { SheetGroup } from '../sheet-group'
import { hryvnia, uah } from './delivery-money'
import { refundTotals } from './delivery-flow'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { SummaryList } from './WaybillCreateSheet'

type Method = 'create' | 'link'

const OUT_TYPES = new Set(['manual_out', 'refund_out'])

/** Expenses Core could take as this refund; others are not shown at all. */
const refundCandidates = (items: readonly CashTransaction[]) =>
  items.filter(
    (item) =>
      item.direction === 'out' &&
      item.currency === 'UAH' &&
      OUT_TYPES.has(item.type),
  )

const ambiguous = (problem: unknown) => {
  const kind = normalizeApiProblem(problem).kind
  return kind === 'network' || kind === 'timeout'
}

/**
 * «Повернути кошти» (10.7–10.11). Core settles all held payments at once,
 * retaining only explicitly confirmed actual delivery costs after goods return.
 * The net refund is a new or already booked expense of exactly that sum.
 * The sheet records the books only — the customer transfer is made elsewhere.
 */
export function RefundSheet({
  delivery,
  onClose,
  onCloseAutoFocus,
  onConfirm,
  orderId,
  orderNumber,
}: {
  delivery: DeliveryOrder
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onConfirm: (source: DeliveryFullRefundInput) => Promise<void>
  orderId: string
  orderNumber: number
}) {
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(deliveryFlowMessages)
  const tc = useT(commonMessages)
  const totals = refundTotals(delivery)
  const money = (value: number) => uah(value, locale)
  const [method, setMethod] = useState<Method>('create')
  const [tills, setTills] = useState<CashRegister[] | null>(null)
  const [tillId, setTillId] = useState<string | null>(null)
  const [retentionDraft, setRetentionDraft] = useState('0')
  const [retentionNote, setRetentionNote] = useState('')
  const retentionSupported =
    delivery.supportsDeliveryCostRetention ??
    Object.hasOwn(delivery, 'retainedDeliveryCostUah')
  const retentionAllowed =
    retentionSupported &&
    delivery.returnedAt !== null &&
    delivery.workflowState !== 'Cancelled'
  const retained = retentionAllowed
    ? hryvnia(retentionDraft, { allowZero: true })
    : 0
  const retentionError =
    retained === null || !Number.isFinite(retained) || retained > 9_999_999_999
      ? t('retentionInvalid')
      : retained > totals.due
        ? t('retentionOver', { amount: money(totals.due) })
        : null
  const noteRequired = retained !== null && retained > 0
  const retentionBlocked =
    retentionError !== null || (noteRequired && retentionNote.trim() === '')
  const netDue =
    retentionError === null && retained !== null
      ? Math.round((totals.due - retained) * 100) / 100
      : totals.due
  const noRefund = netDue === 0
  const retentionInput =
    retained !== null && retained > 0
      ? {
          retainedDeliveryCostUah: retained,
          retentionNote: retentionNote.trim(),
        }
      : {}

  const [operations, setOperations] = useState<{
    tillId: string
    items: CashTransaction[]
  } | null>(null)
  const [operationsFailed, setOperationsFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [operationId, setOperationId] = useState<string | null>(null)
  const [taken, setTaken] = useState<ReadonlySet<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const submitRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void cashApi.list(true, { signal: controller.signal }).then(
      (list) => {
        if (controller.signal.aborted) return
        setTills(list)
        setTillId((current) => current ?? list[0]?.id ?? null)
      },
      () => {
        if (!controller.signal.aborted) setTills([])
      },
    )
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (method !== 'link' || tillId === null || noRefund) return
    const controller = new AbortController()
    void cashApi
      .transactions(
        tillId,
        { currency: 'UAH', pageSize: 50 },
        { signal: controller.signal },
      )
      .then(
        (page) => {
          if (controller.signal.aborted) return
          setOperations({ tillId, items: refundCandidates(page.items) })
          setOperationsFailed(false)
        },
        () => {
          if (!controller.signal.aborted) setOperationsFailed(true)
        },
      )
    return () => controller.abort()
  }, [method, tillId, noRefund])

  const listed = operations?.tillId === tillId ? operations.items : []
  const needle = query.trim().toLocaleLowerCase(locale).replace(',', '.')
  const shown = listed.filter(
    (item) =>
      needle === '' ||
      String(item.amount).includes(needle) ||
      item.id.toLocaleLowerCase(locale).includes(needle) ||
      (item.note ?? '').toLocaleLowerCase(locale).includes(needle),
  )
  const operation = listed.find((item) => item.id === operationId) ?? null
  const operationError =
    operation === null
      ? null
      : taken.has(operation.id) ||
          (operation.referenceId !== null && operation.referenceId !== orderId)
        ? t('operationTaken')
        : operation.amount !== netDue
          ? t('operationAmount', { amount: money(netDue) })
          : null
  const tillName = tills?.find((till) => till.id === tillId)?.name ?? '—'

  const fail = (problem: unknown) => {
    setError(
      ambiguous(problem)
        ? t('saveFailed')
        : deliveryProblemMessage(problem, locale),
    )
    window.requestAnimationFrame(() => alertRef.current?.focus())
  }

  const send = async (source: DeliveryRefundSource | Record<string, never>) => {
    setPending(true)
    setError(null)
    try {
      await onConfirm({ ...source, ...retentionInput })
    } catch (problem) {
      setConfirming(false)
      setPending(false)
      if (
        'existingCashTransactionId' in source &&
        typeof source.existingCashTransactionId === 'string' &&
        isProblemCode(problem, 'refund_transaction_already_allocated')
      )
        setTaken((current) =>
          new Set(current).add(source.existingCashTransactionId),
        )
      else fail(problem)
    }
  }

  const submit = () => {
    if (pending || retentionBlocked) return
    if (noRefund) {
      setConfirming(true)
      return
    }
    if (method === 'create') {
      if (tillId === null) return
      setConfirming(true)
      return
    }
    if (operation === null) {
      setError(t('operationPick'))
      window.requestAnimationFrame(() => alertRef.current?.focus())
      return
    }
    if (operationError !== null) return
    void send({ existingCashTransactionId: operation.id })
  }

  const due = money(netDue)
  const blocked =
    pending ||
    retentionBlocked ||
    (!noRefund &&
      (method === 'create'
        ? tillId === null
        : operation === null || operationError !== null))

  return (
    <Sheet
      description={t('refundDescription', { number: String(orderNumber) })}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button disabled={pending} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={blocked}
            onClick={submit}
            ref={submitRef}
            variant="primary"
          >
            {pending
              ? tc('saving')
              : noRefund
                ? t('settleWithoutRefund')
                : method === 'create'
                  ? t('submitRefund', {
                      amount: due,
                    })
                  : t('submitLink')}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={t('refundTitle')}
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <SheetGroup title={t('refundGroup')}>
        <p className="rz-caption m-0 text-pretty">{t('settlementIntro')}</p>
        <SummaryList
          rows={[
            { label: t('refundBooked'), value: money(totals.booked) },
            ...(totals.refunded > 0
              ? [{ label: t('refundDone'), value: money(totals.refunded) }]
              : []),
            ...(totals.retained > 0
              ? [{ label: t('refundRetained'), value: money(totals.retained) }]
              : []),
          ]}
          total={{ label: t('refundUnsettled'), value: money(totals.due) }}
        />
      </SheetGroup>

      {retentionAllowed ? (
        <SheetGroup title={t('retentionGroup')}>
          <Notice tone="info">{t('retentionHint')}</Notice>
          <Field
            label={t('retentionLabel')}
            error={retentionError ?? undefined}
          >
            <TextInput
              className="rz-mono text-left"
              dir="ltr"
              inputMode="decimal"
              readOnly={pending}
              value={retentionDraft}
              onChange={(event) => {
                setRetentionDraft(event.target.value)
                setError(null)
              }}
            />
          </Field>
          {noteRequired ? (
            <Field
              label={t('retentionNoteLabel')}
              required
              error={
                retentionNote.trim() === ''
                  ? t('retentionNoteRequired')
                  : undefined
              }
            >
              <TextArea
                maxLength={500}
                readOnly={pending}
                value={retentionNote}
                placeholder={t('retentionNotePlaceholder')}
                onChange={(event) => setRetentionNote(event.target.value)}
              />
            </Field>
          ) : null}
        </SheetGroup>
      ) : null}

      <SheetGroup
        title={t('settlementResultGroup', {
          step: retentionAllowed ? '3' : '2',
        })}
      >
        <div aria-live="polite" aria-atomic="true" className="grid gap-3">
          <SummaryList
            rows={[
              { label: t('refundUnsettled'), value: money(totals.due) },
              {
                label: t('settlementKept'),
                value: retentionError === null ? money(retained ?? 0) : '—',
              },
            ]}
            total={{
              label: t('refundLeft'),
              value: retentionError === null ? due : '—',
            }}
          />
          {retentionError === null ? (
            <Notice tone="info">
              {t(
                noRefund
                  ? 'settlementNoRefund'
                  : (retained ?? 0) > 0
                    ? 'settlementPartial'
                    : 'settlementFull',
                {
                  held: money(totals.due),
                  retained: money(retained ?? 0),
                  refund: due,
                },
              )}
            </Notice>
          ) : null}
        </div>
      </SheetGroup>

      {!noRefund ? (
        <>
          <SheetGroup
            title={t('refundMethod', { step: retentionAllowed ? '4' : '3' })}
          >
            <p className="rz-caption m-0 text-pretty">
              {t('refundPaymentHint')}
            </p>
            <div
              aria-label={t('refundMethod', {
                step: retentionAllowed ? '4' : '3',
              })}
              className="rz-seg flex w-full"
              role="group"
            >
              {(
                [
                  ['create', t('refundMethodCreate')],
                  ['link', t('refundMethodLink')],
                ] as const
              ).map(([value, label]) => (
                <button
                  aria-pressed={method === value}
                  className="flex-1 justify-center"
                  disabled={pending}
                  key={value}
                  onClick={() => {
                    setMethod(value)
                    setError(null)
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </SheetGroup>

          {tills !== null && tills.length === 0 ? (
            <Notice tone="warn">{t('noTills')}</Notice>
          ) : null}

          <SheetGroup>
            <div className="grid gap-3">
              <Field label={t('tillLabel')} required>
                <SelectInput
                  disabled={pending || tills === null || tills.length === 0}
                  onChange={(event) => {
                    setTillId(event.target.value)
                    setOperationId(null)
                  }}
                  value={tillId ?? ''}
                >
                  {(tills ?? []).map((till) => (
                    <option key={till.id} value={till.id}>
                      {t('tillOption', { name: till.name })}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          </SheetGroup>

          {method === 'link' ? (
            <SheetGroup>
              <Field
                error={operationError ?? undefined}
                label={t('operationLabel')}
                required
              >
                <SearchInput
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('operationPlaceholder')}
                  value={query}
                />
              </Field>
              {operationsFailed ? (
                <Notice tone="danger">{t('operationsFailed')}</Notice>
              ) : shown.length === 0 ? (
                <p className="rz-inset text-app-muted m-0 text-pretty">
                  {t('operationNone')}
                </p>
              ) : (
                <div className="grid gap-1.5">
                  {shown.map((item) => {
                    const chosen = item.id === operationId
                    return (
                      <button
                        aria-pressed={chosen}
                        className={cn(
                          'border-app-line flex min-h-11 w-full items-center gap-3 rounded-rz-md border bg-(--rz-sheet-field) px-3 py-2 text-left',
                          chosen &&
                            'border-brand bg-(--rz-row-selected) shadow-[inset_2px_0_0_var(--rz-brand)]',
                        )}
                        disabled={pending}
                        key={item.id}
                        onClick={() => {
                          setOperationId(item.id)
                          setError(null)
                        }}
                        type="button"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="rz-strong block truncate font-medium">
                            {item.note ?? item.id}
                          </span>
                          <span className="text-app-muted block font-mono text-micro">
                            {format.date(item.createdAt) ?? item.createdAt} ·{' '}
                            {item.createdByName}
                          </span>
                        </span>
                        <span className="rz-mono rz-strong whitespace-nowrap">
                          {money(item.amount)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </SheetGroup>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        confirmLabel={
          noRefund
            ? t('settleWithoutRefund')
            : t('confirmAction', {
                amount: due,
              })
        }
        consequence={
          noRefund
            ? t('confirmRetentionText', {
                amount: money(retained ?? 0),
                note: retentionNote.trim(),
              })
            : t('confirmText', { till: tillName })
        }
        destructive={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          submitRef.current?.focus()
        }}
        onConfirm={() => {
          if (pending || retentionBlocked) return
          if (noRefund) void send({})
          else if (tillId !== null) void send({ accountId: tillId })
        }}
        onOpenChange={setConfirming}
        open={confirming}
        pending={pending}
        title={
          noRefund
            ? t('confirmRetentionTitle')
            : t('confirmTitle', {
                amount: due,
              })
        }
      />
    </Sheet>
  )
}
