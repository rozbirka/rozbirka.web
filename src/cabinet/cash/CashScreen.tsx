import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  Button,
  ErrorState,
  Field,
  Notice,
  Pagination,
  SelectInput,
  Sheet,
  SkeletonRows,
  TextInput,
  Toolbar,
  useOptionalToast,
} from '@/components/app'
import { cn } from '@/lib/utils'
import {
  commonMessages,
  currencyName,
  parseCurrency,
  SUPPORTED_CURRENCIES,
  useLocale,
  useT,
  type Translate,
} from '@/i18n'
import { normalizeApiProblem } from '@/api/errors'
import {
  cashApi,
  type CashDailySummary,
  type CashRegister,
  type CashTransaction,
  type CashTransactionInput,
} from '@/api/cash'
import { useCabinet } from '../CabinetContext'
import { RedesignShell } from '../redesign-shell'
import { CashCard } from './cash-card'
import { useCashText } from './cash-labels'
import { cashMessages } from './cash-messages'
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
type CashT = Translate<(typeof cashMessages)['uk']>
const problemMessage = (error: unknown, t: CashT) => {
  const problem = normalizeApiProblem(error)
  if (problem.status === 402) return t('needsSubscription')
  if (problem.kind === 'forbidden') return t('forbidden')
  return problem.message
}
const removeCurrencyProblemMessage = (
  error: unknown,
  currency: string,
  t: CashT,
) => {
  switch (normalizeApiProblem(error).code) {
    case 'CURRENCY_HAS_TRANSACTIONS':
      return t('currencyHasTransactions', { code: currency })
    case 'REGISTER_BALANCE_NOT_ZERO':
      return t('currencyBalanceNotZero', { code: currency })
    default:
      return problemMessage(error, t)
  }
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
  // Creating and renaming a register are drawers over the screen they return
  // to, like every other cash form.
  if (location.pathname.endsWith('/edit') && id)
    return (
      <>
        <CashRegisterDetail definition={definition} registerId={id} />
        <CashRegisterEdit definition={definition} registerId={id} />
      </>
    )
  if (location.pathname.endsWith('/new'))
    return (
      <>
        <CashOverview definition={definition} />
        <CashRegisterForm definition={definition} registerId={null} />
      </>
    )
  return id ? (
    <CashRegisterDetail definition={definition} registerId={id} />
  ) : (
    <CashOverview definition={definition} />
  )
}

