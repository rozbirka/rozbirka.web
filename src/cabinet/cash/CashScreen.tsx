import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ArrowDown } from 'lucide-react'
import {
  Button,
  ErrorState,
  Field,
  Notice,
  PageBody,
  PageHeader,
  Pagination,
  Panel,
  SelectInput,
  SkeletonRows,
  TextArea,
  TextInput,
  Toolbar,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { normalizeApiProblem } from '@/api/errors'
import {
  cashApi,
  type CashDailySummary,
  type CashRegister,
  type CashTransaction,
} from '@/api/cash'
import { useCabinet } from '../CabinetContext'
import { CashCard } from './cash-card'
import { CashEditView } from './cash-edit'
import { CashList } from './cash-list'
import { readCashFeed, type CashFeedEntry } from './cash-feed'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

const idFromPath = (path: string) => /\/cash\/([^/]+)/.exec(path)?.[1] ?? null
const localDate = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
const problemMessage = (error: unknown) => {
  const problem = normalizeApiProblem(error)
  if (problem.status === 402) return 'Функція потребує активної підписки.'
  if (problem.kind === 'forbidden') return 'У вас немає прав для цієї дії.'
  if (problem.kind === 'conflict') return problem.message
  return problem.message
}
type CashReplayOperation = 'movement' | 'transfer'
const isAmbiguousMutationFailure = (error: unknown) => {
  const kind = normalizeApiProblem(error).kind
  return kind === 'network' || kind === 'timeout'
}
const useCashIdempotencyKeys = () => {
  const keysRef = useRef(
    new Map<CashReplayOperation, { signature: string; key: string }>(),
  )
  return {
    forPayload(
      tenant: string,
      operation: CashReplayOperation,
      payload: unknown,
    ) {
      const signature = JSON.stringify([tenant, operation, payload])
      const current = keysRef.current.get(operation)
      if (current?.signature === signature) return current.key
      const key = `cash-${operation}-${crypto.randomUUID()}`
      keysRef.current.set(operation, { signature, key })
      return key
    },
    clear(operation: CashReplayOperation) {
      keysRef.current.delete(operation)
    },
  }
}
const canMutate = (
  definition: CabinetModuleScreenProps['definition'],
  cabinet: ReturnType<typeof useCabinet>,
  quota = true,
) => {
  const { quotaResource, ...unmeteredDefinition } = definition
  const access =
    cabinet.status === 'ready' && cabinet.snapshot !== null
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  return (
    evaluateModuleAccess(
      quota || quotaResource === undefined ? definition : unmeteredDefinition,
      access,
      'mutation',
    ).kind === 'allowed'
  )
}
const canTransfer = (
  definition: CabinetModuleScreenProps['definition'],
  cabinet: ReturnType<typeof useCabinet>,
) => {
  const { quotaResource: _quotaResource, ...unmeteredDefinition } = definition
  const access =
    cabinet.status === 'ready' && cabinet.snapshot !== null
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  return (
    evaluateModuleAccess(unmeteredDefinition, access, 'mutation').kind ===
    'allowed'
  )
}
const useDialogFocus = (open: boolean) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    dialogRef.current
      ?.querySelector<HTMLElement>('button:not([disabled])')
      ?.focus()
    return () => trigger?.focus()
  }, [open])
  const containFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled])',
    )
    if (!controls?.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  return { containFocus, dialogRef, triggerRef }
}
/** One register's slice of the day summary. */
type CashDaySummary = CashDailySummary['registers'][number]
const eyebrowClass =
  'text-app-dim font-mono text-[11.5px] tracking-[0.12em] uppercase'
const currenciesFromText = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  ),
]
const balancesFromText = (value: string) =>
  Object.fromEntries(
    value
      .split(/[,\n]/)
      .map((item) => item.split(':').map((part) => part.trim()))
      .flatMap(([currency, amount]) => {
        const parsed = Number(amount)
        return currency && amount && Number.isFinite(parsed)
          ? [[currency, parsed] as const]
          : []
      }),
  )

