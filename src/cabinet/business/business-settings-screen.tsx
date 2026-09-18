import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { Button, Field, Notice, TextInput } from '@/components/app'
import { businessApi } from '@/api/business'
import { inventoryApi, type Warehouse } from '@/api/inventory'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

type SaveState = 'idle' | 'pending' | 'success' | 'error' | 'denied'

const FORM_ID = 'business-form'

const LEGAL_FORMS = ['ФОП', 'ТОВ', 'Без реєстрації'] as const
const ACCOUNTING_CURRENCIES = ['USD', 'UAH', 'EUR'] as const
const COSTING = [
  {
    label: 'Розподіл за вагою',
    hint: 'Ціна авто ділиться на деталі пропорційно вазі',
  },
  { label: 'Вручну', hint: 'Собівартість вказує комірник при розміщенні' },
] as const
const RULES = [
  {
    label: 'Контролювати мінімальний залишок',
    hint: 'Позначати деталі, яких менше норми',
  },
  {
    label: 'Вимагати VIN при додаванні авто',
    hint: 'Без VIN авто не зберігається',
  },
  {
    label: 'Дозволити відʼємний залишок',
    hint: 'Продаж деталі, якої немає фізично на складі',
  },
] as const

/** What `PATCH /tenants/{id}` does not take, said where the design asks for it. */
const NO_LEGAL_FORM =
  'Юридичної форми розбірка не тримає: у ній є назва, місто й логотип, і більше нічого з реквізитів.'
const NO_TAX_ID = 'Поля для ЄДРПОУ чи ІПН у розбірці немає.'
const NO_PHONE = 'Телефон розбірки поки не зберігається.'
const NO_ADDRESS =
  'Повної адреси немає — з місця розбірка тримає лише місто, і воно тут поруч.'
const NO_ACCOUNTING_CURRENCY =
  'Основної валюти обліку кабінет не веде: ціни лишаються у своїй валюті, а каси рахують кожну окремо й без конвертації.'
const NO_COSTING =
  'Способу рахувати собівартість деталі в налаштуваннях немає — як ділити ціну авто, кабінет не питає.'
const NO_RULES =
  'Цих правил обліку кабінет поки не має: ні контролю мінімального залишку, ні вимоги VIN, ні дозволу на відʼємний залишок.'
const NO_EXPORT =
  'Вивантажити всі дані кабінету одним файлом поки не можна — окремого експорту немає в жодному розділі.'
const NO_TENANT_DELETE =
  'Видалити розбірку з кабінету не можна — звертайтеся в підтримку.'
const NO_WAREHOUSE_PARTS =
  'Скільки деталей лежить на складі, тут не рахується — у складу є код, зони й стан.'

function Step({
  number,
  title,
  action,
  children,
}: {
  number: string
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="border-app-line text-app-dim inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]">
            {number}
          </span>
          <h2 className="text-app-ink text-[15px] font-bold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4 grid gap-3.5">{children}</div>
    </section>
  )
}

/** A control the design asks for and the API cannot back: shown, not faked. */
function Dead({ children, title }: { children: ReactNode; title: string }) {
  return (
    <button
      className="border-app-line text-app-dim inline-flex min-h-11 cursor-not-allowed items-center rounded-[10px] border px-3.5 text-[13px] font-medium"
      disabled
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-app-dim text-[12.5px] leading-5 text-pretty">
      {children}
    </p>
  )
}

