import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Check, Loader2, LogOut } from 'lucide-react'
import { normalizeApiProblem } from '@/api/errors'
import { inventoryApi, type Warehouse } from '@/api/inventory'
import { teamApi, type RoleDto } from '@/api/team'
import { tenantsApi } from '@/api/tenants'
import { tenantPreference } from '@/api/tenant-preference'
import { useAuth } from '@/auth/AuthContext'
import {
  Button,
  Field,
  Notice,
  SelectInput,
  TextInput,
  useOperation,
} from '@/components/app'
import { BrandLogo } from '@/components/site/brand-logo'
import { cn } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'

const STEPS = [
  {
    key: 'business',
    title: 'Розкажіть про свій бізнес',
    subtitle:
      'Назву бачить ваша команда й клієнти в документах. Змінити її можна будь-коли в налаштуваннях.',
  },
  {
    key: 'warehouse',
    title: 'Налаштуйте перший склад',
    subtitle:
      'Склад — це фізичне місце із зонами. Деталі отримують адресу при розміщенні, тому їх легко знайти.',
  },
  {
    key: 'team',
    title: 'Запросіть команду',
    subtitle:
      'Роль визначає, що людина бачить у кабінеті. Змінити її можна будь-коли в розділі «Команда».',
  },
  {
    key: 'done',
    title: 'Кабінет готовий',
    subtitle:
      'Залишилось наповнити склад. Почніть з авто на розбір або з партії запчастин від постачальника.',
  },
] as const

const ZONE_COUNTS = [4, 8, 12, 20] as const

/** Zone codes the wizard generates: A, B, C … — the same letters people use. */
const zoneCode = (index: number) => String.fromCodePoint(65 + index)

/** What the first-run wizard asks for and the API has nowhere to put. */
const NO_BUSINESS_KIND =
  'Чим займається розбірка, кабінет не зберігає — у ній є назва, місто й логотип.'
const NO_ACCOUNTING_CURRENCY =
  'Основної валюти обліку кабінет не веде: ціни лишаються у своїй валюті, а каси рахують кожну окремо й без конвертації.'
const NO_WAREHOUSE_ADDRESS =
  'Адреса складу не зберігається — у складу є назва, код і зони.'
const NO_EMAIL_INVITE =
  'Листів кабінет не надсилає й пошти не питає: запрошення — це код, який ви передаєте людині самі.'

const nameTooShort = 'Вкажіть назву розбірки — щонайменше 2 символи'

const KINDS = [
  { label: 'Розбір авто', hint: 'Авто купуються, розбираються на деталі' },
  {
    label: 'Склад запчастин',
    hint: 'Деталі приходять партіями від постачальників',
  },
  { label: 'Змішано', hint: 'І своє розбирання, і закупівля' },
] as const
const CURRENCIES = ['USD', 'UAH', 'EUR'] as const

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

