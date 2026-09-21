import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ordersApi } from '@/api/orders'
import {
  Button,
  ConfirmDialog,
  DeniedState,
  Field,
  Notice,
  PageBody,
  PageHeader,
  SectionPanel,
  TextArea,
} from '@/components/app'
import type { CustomerSearchItem } from '@/api/customers'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  ORDER_NOTES_MAX_LENGTH,
  canContinueOrderStep,
  normalizeOrderNotes,
  orderDraftTotal,
  parseOrderPrice,
  type OrderCreateStep,
  type OrderDraftItem,
} from './order-create-model'
import {
  OrderCreatePartsStep,
  OrderCreatePricesStep,
} from './OrderCreatePartsStep'
import { OrderCreateCustomerStep } from './OrderCreateCustomerStep'

const STEPS: readonly { id: OrderCreateStep; label: string }[] = [
  { id: 'parts', label: 'Запчастини' },
  { id: 'prices', label: 'Ціна' },
  { id: 'customer', label: 'Клієнт' },
  { id: 'summary', label: 'Підсумок' },
]

interface OrderDraft {
  items: OrderDraftItem[]
  selectedCustomer: CustomerSearchItem | null
  notes: string
}

export function OrderCreateScreen({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const navigate = useNavigate()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<OrderDraft>({
    items: [],
    selectedCustomer: null,
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const savedRef = useRef(false)
  const submittingRef = useRef(false)

  const access =
    cabinet.status === 'ready' && cabinet.snapshot !== null
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const dependenciesAllowed =
    cabinet.targetTenant !== null &&
    evaluateModuleAccess(definition, access, 'mutation').kind === 'allowed' &&
    cabinet.snapshot?.permissions.has('parts.view') === true &&
    cabinet.snapshot.permissions.has('customers.view')
  const dirty = draft.items.length > 0 || draft.notes.length > 0

  useEffect(() => {
    if (!dirty || savedRef.current) return
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [dirty])

  if (!dependenciesAllowed || cabinet.targetTenant === null) {
    return (
      <PageBody width="narrow">
        <DeniedState
          description="Потрібен доступ до запчастин і клієнтів. Попросіть адміністратора розбірки відкрити ці розділи для вашої ролі."
          role="alert"
          title="Замовлення недоступні для створення"
        />
      </PageBody>
    )
  }

  const step = STEPS[stepIndex]!
  const tenantSlug = cabinet.targetTenant.slug
  const ordersPath = cabinetPath(tenantSlug, 'orders')

  const submit = async () => {
    if (
      submittingRef.current ||
      busy ||
      !canContinueOrderStep('prices', draft.items)
    )
      return
    submittingRef.current = true
    setBusy(true)
    setError(null)
    try {
      requireLatestMutation({ quota: false })
      requireLatestMutation({ permission: 'parts.view', quota: false })
      requireLatestMutation({ permission: 'customers.view', quota: false })
      const created = await ordersApi.create({
        customerId: draft.selectedCustomer?.id ?? null,
        notes: normalizeOrderNotes(draft.notes),
        items: draft.items.map((item) => ({
          partId: item.part.id,
          quantity: item.quantity,
          unitPrice: parseOrderPrice(item.price)!,
        })),
      })
      savedRef.current = true
      await navigate(cabinetPath(tenantSlug, 'orders', created.id), {
        replace: true,
      })
    } catch {
      setError(
        'Не вдалося створити замовлення. Перевірте дані та спробуйте ще раз.',
      )
      setBusy(false)
      submittingRef.current = false
    }
  }

  return (
    <PageBody width="narrow">
      <PageHeader eyebrow="Продажі · Замовлення" title="Нове замовлення" />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <nav aria-label="Кроки створення замовлення" className="grid gap-2">
        <div className="grid grid-cols-4 gap-2" aria-hidden="true">
          {STEPS.map((candidate, index) => (
            <span
              className={
                index <= stepIndex
                  ? 'bg-app-accent h-1 rounded-full'
                  : 'bg-app-line h-1 rounded-full'
              }
              key={candidate.id}
            />
          ))}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-app-dim text-sm tabular-nums">
            {stepIndex + 1} / {STEPS.length}
          </p>
          <p className="text-sm font-medium text-white">{step.label}</p>
        </div>
      </nav>

      <SectionPanel
        description={
          step.id === 'parts'
            ? 'Оберіть запчастини, які потрібно додати до замовлення.'
            : step.id === 'prices'
              ? 'Перевірте кількість і вкажіть ціну кожної запчастини.'
              : undefined
        }
        title={step.label}
      >
        {step.id === 'parts' ? (
          <OrderCreatePartsStep
            items={draft.items}
            onItemsChange={(items) =>
              setDraft((current) => ({ ...current, items }))
            }
          />
        ) : step.id === 'prices' ? (
          <OrderCreatePricesStep
            items={draft.items}
            onAddMore={() => setStepIndex(0)}
            onItemsChange={(items) =>
              setDraft((current) => ({ ...current, items }))
            }
          />
        ) : step.id === 'customer' ? (
          <OrderCreateCustomerStep
            definition={definition}
            onSelectCustomer={(selectedCustomer) =>
              setDraft((current) => ({ ...current, selectedCustomer }))
            }
            selectedCustomer={draft.selectedCustomer}
          />
        ) : (
          <OrderCreateSummary
            draft={draft}
            onNotesChange={(notes) =>
              setDraft((current) => ({
                ...current,
                notes: notes.slice(0, ORDER_NOTES_MAX_LENGTH),
              }))
            }
          />
        )}
      </SectionPanel>

      <div className="border-app-line bg-app-raised flex flex-wrap items-center justify-between gap-3 rounded-panel border p-4">
        {stepIndex === 0 ? (
          <Button
            onClick={() => {
              if (dirty) setDiscardOpen(true)
              else void navigate(ordersPath)
            }}
            variant="ghost"
          >
            Скасувати
          </Button>
        ) : (
          <Button
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            variant="ghost"
          >
            Назад
          </Button>
        )}
        <Button
          aria-busy={busy}
          disabled={busy || !canContinueOrderStep(step.id, draft.items)}
          onClick={() => {
            if (step.id === 'summary') void submit()
            else
              setStepIndex((current) => Math.min(STEPS.length - 1, current + 1))
          }}
          variant={step.id === 'summary' ? 'primary' : undefined}
        >
          {step.id === 'summary' ? 'Створити' : 'Далі'}
        </Button>
      </div>

      <ConfirmDialog
        confirmLabel="Вийти без збереження"
        consequence="Вибрані запчастини, ціни й нотатки буде втрачено."
        onConfirm={() => {
          savedRef.current = true
          void navigate(ordersPath)
        }}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title="Скасувати створення замовлення?"
      />
    </PageBody>
  )
}

function OrderCreateSummary({
  draft,
  onNotesChange,
}: {
  draft: OrderDraft
  onNotesChange: (notes: string) => void
}) {
  return (
    <div className="grid gap-4">
      {draft.selectedCustomer ? (
        <div>
          <p className="text-app-dim text-xs uppercase">Клієнт</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {draft.selectedCustomer.name}
          </p>
          {draft.selectedCustomer.phone ? (
            <p className="text-app-muted text-sm">
              {draft.selectedCustomer.phone}
            </p>
          ) : null}
        </div>
      ) : null}

      <Field
        hint={`${draft.notes.length}/${ORDER_NOTES_MAX_LENGTH}`}
        label="Нотатки"
      >
        <TextArea
          maxLength={ORDER_NOTES_MAX_LENGTH}
          onChange={(event) => onNotesChange(event.target.value)}
          value={draft.notes}
        />
      </Field>

      <div className="grid gap-2">
        {draft.items.map((item) => {
          const unitPrice = parseOrderPrice(item.price) ?? 0
          return (
            <article
              className="border-app-line bg-app-input grid grid-cols-[1fr_auto] gap-3 rounded-control border p-3"
              key={item.part.id}
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white">
                  {item.part.name}
                </h3>
                <p className="text-app-dim text-xs">
                  {item.quantity} шт. × {unitPrice} $
                </p>
              </div>
              <strong className="text-sm text-white tabular-nums">
                {item.quantity * unitPrice} $
              </strong>
            </article>
          )
        })}
      </div>

      <p className="border-app-line border-t pt-3 text-right text-lg font-semibold text-white tabular-nums">
        Разом: {orderDraftTotal(draft.items)} $
      </p>
    </div>
  )
}
