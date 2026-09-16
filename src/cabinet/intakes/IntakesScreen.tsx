import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import { ChevronLeft, Plus, ScanLine } from 'lucide-react'
import {
  Button,
  Card,
  Fact,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Notice,
  PageBody,
  PageHeader,
  Pagination,
  Panel,
  PillGroup,
  QuantityStepper,
  SearchInput,
  SelectInput,
  SkeletonRows,
  StatCard,
  StatusPill,
  StatStrip,
  TextArea,
  TextInput,
  Toolbar,
} from '@/components/app'
import {
  intakesApi,
  type AddIntakePartRequest,
  type CreateIntakeRequest,
  type Intake,
  type IntakeListParams,
  isIntakeStatus,
} from '@/api/intakes'
import { inventoryApi, type InventoryZone } from '@/api/inventory'
import { partsApi } from '@/api/parts'
import { normalizeApiProblem } from '@/api/errors'
import { cn, plural } from '@/lib/utils'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { MediaPicker } from '../cars/CarsScreen'
import type { MediaUploadResult } from '@/api/media'
import { cabinetModules } from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import type { ModuleAccessDecision } from '../policy'
import type { CabinetModuleDefinition } from '../module-registry'
import type { Permission } from '../access-types'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

const defaultPageSize = 20
const positiveInteger = (value: string | null, fallback: number) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}
const pageSizeParam = (value: string | null, fallback: number) => {
  const number = positiveInteger(value, fallback)
  return number <= 100 ? number : fallback
}
/**
 * Intakes are bought in dollars, like the cars and the parts they become. A
 * round sum drops its cents; real cents are kept.
 */
const money = (amount: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger',
  }).format(amount)

function useIntakeAccess() {
  const cabinet = useCabinet()
  const access =
    cabinet.status === 'ready' && cabinet.snapshot
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const decision = (
    definition: CabinetModuleDefinition,
    permission: Permission,
    quota: boolean,
  ): ModuleAccessDecision => {
    const { quotaResource, ...definitionWithoutQuota } = definition
    return evaluateModuleAccess(
      {
        ...definitionWithoutQuota,
        released: true,
        mutationPermission: permission,
        ...(quota && quotaResource !== undefined ? { quotaResource } : {}),
      },
      access,
      'mutation',
    )
  }
  const viewDecision = (
    definition: CabinetModuleDefinition,
    permission: Permission,
  ): ModuleAccessDecision =>
    evaluateModuleAccess(
      { ...definition, released: true, viewPermission: permission },
      access,
      'view',
    )
  const createDecision = decision(
    cabinetModules.intakes,
    'intakes.manage',
    true,
  )
  const manageDecision = decision(
    cabinetModules.intakes,
    'intakes.manage',
    false,
  )
  const partsViewDecision = viewDecision(cabinetModules.parts, 'parts.view')
  const partQuotaDecision = decision(
    cabinetModules.parts,
    'intakes.manage',
    true,
  )
  const partCreateDecision =
    manageDecision.kind !== 'allowed'
      ? manageDecision
      : partsViewDecision.kind !== 'allowed'
        ? partsViewDecision
        : partQuotaDecision
  const partsMediaManage =
    decision(cabinetModules.parts, 'parts.manage', false).kind === 'allowed'
  const financeManage =
    decision(cabinetModules.intakes, 'finance.manage', false).kind === 'allowed'
  return {
    cabinet,
    createDecision,
    manageDecision,
    partCreateDecision,
    partsMediaManage,
    financeManage,
    manage: manageDecision.kind === 'allowed',
    partsView: partsViewDecision.kind === 'allowed',
    financeView:
      viewDecision(cabinetModules.intakes, 'finance.view').kind === 'allowed',
  }
}

const allowedToView = (
  definition: CabinetModuleDefinition,
  cabinet: ReturnType<typeof useCabinet>,
) =>
  evaluateModuleAccess(
    { ...definition, released: true },
    cabinet.status === 'ready' && cabinet.snapshot
      ? { status: 'ready', snapshot: cabinet.snapshot, error: null }
      : { status: 'loading', snapshot: null, error: null },
    'view',
  ).kind === 'allowed'

