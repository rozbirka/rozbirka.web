import { TrackingSyncDetails } from './TrackingSyncDetails'
import { TrackingRetryNotice } from './TrackingRetryNotice'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, RefreshCw, RotateCcw } from 'lucide-react'
import {
  Button,
  Card,
  FactRows,
  Field,
  Notice,
  SelectInput,
  Segmented,
  Sheet,
  StatusPill,
  TextArea,
} from '@/components/app'
import {
  providerReturnApi,
  type ProviderReturnCandidate,
  type ProviderReturnChoice,
  type ProviderReturnDetail,
  type ProviderReturnInput,
  type ProviderReturnOptions,
  type ProviderReturnQuote,
} from '@/api/provider-return'
import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import { useFormat, useT } from '@/i18n'
import { SheetGroup } from '../sheet-group'
import { providerReturnMessages } from './provider-return-messages'
import { ReturnBranchPicker, type ReturnBranch } from './ReturnBranchPicker'

interface Props {
  integrationId: string
  shipmentId: string
  sourceNumber: string
  canManage: boolean
  enabled: boolean
}

/** Own the state by both tenant integration and immutable outbound attempt. */
export function ProviderReturnPanel(props: Props) {
  return (
    <ReturnPanel
      key={`${props.integrationId}:${props.shipmentId}`}
      {...props}
    />
  )
}

