import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  Button,
  ErrorState,
  Field,
  Notice,
  PageBody,
  PageHeader,
  Pagination,
  Panel,
  SkeletonRows,
  TextInput,
  Toolbar,
  useOptionalToast,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { normalizeApiProblem } from '@/api/errors'
import {
  cashApi,
  type CashDailySummary,
  type CashRegister,
  type CashTransaction,
  type CashTransactionInput,
} from '@/api/cash'
import { useCabinet } from '../CabinetContext'
import { CashCard } from './cash-card'
import { CashEditView } from './cash-edit'
import { CashList } from './cash-list'
import { readCashFeed, type CashFeedEntry } from './cash-feed'
import { CashMovementDrawer } from './CashMovementDrawer'
import { CashTransferDrawer } from './CashTransferDrawer'
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
  const toast = useOptionalToast()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const replayKeys = useCashIdempotencyKeys()
  const mutationsAllowed = canMutate(definition, cabinet)
  const transferAllowed = canTransfer(definition, cabinet)
  const [params] = useSearchParams()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const date = params.get('date') ?? localDate(timeZone)
  const [summary, setSummary] = useState<CashDailySummary | null>(null)
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [feed, setFeed] = useState<CashFeedEntry[]>([])
  const [feedTruncated, setFeedTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const load = useCallback(
    (signal?: AbortSignal) =>
      Promise.all([
        cashApi.list(undefined, signal ? { signal } : {}),
        cashApi.dailySummary(date, timeZone, signal ? { signal } : {}),
      ])
        .then(async ([list, daily]) => {
          if (signal?.aborted) return
          setRegisters(list)
          setSummary(daily)
          setError(null)
          const latest = await readCashFeed(
            list,
            signal ?? new AbortController().signal,
          )
          if (signal?.aborted) return
          setFeed(latest.entries)
          setFeedTruncated(latest.truncated)
        })
        .catch((failure) => {
          if (!signal?.aborted) setError(problemMessage(failure))
        }),
    [date, timeZone],
  )
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  const saveTransfer = async (
    input: Parameters<typeof cashApi.transfer>[0],
  ) => {
    if (transferBusy || !transferAllowed) return
    setTransferBusy(true)
    setTransferError(null)
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
      await load()
      setTransferOpen(false)
      toast?.show({ message: 'Переказ виконано.', tone: 'ok' })
    } catch (failure) {
      if (!isAmbiguousMutationFailure(failure)) replayKeys.clear('transfer')
      setTransferError(problemMessage(failure))
    } finally {
      setTransferBusy(false)
    }
  }
  const activeRegisters = registers.filter((register) => register.isActive)
  return (
    <>
      {error && <Notice tone="danger">{error}</Notice>}
      <CashList
        canCreate={mutationsAllowed}
        canTransfer={transferAllowed && activeRegisters.length > 0}
        date={date}
        feed={feed}
        feedTruncated={feedTruncated}
        onTransfer={() => {
          setTransferError(null)
          setTransferOpen(true)
        }}
        registers={registers}
        summary={summary}
      />
      <CashTransferDrawer
        busy={transferBusy}
        error={transferError}
        onOpenChange={setTransferOpen}
        onSubmit={(input) => void saveTransfer(input)}
        open={transferOpen}
        registers={registers}
      />
    </>
  )
}

