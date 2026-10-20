import { useEffect, useId, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Button,
  Field,
  Notice,
  Sheet,
  SkeletonRows,
  SearchInput,
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
          <p className="rz-muted m-0 min-w-0 flex-1 truncate">
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
        <SearchInput
          aria-controls={listId}
          autoComplete="off"
          className="h-control-lg"
          onChange={(event) => changeQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          type="text"
          value={query}
        />
      </Field>

      {searchError === null ? null : (
        <Notice tone="danger">{searchError}</Notice>
      )}

      <div className="rz-card" id={listId}>
        {results === null ? (
          <div className="p-3">
            <SkeletonRows label={t('searching')} rows={3} />
          </div>
        ) : results.length === 0 ? (
          <p className="rz-muted m-0 px-4 py-5 text-center">{t('notFound')}</p>
        ) : (
          <ul aria-label={t('foundLabel')} className="m-0 list-none p-0">
            {results.map((customer) => {
              const active = !creating && customer.id === picked
              const current = customer.id === currentId
              return (
                <li key={customer.id}>
                  <button
                    className={cn(
                      'border-app-line flex w-full cursor-pointer items-center gap-2.5 border-0 border-b bg-transparent px-3 py-2 text-left transition-colors',
                      active
                        ? 'bg-app-selected shadow-[inset_2px_0_0_var(--rz-brand)]'
                        : 'hover:bg-app-hover',
                    )}
                    onClick={() => {
                      setPicked(customer.id)
                      setCreating(false)
                    }}
                    type="button"
                  >
                    <span
                      aria-hidden
                      className="rz-avatar rz-avatar--round size-8"
                    >
                      {initials(customer.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="rz-strong block truncate font-medium">
                        {customer.name}
                      </span>
                      <span className="rz-dim block font-mono text-caption">
                        {customer.phone === null
                          ? t('noPhone')
                          : displayCustomerPhone(customer.phone)}{' '}
                        · {t('ordersCount', { count: customer.ordersCount })}
                      </span>
                    </span>
                    {current || active ? (
                      <span
                        className={cn(
                          'shrink-0 text-caption font-medium whitespace-nowrap',
                          current ? 'text-app-muted' : 'text-app-strong',
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
            'flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left font-medium transition-colors',
            creating
              ? 'bg-app-selected text-app-strong shadow-[inset_2px_0_0_var(--rz-brand)]'
              : 'text-app-ink hover:bg-app-hover',
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
          <span
            aria-hidden
            className="border-app-line-2 text-app-muted grid size-8 shrink-0 place-items-center rounded-full border border-dashed"
          >
            <Plus className="size-3.5" />
          </span>
          {t('newCustomer')}
        </button>
      </div>

      {creating ? (
        <div className="rz-inset grid gap-3">
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