export function CashScreen({ definition }: CabinetModuleScreenProps) {
  const location = useLocation()
  const id = idFromPath(location.pathname)
  if (location.pathname.endsWith('/edit') && id)
    return <CashRegisterEdit definition={definition} registerId={id} />
  if (location.pathname.endsWith('/new'))
    return <CashRegisterForm definition={definition} registerId={null} />
  return id ? (
    <CashRegisterDetail definition={definition} registerId={id} />
  ) : (
    <CashOverview definition={definition} />
  )
}

function CashOverview({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const navigate = useNavigate()
  const mutationsAllowed = canMutate(definition, cabinet)
  const [params] = useSearchParams()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const date = params.get('date') ?? localDate(timeZone)
  const [summary, setSummary] = useState<CashDailySummary | null>(null)
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [feed, setFeed] = useState<CashFeedEntry[]>([])
  const [feedTruncated, setFeedTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      cashApi.list(undefined, { signal: controller.signal }),
      cashApi.dailySummary(date, timeZone, { signal: controller.signal }),
    ])
      .then(async ([list, daily]) => {
        if (controller.signal.aborted) return
        setRegisters(list)
        setSummary(daily)
        setError(null)
        const latest = await readCashFeed(list, controller.signal)
        if (controller.signal.aborted) return
        setFeed(latest.entries)
        setFeedTruncated(latest.truncated)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(problemMessage(error))
      })
    return () => controller.abort()
  }, [date, timeZone])
  const transferFrom = registers.find((one) => one.isActive)
  return (
    <>
      {error && <Notice tone="danger">{error}</Notice>}
      <CashList
        canCreate={mutationsAllowed}
        canTransfer={mutationsAllowed && transferFrom !== undefined}
        date={date}
        feed={feed}
        feedTruncated={feedTruncated}
        onTransfer={() => {
          if (transferFrom) void navigate(transferFrom.id)
        }}
        registers={registers}
        summary={summary}
      />
    </>
  )
}