export function BusinessSettingsScreen() {
  const cabinet = useCabinet()
  const tenant = cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const [name, setName] = useState(tenant?.name ?? '')
  const [city, setCity] = useState(tenant?.city ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null)
  const mountedRef = useRef(true)
  const latestCabinetRef = useRef(cabinet)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.business,
  )

  useEffect(() => {
    latestCabinetRef.current = cabinet
  }, [cabinet])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafts reset only at a tenant scope boundary.
    setName(tenant?.name ?? '')
    setCity(tenant?.city ?? '')
    setSaveState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reset is intentionally keyed by the cabinet scope.
  }, [generation, tenant?.id])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void inventoryApi
      .getWarehouses({ signal: controller.signal })
      .then((list) => {
        if (!controller.signal.aborted) setWarehouses(list)
      })
      .catch(() => {
        // The warehouse list is read-only context here; the settings form
        // still works without it, so a failure stays quiet.
        if (!controller.signal.aborted) setWarehouses([])
      })
    return () => controller.abort()
  }, [generation, tenant?.id])

  if (!tenant) {
    return (
      <p className="text-app-muted text-sm">
        Оберіть розбірку, щоб змінити її налаштування.
      </p>
    )
  }

  const normalizedName = name.trim()
  const normalizedCity = city.trim()
  const busy = saveState === 'pending'
  const canSave = !busy && normalizedName.length >= 2
  const changed =
    normalizedName !== tenant.name || normalizedCity !== (tenant.city ?? '')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    let scope: ReturnType<typeof requireLatestMutation>
    try {
      scope = requireLatestMutation({ quota: false })
    } catch {
      setSaveState('denied')
      return
    }

    setSaveState('pending')
    try {
      const updated = await businessApi.update(
        tenant.id,
        { name: normalizedName, city: normalizedCity || null },
        { signal: scope.signal },
      )
      const latest = latestCabinetRef.current
      const latestSnapshot = latest.snapshot
      if (
        !mountedRef.current ||
        scope.signal.aborted ||
        latestSnapshot?.generation !== scope.generation ||
        latestSnapshot?.tenantId !== scope.tenantId
      ) {
        return
      }
      setName(updated.name)
      setCity(updated.city ?? '')
      setSaveState('success')
      void Promise.resolve(cabinet.switchTenant(updated.id)).catch(
        () => undefined,
      )
    } catch {
      if (!mountedRef.current || scope.signal.aborted) return
      setSaveState('error')
    }
  }

  const reset = () => {
    setName(tenant.name)
    setCity(tenant.city ?? '')
    setSaveState('idle')
  }

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              Налаштування · Бізнес
            </p>
            <h1 className="mt-1.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              Бізнес
            </h1>
            <p className="text-app-muted mt-2.5 max-w-[62ch] text-[14.5px] leading-6 text-pretty">
              Реквізити розбірки, склади й правила обліку.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button disabled={busy || !changed} onClick={reset}>
              Скасувати зміни
            </Button>
            <Button
              className="px-5 text-sm font-bold"
              disabled={!canSave || !changed}
              form={FORM_ID}
              type="submit"
              variant="primary"
            >
              {busy ? 'Зберігаємо…' : 'Зберегти'}
            </Button>
          </div>
        </div>

        {saveState === 'success' && (
          <Notice tone="ok">Налаштування бізнесу збережено.</Notice>
        )}
        {saveState === 'denied' && (
          <Notice tone="danger">
            Ви більше не маєте права змінювати налаштування бізнесу.
          </Notice>
        )}
        {saveState === 'error' && (
          <Notice tone="danger">
            Не вдалося зберегти налаштування бізнесу. Спробуйте ще раз.
          </Notice>
        )}

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 content-start gap-5">
            <Step number="01" title="Реквізити">
              <form
                className="grid gap-3.5"
                id={FORM_ID}
                onSubmit={(event) => void save(event)}
              >
                <Field
                  hint="Показується в документах, стікерах і рахунках."
                  label="Назва бізнесу"
                  required
                >
                  <TextInput
                    disabled={busy}
                    onChange={(event) => {
                      setName(event.target.value)
                      if (!busy) setSaveState('idle')
                    }}
                    placeholder="Розбірка Коваль"
                    value={name}
                  />
                </Field>
                <Field label="Місто">
                  <TextInput
                    disabled={busy}
                    onChange={(event) => {
                      setCity(event.target.value)
                      if (!busy) setSaveState('idle')
                    }}
                    placeholder="Львів"
                    value={city}
                  />
                </Field>
              </form>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <p className="text-app-muted text-[13px] font-medium">
                    Юридична форма
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LEGAL_FORMS.map((label) => (
                      <Dead key={label} title={NO_LEGAL_FORM}>
                        {label}
                      </Dead>
                    ))}
                  </div>
                </div>
                <Field label="ЄДРПОУ / ІПН">
                  <TextInput
                    disabled
                    placeholder="не зберігається"
                    title={NO_TAX_ID}
                    value=""
                  />
                </Field>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Телефон">
                  <TextInput
                    disabled
                    placeholder="не зберігається"
                    title={NO_PHONE}
                    value=""
                  />
                </Field>
                <Field label="Адреса">
                  <TextInput
                    disabled
                    placeholder="є тільки місто"
                    title={NO_ADDRESS}
                    value=""
                  />
                </Field>
              </div>
              <Note>
                {NO_LEGAL_FORM} {NO_ADDRESS}
              </Note>
            </Step>

            <Step
              action={
                <Button asChild>
                  <Link to="../../inventory">
                    <Plus aria-hidden />
                    Додати склад
                  </Link>
                </Button>
              }
              number="02"
              title="Склади"
            >
              {warehouses === null ? (
                <Note>Завантажуємо склади…</Note>
              ) : warehouses.length === 0 ? (
                <Note>
                  Складів ще немає. Перший створюється в розділі
                  «Інвентаризація».
                </Note>
              ) : (
                <ul className="grid gap-2.5">
                  {warehouses.map((warehouse) => (
                    <li
                      className="border-app-line flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] border px-4 py-3.5"
                      key={warehouse.id}
                    >
                      <div className="min-w-0 flex-[1_1_200px]">
                        <p className="flex flex-wrap items-center gap-2.5">
                          <span className="text-app-ink text-[14px] font-bold">
                            {warehouse.name}
                          </span>
                          {warehouse.isSystemDefault && (
                            <span className="border-app-line text-app-dim rounded-full border px-2.5 py-0.5 text-[11px]">
                              Основний
                            </span>
                          )}
                          {!warehouse.isActive && (
                            <span className="border-app-line text-app-dim rounded-full border px-2.5 py-0.5 text-[11px]">
                              Архівний
                            </span>
                          )}
                        </p>
                        <p className="text-app-dim mt-1 text-[12.5px]">
                          <span className="font-mono">{warehouse.code}</span> ·{' '}
                          {warehouse.zoneCount}{' '}
                          {warehouse.zoneCount === 1 ? 'зона' : 'зон'}
                        </p>
                      </div>
                      <span
                        className="text-app-dim ml-auto text-[13px]"
                        title={NO_WAREHOUSE_PARTS}
                      >
                        деталей — не рахується
                      </span>
                      <Button asChild>
                        <Link to="../../inventory">Змінити</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Note>
                Склади й зони живуть в «Інвентаризації» — тут вони лише
                показані. {NO_WAREHOUSE_PARTS}
              </Note>
            </Step>

            <Step number="03" title="Валюти й облік">
              <div>
                <p className="text-app-muted text-[13px] font-medium">
                  Основна валюта обліку
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCOUNTING_CURRENCIES.map((label) => (
                    <Dead key={label} title={NO_ACCOUNTING_CURRENCY}>
                      {label}
                    </Dead>
                  ))}
                </div>
                <Note>{NO_ACCOUNTING_CURRENCY}</Note>
              </div>
              <div>
                <p className="text-app-muted text-[13px] font-medium">
                  Собівартість запчастини
                </p>
                <div className="mt-2 flex flex-wrap gap-2.5">
                  {COSTING.map((option) => (
                    <button
                      className="border-app-line min-w-0 flex-[1_1_200px] cursor-not-allowed rounded-[14px] border px-4 py-3 text-left"
                      disabled
                      key={option.label}
                      title={NO_COSTING}
                      type="button"
                    >
                      <span className="text-app-dim block text-[14px] font-bold">
                        {option.label}
                      </span>
                      <span className="text-app-dim mt-1 block text-[12.5px]">
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <Note>{NO_COSTING}</Note>
              </div>
              <div className="grid gap-2">
                {RULES.map((rule) => (
                  <div
                    className="border-app-line flex items-start gap-3 rounded-[14px] border px-3.5 py-3"
                    key={rule.label}
                    title={NO_RULES}
                  >
                    <span
                      aria-hidden
                      className="bg-app-line mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5"
                    >
                      <span className="bg-app-dim size-4 rounded-full" />
                    </span>
                    <span className="min-w-0">
                      <span className="text-app-dim block text-[13.5px] font-medium">
                        {rule.label}
                      </span>
                      <span className="text-app-dim mt-0.5 block text-[12.5px]">
                        {rule.hint}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <Note>{NO_RULES}</Note>
            </Step>
          </div>

          <div className="grid min-w-0 content-start gap-5">
            <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
              <h2 className="text-app-ink text-[15px] font-bold">Зведення</h2>
              <p
                className={
                  normalizedName.length > 1
                    ? 'text-app-ink mt-3.5 text-[17px] font-bold'
                    : 'text-app-dim mt-3.5 text-[17px] font-bold'
                }
              >
                {normalizedName.length > 1 ? normalizedName : 'Назва бізнесу'}
              </p>
              <p className="text-app-muted mt-1 text-[13px]">
                {normalizedCity === '' ? 'місто не вказано' : normalizedCity}
              </p>
              <dl className="mt-4 grid gap-2.5 text-[13.5px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Складів</dt>
                  <dd className="text-app-ink text-right font-medium">
                    {warehouses === null ? '…' : warehouses.length}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Валюта обліку</dt>
                  <dd
                    className="text-app-dim text-right"
                    title={NO_ACCOUNTING_CURRENCY}
                  >
                    —
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-app-muted">Собівартість</dt>
                  <dd className="text-app-dim text-right" title={NO_COSTING}>
                    —
                  </dd>
                </div>
              </dl>
              <Button
                className="mt-5 w-full justify-center"
                disabled={!canSave || !changed}
                form={FORM_ID}
                type="submit"
                variant="primary"
              >
                {busy ? 'Зберігаємо…' : 'Зберегти'}
              </Button>
              <p className="text-app-dim mt-3 text-[12.5px] leading-5 text-pretty">
                {normalizedName.length > 1
                  ? 'Зберігаються назва й місто — решти реквізитів розбірка не тримає.'
                  : 'Вкажіть назву бізнесу.'}
              </p>
            </section>

            <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
              <h2 className="text-app-ink text-[15px] font-bold">
                Дані кабінету
              </h2>
              <p className="text-app-muted mt-2.5 text-[13px] leading-5 text-pretty">
                Вивантажити все одним файлом чи видалити розбірку через кабінет
                поки не можна.
              </p>
              <div className="mt-3.5 grid gap-2.5">
                <Dead title={NO_EXPORT}>Експорт усіх даних</Dead>
                <Dead title={NO_TENANT_DELETE}>Видалити кабінет</Dead>
              </div>
              <p className="text-app-dim mt-3.5 text-[12.5px] leading-5 text-pretty">
                {NO_EXPORT} {NO_TENANT_DELETE}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
