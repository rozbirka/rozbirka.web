import { useState } from 'react'
import { Link } from 'react-router'
import {
  Button,
  DeniedState,
  PageBody,
  PageHeader,
  SectionPanel,
} from '@/components/app'
import type { CustomerSearchItem } from '@/api/customers'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import {
  canContinueOrderStep,
  type OrderCreateStep,
  type OrderDraftItem,
} from './order-create-model'
import {
  OrderCreatePartsStep,
  OrderCreatePricesStep,
} from './OrderCreatePartsStep'

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
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<OrderDraft>({
    items: [],
    selectedCustomer: null,
    notes: '',
  })

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
  const ordersPath = cabinetPath(cabinet.targetTenant.slug, 'orders')

  return (
    <PageBody width="narrow">
      <PageHeader eyebrow="Продажі · Замовлення" title="Нове замовлення" />

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
        ) : (
          <p className="text-app-dim text-sm">Наступний крок замовлення.</p>
        )}
      </SectionPanel>

      <div className="border-app-line bg-app-raised flex flex-wrap items-center justify-between gap-3 rounded-panel border p-4">
        {stepIndex === 0 ? (
          <Button asChild variant="ghost">
            <Link to={ordersPath}>Скасувати</Link>
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
          disabled={!canContinueOrderStep(step.id, draft.items)}
          onClick={() =>
            setStepIndex((current) => Math.min(STEPS.length - 1, current + 1))
          }
        >
          Далі
        </Button>
      </div>
    </PageBody>
  )
}