function Denied({ decision }: { decision: ModuleAccessDecision }) {
  const message =
    decision.kind === 'quota-exhausted'
      ? decision.resource === 'parts'
        ? 'Ліміт запчастин вичерпано.'
        : 'Ліміт приймань вичерпано.'
      : decision.kind === 'subscription-blocked'
        ? 'Поточна підписка не дозволяє цю дію.'
        : 'Недостатньо прав.'
  return (
    <Notice role="alert" tone="warn">
      {message}
    </Notice>
  )
}

export function IntakesScreen(_props: Partial<CabinetModuleScreenProps> = {}) {
  const {
    cabinet,
    createDecision,
    manageDecision,
    partCreateDecision,
    partsMediaManage,
    financeManage,
  } = useIntakeAccess()
  const params = useParams<{ tenant: string; intakeId: string }>()
  const location = useLocation()
  const tenant = params.tenant ?? cabinet.targetTenant?.slug ?? ''
  const base = `/app/${tenant}/intakes`
  const intakeId = params.intakeId
  if (location.pathname.endsWith('/parts/new')) {
    if (manageDecision.kind !== 'allowed')
      return <Denied decision={manageDecision} />
    if (partCreateDecision.kind !== 'allowed')
      return <Denied decision={partCreateDecision} />
    return intakeId ? (
      <PartForm canUploadMedia={partsMediaManage} intakeId={intakeId} />
    ) : (
      <Denied decision={{ kind: 'permission-denied' }} />
    )
  }
  if (
    location.pathname.endsWith('/new') ||
    location.pathname.endsWith('/batch')
  ) {
    if (createDecision.kind !== 'allowed')
      return <Denied decision={createDecision} />
    return (
      <IntakeForm
        batch={location.pathname.endsWith('/batch')}
        canManageFinance={financeManage}
        title="Нове приймання"
        submit={(request, signal) => intakesApi.create(request, { signal })}
      />
    )
  }
  if (intakeId && location.pathname.endsWith('/edit')) {
    if (manageDecision.kind !== 'allowed')
      return <Denied decision={manageDecision} />
    return (
      <IntakeForm
        canManageFinance={financeManage}
        intakeId={intakeId}
        title="Редагувати приймання"
        submit={(request, signal) =>
          intakesApi.update(intakeId, request, { signal })
        }
      />
    )
  }
  if (intakeId) return <IntakeDetail base={base} intakeId={intakeId} />
  return <IntakesList base={base} />
}

function IntakesList({ base }: { base: string }) {
  const { createDecision } = useIntakeAccess()
  const [searchParams, setSearchParams] = useSearchParams()
  const selection = useMemo<IntakeListParams>(
    () => ({
      search: searchParams.get('search') ?? undefined,
      status: isIntakeStatus(searchParams.get('status'))
        ? (searchParams.get('status') as IntakeListParams['status'])
        : undefined,
      page: positiveInteger(searchParams.get('page'), 1),
      pageSize: pageSizeParam(searchParams.get('pageSize'), defaultPageSize),
    }),
    [searchParams],
  )
  const [query, setQuery] = useState(searchParams.get('search') ?? '')
  const [state, setState] = useState<{
    page: Awaited<ReturnType<typeof intakesApi.list>> | null
    error: string | null
  }>({ page: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    void intakesApi.list(selection, { signal: controller.signal }).then(
      (page) => setState({ page, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            error: normalizeApiProblem(error).message,
          }))
      },
    )
    return () => controller.abort()
  }, [selection])
  const updateSearch = () => {
    const next = new URLSearchParams(searchParams)
    const value = query.trim()
    if (value) next.set('search', value)
    else next.delete('search')
    next.set('page', '1')
    setSearchParams(next)
  }
  const updatePage = (page: number, pageSize: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    setSearchParams(next)
  }
  const currentPage = state.page?.page ?? selection.page ?? 1
  const currentPageSize =
    state.page?.pageSize ?? selection.pageSize ?? defaultPageSize
  const totalPages = state.page?.totalPages ?? 1
  return (
    <PageBody>
      <PageHeader
        actions={
          createDecision.kind === 'allowed' ? (
            <Button asChild variant="primary">
              <Link to={`${base}/new`}>
                <Plus aria-hidden />
                Нове приймання
              </Link>
            </Button>
          ) : undefined
        }
        eyebrow="Склад"
        title="Приймання авто"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          updateSearch()
        }}
      >
        <Toolbar>
          <Field className="min-w-52 flex-1" label="Пошук приймань">
            <SearchInput
              aria-label="Пошук приймань"
              onChange={(event) => setQuery(event.target.value)}
              value={query}
            />
          </Field>
          <Field className="min-w-40" label="Статус">
            <SelectInput
              onChange={(event) => {
                const next = new URLSearchParams(searchParams)
                if (event.target.value) next.set('status', event.target.value)
                else next.delete('status')
                next.set('page', '1')
                setSearchParams(next)
              }}
              value={selection.status ?? ''}
            >
              <option value="">Усі</option>
              <option value="active">Активні</option>
              <option value="closed">Закриті</option>
            </SelectInput>
          </Field>
          <Button type="submit" variant="primary">
            Шукати
          </Button>
        </Toolbar>
      </form>
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      <StatStrip
        items={[{ label: 'знайдено', value: state.page?.total ?? 0 }]}
      />
      <DataTable
        caption="Список приймань"
        columns={[
          {
            key: 'name',
            label: 'Приймання',
            variant: 'primary',
            cell: (intake) => (
              <Link
                className="hover:text-brand block"
                to={`${base}/${intake.id}`}
              >
                {intake.name ?? 'Без назви'}
              </Link>
            ),
          },
          {
            key: 'supplier',
            label: 'Постачальник',
            cell: (intake) => intake.supplier ?? 'Постачальника не вказано',
          },
          {
            key: 'parts',
            label: 'Запчастин',
            align: 'end',
            cell: (intake) => intake.partsCount,
          },
        ]}
        empty={
          <EmptyState
            description="Створіть перше приймання, щоб оприбуткувати партію запчастин."
            title="Приймань поки немає"
          />
        }
        footer={
          <Pagination
            label="Пагінація приймань"
            onPage={(nextPage) => updatePage(nextPage, currentPageSize)}
            page={currentPage}
            totalPages={totalPages}
          />
        }
        rowKey={(intake) => intake.id}
        rows={state.page?.items ?? []}
      />
    </PageBody>
  )
}