function CashRegisterDetail({
  definition,
  registerId,
}: CabinetModuleScreenProps & { registerId: string }) {
  const cabinet = useCabinet()
  const toast = useOptionalToast()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const replayKeys = useCashIdempotencyKeys()
  const mutationsAllowed = canMutate(definition, cabinet, false)
  const [params, setParams] = useSearchParams()
  const [register, setRegister] = useState<CashRegister | null>(null)
  const [ledger, setLedger] = useState<CashTransaction[]>([])
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerTotalPages, setLedgerTotalPages] = useState(0)
  const [totalOperations, setTotalOperations] = useState<number | null>(null)
  const [lastOperationAt, setLastOperationAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementBusy, setMovementBusy] = useState(false)
  const [movementError, setMovementError] = useState<string | null>(null)
  const ledgerCurrency = params.get('currency') ?? undefined
  const ledgerFrom = params.get('from') ?? undefined
  const ledgerTo = params.get('to') ?? undefined
  const ledgerPage = Number(params.get('page') ?? '1') || 1
  const load = useCallback(
    (signal?: AbortSignal) =>
      Promise.all([
        cashApi.getById(registerId, signal ? { signal } : {}),
        cashApi.transactions(
          registerId,
          { page: 1, pageSize: 1 },
          signal ? { signal } : {},
        ),
        cashApi.transactions(
          registerId,
          {
            ...(ledgerCurrency ? { currency: ledgerCurrency } : {}),
            ...(ledgerFrom ? { from: ledgerFrom } : {}),
            ...(ledgerTo ? { to: ledgerTo } : {}),
            page: ledgerPage,
          },
          signal ? { signal } : {},
        ),
      ])
        .then(([account, lifetime, page]) => {
          if (!signal?.aborted) {
            setRegister(account)
            setLedger(page.items)
            setLedgerTotal(page.total)
            setLedgerTotalPages(page.totalPages)
            setTotalOperations(lifetime.total)
            setLastOperationAt(lifetime.items[0]?.createdAt ?? null)
            setError(null)
          }
        })
        .catch((failure) => {
          if (!signal?.aborted) setError(problemMessage(failure))
        }),
    [ledgerCurrency, ledgerFrom, ledgerPage, ledgerTo, registerId],
  )
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  const saveMovement = async (input: CashTransactionInput) => {
    if (movementBusy) return
    setMovementBusy(true)
    setMovementError(null)
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
      await load()
      setMovementOpen(false)
      toast?.show({ message: 'Операцію записано.', tone: 'ok' })
    } catch (failure) {
      if (!isAmbiguousMutationFailure(failure)) replayKeys.clear('movement')
      setMovementError(problemMessage(failure))
    } finally {
      setMovementBusy(false)
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
  const setFilter = (key: 'currency' | 'from' | 'to', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setParams(next)
  }
  return (
    <>
      <CashCard
        canManage={mutationsAllowed}
        onNewOperation={
          mutationsAllowed && register.isActive
            ? () => {
                setMovementError(null)
                setMovementOpen(true)
              }
            : undefined
        }
        error={error}
        filters={
          <Toolbar>
            <label className="grid min-w-[130px] gap-1 text-[12px] text-app-dim">
              Валюта
              <select
                aria-label="Валюта журналу"
                className="border-app-line bg-app-input text-app-ink h-10 rounded-[10px] border px-3 text-[14px]"
                onChange={(event) => setFilter('currency', event.target.value)}
                value={ledgerCurrency ?? ''}
              >
                <option value="">Усі</option>
                {Object.keys(register.balances).map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-[150px] gap-1 text-[12px] text-app-dim">
              Від
              <input
                aria-label="Операції від"
                className="border-app-line bg-app-input text-app-ink h-10 rounded-[10px] border px-3 text-[14px]"
                onChange={(event) => setFilter('from', event.target.value)}
                type="date"
                value={ledgerFrom ?? ''}
              />
            </label>
            <label className="grid min-w-[150px] gap-1 text-[12px] text-app-dim">
              До
              <input
                aria-label="Операції до"
                className="border-app-line bg-app-input text-app-ink h-10 rounded-[10px] border px-3 text-[14px]"
                onChange={(event) => setFilter('to', event.target.value)}
                type="date"
                value={ledgerTo ?? ''}
              />
            </label>
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
      />
      <CashMovementDrawer
        busy={movementBusy}
        error={movementError}
        onOpenChange={setMovementOpen}
        onSubmit={(input) => void saveMovement(input)}
        open={movementOpen}
        register={register}
      />
    </>
  )
}

function CashRegisterEdit({
  definition,
  registerId,
}: CabinetModuleScreenProps & { registerId: string }) {
  const cabinet = useCabinet()
  const location = useLocation()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const mutationsAllowed = canMutate(definition, cabinet, false)
  const navigate = useNavigate()
  const [register, setRegister] = useState<CashRegister | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const detailPath = location.pathname.replace(/\/edit\/?$/, '')
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
  const save = async () => {
    if (busy || name.trim() === '') return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      await cashApi.update(registerId, { name: name.trim() })
      if (scope.signal.aborted) return
      await navigate(detailPath, { replace: true })
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
      backTo={detailPath}
      busy={busy}
      canManage={mutationsAllowed}
      name={name}
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
      onName={setName}
      onSave={() => void save()}
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
  const [currencies, setCurrencies] = useState<string[]>(['UAH'])
  const [initialBalances, setInitialBalances] = useState<
    Record<string, string>
  >({ UAH: '' })
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
            currencies,
            initialBalances: Object.fromEntries(
              currencies
                .filter((code) => initialBalances[code]?.trim())
                .map((code) => [code, Number(initialBalances[code])]),
            ),
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
            <fieldset className="grid gap-2">
              <legend className="text-app-muted text-sm font-semibold">
                Тип
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: 'cash', label: 'Готівкова', hint: 'Готівка в касі' },
                  {
                    value: 'bank',
                    label: 'Безготівкова',
                    hint: 'Банківський рахунок',
                  },
                ].map((option) => (
                  <button
                    aria-pressed={type === option.value}
                    className={cn(
                      'border-app-line rounded-control grid min-h-20 gap-1 border p-3 text-left',
                      type === option.value
                        ? 'border-brand bg-brand/10'
                        : 'bg-app-input',
                    )}
                    key={option.value}
                    onClick={() => setType(option.value)}
                    type="button"
                  >
                    <span className="font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="text-app-dim text-xs">{option.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {!registerId && (
            <>
              <fieldset className="grid gap-2">
                <legend className="text-app-muted text-sm font-semibold">
                  Валюти
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { code: 'UAH', symbol: '₴' },
                    { code: 'USD', symbol: '$' },
                    { code: 'EUR', symbol: '€' },
                  ].map(({ code, symbol }) => {
                    const selected = currencies.includes(code)
                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          'border-app-line rounded-control flex min-h-16 items-center justify-between border p-3',
                          selected
                            ? 'border-brand bg-brand/10 text-white'
                            : 'bg-app-input text-app-muted',
                        )}
                        key={code}
                        onClick={() =>
                          setCurrencies((current) =>
                            selected
                              ? current.length === 1
                                ? current
                                : current.filter((item) => item !== code)
                              : [...current, code],
                          )
                        }
                        type="button"
                      >
                        <span className="text-xl font-bold">{symbol}</span>
                        <span className="font-mono text-sm">{code}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
              <fieldset className="grid gap-3">
                <legend className="text-app-muted text-sm font-semibold">
                  Початкові баланси
                </legend>
                <p className="text-app-dim text-xs">
                  Необов’язково. Порожнє поле означає нульовий баланс.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {currencies.map((code) => (
                    <Field key={code} label={`Баланс ${code}`}>
                      <TextInput
                        inputMode="decimal"
                        numeric
                        onChange={(event) =>
                          setInitialBalances((current) => ({
                            ...current,
                            [code]: event.target.value,
                          }))
                        }
                        placeholder="0"
                        value={initialBalances[code] ?? ''}
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
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
