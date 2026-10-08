import { useEffect, useId, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import {
  Button,
  Field,
  Notice,
  Sheet,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import { cn } from '@/lib/utils'
import {
  customersApi,
  readCustomerPhoneConflict,
  type CustomerPhoneConflict,
  type CustomerSearchItem,
} from '@/api/customers'
import { normalizeApiProblem } from '@/api/errors'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { commonMessages, useT } from '@/i18n'
import { isValidContactPhone, phoneExample } from '@/lib/phone'
import {
  customerPhoneForSave,
  displayCustomerPhone,
  newCustomerPhoneDraft,
  normalizeCustomerPhoneDraft,
} from '../customers/customer-phone'
import { customerFormMessages } from '../customers/customer-form-messages'
import { orderCustomerMessages } from './order-customer-messages'

const SEARCH_DEBOUNCE_MS = 250

/**
 * Two initials for the avatar chip; a single word gives one. Leading quotes
 * and dashes are skipped — «Автосервіс «Вектор»» reads as АВ, not А«.
 */
const initials = (name: string) =>
  name
    .split(/[\s]+/)
    .map((part) => /\p{L}/u.exec(part)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .map((letter) => letter.toUpperCase())
    .join('') || '?'

/**
 * Who the order is for, chosen or created without leaving the order.
 *
 * Until now the customer could only be set while the order was being created:
 * `PUT /orders/{id}/customer` existed and nothing in the cabinet called it, so
 * an order saved without a customer stayed without one forever.
 */
interface OrderCustomerDrawerProps {
  busy: boolean
  currentId: string | null
  currentName: string | null
  error: string | null
  onAssign: (customerId: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  orderNumber: number
}

export function OrderCustomerDrawer(props: OrderCustomerDrawerProps) {
  if (!props.open) return null
  return <OpenOrderCustomerDrawer {...props} />
}

function OpenOrderCustomerDrawer({
  busy,
  currentId,
  currentName,
  error,
  onAssign,
  onOpenChange,
  open,
  orderNumber,
}: OrderCustomerDrawerProps) {
  const t = useT(orderCustomerMessages)
  const tf = useT(customerFormMessages)
  const tc = useT(commonMessages)
  /** A national number is read in the business country; any country is fine. */
  const country = useTenantSettings().countryCode ?? 'UA'
  const listId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSearchItem[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(() => newCustomerPhoneDraft(country))
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [conflict, setConflict] = useState<CustomerPhoneConflict | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void customersApi
        .search(query.trim(), { signal: controller.signal })
        .then((items) => {
          if (!controller.signal.aborted) {
            setResults(items)
            setSearchError(null)
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setResults([])
            setSearchError(normalizeApiProblem(reason).message)
          }
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [open, query])

  const nameValid = name.trim().length > 1
  const phoneE164 = customerPhoneForSave(phone, country)
  const phoneValid = phoneE164 !== null && isValidContactPhone(phoneE164)
  const canAssign = creating
    ? nameValid && phoneValid
    : picked !== null && picked !== currentId

  const changeQuery = (value: string) => {
    setQuery(value)
    setResults(null)
    setSearchError(null)
    setPicked(null)
  }

  const submit = () => {
    if (!canAssign || busy || saving) return
    if (!creating) {
      if (picked !== null) onAssign(picked)
      return
    }
    setSaving(true)
    setCreateError(null)
    setConflict(null)
    void customersApi
      .create({ name: name.trim(), phone: phoneE164 })
      .then(({ customer }) => {
        onAssign(customer.id)
        setCreating(false)
        setName('')
        setPhone(newCustomerPhoneDraft(country))
        setPhoneTouched(false)
      })
      .catch((reason: unknown) => {
        const duplicate = readCustomerPhoneConflict(reason)
        if (duplicate) setConflict(duplicate)
        else setCreateError(normalizeApiProblem(reason).message)
      })
      .finally(() => setSaving(false))
  }

  return (
    <Sheet
      eyebrow={t('eyebrow', { number: String(orderNumber) })}
      footer={
        <>
          <p className="text-app-muted min-w-0 flex-1 truncate text-[13px]">
            {currentName === null
              ? t('noCustomer')
              : t('current', { name: currentName })}
          </p>
          <Button disabled={busy || saving} onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy || saving}
            disabled={busy || saving || !canAssign}
            onClick={submit}
            variant="primary"
          >
            {creating ? t('createAndAssign') : t('assign')}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if ((busy || saving) && !next) return
        onOpenChange(next)
      }}
      open={open}
      title={currentId === null ? t('titleAdd') : t('titleChange')}
    >
      {error === null ? null : <Notice tone="danger">{error}</Notice>}

      <Field hiddenLabel label={t('searchLabel')}>
        <span className="relative block">
          <Search
            aria-hidden
            className="text-app-dim pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <TextInput
            aria-controls={listId}
            autoComplete="off"
            className="h-[46px] rounded-[11px] pl-10"
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            value={query}
          />
        </span>
      </Field>

      {searchError === null ? null : (
        <Notice tone="danger">{searchError}</Notice>
      )}

      <div
        className="border-app-line bg-app-raised overflow-hidden rounded-[14px] border"
        id={listId}
      >
        {results === null ? (
          <div className="p-4">
            <SkeletonRows label={t('searching')} rows={3} />
          </div>
        ) : results.length === 0 ? (
          <p className="text-app-muted px-4 py-5 text-center text-[13px]">
            {t('notFound')}
          </p>
        ) : (
          <ul aria-label={t('foundLabel')}>
            {results.map((customer) => {
              const active = !creating && customer.id === picked
              const current = customer.id === currentId
              return (
                <li key={customer.id}>
                  <button
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-3 text-left transition-colors',
                      active
                        ? 'bg-brand/[0.07] shadow-[inset_3px_0_0_var(--color-brand)]'
                        : 'hover:bg-white/[0.04]',
                    )}
                    onClick={() => {
                      setPicked(customer.id)
                      setCreating(false)
                    }}
                    type="button"
                  >
                    <span className="bg-brand/15 text-brand grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold">
                      {initials(customer.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold tracking-[-0.01em] text-white">
                        {customer.name}
                      </span>
                      <span className="text-app-muted mt-[3px] block font-mono text-[12px]">
                        {customer.phone === null
                          ? t('noPhone')
                          : displayCustomerPhone(customer.phone)}{' '}
                        · {t('ordersCount', { count: customer.ordersCount })}
                      </span>
                    </span>
                    {current || active ? (
                      <span
                        className={cn(
                          'shrink-0 text-[12px] font-bold whitespace-nowrap',
                          current ? 'text-app-muted' : 'text-brand',
                        )}
                      >
                        {current ? t('currentTag') : t('pickedTag')}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button
          className={cn(
            'text-brand flex w-full items-center gap-3 px-3.5 py-3 text-left text-[14px] font-bold transition-colors',
            creating ? 'bg-brand/[0.07]' : 'hover:bg-brand/[0.08]',
          )}
          onClick={() => {
            setCreating((was) => !was)
            setPicked(null)
            setConflict(null)
            setCreateError(null)
            if (!creating && !/\d/.test(query)) setName(query.trim())
          }}
          type="button"
        >
          <span className="border-brand/50 grid size-9 shrink-0 place-items-center rounded-full border border-dashed">
            <Plus aria-hidden className="size-4" />
          </span>
          {t('newCustomer')}
        </button>
      </div>

      {creating ? (
        <div className="border-app-line bg-app-raised grid gap-3 rounded-[14px] border px-[18px] py-4">
          <Field label={t('name')}>
            <TextInput
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
          <Field
            error={
              phoneTouched && !phoneValid
                ? tf('phoneInvalid', { example: phoneExample(country) })
                : null
            }
            label={t('phone')}
          >
            <TextInput
              autoComplete="off"
              className="font-mono"
              inputMode="tel"
              onBlur={() => {
                setPhoneTouched(true)
                if (phoneValid && phoneE164 !== null) setPhone(phoneE164)
              }}
              onChange={(event) =>
                setPhone(normalizeCustomerPhoneDraft(event.target.value))
              }
              placeholder={phoneExample(country)}
              type="tel"
              value={phone}
            />
          </Field>
          {conflict === null ? null : (
            <Notice tone="warn">{conflict.message}</Notice>
          )}
          {createError === null ? null : (
            <Notice tone="danger">{createError}</Notice>
          )}
        </div>
      ) : null}
    </Sheet>
  )
}