function IntakeDetail({ base, intakeId }: { base: string; intakeId: string }) {
  const { manage, partsView, partCreateDecision, financeView } =
    useIntakeAccess()
  const navigate = useNavigate()
  const [intake, setIntake] = useState<Intake | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.intakes,
  )
  useEffect(() => {
    const controller = new AbortController()
    void intakesApi
      .get(intakeId, { signal: controller.signal })
      .then(setIntake, (error: unknown) => {
        if (!controller.signal.aborted)
          setProblem(normalizeApiProblem(error).message)
      })
    return () => controller.abort()
  }, [intakeId])
  const remove = async () => {
    if (busy) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      await intakesApi.remove(intakeId, { signal: scope.signal })
      void navigate(base)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }
  if (!intake && problem)
    return (
      <PageBody width="narrow">
        <ErrorState
          actions={
            <Button asChild>
              <Link to={base}>До списку</Link>
            </Button>
          }
          description={problem}
          title="Не вдалося завантажити приймання"
        />
      </PageBody>
    )
  if (!intake)
    return (
      <PageBody width="narrow">
        <SkeletonRows label="Завантажуємо приймання…" rows={3} />
      </PageBody>
    )
  return (
    <PageBody aria-busy={busy} className="max-w-4xl" role="main">
      <Button asChild className="justify-self-start" variant="quiet">
        <Link to={base}>
          <ChevronLeft aria-hidden />
          До приймань
        </Link>
      </Button>
      <PageHeader
        actions={
          manage ? (
            <>
              <Button asChild variant="primary">
                <Link to={`${base}/${intake.id}/edit`}>Редагувати</Link>
              </Button>
              {partCreateDecision.kind === 'allowed' ? (
                <Button asChild>
                  <Link to={`${base}/${intake.id}/parts/new`}>
                    Додати запчастину
                  </Link>
                </Button>
              ) : null}
              <Button
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                variant="danger"
              >
                Видалити
              </Button>
            </>
          ) : undefined
        }
        eyebrow="Склад · Приймання"
        title={intake.name ?? 'Приймання без назви'}
      />
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      <Panel>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Постачальник">{intake.supplier ?? 'не вказано'}</Fact>
          <Fact label="Дата придбання">
            {intake.purchasedAt ?? 'не вказано'}
          </Fact>
          {financeView ? (
            <Fact label="Вартість">
              {intake.totalCost === null
                ? 'не вказано'
                : money(intake.totalCost)}
            </Fact>
          ) : null}
          <Fact label="Створив">{intake.createdBy.displayName}</Fact>
          <Fact label="Нотатки">{intake.notes ?? 'Нотаток немає'}</Fact>
        </dl>
      </Panel>
      {intake.photos.length > 0 ? (
        <section aria-label="Фото приймання" className="grid gap-2">
          <h2 className="text-base font-semibold text-white">Фото</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {intake.photos.map((photo, index) => (
              <li key={photo.url}>
                <a
                  className="rounded-panel border-app-line block overflow-hidden border"
                  href={photo.url}
                >
                  <img
                    alt={`Фото приймання ${index + 1}`}
                    className="aspect-4/3 w-full object-cover"
                    src={photo.thumbnailUrl || photo.url}
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {financeView && intake.profitability ? (
        <section aria-label="Прибутковість" className="grid gap-2">
          <h2 className="text-base font-semibold text-white">Прибутковість</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              accent
              label="Інвестовано"
              value={money(intake.profitability.invested)}
            />
            <StatCard
              label="Повернено"
              value={money(intake.profitability.recouped)}
            />
            <StatCard
              label="Повернення"
              value={`${String(intake.profitability.recoupedPercent ?? '—')}%`}
            />
          </div>
        </section>
      ) : null}
      {partsView ? (
        <section className="grid gap-2">
          <h2 className="text-base font-semibold text-white">Запчастини</h2>
          <DataTable
            caption="Запчастини приймання"
            columns={[
              {
                key: 'name',
                label: 'Деталь',
                variant: 'primary',
                cell: (part) => part.name,
              },
              {
                key: 'quantity',
                label: 'Кількість',
                align: 'end',
                cell: (part) => `${String(part.quantity)} ${part.unit}`,
              },
              {
                key: 'status',
                label: 'Стан',
                cell: (part) => part.status,
              },
            ]}
            empty={
              <EmptyState
                description="Додайте запчастину, щоб оприбуткувати вміст цього приймання."
                title="У прийманні ще немає запчастин"
              />
            }
            rowKey={(part) => part.id}
            rows={intake.parts}
          />
        </section>
      ) : null}
      <ConfirmDialog
        confirmLabel="Видалити"
        consequence="Приймання та його звʼязок із оприбуткованими деталями зникнуть назавжди."
        onConfirm={() => void remove()}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={busy}
        title="Видалити приймання?"
      />
    </PageBody>
  )
}

function IntakeForm({
  title,
  intakeId,
  batch = false,
  canManageFinance,
  submit,
}: {
  title: string
  intakeId?: string
  batch?: boolean
  canManageFinance: boolean
  submit: (request: CreateIntakeRequest, signal: AbortSignal) => Promise<Intake>
}) {
  const cabinet = useCabinet()
  const params = useParams<{ tenant: string }>()
  const navigate = useNavigate()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const [values, setValues] = useState({
    name: '',
    supplier: '',
    purchasedAt: '',
    totalCost: '',
    notes: '',
  })
  const [media, setMedia] = useState<MediaUploadResult[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ totalCost?: string }>({})
  const [busy, setBusy] = useState(false)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.intakes,
  )
  const update =
    (key: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target
      setValues((current) => ({ ...current, [key]: value }))
    }
  useEffect(() => {
    if (!intakeId) return
    const controller = new AbortController()
    void intakesApi.get(intakeId, { signal: controller.signal }).then(
      (intake) =>
        setValues({
          name: intake.name ?? '',
          supplier: intake.supplier ?? '',
          purchasedAt: intake.purchasedAt ?? '',
          totalCost:
            canManageFinance && intake.totalCost !== null
              ? String(intake.totalCost)
              : '',
          notes: intake.notes ?? '',
        }),
      (error: unknown) => {
        if (!controller.signal.aborted)
          setProblem(normalizeApiProblem(error).message)
      },
    )
    return () => controller.abort()
  }, [canManageFinance, intakeId])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const amount = values.totalCost === '' ? null : Number(values.totalCost)
    if (
      canManageFinance &&
      amount !== null &&
      (!Number.isFinite(amount) || amount < 0)
    ) {
      setFieldErrors({
        totalCost:
          'Вартість має бути числом не менше нуля. Введіть суму цифрами, наприклад 7500.',
      })
      return
    }
    setFieldErrors({})
    setBusy(true)
    try {
      const request = {
        name: values.name.trim() || null,
        supplier: values.supplier.trim() || null,
        purchasedAt: values.purchasedAt || null,
        ...(canManageFinance ? { totalCost: amount } : {}),
        notes: values.notes.trim() || null,
      }
      const scope = requireLatestMutation({ quota: intakeId === undefined })
      if ('totalCost' in request)
        requireLatestMutation({
          permission: 'finance.manage',
          quota: false,
        })
      const intake = await submit(
        intakeId
          ? request
          : { ...request, photoKeys: media.map((item) => item.storageKey) },
        scope.signal,
      )
      void navigate(`${base}/${intake.id}`)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }
  const backTo = intakeId ? `${base}/${intakeId}` : base
  return (
    <PageBody role="main" width="narrow">
      <Button asChild className="justify-self-start" variant="quiet">
        <Link to={backTo}>
          <ChevronLeft aria-hidden />
          {intakeId ? 'До приймання' : 'До приймань'}
        </Link>
      </Button>
      <PageHeader eyebrow="Склад · Приймання" title={title} />
      {batch ? (
        <Panel className="grid gap-1.5">
          <h2 className="text-sm font-semibold text-white">Підсумок партії</h2>
          <p aria-label="Підсумок партії" className="text-app-muted text-sm">
            Підсумок: {values.name || 'без назви'} ·{' '}
            {values.supplier || 'без постачальника'}
            {canManageFinance
              ? ` · ${values.totalCost || 'вартість не вказано'}`
              : null}
          </p>
        </Panel>
      ) : null}
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      <form
        aria-busy={busy}
        className="grid gap-4"
        onSubmit={(event) => void save(event)}
      >
        <Panel className="grid gap-3">
          <h2 className="text-base font-semibold text-white">Партія</h2>
          <Field hint="Як у накладній постачальника" label="Назва">
            <TextInput
              autoComplete="off"
              name="name"
              onChange={update('name')}
              value={values.name}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Field className="min-w-52 flex-1" label="Постачальник">
              <TextInput
                autoComplete="off"
                name="supplier"
                onChange={update('supplier')}
                value={values.supplier}
              />
            </Field>
            <Field
              className="min-w-52 flex-1"
              hint="Формат РРРР-ММ-ДД"
              label="Дата придбання"
            >
              <TextInput
                inputMode="numeric"
                name="purchasedAt"
                onChange={update('purchasedAt')}
                placeholder="2026-08-01"
                value={values.purchasedAt}
              />
            </Field>
          </div>
        </Panel>
        {canManageFinance ? (
          <Panel className="grid gap-3">
            <h2 className="text-base font-semibold text-white">Гроші</h2>
            <Field
              className="max-w-xs"
              error={fieldErrors.totalCost}
              hint="Скільки заплачено за всю партію. Порожнє поле — вартість не фіксуємо."
              label="Загальна вартість"
            >
              <TextInput
                inputMode="decimal"
                name="totalCost"
                onChange={update('totalCost')}
                placeholder="0"
                value={values.totalCost}
              />
            </Field>
          </Panel>
        ) : null}
        <Panel className="grid gap-3">
          <Field
            hint="Домовленості, стан партії, усе, що знадобиться складу згодом"
            label="Нотатки"
          >
            <TextArea
              name="notes"
              onChange={update('notes')}
              value={values.notes}
            />
          </Field>
        </Panel>
        {!intakeId ? (
          <Panel>
            <MediaPicker
              entityType="intakes"
              items={media}
              onChange={setMedia}
            />
          </Panel>
        ) : null}
        <div className="border-app-line rounded-panel bg-app-raised flex flex-wrap items-center gap-2 border p-3">
          <Button disabled={busy} type="submit" variant="primary">
            Зберегти
          </Button>
          <Button asChild variant="quiet">
            <Link to={backTo}>Скасувати</Link>
          </Button>
        </div>
      </form>
    </PageBody>
  )
}

/** The four states a yard actually sorts parts into, mapped to the server enum. */
const INTAKE_CONDITIONS = [
  { value: 'good', label: 'б/в' },
  { value: 'refurbished', label: 'після ремонту' },
  { value: 'new', label: 'нова' },
  { value: 'scrap', label: 'під відновлення' },
] as const

/** A part added in this sitting, kept only for the session's own recap. */
interface AddedPart {
  id: string
  name: string
  quantity: number
  unit: string
  zone: string | null
}

function PartForm({
  canUploadMedia,
  intakeId,
}: {
  canUploadMedia: boolean
  intakeId: string
}) {
  const navigate = useNavigate()
  const cabinet = useCabinet()
  const params = useParams<{ tenant: string }>()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const canPlace = allowedToView(cabinetModules.inventory, cabinet)
  const [values, setValues] = useState({
    name: '',
    partType: '',
    oemCode: '',
    condition: 'good',
    quantity: 1,
    unit: 'шт',
    price: '',
    zoneId: '',
    notes: '',
  })
  const [media, setMedia] = useState<MediaUploadResult[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({})
  const [intake, setIntake] = useState<Intake | null>(null)
  const [zones, setZones] = useState<InventoryZone[]>([])
  const [added, setAdded] = useState<AddedPart[]>([])
  const [busy, setBusy] = useState(false)
  const intakeMutation = useLatestMutationGuard(cabinetModules.intakes)
  const partMutation = useLatestMutationGuard(cabinetModules.parts)

  useEffect(() => {
    const controller = new AbortController()
    void intakesApi.get(intakeId, { signal: controller.signal }).then(
      (next) => {
        if (!controller.signal.aborted) setIntake(next)
      },
      () => undefined,
    )
    return () => controller.abort()
  }, [intakeId])

  useEffect(() => {
    if (!canPlace) return
    const controller = new AbortController()
    void inventoryApi
      .getZones({ activeOnly: true, signal: controller.signal })
      .then(
        (next) => {
          if (!controller.signal.aborted) setZones(next)
        },
        () => {
          // Without zones the cell simply stays unset — the part is still added.
        },
      )
    return () => controller.abort()
  }, [canPlace])

  const update = (key: keyof typeof values, value: string | number) =>
    setValues((current) => ({ ...current, [key]: value }))

  /**
   * What one piece of this batch cost: the price of the whole intake spread
   * over the positions already in it. It is the yard's own arithmetic, shown
   * so the sale price is set against something rather than guessed.
   */
  const unitCost =
    intake && intake.totalCost !== null && intake.partsCount > 0
      ? intake.totalCost / intake.partsCount
      : null
  const price = Number(values.price.replace(',', '.'))
  const hasPrice =
    values.price.trim() !== '' && Number.isFinite(price) && price > 0
  const margin =
    hasPrice && unitCost !== null
      ? Math.round(((price - unitCost) / price) * 100)
      : null
  const named = values.name.trim().length > 0
  const zone = zones.find((item) => item.id === values.zoneId) ?? null

  const save = async (event: React.FormEvent, andAnother = false) => {
    event.preventDefault()
    if (busy) return
    if (!named) {
      setFieldErrors({
        name: 'Вкажіть назву деталі, як її шукатимуть на складі — наприклад, «Бампер передній».',
      })
      return
    }
    setFieldErrors({})
    const request: AddIntakePartRequest = {
      name: values.name.trim(),
      partType: values.partType.trim() || null,
      condition: values.condition || null,
      quantity: values.quantity,
      unit: values.unit || null,
      notes: values.notes.trim() || null,
      photoKeys: media.map((item) => item.storageKey),
      ...(values.zoneId ? { inventoryZoneIds: [values.zoneId] } : {}),
    }
    setBusy(true)
    try {
      const intakeScope = intakeMutation.requireLatestMutation({ quota: false })
      partMutation.requireLatestMutation({ permission: 'parts.view' })
      const created = await intakesApi.addPart(intakeId, request, {
        signal: intakeScope.signal,
      })
      // The intake endpoint carries no price, so the asking price is set on the
      // part it just created — one call, right after, before anyone sees it.
      if (hasPrice) {
        const priceScope = partMutation.requireLatestMutation({
          permission: 'parts.manage',
          quota: false,
        })
        await partsApi.update(
          created.id,
          { desiredSalePrice: { isSet: true, value: price } },
          { signal: priceScope.signal },
        )
      }
      if (!andAnother) {
        void navigate(`${base}/${intakeId}`)
        return
      }
      setAdded((current) => [
        {
          id: created.id,
          name: request.name,
          quantity: values.quantity,
          unit: values.unit || 'шт',
          zone: zone?.code ?? null,
        },
        ...current,
      ])
      setValues((current) => ({
        ...current,
        name: '',
        partType: '',
        oemCode: '',
        quantity: 1,
        price: '',
        notes: '',
      }))
      setMedia([])
      setIntake(
        (current) =>
          current && { ...current, partsCount: current.partsCount + 1 },
      )
      setBusy(false)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }

  const backTo = `${base}/${intakeId}`
  const saveNote = named
    ? 'Деталь отримає QR-код і потрапить у це приймання.'
    : 'Вкажіть назву, щоб додати деталь.'

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            До приймання
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Склад</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>Приймання</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            aria-busy={busy}
            className="px-[18px] text-sm font-semibold"
            disabled={busy || !named}
            onClick={(event) => void save(event, true)}
          >
            Зберегти й додати ще
          </Button>
          <Button
            aria-busy={busy}
            className="px-5 text-sm font-bold"
            disabled={busy || !named}
            onClick={(event) => void save(event)}
            variant="primary"
          >
            Додати деталь
          </Button>
        </div>
      </div>

      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
            Додати деталь
          </h1>
          <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium">
            <span>
              Деталь у приймання{' '}
              <span className="text-app-ink font-semibold">
                {intake?.name ?? '…'}
              </span>
            </span>
            {intake ? (
              <>
                <span aria-hidden className="text-white/20">
                  ·
                </span>
                <span>
                  уже {intake.partsCount}{' '}
                  {plural(intake.partsCount, ['позиція', 'позиції', 'позицій'])}
                </span>
              </>
            ) : null}
          </p>
        </div>

        {problem ? <Notice tone="danger">{problem}</Notice> : null}

        <form
          aria-busy={busy}
          className="flex flex-wrap items-start gap-6"
          onSubmit={(event) => void save(event)}
        >
          <div className="grid min-w-[320px] flex-[1_1_560px] gap-5">
            <FormCard step="01" title="Опис">
              <Field
                error={fieldErrors.name}
                hint="Назва, за якою деталь шукатимуть на складі"
                label="Назва"
                required
              >
                <TextInput
                  autoComplete="off"
                  name="name"
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="Наприклад: Фара права LED"
                  required
                  value={values.name}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Тип деталі">
                  <TextInput
                    autoComplete="off"
                    name="partType"
                    onChange={(event) => update('partType', event.target.value)}
                    placeholder="оптика, кузов, ходова"
                    value={values.partType}
                  />
                </Field>
                <Field
                  hint="Приймання поки не зберігає OEM — впишіть його на картці деталі"
                  label="OEM-код"
                >
                  <TextInput
                    className="font-mono"
                    disabled
                    name="oemCode"
                    placeholder="1RV-8820-02"
                    value=""
                  />
                </Field>
              </div>
              <Field label="Стан">
                <PillGroup
                  label="Стан деталі"
                  onChange={(next) => update('condition', next)}
                  options={INTAKE_CONDITIONS}
                  value={values.condition}
                />
              </Field>
            </FormCard>

            <FormCard
              description={
                unitCost === null
                  ? 'Собівартість позиції з’явиться, щойно приймання матиме ціну й позиції.'
                  : `Собівартість підтягується з партії — ${money(unitCost)} на одиницю.`
              }
              step="02"
              title="Кількість і ціна"
            >
              <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr]">
                <Field label="Кількість" required>
                  <QuantityStepper
                    label="Кількість деталей"
                    min={1}
                    onChange={(next) => update('quantity', next)}
                    value={values.quantity}
                  />
                </Field>
                <Field hint="шт, компл, кг" label="Одиниця">
                  <TextInput
                    autoComplete="off"
                    name="unit"
                    onChange={(event) => update('unit', event.target.value)}
                    value={values.unit}
                  />
                </Field>
                <Field hint="Бажана ціна, у доларах" label="Ціна продажу">
                  <TextInput
                    inputMode="decimal"
                    name="price"
                    onChange={(event) => update('price', event.target.value)}
                    placeholder="0"
                    value={values.price}
                  />
                </Field>
              </div>
            </FormCard>

            {canPlace ? (
              <FormCard
                description="Можна вказати комірку зараз або розмістити партію пізніше."
                step="03"
                title="Розміщення"
              >
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Комірка">
                    <SelectInput
                      name="zoneId"
                      onChange={(event) => update('zoneId', event.target.value)}
                      value={values.zoneId}
                    >
                      <option value="">Без комірки</option>
                      {zones.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Button
                    className="min-h-11"
                    disabled
                    title="Сканування комірки камерою ще не підключене до цієї форми"
                    type="button"
                  >
                    <ScanLine aria-hidden />
                    Сканувати
                  </Button>
                </div>
              </FormCard>
            ) : null}

            <FormCard step={canPlace ? '04' : '03'} title="Фото й нотатки">
              {canUploadMedia ? (
                <MediaPicker
                  beforeDispatch={() => {
                    intakeMutation.requireLatestMutation({ quota: false })
                    partMutation.requireLatestMutation({
                      permission: 'parts.view',
                      quota: false,
                    })
                  }}
                  entityType="parts"
                  items={media}
                  onChange={setMedia}
                />
              ) : null}
              <Field label="Нотатки">
                <TextArea
                  name="notes"
                  onChange={(event) => update('notes', event.target.value)}
                  placeholder="Дефекти, комплектність"
                  rows={2}
                  value={values.notes}
                />
              </Field>
            </FormCard>
          </div>

          <aside className="sticky top-24 grid min-w-[280px] flex-[0_0_320px] gap-5">
            <Card title="Нова позиція">
              <div className="border-app-line bg-app-input rounded-[14px] border p-4">
                <p
                  className={cn(
                    'text-[17px] font-bold tracking-[-0.015em]',
                    named ? 'text-white' : 'text-app-dim',
                  )}
                >
                  {named ? values.name : 'Назва деталі'}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusPill tone={zone ? 'ok' : 'warn'}>
                    {zone ? `Доступно · ${zone.code}` : 'Без комірки'}
                  </StatusPill>
                  <span className="text-app-muted font-mono text-[13px]">
                    {values.quantity} {values.unit || 'шт'}
                  </span>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                <dt className="text-app-muted text-sm font-semibold">
                  Собівартість
                </dt>
                <dd className="font-mono text-[16px] text-white tabular-nums">
                  {unitCost === null ? '—' : money(unitCost)}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  Ціна продажу
                </dt>
                <dd
                  className={cn(
                    'font-mono text-[16px] tabular-nums',
                    hasPrice ? 'text-white' : 'text-app-dim',
                  )}
                >
                  {hasPrice ? money(price) : '—'}
                </dd>
                <div className="bg-app-line col-span-2 my-1 h-px" />
                <dt className="text-[16px] font-bold text-white">Маржа</dt>
                <dd
                  className={cn(
                    'font-mono text-[20px] tabular-nums',
                    margin === null
                      ? 'text-app-dim'
                      : margin >= 30
                        ? 'text-state-ok'
                        : margin > 0
                          ? 'text-state-warn'
                          : 'text-state-danger',
                  )}
                >
                  {margin === null ? '—' : `${String(margin)}%`}
                </dd>
              </dl>
              <Button
                aria-busy={busy}
                className="mt-5 min-h-12 w-full text-[16px] font-bold"
                disabled={busy || !named}
                type="submit"
                variant="primary"
              >
                Додати деталь
              </Button>
              <p className="text-app-dim mt-3 text-[13px] leading-[1.5]">
                {saveNote}
              </p>
            </Card>

            {added.length > 0 ? (
              <Card
                aside={
                  <span className="text-app-muted font-mono text-[12px]">
                    {added.length}
                  </span>
                }
                bodyClassName="p-0"
                title="Додані щойно"
              >
                <ul className="divide-app-line grid divide-y">
                  {added.map((item) => (
                    <li
                      className="flex items-center gap-3 px-6 py-3"
                      key={item.id}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {item.name}
                        </span>
                        <span className="text-app-muted mt-0.5 block font-mono text-[13px]">
                          {item.zone ?? 'без комірки'}
                        </span>
                      </span>
                      <span className="text-app-muted font-mono text-[14px] whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </aside>
        </form>
      </div>
    </div>
  )
}

/** A numbered step of a long form, as the redesign draws it. */
function FormCard({
  step,
  title,
  description,
  children,
}: {
  step: string
  title: string
  description?: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="border-app-line bg-app-raised rounded-[18px] border px-6 pt-[22px] pb-6"
    >
      <div className="flex items-baseline gap-2.5">
        <span className="text-app-dim font-mono text-[12px]">{step}</span>
        <h2
          className="text-[17px] font-bold tracking-[-0.01em] text-white"
          id={titleId}
        >
          {title}
        </h2>
      </div>
      {description === undefined ? null : (
        <p className="text-app-muted mt-1.5 text-sm">{description}</p>
      )}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  )
}