export function TenantOnboardingScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [draftStep, setStep] = useState(0)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [touched, setTouched] = useState(false)
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [warehouseName, setWarehouseName] = useState('Центральний')
  const [zones, setZones] = useState<number>(4)
  const [roles, setRoles] = useState<RoleDto[]>([])
  const [roleId, setRoleId] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resume, setResume] = useState<{
    generation: number
    tenantId: string
  } | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const generationRef = useRef(0)
  const activeCreateRef = useRef<{
    generation: number
    controller: AbortController
  } | null>(null)

  useEffect(() => {
    return () => {
      generationRef.current += 1
      activeCreateRef.current?.controller.abort('onboarding-unmounted')
      activeCreateRef.current = null
    }
  }, [])

  // The yard the first step created, resolved from the hydrated list rather
  // than stored: while it is not there yet, the wizard is still on step one.
  const createdTenant =
    resume === null
      ? undefined
      : auth.tenants.find((tenant) => tenant.id === resume.tenantId)
  const slug = createdTenant?.slug ?? null
  // Step one is irreversible — once the yard exists, the wizard moves on.
  const step = slug !== null && draftStep === 0 ? 1 : draftStep

  useEffect(() => {
    if (slug === null || step !== 1) return
    const controller = new AbortController()
    void inventoryApi
      .getWarehouses({ signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return
        const first = list.find((one) => one.isSystemDefault) ?? list[0] ?? null
        setWarehouse(first)
        if (first) setWarehouseName(first.name)
      })
      .catch(() => {
        if (!controller.signal.aborted) setWarehouse(null)
      })
    return () => controller.abort()
  }, [slug, step])

  useEffect(() => {
    if (slug === null || step !== 2) return
    const controller = new AbortController()
    void teamApi
      .listRoles({ signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return
        setRoles(list)
        setRoleId((current) => (current === '' ? (list[0]?.id ?? '') : current))
      })
      .catch(() => {
        if (!controller.signal.aborted) setRoles([])
      })
    return () => controller.abort()
  }, [slug, step])

  const invalidateCreate = (reason: string) => {
    generationRef.current += 1
    activeCreateRef.current?.controller.abort(reason)
    activeCreateRef.current = null
  }

  const handleLogout = async () => {
    invalidateCreate('onboarding-logout')
    tenantPreference.clear()
    void navigate('/', { replace: true, flushSync: true })
    await auth.signOut()
  }

  const create = useOperation(
    useCallback(async () => {
      const operation = {
        generation: generationRef.current + 1,
        controller: new AbortController(),
      }
      generationRef.current = operation.generation
      activeCreateRef.current = operation
      const isCurrent = () =>
        activeCreateRef.current === operation &&
        generationRef.current === operation.generation &&
        !operation.controller.signal.aborted
      try {
        const created = await tenantsApi.create(
          {
            tenantName: name.trim(),
            ...(city.trim() ? { city: city.trim() } : {}),
          },
          { signal: operation.controller.signal },
        )
        if (!isCurrent()) return
        tenantPreference.set(created.tenantId)
        await auth.hydrate()
        if (!isCurrent()) return
        setResume({
          generation: operation.generation,
          tenantId: created.tenantId,
        })
      } catch (failure) {
        // A superseded attempt (logout, unmount) is not a failure to report.
        if (!isCurrent()) return
        throw failure
      } finally {
        if (activeCreateRef.current === operation) {
          activeCreateRef.current = null
        }
      }
    }, [auth, city, name]),
    {
      errorMessage: (failure) =>
        `Не вдалося створити розбірку. ${normalizeApiProblem(failure).message}`,
    },
  )

  const nameIssue = name.trim().length < 2 ? nameTooShort : null

  const attemptCreate = () => {
    setTouched(true)
    if (nameIssue !== null) {
      nameRef.current?.focus()
      return
    }
    if (create.pending) return
    create.run()
  }

  const finish = () => {
    if (slug === null) return
    void navigate(cabinetPath(slug, 'dashboard'), { replace: true })
  }

  const applyWarehouse = async () => {
    if (busy) return
    setBusy(true)
    setStepError(null)
    try {
      const target =
        warehouse ??
        (await inventoryApi.createWarehouse({
          name: warehouseName.trim() || 'Центральний',
          code: 'MAIN',
        }))
      if (warehouse && warehouseName.trim() !== warehouse.name) {
        await inventoryApi.updateWarehouse(warehouse.id, {
          name: warehouseName.trim(),
          code: warehouse.code,
          isActive: warehouse.isActive,
        })
      }
      const existing = target.zoneCount
      for (let index = existing; index < zones; index += 1) {
        await inventoryApi.createZone({
          warehouseId: target.id,
          name: `Зона ${zoneCode(index)}`,
          code: zoneCode(index),
        })
      }
      setStep(2)
    } catch (failure) {
      setStepError(
        `Не вдалося налаштувати склад. ${normalizeApiProblem(failure).message} Це можна зробити пізніше в «Інвентаризації».`,
      )
    } finally {
      setBusy(false)
    }
  }

  const createInvitation = async () => {
    if (busy || roleId === '') return
    setBusy(true)
    setStepError(null)
    try {
      const invitation = await teamApi.createInvitation(roleId)
      setCode(invitation.code)
    } catch (failure) {
      setStepError(
        `Не вдалося створити запрошення. ${normalizeApiProblem(failure).message}`,
      )
    } finally {
      setBusy(false)
    }
  }

  const current = STEPS[step] ?? STEPS[0]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (step === 0) attemptCreate()
  }

  return (
    <div className="bg-app-canvas text-app-ink type-redesign relative flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
        <BrandLogo />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="text-app-muted hover:text-app-ink text-[13px] transition-colors"
            to="/account/security"
          >
            Особистий акаунт
          </Link>
          {/* Not uppercased: in the mono face «З» and «3» are the same glyph,
              and «КРОК 1 З 4» reads as a broken number. */}
          <span className="text-app-dim text-[13px]">
            Крок {step + 1} з {STEPS.length}
          </span>
          {slug === null ? null : (
            <Button onClick={finish} variant="quiet">
              Пропустити
            </Button>
          )}
          <Button onClick={() => void handleLogout()} variant="quiet">
            <LogOut aria-hidden />
            Вийти
          </Button>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-16 sm:px-6">
        <div className="grid w-full max-w-[600px] content-start gap-6">
          <div aria-hidden className="flex gap-1.5">
            {STEPS.map((one, index) => (
              <span
                className={cn(
                  'h-1 flex-1 rounded-full',
                  index <= step ? 'bg-brand' : 'bg-white/[0.08]',
                )}
                key={one.key}
              />
            ))}
          </div>

          <div>
            <h1 className="text-[32px] leading-[1.04] font-extrabold tracking-[-0.03em] text-white sm:text-[40px]">
              {current.title}
            </h1>
            <p className="text-app-muted mt-3 max-w-[56ch] text-[14.5px] leading-6 text-pretty">
              {current.subtitle}
            </p>
          </div>

          {stepError === null ? null : (
            <Notice tone="danger">{stepError}</Notice>
          )}

          {step === 0 && (
            <form
              aria-busy={create.pending}
              className="grid gap-5"
              noValidate
              onSubmit={submit}
            >
              <Field
                error={touched ? nameIssue : null}
                hint="Наприклад: CarDubliany"
                label="Назва розбірки"
                required
              >
                <TextInput
                  autoComplete="organization"
                  autoFocus
                  onBlur={() => setTouched(true)}
                  onChange={(event) => setName(event.target.value)}
                  ref={nameRef}
                  value={name}
                />
              </Field>
              <Field
                hint="Показуємо в картках запчастин, щоб покупці бачили, звідки доставка."
                label="Місто (необовʼязково)"
              >
                <TextInput
                  autoComplete="address-level2"
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Львів"
                  value={city}
                />
              </Field>
              <div>
                <p className="text-app-muted text-[13px] font-medium">
                  Чим займаєтесь
                </p>
                <div className="mt-2 flex flex-wrap gap-2.5">
                  {KINDS.map((kind) => (
                    <button
                      className="border-app-line min-w-0 flex-[1_1_180px] cursor-not-allowed rounded-[14px] border px-4 py-3 text-left"
                      disabled
                      key={kind.label}
                      title={NO_BUSINESS_KIND}
                      type="button"
                    >
                      <span className="text-app-dim block text-[14px] font-bold">
                        {kind.label}
                      </span>
                      <span className="text-app-dim mt-1 block text-[12.5px]">
                        {kind.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <Note>{NO_BUSINESS_KIND}</Note>
              </div>
              <div>
                <p className="text-app-muted text-[13px] font-medium">
                  Основна валюта обліку
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CURRENCIES.map((one) => (
                    <Dead key={one} title={NO_ACCOUNTING_CURRENCY}>
                      {one}
                    </Dead>
                  ))}
                </div>
                <Note>{NO_ACCOUNTING_CURRENCY}</Note>
              </div>

              {create.error === null ? null : (
                <Notice
                  action={
                    <Button onClick={attemptCreate} {...create.triggerProps}>
                      Спробувати ще раз
                    </Button>
                  }
                  tone="danger"
                >
                  {create.error}
                </Notice>
              )}

              <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <span className="text-app-dim text-[13px]">
                  14 днів безкоштовно, картка не потрібна
                </span>
                <Button
                  {...create.triggerProps}
                  size="touch"
                  type="submit"
                  variant="primary"
                >
                  {create.pending ? (
                    <>
                      <Loader2
                        aria-hidden
                        className="motion-safe:animate-spin"
                      />
                      Створюємо…
                    </>
                  ) : (
                    <>
                      Створити розбірку
                      <ArrowRight aria-hidden />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  hint={
                    warehouse === null
                      ? 'Створимо його зараз'
                      : 'Склад уже створено — можна перейменувати'
                  }
                  label="Назва складу"
                >
                  <TextInput
                    onChange={(event) => setWarehouseName(event.target.value)}
                    placeholder="Центральний"
                    value={warehouseName}
                  />
                </Field>
                <Field hint={NO_WAREHOUSE_ADDRESS} label="Адреса">
                  <TextInput
                    disabled
                    placeholder="не зберігається"
                    title={NO_WAREHOUSE_ADDRESS}
                    value=""
                  />
                </Field>
              </div>
              <div>
                <p className="text-app-muted text-[13px] font-medium">
                  Скільки зон створити
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ZONE_COUNTS.map((count) => (
                    <button
                      aria-pressed={zones === count}
                      className={cn(
                        'inline-flex min-h-11 items-center rounded-[10px] border px-3.5 text-[13px] font-bold',
                        zones === count
                          ? 'border-app-line-2 text-app-ink bg-white/[0.07]'
                          : 'border-app-line text-app-muted hover:text-app-ink',
                      )}
                      key={count}
                      onClick={() => setZones(count)}
                      type="button"
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <Note>
                  Зони назвемо літерами — {zoneCode(0)}, {zoneCode(1)},{' '}
                  {zoneCode(2)}… Уже створені зони лишаються, додамо лише
                  відсутні. Перейменувати чи додати ще можна в «Інвентаризації».
                </Note>
              </div>
              <div className="border-app-line flex flex-wrap items-center justify-end gap-3 border-t pt-5">
                <Button
                  aria-busy={busy}
                  disabled={busy}
                  onClick={() => void applyWarehouse()}
                  size="touch"
                  variant="primary"
                >
                  {busy ? 'Налаштовуємо…' : 'Далі'}
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field hint={NO_EMAIL_INVITE} label="Пошта колеги">
                  <TextInput
                    disabled
                    placeholder="листів не надсилаємо"
                    title={NO_EMAIL_INVITE}
                    value=""
                  />
                </Field>
                <Field label="Роль">
                  <SelectInput
                    onChange={(event) => setRoleId(event.target.value)}
                    value={roleId}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              {code === null ? null : (
                <Notice tone="ok">
                  Код запрошення:{' '}
                  <span className="font-mono font-bold">{code}</span>. Передайте
                  його колезі — він введе код під час реєстрації.
                </Notice>
              )}
              <div>
                <Button
                  aria-busy={busy}
                  disabled={busy || roleId === ''}
                  onClick={() => void createInvitation()}
                >
                  {code === null ? 'Створити запрошення' : 'Створити ще одне'}
                </Button>
              </div>
              <Note>
                {NO_EMAIL_INVITE} Запросити команду можна й пізніше — у розділі
                «Команда».
              </Note>
              <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <Button onClick={() => setStep(1)}>Назад</Button>
                <Button
                  onClick={() => setStep(3)}
                  size="touch"
                  variant="primary"
                >
                  Далі
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && slug !== null && (
            <div className="grid gap-5">
              <ul className="grid gap-2.5">
                {(
                  [
                    {
                      module: 'cars',
                      title: 'Додайте авто на розбір',
                      hint: 'VIN, марка й ціна купівлі — деталі потім підуть від нього',
                    },
                    {
                      module: 'intakes',
                      title: 'Прийміть партію запчастин',
                      hint: 'Коли деталі приходять від постачальника, а не з авто',
                    },
                    {
                      module: 'parts',
                      title: 'Перегляньте склад',
                      hint: 'Тут усе, що вже є в наявності',
                    },
                  ] as const
                ).map((one, index) => (
                  <li key={one.module}>
                    <Link
                      className="border-app-line bg-app-raised hover:border-app-line-2 flex min-w-0 items-start gap-4 rounded-[16px] border px-4 py-3.5"
                      to={cabinetPath(slug, one.module)}
                    >
                      <span className="border-app-line text-app-dim inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="text-app-ink block text-[14px] font-bold">
                          {one.title}
                        </span>
                        <span className="text-app-dim mt-1 block text-[12.5px]">
                          {one.hint}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <Button onClick={() => setStep(2)}>Назад</Button>
                <Button onClick={finish} size="touch" variant="primary">
                  <Check aria-hidden />
                  До кабінету
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(80%_60%_at_50%_0%,rgba(247,116,37,0.12),transparent_60%)]"
      />
    </div>
  )
}