function CashOverview({ definition }: CabinetModuleScreenProps) {
  const t = useT(cashMessages)
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
          if (!signal?.aborted) setError(problemMessage(failure, t))
        }),
    [date, t, timeZone],
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
      toast?.show({ message: t('transferDone'), tone: 'ok' })
    } catch (failure) {
      if (!isAmbiguousMutationFailure(failure)) replayKeys.clear('transfer')
      setTransferError(problemMessage(failure, t))
    } finally {
      setTransferBusy(false)
    }
  }
  const activeRegisters = registers.filter((register) => register.isActive)
  return (
    <>
      <CashList
        canCreate={mutationsAllowed}
        canTransfer={transferAllowed && activeRegisters.length > 0}
        date={date}
        error={error}
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
  const t = useT(cashMessages)
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
  const [activateBusy, setActivateBusy] = useState(false)
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
          if (!signal?.aborted) setError(problemMessage(failure, t))
        }),
    [ledgerCurrency, ledgerFrom, ledgerPage, ledgerTo, registerId, t],
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
      toast?.show({ message: t('movementSaved'), tone: 'ok' })
    } catch (failure) {
      if (!isAmbiguousMutationFailure(failure)) replayKeys.clear('movement')
      setMovementError(problemMessage(failure, t))
    } finally {
      setMovementBusy(false)
    }
  }
  const activateRegister = async () => {
    if (activateBusy || !mutationsAllowed || register?.isActive) return
    setActivateBusy(true)
    setError(null)
    let scope: ReturnType<typeof requireLatestMutation> | null = null
    try {
      scope = requireLatestMutation({ quota: false })
      const activated = await cashApi.activate(registerId)
      if (scope.signal.aborted) return
      setRegister(activated)
      toast?.show({ message: t('tillActivated'), tone: 'ok' })
    } catch (failure) {
      if (!scope?.signal.aborted) setError(problemMessage(failure, t))
    } finally {
      setActivateBusy(false)
    }
  }
  if (error && !register)
    return (
      <RedesignShell crumb={t('crumb')}>
        <ErrorState description={error} title={t('loadFailed')} />
      </RedesignShell>
    )
  if (!register)
    return (
      <RedesignShell crumb={t('crumb')}>
        <SkeletonRows label={t('loadingTill')} rows={3} />
      </RedesignShell>
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
        cashHref={`/app/${cabinet.targetTenant?.slug ?? ''}/cash`}
        canManage={mutationsAllowed}
        activating={activateBusy}
        onActivate={
          mutationsAllowed && !register.isActive
            ? () => void activateRegister()
            : undefined
        }
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
          <Toolbar className="items-end">
            <Field className="min-w-[130px]" label={t('currency')}>
              <SelectInput
                aria-label={t('ledgerCurrency')}
                onChange={(event) => setFilter('currency', event.target.value)}
                value={ledgerCurrency ?? ''}
              >
                <option value="">{t('segAll')}</option>
                {Object.keys(register.balances).map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field className="min-w-[150px]" label={t('from')}>
              <TextInput
                aria-label={t('operationsFrom')}
                onChange={(event) => setFilter('from', event.target.value)}
                type="date"
                value={ledgerFrom ?? ''}
              />
            </Field>
            <Field className="min-w-[150px]" label={t('to')}>
              <TextInput
                aria-label={t('operationsTo')}
                onChange={(event) => setFilter('to', event.target.value)}
                type="date"
                value={ledgerTo ?? ''}
              />
            </Field>
          </Toolbar>
        }
        lastOperationAt={lastOperationAt}
        ledger={ledger}
        ledgerTotal={ledgerTotal}
        pagination={
          <Pagination
            label={t('ledgerPages')}
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
  const t = useT(cashMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const { money } = useCashText()
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
          if (!signal?.aborted) setError(problemMessage(failure, t))
        }),
    [registerId, t],
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
      setError(problemMessage(failure, t))
      setBusy(false)
    }
  }
  const changeCurrency = async (currency: string, action: 'add' | 'remove') => {
    if (busy || !mutationsAllowed || register?.type !== 'cash') return
    setBusy(true)
    setError(null)
    let scope: ReturnType<typeof requireLatestMutation> | null = null
    try {
      scope = requireLatestMutation({ quota: false })
      if (action === 'add') await cashApi.addCurrency(registerId, currency)
      else await cashApi.removeCurrency(registerId, currency)
      if (scope.signal.aborted) return
      await load(scope.signal)
    } catch (failure) {
      if (!scope?.signal.aborted)
        setError(
          action === 'remove'
            ? removeCurrencyProblemMessage(failure, currency, t)
            : problemMessage(failure, t),
        )
    } finally {
      setBusy(false)
    }
  }
  const named = name.trim().length > 1
  const ready = register !== null && named && name.trim() !== register.name
  const close = () => {
    if (!busy) void navigate(detailPath)
  }
  return (
    <Sheet
      eyebrow={
        register ? t('eyebrowTill', { name: register.name }) : t('crumb')
      }
      footer={
        <>
          <Button disabled={busy} onClick={close} type="button">
            {tc('cancel')}
          </Button>
          {mutationsAllowed && register ? (
            <Button
              aria-busy={busy}
              disabled={busy || !ready}
              form={CASH_EDIT_FORM}
              type="submit"
              variant="primary"
            >
              {busy ? tc('saving') : t('saveChanges')}
            </Button>
          ) : null}
        </>
      }
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open
      title={t('editTitle')}
    >
      {error && !register ? (
        <ErrorState
          description={error}
          onRetry={() => void load()}
          title={t('loadFailed')}
        />
      ) : !register ? (
        <SkeletonRows label={t('loadingTill')} rows={3} />
      ) : (
        <form
          aria-busy={busy}
          className="grid content-start gap-5"
          id={CASH_EDIT_FORM}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (ready) void save()
          }}
        >
          {!mutationsAllowed && <Notice tone="warn">{t('editNoRight')}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <Field
            error={named ? null : t('nameEmpty')}
            hint={t('nameHintEdit')}
            label={t('tillName')}
          >
            <TextInput
              disabled={!mutationsAllowed}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('namePlaceholder')}
              value={name}
            />
          </Field>
          {register.type === 'cash' && (
            <fieldset className="grid gap-3">
              <legend className="rz-label mb-2">{t('currencies')}</legend>
              <div className="grid gap-2">
                {Object.entries(register.balances).map(([code, balance]) => {
                  const supportedCode = parseCurrency(code)
                  const canRemove = mutationsAllowed && balance === 0
                  return (
                    <div
                      className="rz-inset flex items-center justify-between gap-3 py-2"
                      key={code}
                    >
                      <div>
                        <p className="text-app-strong m-0 font-semibold">
                          {code} (
                          {supportedCode
                            ? currencyName(supportedCode, locale)
                            : code}
                          )
                        </p>
                        <p className="rz-caption rz-mono m-0">
                          {money(balance, code)}
                        </p>
                      </div>
                      {canRemove && (
                        <Button
                          aria-label={`${t('removeCurrency')} ${code}`}
                          disabled={busy}
                          onClick={() => void changeCurrency(code, 'remove')}
                          type="button"
                        >
                          {t('removeCurrency')}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              {mutationsAllowed && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SUPPORTED_CURRENCIES.filter(
                    (code) => !(code in register.balances),
                  ).map((code) => (
                    <Button
                      aria-label={`${t('addCurrency')} ${code}`}
                      disabled={busy}
                      key={code}
                      onClick={() => void changeCurrency(code, 'add')}
                      type="button"
                    >
                      + {code}
                    </Button>
                  ))}
                </div>
              )}
            </fieldset>
          )}
        </form>
      )}
    </Sheet>
  )
}

const CASH_EDIT_FORM = 'cash-register-edit-form'

function CashRegisterForm({
  definition,
  registerId,
}: CabinetModuleScreenProps & { registerId: string | null }) {
  const t = useT(cashMessages)
  const tc = useT(commonMessages)
  const { registerType } = useCashText()
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const mutationsAllowed = canMutate(definition, cabinet, registerId === null)
  const location = useLocation()
  const navigate = useNavigate()
  const cashPath = location.pathname.replace(/\/(?:new|[^/]+\/edit)$/, '')
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const { locale } = useLocale()
  const [currencies, setCurrencies] = useState<string[]>(['UAH'])
  const effectiveCurrencies = type === 'bank' ? ['UAH'] : currencies
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
          if (!controller.signal.aborted) setError(problemMessage(error, t))
        })
      return () => controller.abort()
    }
  }, [registerId, t])
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
            currencies: effectiveCurrencies,
            initialBalances: Object.fromEntries(
              effectiveCurrencies
                .filter((code) => initialBalances[code]?.trim())
                .map((code) => [code, Number(initialBalances[code])]),
            ),
          })
      if (scope.signal.aborted) return
      await navigate(`${cashPath}/${encodeURIComponent(result.id)}`, {
        replace: true,
      })
    } catch (error) {
      setError(problemMessage(error, t))
      setBusy(false)
    }
  }
  const close = () => {
    if (!busy)
      void navigate(
        registerId ? `${cashPath}/${encodeURIComponent(registerId)}` : cashPath,
      )
  }
  return (
    <Sheet
      eyebrow={t('crumb')}
      footer={
        <>
          <Button disabled={busy} onClick={close} type="button">
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={!mutationsAllowed || busy || !name.trim()}
            form={CASH_REGISTER_FORM}
            type="submit"
            variant="primary"
          >
            {busy ? tc('saving') : tc('save')}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open
      title={registerId ? t('editTill') : t('newTill')}
    >
      <form
        aria-busy={busy}
        className="grid content-start gap-5"
        id={CASH_REGISTER_FORM}
        onSubmit={(event) => void save(event)}
      >
        <Field hint={t('nameHint')} label={t('name')}>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
          />
        </Field>
        {registerId ? (
          <div className="rz-inset grid gap-1">
            <p className="rz-muted m-0">
              {t('tillType', { type: registerType(type) })}
            </p>
            <p className="rz-caption m-0">{t('typeFixed')}</p>
          </div>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="rz-label mb-2">{t('colType')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  value: 'cash',
                  label: t('typeCash'),
                  hint: t('cashOptionHint'),
                },
                {
                  value: 'bank',
                  label: t('typeBank'),
                  hint: t('bankOptionHint'),
                },
              ].map((option) => (
                <button
                  aria-pressed={type === option.value}
                  className={cn(
                    'rounded-control grid min-h-16 gap-1 border p-3 text-left transition-colors',
                    type === option.value
                      ? 'border-brand bg-brand-soft'
                      : 'border-app-line bg-app-input hover:bg-app-hover',
                  )}
                  key={option.value}
                  onClick={() => setType(option.value)}
                  type="button"
                >
                  <span className="text-app-strong font-semibold">
                    {option.label}
                  </span>
                  <span className="rz-caption">{option.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {!registerId && (
          <>
            {type !== 'bank' && (
              <fieldset className="grid gap-2">
                <legend className="rz-label mb-2">{t('currencies')}</legend>
                {/* The supported catalog with ISO codes: symbols cannot tell
                  CAD from USD. A till may keep any of them; this is not the
                  accounting currency. */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SUPPORTED_CURRENCIES.map((code) => {
                    const selected = currencies.includes(code)
                    return (
                      <button
                        aria-label={`${code} (${currencyName(code, locale)})`}
                        aria-pressed={selected}
                        className={cn(
                          'rounded-control grid min-h-12 content-center gap-0.5 border px-3 py-2 text-left transition-colors',
                          selected
                            ? 'border-brand bg-brand-soft text-app-strong'
                            : 'border-app-line bg-app-input text-app-muted hover:bg-app-hover',
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
                        <span className="rz-mono font-semibold">{code}</span>
                        <span className="text-app-dim text-micro text-pretty">
                          {currencyName(code, locale)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )}
            <fieldset className="grid gap-3">
              <legend className="rz-label mb-2">{t('initialBalances')}</legend>
              <p className="rz-hint m-0">{t('initialBalancesHint')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {effectiveCurrencies.map((code) => (
                  <Field key={code} label={t('balanceOf', { code })}>
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
        {!mutationsAllowed && <Notice tone="warn">{t('createNoRight')}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Sheet>
  )
}

const CASH_REGISTER_FORM = 'cash-register-form'
