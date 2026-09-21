import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import {
  customersApi,
  readCustomerPhoneConflict,
  type CustomerPhoneConflict,
  type CustomerSearchItem,
} from '@/api/customers'
import {
  Button,
  ConfirmDialog,
  Field,
  FormDialog,
  Notice,
  SearchInput,
  TextInput,
} from '@/components/app'
import {
  newCustomerPhoneDraft,
  normalizeCustomerPhoneDraft,
} from '../customers/customer-phone'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

export function OrderCreateCustomerStep({
  definition,
  selectedCustomer,
  onSelectCustomer,
}: CabinetModuleScreenProps & {
  selectedCustomer: CustomerSearchItem | null
  onSelectCustomer: (customer: CustomerSearchItem | null) => void
}) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSearchItem[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState(newCustomerPhoneDraft())
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState<CustomerPhoneConflict | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const access =
    cabinet.status === 'ready' && cabinet.snapshot !== null
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const canCreateCustomer =
    evaluateModuleAccess(
      { ...definition, mutationPermission: 'customers.manage' },
      access,
      'mutation',
    ).kind === 'allowed'

  useEffect(() => {
    const customerId = params.get('customerId')
    if (!customerId || selectedCustomer) return
    const controller = new AbortController()
    void customersApi
      .getById(customerId, { signal: controller.signal })
      .then((customer) => {
        if (controller.signal.aborted) return
        onSelectCustomer({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          ordersCount: customer.ordersCount ?? 0,
        })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Не вдалося завантажити клієнта. Замовлення можна створити без нього.',
          )
      })
    return () => controller.abort()
  }, [params, selectedCustomer, onSelectCustomer])

  useEffect(() => {
    if (!query.trim() || selectedCustomer) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void customersApi
        .search(query.trim(), { signal: controller.signal })
        .then((customers) => {
          if (!controller.signal.aborted) setResults(customers)
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError('Не вдалося знайти клієнтів.')
        })
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, selectedCustomer])

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node))
        setPickerOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const openCreate = () => {
    setCustomerName(query.trim())
    setCustomerPhone(newCustomerPhoneDraft())
    setError(null)
    setPickerOpen(false)
    setCreateOpen(true)
  }

  const createCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customerName.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const scope = requireLatestMutation({
        permission: 'customers.manage',
        quota: false,
      })
      const response = await customersApi.create(
        {
          name: customerName.trim(),
          phone: customerPhone === '+380' ? null : customerPhone,
          notes: null,
        },
        { signal: scope.signal },
      )
      onSelectCustomer({
        id: response.customer.id,
        name: response.customer.name,
        phone: response.customer.phone,
        ordersCount: response.customer.ordersCount,
      })
      setCreateOpen(false)
      setQuery('')
    } catch (requestError) {
      const duplicate = readCustomerPhoneConflict(requestError)
      if (duplicate) {
        setCreateOpen(false)
        setConflict(duplicate)
      } else {
        setError('Не вдалося створити клієнта.')
      }
    } finally {
      setBusy(false)
    }
  }

  const resolveConflict = async () => {
    if (!conflict || busy) return
    setBusy(true)
    try {
      const scope = requireLatestMutation({
        permission: conflict.isActive ? 'customers.view' : 'customers.manage',
        quota: false,
      })
      const customer = conflict.isActive
        ? await customersApi.getById(conflict.customerId, {
            signal: scope.signal,
          })
        : await customersApi.activate(conflict.customerId, {
            signal: scope.signal,
          })
      onSelectCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        ordersCount: customer.ordersCount ?? 0,
      })
      setConflict(null)
      setQuery('')
    } catch {
      setError('Не вдалося вибрати клієнта.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-app-dim text-sm">
        Клієнта можна не вказувати. Ви зможете додати його пізніше.
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {selectedCustomer ? (
        <div className="border-app-line bg-app-input flex items-center justify-between gap-3 rounded-control border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {selectedCustomer.name}
            </p>
            <p className="text-app-dim text-xs">
              {selectedCustomer.phone ?? 'Телефон не вказано'}
            </p>
          </div>
          <Button onClick={() => onSelectCustomer(null)}>Змінити</Button>
        </div>
      ) : (
        <div className="relative grid gap-2" ref={pickerRef}>
          <Field label="Пошук клієнта">
            <SearchInput
              onChange={(event) => {
                setQuery(event.target.value)
                setPickerOpen(true)
              }}
              onFocus={() => setPickerOpen(true)}
              value={query}
            />
          </Field>
          {pickerOpen && query.trim() ? (
            <div className="border-app-line-2 bg-app-overlay absolute top-full z-20 mt-1 grid max-h-64 w-full gap-1 overflow-y-auto rounded-control border p-2 shadow-2xl">
              {results.map((customer) => (
                <Button
                  aria-label={`Обрати клієнта ${customer.name}`}
                  className="h-auto justify-start px-3 py-2 text-left"
                  key={customer.id}
                  onClick={() => {
                    onSelectCustomer(customer)
                    setPickerOpen(false)
                    setQuery('')
                    setResults([])
                  }}
                  variant="quiet"
                >
                  <span>
                    <strong className="block text-white">
                      {customer.name}
                    </strong>
                    <span className="text-app-dim block text-xs">
                      {customer.phone ?? 'Телефон не вказано'}
                    </span>
                  </span>
                </Button>
              ))}
              {canCreateCustomer ? (
                <Button onClick={openCreate} variant="primary">
                  Новий клієнт «{query.trim()}»
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <FormDialog
        error={error}
        onOpenChange={setCreateOpen}
        onSubmit={(event) => void createCustomer(event)}
        open={createOpen}
        pending={busy}
        submitDisabled={!customerName.trim()}
        submitLabel="Створити клієнта"
        title="Новий клієнт"
      >
        <Field label="Ім’я" required>
          <TextInput
            onChange={(event) => setCustomerName(event.target.value)}
            value={customerName}
          />
        </Field>
        <Field label="Телефон">
          <TextInput
            inputMode="tel"
            onChange={(event) =>
              setCustomerPhone(normalizeCustomerPhoneDraft(event.target.value))
            }
            value={customerPhone}
          />
        </Field>
      </FormDialog>

      <ConfirmDialog
        cancelLabel="Назад до форми"
        confirmLabel={
          conflict?.isActive ? 'Вибрати клієнта' : 'Активувати й вибрати'
        }
        consequence={conflict?.message ?? ''}
        destructive={false}
        onConfirm={() => void resolveConflict()}
        onOpenChange={(open) => {
          if (!open) {
            setConflict(null)
            setCreateOpen(true)
          }
        }}
        open={conflict !== null}
        pending={busy}
        title={conflict?.customerName ?? 'Клієнт уже існує'}
      />
    </div>
  )
}