function ReturnPanel({
  integrationId,
  shipmentId,
  sourceNumber,
  canManage,
  enabled,
}: Props) {
  const t = useT(providerReturnMessages)
  const format = useFormat()
  const [detail, setDetail] = useState<ProviderReturnDetail | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [candidates, setCandidates] = useState<
    ProviderReturnCandidate[] | null
  >(null)
  const [externalSourceVersion, setExternalSourceVersion] = useState<
    string | null
  >(null)
  const gate = useRef(false)
  const alive = useRef(true)
  const actionsAllowed = enabled && canManage

  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    void providerReturnApi
      .get(integrationId, shipmentId, { signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) {
          setDetail(next)
          setError(false)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      alive.current = false
      controller.abort()
    }
  }, [integrationId, shipmentId, enabled])

  const run = async (operation: () => Promise<void>, reloadOnError = false) => {
    if (gate.current) return
    gate.current = true
    setBusy(true)
    setError(false)
    try {
      await operation()
    } catch {
      if (alive.current) setError(true)
      if (reloadOnError && alive.current) {
        try {
          const current = await providerReturnApi.get(integrationId, shipmentId)
          if (alive.current) setDetail(current)
        } catch {
          // Keep the original visible error if reading the persisted state fails.
        }
      }
    } finally {
      gate.current = false
      if (alive.current) setBusy(false)
    }
  }
  const update = (next: ProviderReturnDetail) => {
    if (!alive.current) return
    setDetail(next)
    if (next.state === 'Rejected' && next.version) setUncertain(false)
    if (next.requestRef) {
      setUncertain(false)
      setCandidates(null)
      setExternalSourceVersion(null)
    }
  }
  const unknown =
    uncertain || detail?.state === 'Unknown' || detail?.state === 'Submitting'
  const reason = detail?.capability.blockReason
  const block = !enabled
    ? t('disconnected')
    : reason === 'buyer_received'
      ? t('received')
      : reason === 'source_not_eligible'
        ? t('disabled')
        : reason === 'native_return_exists'
          ? t('nativeExists')
          : t('blocked')

  return (
    <Card
      title={t('title')}
      aside={
        detail?.requestNumber ? (
          <StatusPill tone="info">
            {t(detail.isExternal ? 'externalLinked' : 'accepted')}
          </StatusPill>
        ) : undefined
      }
    >
      <div className="grid gap-3">
        {error ? (
          <Notice tone="danger">{detail ? t('error') : t('loadFailed')}</Notice>
        ) : null}
        {detail === null ? (
          loading ? (
            <p className="rz-caption m-0" role="status">
              {t('loading')}
            </p>
          ) : (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  update(
                    await providerReturnApi.get(integrationId, shipmentId),
                  ),
                )
              }
            >
              {t('retry')}
            </Button>
          )
        ) : (
          <>
            <TrackingRetryNotice actionLabel={t('refresh')} state={detail} />
            {detail.reverse ? (
              <div className="rz-inset grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
                <div className="grid min-w-0 gap-1">
                  <p className="rz-caption m-0">{t('reverse')}</p>
                  <p className="rz-h-title m-0 font-mono break-all">
                    {detail.reverse.number}
                  </p>
                  <p className="m-0 text-pretty">
                    {detail.reverse.status ?? t('statusPending')}
                  </p>
                </div>
                {detail.trackingLastSuccessAt || detail.reverse.statusAt ? (
                  <p className="rz-caption m-0 sm:text-right">
                    {t(detail.trackingLastSuccessAt ? 'checked' : 'statusAt')}
                    <br className="hidden sm:block" />{' '}
                    <time
                      dateTime={
                        detail.trackingLastSuccessAt ??
                        detail.reverse.statusAt ??
                        undefined
                      }
                    >
                      {detail.trackingLastSuccessAt
                        ? format.dateWith(detail.trackingLastSuccessAt, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : format.dateTime(detail.reverse.statusAt)}
                    </time>
                  </p>
                ) : null}
              </div>
            ) : null}
            {unknown ? (
              <Notice tone="warn">
                {t(
                  detail.state === 'Submitting' && !uncertain
                    ? 'submitting'
                    : 'unknown',
                )}
              </Notice>
            ) : detail.requestNumber && !detail.reverse ? (
              <p className="rz-caption m-0">{t('waiting')}</p>
            ) : detail.state === 'Rejected' ? (
              <Notice tone="warn">{t('rejected')}</Notice>
            ) : null}
            {!enabled ||
            (!detail.capability.canCreate && !detail.requestRef && !unknown) ? (
              <p className="rz-caption m-0">{block}</p>
            ) : null}
            {detail.capability.canCreate && !unknown && actionsAllowed ? (
              <>
                <p className="rz-caption m-0">{t('intro')}</p>
                <div>
                  <Button onClick={() => setOpen(true)}>
                    <RotateCcw aria-hidden />
                    {t('create')}
                  </Button>
                </div>
              </>
            ) : null}
            {detail.capability.canFindExternal &&
            !unknown &&
            !detail.requestRef &&
            actionsAllowed ? (
              <div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setCandidates(null)
                      const result = await providerReturnApi.externalCandidates(
                        integrationId,
                        shipmentId,
                      )
                      if (!alive.current) return
                      setExternalSourceVersion(result.sourceVersion)
                      setCandidates(result.candidates)
                    })
                  }
                >
                  {t('searchExternal')}
                </Button>
              </div>
            ) : null}
            {actionsAllowed && (detail.requestRef || unknown) ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() =>
                    void run(
                      async () =>
                        update(
                          await (unknown
                            ? providerReturnApi.get(integrationId, shipmentId)
                            : providerReturnApi.refresh(
                                integrationId,
                                shipmentId,
                              )),
                        ),
                      true,
                    )
                  }
                >
                  <RefreshCw
                    aria-hidden
                    className={busy ? 'animate-spin' : undefined}
                  />
                  {t(busy ? 'refreshing' : 'refresh')}
                </Button>
                {unknown ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setExternalSourceVersion(null)
                        update(
                          await providerReturnApi.get(
                            integrationId,
                            shipmentId,
                          ),
                        )
                        const next = await providerReturnApi.candidates(
                          integrationId,
                          shipmentId,
                        )
                        if (alive.current) setCandidates(next)
                      })
                    }
                  >
                    {t('search')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {detail.requestNumber || detail.reverse ? (
              <details className="group border-t border-app-line pt-2">
                <summary className="rz-muted flex min-h-control cursor-pointer list-none items-center justify-between gap-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
                  {t('requestDetails')}
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <FactRows
                  rows={[
                    {
                      label: t('source'),
                      value: <span className="font-mono">{sourceNumber}</span>,
                    },
                    ...(detail.requestNumber
                      ? [
                          {
                            label: t('request'),
                            value: (
                              <span className="font-mono">
                                {detail.requestNumber}
                              </span>
                            ),
                          },
                        ]
                      : []),
                    ...(detail.requestStatus
                      ? [
                          {
                            label: t('requestStatus'),
                            value: detail.requestStatus,
                          },
                        ]
                      : []),
                    ...(detail.trackingLastSuccessAt && detail.reverse?.statusAt
                      ? [
                          {
                            label: t('statusAt'),
                            value: format.dateTime(detail.reverse.statusAt),
                          },
                        ]
                      : []),
                  ]}
                />
              </details>
            ) : null}
            {detail.state === 'Accepted' ? (
              <TrackingSyncDetails
                state={{
                  ...detail,
                  trackingEnabled: enabled && detail.trackingEnabled !== false,
                }}
              />
            ) : null}
            {candidates !== null ? (
              <div className="grid gap-2">
                <Notice tone="info">
                  {t(candidates.length ? 'candidateHint' : 'empty')}
                </Notice>
                {candidates.map((candidate) => (
                  <div
                    key={candidate.ref}
                    className="border-app-line grid gap-2 rounded-rz-md border p-3"
                  >
                    <FactRows
                      rows={[
                        { label: t('request'), value: candidate.number },
                        { label: t('source'), value: candidate.sourceNumber },
                        ...(candidate.status
                          ? [
                              {
                                label: t('requestStatus'),
                                value: candidate.status,
                              },
                            ]
                          : []),
                        ...(candidate.contactPersonRecipient
                          ? [
                              {
                                label: t('contact'),
                                value: candidate.contactPersonRecipient,
                              },
                            ]
                          : []),
                        ...(candidate.addressRecipient
                          ? [
                              {
                                label: t('address'),
                                value: candidate.addressRecipient,
                              },
                            ]
                          : []),
                        ...(candidate.reverseNumber
                          ? [
                              {
                                label: t('reverse'),
                                value: candidate.reverseNumber,
                              },
                            ]
                          : []),
                      ]}
                    />
                    {actionsAllowed ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(async () =>
                            update(
                              await (externalSourceVersion
                                ? providerReturnApi.attachExternal(
                                    integrationId,
                                    shipmentId,
                                    externalSourceVersion,
                                    candidate,
                                  )
                                : providerReturnApi.confirm(
                                    integrationId,
                                    shipmentId,
                                    candidate.ref,
                                    detail.version ?? '',
                                  )),
                            ),
                          )
                        }
                      >
                        {t(
                          externalSourceVersion
                            ? 'confirmExternal'
                            : 'confirmCandidate',
                        )}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="rz-caption m-0">{t('scope')}</p>
          </>
        )}
      </div>
      {open && actionsAllowed ? (
        <ProviderReturnSheet
          integrationId={integrationId}
          shipmentId={shipmentId}
          sourceVersion={detail?.sourceVersion ?? ''}
          onClose={() => {
            setOpen(false)
            void run(async () =>
              update(await providerReturnApi.get(integrationId, shipmentId)),
            )
          }}
          onCreated={(next) => {
            update(next)
            setOpen(false)
          }}
          onUnknown={() => {
            setUncertain(true)
            setOpen(false)
            void run(async () =>
              update(await providerReturnApi.get(integrationId, shipmentId)),
            )
          }}
        />
      ) : null}
    </Card>
  )
}

function ProviderReturnSheet({
  integrationId,
  shipmentId,
  sourceVersion,
  onClose,
  onCreated,
  onUnknown,
}: {
  integrationId: string
  shipmentId: string
  sourceVersion: string
  onClose: () => void
  onCreated: (value: ProviderReturnDetail) => void
  onUnknown: () => void
}) {
  const t = useT(providerReturnMessages)
  const format = useFormat()
  const [options, setOptions] = useState<ProviderReturnOptions | null>(null)
  const [subtypes, setSubtypes] = useState<ProviderReturnChoice[]>([])
  const [destination, setDestination] = useState<'original' | 'branch'>(
    'original',
  )
  const [returnBranch, setReturnBranch] = useState<ReturnBranch | null>(null)
  const [input, setInput] = useState<ProviderReturnInput>({
    sourceVersion,
    returnAddressRef: '',
    paymentMethod: 'Cash',
    reasonRef: '',
    subtypeReasonRef: '',
    note: '',
  })
  const [quote, setQuote] = useState<ProviderReturnQuote | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const gate = useRef(false)
  const alive = useRef(true)
  const errorRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLSelectElement>(null)
  const valid = Boolean(
    (destination === 'original'
      ? input.returnAddressRef
      : returnBranch &&
        input.recipientWarehouseRef &&
        input.recipientSettlementRef) &&
    input.reasonRef &&
    input.subtypeReasonRef,
  )
  const address = options?.addresses.find(
    (item) => item.ref === input.returnAddressRef,
  )
  const destinationLabel =
    destination === 'branch'
      ? [returnBranch?.settlement.name, returnBranch?.division.name]
          .filter(Boolean)
          .join(' · ')
      : [address?.city, address?.address].filter(Boolean).join(' · ')
  const nonCashAllowed =
    destination === 'branch'
      ? options?.addresses.some((item) => item.nonCash)
      : address?.nonCash
  const fail = (problem?: unknown) => {
    setError(
      t(
        isProblemCode(problem, 'np_return_source_changed')
          ? 'sourceChanged'
          : isProblemCode(problem, 'np_return_address_unavailable')
            ? 'addressUnavailable'
            : isProblemCode(problem, 'np_return_native_return_exists')
              ? 'nativeExists'
              : 'error',
      ),
    )
    window.requestAnimationFrame(() => errorRef.current?.focus())
  }
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    void providerReturnApi
      .options(integrationId, shipmentId, { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return
        setOptions(next)
        setInput((current) => ({
          ...current,
          returnAddressRef:
            next.addresses.length === 1 ? next.addresses[0]!.ref : '',
        }))
        window.requestAnimationFrame(() => firstRef.current?.focus())
      })
      .catch(() => {
        if (!controller.signal.aborted) fail()
      })
    return () => {
      alive.current = false
      controller.abort()
    }
    // Translation changes do not restart a form's provider reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, shipmentId])
  useEffect(() => {
    if (!input.reasonRef) return
    const controller = new AbortController()
    void providerReturnApi
      .subtypes(integrationId, shipmentId, input.reasonRef, {
        signal: controller.signal,
      })
      .then((next) => {
        if (!controller.signal.aborted) setSubtypes(next)
      })
      .catch(() => {
        if (!controller.signal.aborted) fail()
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.reasonRef, integrationId, shipmentId])
  const submit = async () => {
    if (gate.current || !valid) return
    gate.current = true
    setBusy(true)
    setError(null)
    const creating = quote !== null
    try {
      if (creating) {
        const next = await providerReturnApi.create(
          integrationId,
          shipmentId,
          input,
        )
        if (alive.current) onCreated(next)
      } else {
        const next = await providerReturnApi.quote(
          integrationId,
          shipmentId,
          input,
        )
        if (alive.current) setQuote(next)
      }
    } catch (problem) {
      if (!alive.current) return
      const normalized = normalizeApiProblem(problem)
      // A response can be lost after NP has accepted the write. Never offer a blind repeat.
      if (
        creating &&
        ([
          'np_return_request_exists',
          'np_return_operation_in_progress',
          'nova_poshta_outcomeunknown',
        ].some((code) => isProblemCode(problem, code)) ||
          ['network', 'timeout'].includes(normalized.kind) ||
          !normalized.status ||
          normalized.status >= 500)
      )
        onUnknown()
      else fail(problem)
    } finally {
      gate.current = false
      if (alive.current) setBusy(false)
    }
  }
  return (
    <Sheet
      open
      title={t('create')}
      description={t('intro')}
      pending={busy}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {t('close')}
          </Button>
          {quote ? (
            <Button disabled={busy} onClick={() => setQuote(null)}>
              {t('back')}
            </Button>
          ) : null}
          <Button
            key={quote === null ? 'calculate' : 'confirm'}
            variant="primary"
            disabled={busy || !options || !valid}
            onClick={() => void submit()}
          >
            {t(quote ? 'confirm' : 'quote')}
          </Button>
        </>
      }
    >
      {error ? (
        <div ref={errorRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      {quote ? (
        <SheetGroup title={t('confirmation')}>
          <FactRows
            rows={[
              {
                label: t('address'),
                value: destinationLabel,
              },
              {
                label: t('reason'),
                value: options?.reasons.find(
                  (item) => item.ref === input.reasonRef,
                )?.description,
              },
              {
                label: t('payment'),
                value: t(input.paymentMethod === 'Cash' ? 'cash' : 'nonCash'),
              },
              {
                label: t('cost'),
                value:
                  quote.cost === null
                    ? t('costHidden')
                    : format.money(quote.cost, 'UAH'),
              },
            ]}
          />
          <p className="rz-caption m-0">{t('scope')}</p>
        </SheetGroup>
      ) : options ? (
        <SheetGroup>
          <Segmented
            label={t('address')}
            name="return-destination"
            value={destination}
            options={[
              {
                value: 'original',
                label: t('originalAddress'),
                disabled: busy,
              },
              { value: 'branch', label: t('anotherBranch'), disabled: busy },
            ]}
            onChange={(next) => {
              setDestination(next)
              setReturnBranch(null)
              setInput({
                ...input,
                returnAddressRef:
                  next === 'original' && options.addresses.length === 1
                    ? options.addresses[0]!.ref
                    : '',
                recipientWarehouseRef: undefined,
                recipientSettlementRef: undefined,
                paymentMethod: 'Cash',
              })
            }}
          />
          {destination === 'branch' ? (
            <fieldset disabled={busy} className="m-0 grid gap-4 border-0 p-0">
              <ReturnBranchPicker
                integrationId={integrationId}
                shipmentId={shipmentId}
                value={returnBranch}
                onChange={(next) => {
                  setReturnBranch(next)
                  setInput((current) => ({
                    ...current,
                    returnAddressRef: '',
                    recipientWarehouseRef: next?.division.ref,
                    recipientSettlementRef: next?.settlement.ref,
                  }))
                }}
              />
            </fieldset>
          ) : (
            <Field label={t('address')} required>
              <SelectInput
                ref={firstRef}
                disabled={busy}
                value={input.returnAddressRef}
                onChange={(event) =>
                  setInput({
                    ...input,
                    returnAddressRef: event.target.value,
                    paymentMethod: 'Cash',
                  })
                }
              >
                <option value="">{t('choose')}</option>
                {options.addresses.map((item) => (
                  <option key={item.ref} value={item.ref}>
                    {[item.city, item.address].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}
          <Field label={t('payment')} required>
            <SelectInput
              disabled={busy}
              value={input.paymentMethod}
              onChange={(event) =>
                setInput({
                  ...input,
                  paymentMethod:
                    event.target.value === 'NonCash' ? 'NonCash' : 'Cash',
                })
              }
            >
              <option value="Cash">{t('cash')}</option>
              {nonCashAllowed ? (
                <option value="NonCash">{t('nonCash')}</option>
              ) : null}
            </SelectInput>
          </Field>
          <Field label={t('reason')} required>
            <SelectInput
              disabled={busy}
              value={input.reasonRef}
              onChange={(event) => {
                setSubtypes([])
                setInput({
                  ...input,
                  reasonRef: event.target.value,
                  subtypeReasonRef: '',
                })
              }}
            >
              <option value="">{t('choose')}</option>
              {options.reasons.map((item) => (
                <option key={item.ref} value={item.ref}>
                  {item.description}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t('subtype')} required>
            <SelectInput
              disabled={busy || !subtypes.length}
              value={input.subtypeReasonRef}
              onChange={(event) =>
                setInput({ ...input, subtypeReasonRef: event.target.value })
              }
            >
              <option value="">{t('choose')}</option>
              {subtypes.map((item) => (
                <option key={item.ref} value={item.ref}>
                  {item.description}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t('note')}>
            <TextArea
              disabled={busy}
              maxLength={100}
              value={input.note}
              onChange={(event) =>
                setInput({ ...input, note: event.target.value })
              }
            />
          </Field>
        </SheetGroup>
      ) : (
        <p className="rz-caption m-0">{t('submitting')}</p>
      )}
    </Sheet>
  )
}
