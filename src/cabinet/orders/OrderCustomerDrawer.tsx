import { useState } from 'react'
import { CustomerSearchPicker } from '@/components/customers/CustomerSearchPicker'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import {
  customersApi,
  readCustomerPhoneConflict,
  type CustomerPhoneConflict,
} from '@/api/customers'
import { normalizeApiProblem } from '@/api/errors'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { commonMessages, useT } from '@/i18n'
import { isValidContactPhone, phoneExample } from '@/lib/phone'
import {
  customerPhoneForSave,
  newCustomerPhoneDraft,
  normalizeCustomerPhoneDraft,
} from '../customers/customer-phone'
import { customerFormMessages } from '../customers/customer-form-messages'
import { orderCustomerMessages } from './order-customer-messages'

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
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(() => newCustomerPhoneDraft(country))
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [conflict, setConflict] = useState<CustomerPhoneConflict | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const nameValid = name.trim().length > 1
  const phoneE164 = customerPhoneForSave(phone, country)
  const phoneValid = phoneE164 !== null && isValidContactPhone(phoneE164)
  const canAssign = creating
    ? nameValid && phoneValid
    : picked !== null && picked !== currentId

  const changeQuery = (value: string) => {
    setQuery(value)
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

      <CustomerSearchPicker
        createLabel={t('newCustomer')}
        onCreate={() => {
          setCreating((was) => !was)
          setPicked(null)
          setConflict(null)
          setCreateError(null)
          if (!creating && !/\d/.test(query)) setName(query.trim())
        }}
        currentId={currentId}
        disabled={busy || saving}
        initialOpen
        onQueryChange={changeQuery}
        onSelect={(customer) => {
          setPicked(customer.id)
          setQuery(customer.name)
          setCreating(false)
        }}
        query={query}
        selectedId={creating ? null : picked}
      />
      {creating ? (
        <div className="grid gap-3">
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