function CashRegisterDetail({
  definition,
  registerId,
}: CabinetModuleScreenProps & { registerId: string }) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const replayKeys = useCashIdempotencyKeys()
  const mutationsAllowed = canMutate(definition, cabinet, false)
  const transferAllowed = canTransfer(definition, cabinet)
  const [params, setParams] = useSearchParams()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const date = localDate(timeZone)
  const [register, setRegister] = useState<CashRegister | null>(null)
  const [ledger, setLedger] = useState<CashTransaction[]>([])
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerTotalPages, setLedgerTotalPages] = useState(0)
  const [totalOperations, setTotalOperations] = useState<number | null>(null)
  const [lastOperationAt, setLastOperationAt] = useState<string | null>(null)
  const [daySummary, setDaySummary] = useState<CashDaySummary | null>(null)
  const [transferRegisters, setTransferRegisters] = useState<CashRegister[]>([])
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<'manual_in' | 'manual_out'>('manual_in')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toRegisterId, setToRegisterId] = useState('')
  const [fromCurrency, setFromCurrency] = useState('')
  const [toCurrency, setToCurrency] = useState('')
  const [amountOut, setAmountOut] = useState('')
  const [amountIn, setAmountIn] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferStatus, setTransferStatus] = useState<string | null>(null)
  const ledgerCurrency = params.get('currency') ?? undefined
  const ledgerFrom = params.get('from') ?? undefined
  const ledgerTo = params.get('to') ?? undefined
  const ledgerPage = Number(params.get('page') ?? '1') || 1
  const load = useCallback(
    (signal?: AbortSignal) =>
      Promise.all([
        cashApi.getById(registerId, signal ? { signal } : {}),
        cashApi.list(true, signal ? { signal } : {}),
        // The lifetime count and the newest movement have to come from an
        // unfiltered read: the ledger page below may be narrowed to a
        // currency, a date range or a later page, and its total would answer a
        // different question than «операцій усього».
        cashApi.transactions(
          registerId,
          { page: 1, pageSize: 1 },
          signal ? { signal } : {},
        ),
        cashApi.transactions(
          registerId,
          {
            ...(ledgerCurrency === undefined
              ? {}
              : { currency: ledgerCurrency }),
            ...(ledgerFrom === undefined ? {} : { from: ledgerFrom }),
            ...(ledgerTo === undefined ? {} : { to: ledgerTo }),
            page: ledgerPage,
          },
          signal ? { signal } : {},
        ),
      ])
        .then(([account, availableRegisters, lifetime, page]) => {
          if (!signal?.aborted) {
            setRegister(account)
            setLedger(page.items)
            setLedgerTotal(page.total)
            setLedgerTotalPages(page.totalPages)
            setTransferRegisters(availableRegisters)
            setTotalOperations(lifetime.total)
            setLastOperationAt(lifetime.items[0]?.createdAt ?? null)
            setError(null)
          }
        })
        .catch((error) => {
          if (!signal?.aborted) setError(problemMessage(error))
        }),
    [ledgerCurrency, ledgerFrom, ledgerPage, ledgerTo, registerId],
  )
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  useEffect(() => {
    const controller = new AbortController()
    void cashApi
      .dailySummary(date, timeZone, { signal: controller.signal })
      .then((daily) => {
        if (controller.signal.aborted) return
        setDaySummary(
          daily.registers.find((one) => one.id === registerId) ?? null,
        )
      })
      .catch(() => {
        // The day slice is an extra: a till card without it still shows the
        // balances and the ledger, so a failure here stays silent.
      })
    return () => controller.abort()
  }, [date, registerId, timeZone])
  const saveMovement = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !amount) return
    setBusy(true)
    const input = {
      type,
      amount: Number(amount),
      currency: currency || null,
      note: note || null,
    }
    try {
      requireLatestMutation({ permission: 'finance.view', quota: false })
      const scope = requireLatestMutation({ quota: false })
      await cashApi.createTransaction(registerId, input, {
        idempotencyKey: replayKeys.forPayload(scope.tenantId, 'movement', {
          registerId,
          input,
        }),
      })
      replayKeys.clear('movement')
      if (scope.signal.aborted) return
      setAmount('')
      setNote('')
      await load()
    } catch (error) {
      if (!isAmbiguousMutationFailure(error)) replayKeys.clear('movement')
      setError(problemMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const saveTransfer = async (event: FormEvent) => {
    event.preventDefault()
    if (
      transferBusy ||
      !transferAllowed ||
      !toRegisterId ||
      !fromCurrency ||
      !toCurrency ||
      !amountOut ||
      !amountIn
    )
      return
    setTransferBusy(true)
    setTransferError(null)
    setTransferStatus(null)
    const input = {
      fromRegisterId: registerId,
      fromCurrency,
      toRegisterId,
      toCurrency,
      amountOut: Number(amountOut),
      amountIn: Number(amountIn),
      note: transferNote.trim() || null,
    }
    try {
      const scope = requireLatestMutation({ quota: false })
      await cashApi.transfer(input, {
        idempotencyKey: replayKeys.forPayload(
          scope.tenantId,
          'transfer',
          input,
        ),
      })
      replayKeys.clear('transfer')
      if (scope.signal.aborted) return
      setAmountOut('')
      setAmountIn('')
      setTransferNote('')
      await load()
      setTransferStatus('Переказ виконано.')
    } catch (transferFailure) {
      if (!isAmbiguousMutationFailure(transferFailure))
        replayKeys.clear('transfer')
      setTransferError(problemMessage(transferFailure))
    } finally {
      setTransferBusy(false)
    }
  }
  if (error && !register)
    return (
      <PageBody width="narrow">
        <ErrorState description={error} title="Не вдалося завантажити касу" />
      </PageBody>
    )
  if (!register)
    return (
      <PageBody width="narrow">
        <SkeletonRows label="Завантажуємо касу…" rows={3} />
      </PageBody>
    )
  const transferDestinations = transferRegisters.filter(
    (candidate) => candidate.id !== registerId && candidate.isActive,
  )
  const transferDestination = transferDestinations.find(
    (candidate) => candidate.id === toRegisterId,
  )
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setParams(next)
  }
  return (
    <CashCard
      canManage={mutationsAllowed}
      date={date}
      daySummary={daySummary}
      error={error}
      filters={
        <Toolbar>
          <Field className="min-w-36 flex-1" label="Валюта журналу">
            <TextInput
              onChange={(event) => setFilter('currency', event.target.value)}
              placeholder="Усі"
              value={params.get('currency') ?? ''}
            />
          </Field>
          <Field className="min-w-36 flex-1" label="Від">
            <TextInput
              onChange={(event) => setFilter('from', event.target.value)}
              type="date"
              value={params.get('from') ?? ''}
            />
          </Field>
          <Field className="min-w-36 flex-1" label="До">
            <TextInput
              onChange={(event) => setFilter('to', event.target.value)}
              type="date"
              value={params.get('to') ?? ''}
            />
          </Field>
        </Toolbar>
      }
      lastOperationAt={lastOperationAt}
      ledger={ledger}
      ledgerTotal={ledgerTotal}
      pagination={
        <Pagination
          label="Сторінки журналу"
          onPage={(nextPage) => {
            const next = new URLSearchParams(params)
            next.set('page', String(nextPage))
            setParams(next)
          }}
          page={ledgerPage}
          totalPages={Math.max(ledgerTotalPages, 1)}
        />
      }
      register={register}
      totalOperations={totalOperations}
    >
      {mutationsAllowed && (
        <Panel padded={false}>
          <form
            onSubmit={(event) => void saveMovement(event)}
            className="grid gap-4 p-4"
          >
            <div className="grid gap-1">
              <h2 className="text-base font-semibold text-white">
                Ручна операція
              </h2>
              <p className="text-app-dim text-[13.5px]">
                Запис у журнал цієї каси без переказу та без документа.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Field className="min-w-40 flex-1" label="Тип операції">
                <SelectInput
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as 'manual_in' | 'manual_out')
                  }
                >
                  <option value="manual_in">Надходження</option>
                  <option value="manual_out">Витрата</option>
                </SelectInput>
              </Field>
              <Field className="min-w-36 flex-1" label="Сума">
                <TextInput
                  numeric
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>
              <Field
                className="min-w-36 flex-1"
                hint="Порожньо — валюта каси за замовчуванням"
                label="Валюта"
              >
                <TextInput
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  placeholder="UAH"
                />
              </Field>
            </div>
            <Field hint="Необовʼязково" label="Нотатка">
              <TextInput
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            {amount.trim() !== '' && (
              <p
                aria-live="polite"
                className="border-app-line bg-app-canvas rounded-control flex flex-wrap items-center justify-between gap-3 border px-3.5 py-3"
              >
                <span className="text-app-muted text-[13.5px]">
                  {type === 'manual_in'
                    ? `Надходження до каси «${register.name}»`
                    : `Витрата з каси «${register.name}»`}
                </span>
                <span
                  className={cn(
                    'ml-auto text-[18px] font-semibold tabular-nums',
                    type === 'manual_in'
                      ? 'text-state-ok'
                      : 'text-state-danger',
                  )}
                >
                  {`${type === 'manual_in' ? '+' : '−'}${amount.trim()}${
                    currency.trim() ? ` ${currency.trim()}` : ''
                  }`}
                </span>
              </p>
            )}
            <div className="border-app-line -mx-4 -mb-4 flex flex-wrap justify-end gap-3 border-t px-4 py-4">
              <Button
                type="submit"
                variant="primary"
                aria-busy={busy}
                disabled={busy || !amount}
              >
                {busy ? 'Зберігаємо…' : 'Записати операцію'}
              </Button>
            </div>
          </form>
        </Panel>
      )}
      {transferAllowed && register.isActive && (
        <section className="grid gap-3">
          <h2 className="text-base font-semibold text-white">
            Переказ між касами
          </h2>
          {transferDestinations.length === 0 ? (
            <Notice role="status" tone="info">
              Переказ потребує ще однієї активної каси. Створіть другу касу або
              активуйте наявну.
            </Notice>
          ) : (
            <Panel padded={false}>
              <form
                className="grid gap-4 p-4"
                onSubmit={(event) => void saveTransfer(event)}
              >
                <div className="border-app-line bg-app-canvas rounded-control grid gap-3 border p-3">
                  <div className="grid gap-1">
                    <p className={eyebrowClass}>Звідки</p>
                    <p className="text-app-ink text-sm font-medium">
                      {register.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Field className="min-w-36 flex-1" label="Валюта списання">
                      <SelectInput
                        value={fromCurrency}
                        onChange={(event) =>
                          setFromCurrency(event.target.value)
                        }
                        required
                      >
                        <option value="">Оберіть валюту</option>
                        {Object.keys(register.balances).map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field className="min-w-36 flex-1" label="Сума списання">
                      <TextInput
                        numeric
                        value={amountOut}
                        onChange={(event) => setAmountOut(event.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        required
                      />
                    </Field>
                  </div>
                  {fromCurrency && (
                    <p
                      aria-live="polite"
                      className="text-app-dim text-[12.5px] tabular-nums"
                    >
                      Доступно в цій касі:{' '}
                      {register.balances[fromCurrency] ?? '—'} {fromCurrency}
                    </p>
                  )}
                </div>
                <div aria-hidden className="flex items-center gap-3">
                  <span className="bg-app-line h-px flex-1" />
                  <ArrowDown className="text-app-dim size-4 shrink-0" />
                  <span className="bg-app-line h-px flex-1" />
                </div>
                <div className="border-app-line bg-app-canvas rounded-control grid gap-3 border p-3">
                  <div className="grid gap-1.5">
                    <p className={eyebrowClass}>Куди</p>
                    <Field label="Каса-отримувач">
                      <SelectInput
                        value={toRegisterId}
                        onChange={(event) => {
                          setToRegisterId(event.target.value)
                          setToCurrency('')
                        }}
                        required
                      >
                        <option value="">Оберіть касу</option>
                        {transferDestinations.map((destination) => (
                          <option key={destination.id} value={destination.id}>
                            {destination.name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Field
                      className="min-w-36 flex-1"
                      label="Валюта зарахування"
                    >
                      <SelectInput
                        value={toCurrency}
                        onChange={(event) => setToCurrency(event.target.value)}
                        disabled={!transferDestination}
                        required
                      >
                        <option value="">Оберіть валюту</option>
                        {Object.keys(transferDestination?.balances ?? {}).map(
                          (code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ),
                        )}
                      </SelectInput>
                    </Field>
                    <Field className="min-w-36 flex-1" label="Сума зарахування">
                      <TextInput
                        numeric
                        value={amountIn}
                        onChange={(event) => setAmountIn(event.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        required
                      />
                    </Field>
                  </div>
                  {transferDestination && toCurrency && (
                    <p
                      aria-live="polite"
                      className="text-app-dim text-[12.5px] tabular-nums"
                    >
                      Баланс каси-отримувача:{' '}
                      {transferDestination.balances[toCurrency] ?? '—'}{' '}
                      {toCurrency}
                    </p>
                  )}
                </div>
                <Field hint="Необовʼязково" label="Нотатка переказу">
                  <TextInput
                    value={transferNote}
                    onChange={(event) => setTransferNote(event.target.value)}
                  />
                </Field>
                {transferError && (
                  <Notice tone="danger">{transferError}</Notice>
                )}
                {transferStatus && <Notice tone="ok">{transferStatus}</Notice>}
                <div className="border-app-line -mx-4 -mb-4 flex flex-wrap justify-end gap-3 border-t px-4 py-4">
                  <Button
                    type="submit"
                    variant="primary"
                    aria-busy={transferBusy}
                    disabled={
                      transferBusy ||
                      !toRegisterId ||
                      !fromCurrency ||
                      !toCurrency ||
                      !amountOut ||
                      !amountIn
                    }
                  >
                    {transferBusy ? 'Переказуємо…' : 'Переказати кошти'}
                  </Button>
                </div>
              </form>
            </Panel>
          )}
        </section>
      )}
    </CashCard>
  )
}

function CashRegisterEdit({
  definition,
  registerId,
}: CabinetModuleScreenProps & { registerId: string }) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const mutationsAllowed = canMutate(definition, cabinet, false)
  const navigate = useNavigate()
  const [register, setRegister] = useState<CashRegister | null>(null)
  const [name, setName] = useState('')
  const [newCurrency, setNewCurrency] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { containFocus, dialogRef, triggerRef } = useDialogFocus(confirmDelete)
  const load = useCallback(
    (signal?: AbortSignal) =>
      cashApi
        .getById(registerId, signal ? { signal } : {})
        .then((result) => {
          if (signal?.aborted) return
          setRegister(result)
          setName((current) => (current === '' ? result.name : current))
          setError(null)
        })
        .catch((failure) => {
          if (!signal?.aborted) setError(problemMessage(failure))
        }),
    [registerId],
  )
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  const mutate = async (action: () => Promise<CashRegister | void>) => {
    if (busy) return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      const result = await action()
      if (scope.signal.aborted) return
      if (result) setRegister(result)
      else await load()
      setError(null)
    } catch (failure) {
      setError(problemMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (busy || name.trim() === '') return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      await cashApi.update(registerId, { name: name.trim() })
      if (scope.signal.aborted) return
      await navigate(`../${registerId}`, { replace: true })
    } catch (failure) {
      setError(problemMessage(failure))
      setBusy(false)
    }
  }
  const removeRegister = async () => {
    if (busy) return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      await cashApi.remove(registerId)
      if (scope.signal.aborted) return
      await navigate('../..', { replace: true })
    } catch (failure) {
      setError(problemMessage(failure))
      setBusy(false)
    }
  }
  if (error && !register)
    return (
      <PageBody width="narrow">
        <ErrorState description={error} title="Не вдалося завантажити касу" />
      </PageBody>
    )
  if (!register)
    return (
      <PageBody width="narrow">
        <SkeletonRows label="Завантажуємо касу…" rows={3} />
      </PageBody>
    )
  return (
    <CashEditView
      busy={busy}
      canManage={mutationsAllowed}
      dialog={
        confirmDelete ? (
          <div
            aria-describedby="cash-delete-description"
            aria-labelledby="cash-delete-title"
            aria-modal="true"
            className="bg-app-overlay border-app-line-2 rounded-sheet grid gap-3 border p-5"
            onKeyDown={containFocus}
            ref={dialogRef}
            role="alertdialog"
          >
            <h2
              className="text-lg font-semibold text-white"
              id="cash-delete-title"
            >
              Підтвердити видалення каси
            </h2>
            <p className="text-app-muted text-sm" id="cash-delete-description">
              Каса та її журнал операцій зникнуть назавжди.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button disabled={busy} onClick={() => setConfirmDelete(false)}>
                Скасувати
              </Button>
              <Button
                disabled={busy}
                onClick={() => void removeRegister()}
                variant="danger"
              >
                Підтвердити видалення
              </Button>
            </div>
          </div>
        ) : null
      }
      name={name}
      newCurrency={newCurrency}
      notice={
        <>
          {!mutationsAllowed && (
            <Notice tone="warn">
              Зберегти не вдасться: бракує права finance.manage. Попросіть
              власника кабінету відкрити доступ.
            </Notice>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
        </>
      }
      onAddCurrency={() =>
        void mutate(async () => {
          await cashApi.addCurrency(registerId, newCurrency.trim())
          setNewCurrency('')
        })
      }
      deleteRef={triggerRef}
      onDelete={() => setConfirmDelete(true)}
      onName={setName}
      onNewCurrency={setNewCurrency}
      onRemoveCurrency={(code) =>
        void mutate(() => cashApi.removeCurrency(registerId, code))
      }
      onSave={() => void save()}
      onToggleActive={() =>
        void mutate(() =>
          register.isActive
            ? cashApi.deactivate(registerId)
            : cashApi.activate(registerId),
        )
      }
      register={register}
    />
  )
}

function CashRegisterForm({
  definition,
  registerId,
}: CabinetModuleScreenProps & { registerId: string | null }) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const mutationsAllowed = canMutate(definition, cabinet, registerId === null)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const [currencies, setCurrencies] = useState('')
  const [initialBalances, setInitialBalances] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (registerId) {
      const controller = new AbortController()
      void cashApi
        .getById(registerId, { signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) {
            setName(result.name)
            setType(result.type)
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(problemMessage(error))
        })
      return () => controller.abort()
    }
  }, [registerId])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: registerId === null })
      const result = registerId
        ? await cashApi.update(registerId, { name: name.trim() })
        : await cashApi.create({
            name: name.trim(),
            type,
            currencies: currenciesFromText(currencies),
            initialBalances: balancesFromText(initialBalances),
          })
      if (scope.signal.aborted) return
      await navigate(`../${result.id}`, { replace: true })
    } catch (error) {
      setError(problemMessage(error))
      setBusy(false)
    }
  }
  return (
    <PageBody width="narrow">
      <PageHeader
        eyebrow="Гроші · Каси"
        title={registerId ? 'Редагувати касу' : 'Нова каса'}
      />
      <Panel padded={false}>
        <form className="grid gap-4 p-4" onSubmit={(event) => void save(event)}>
          <Field hint="Так каса підписана у звітах і переказах" label="Назва">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Основна каса"
            />
          </Field>
          {registerId ? (
            <div className="border-app-line bg-app-canvas rounded-control grid gap-1 border px-3.5 py-3">
              <p className="text-app-muted text-[14.5px]">Тип каси: {type}</p>
              <p className="text-app-dim text-[12.5px]">
                Тип задають при створенні й далі не змінюють. Потрібен інший тип
                — створіть окрему касу.
              </p>
            </div>
          ) : (
            <Field hint="Після створення тип не змінюється" label="Тип">
              <SelectInput
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="cash">Готівка</option>
                <option value="bank">Банк</option>
              </SelectInput>
            </Field>
          )}
          {!registerId && (
            <>
              <Field hint="Коди валют через кому" label="Валюти">
                <TextInput
                  value={currencies}
                  onChange={(event) => setCurrencies(event.target.value)}
                  placeholder="UAH, USD"
                />
              </Field>
              <Field
                hint="Пара «код: сума» через кому або з нового рядка. Необовʼязково — можна почати з нуля."
                label="Початкові баланси"
              >
                <TextArea
                  className="font-mono"
                  value={initialBalances}
                  onChange={(event) => setInitialBalances(event.target.value)}
                  placeholder="UAH: 1000, USD: 25"
                />
              </Field>
            </>
          )}
          {!mutationsAllowed && (
            <Notice tone="warn">
              Зберегти не вдасться: бракує права finance.manage або вичерпано
              ліміт кас у тарифі. Попросіть власника кабінету відкрити доступ чи
              змінити тариф.
            </Notice>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="border-app-line -mx-4 -mb-4 flex flex-wrap justify-end gap-3 border-t px-4 py-4">
            <Button asChild>
              <Link to={registerId ? `../${registerId}` : '..'}>Скасувати</Link>
            </Button>
            <Button
              type="submit"
              variant="primary"
              aria-busy={busy}
              disabled={!mutationsAllowed || busy || !name.trim()}
            >
              {busy ? 'Зберігаємо…' : 'Зберегти'}
            </Button>
          </div>
        </form>
      </Panel>
    </PageBody>
  )
}
