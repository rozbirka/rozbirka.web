import { useEffect, useState, type FormEvent } from 'react'
import {
  Button,
  Field,
  Notice,
  SelectInput,
  Sheet,
  TextInput,
} from '@/components/app'
import {
  integrationsApi,
  type NovaPoshtaDispatchPoint,
  type NovaPoshtaDispatchPointInput,
  type NovaPoshtaDivision,
  type NovaPoshtaSettlement,
  type NovaPoshtaCounterparty,
  type NovaPoshtaContact,
} from '@/api/integrations'
import type { ApiProblem } from '@/api/contracts'
import { normalizeApiProblem } from '@/api/errors'
import { commonMessages, useLocale, useT } from '@/i18n'
import { moduleLabel } from '../module-messages'
import { integrationProblemMessage } from './integration-labels'
import { npFormsMessages } from './np-forms-messages'
import { SettlementPicker } from './settlement-picker'

/**
 * Core's own contact rule, so a bad phone is caught before the round trip. NP
 * is Ukrainian-only, so the example and placeholder stay +380 in every
 * interface language.
 */
const PHONE = /^\+?[1-9]\d{7,14}$/

const FORM_ID = 'dispatch-point-form'

export interface DispatchPointDraft {
  point: NovaPoshtaDispatchPoint | null
  /** Known for a point being edited only after its division resolves. */
  settlementName: string | null
}

export interface DispatchPointSubmission {
  input: NovaPoshtaDispatchPointInput
  makeDefault: boolean
}

/** The design's switch: a track with a knob, announced as a switch. */
export function Switch({
  checked,
  disabled = false,
  label,
  onChange,
  title,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
  title?: string | undefined
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`inline-flex h-6 w-[42px] shrink-0 items-center rounded-full border p-[3px] transition-colors ${
        checked
          ? 'border-state-ok/35 bg-state-ok-soft justify-end'
          : 'border-app-line-2 justify-start bg-white/[0.05]'
      } ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      title={title}
      type="button"
    >
      <span
        aria-hidden
        className={`size-4 rounded-full ${checked ? 'bg-state-ok' : 'bg-app-dim'}`}
      />
    </button>
  )
}

function Toggle({
  checked,
  disabled,
  hint,
  label,
  onChange,
  title,
}: {
  checked: boolean
  disabled?: boolean
  hint: string
  label: string
  onChange: (next: boolean) => void
  title?: string | undefined
}) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="min-w-0 flex-1">
        <p
          className={`text-[14px] font-semibold ${checked ? 'text-app-ink' : 'text-app-muted'}`}
        >
          {label}
        </p>
        <p className="text-app-dim mt-0.5 text-[12px] leading-[1.45] text-pretty">
          {hint}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled === true}
        label={label}
        onChange={onChange}
        title={title}
      />
    </div>
  )
}

/**
 * Add or change one dispatch point. The carrier's own catalogue decides what
 * a valid settlement and division are, so both are picked from it rather than
 * typed — Core rejects anything it cannot find there anyway.
 */
export function DispatchPointForm({
  draft,
  error,
  integrationId,
  onClose,
  onDeactivate,
  onSubmit,
  pending,
}: {
  draft: DispatchPointDraft
  error: string | null
  integrationId: string
  onClose: () => void
  onDeactivate?: (() => void) | undefined
  onSubmit: (submission: DispatchPointSubmission) => void
  pending: boolean
}) {
  const { locale } = useLocale()
  const t = useT(npFormsMessages)
  const tc = useT(commonMessages)
  const point = draft.point
  const [name, setName] = useState(point?.name ?? '')
  const [senderName, setSenderName] = useState(point?.senderName ?? '')
  const [phone, setPhone] = useState(point?.phone ?? '')
  const [isCompany, setIsCompany] = useState(point?.companyName !== null)
  const [companyName, setCompanyName] = useState(point?.companyName ?? '')
  const [companyTin, setCompanyTin] = useState(point?.companyTin ?? '')
  const [isActive, setIsActive] = useState(point?.isActive ?? true)
  const [makeDefault, setMakeDefault] = useState(point?.isDefault ?? false)

  const [settlement, setSettlement] = useState<NovaPoshtaSettlement | null>(
    null,
  )
  const [loadedDivisions, setLoadedDivisions] = useState<{
    settlementRef: string
    items: NovaPoshtaDivision[]
  } | null>(null)
  // Derived during render: picking another settlement empties the list without
  // a second pass through the effect.
  const [divisionChoice, setDivisionChoice] = useState<string | null>(
    point?.warehouseRef ?? null,
  )
  const [lookupError, setLookupError] = useState<ApiProblem | null>(null)

  // Nova Poshta will not take a sender typed into this form: it has to be a
  // counterparty already registered against the tenant's own key, together
  // with one of its contact people.
  const [senders, setSenders] = useState<NovaPoshtaCounterparty[] | null>(null)
  const [senderChoice, setSenderChoice] = useState<string | null>(
    point?.counterpartyRef ?? null,
  )
  const [contacts, setContacts] = useState<{
    counterpartyRef: string
    items: NovaPoshtaContact[]
  } | null>(null)
  const [contactChoice, setContactChoice] = useState<string | null>(
    point?.contactRef ?? null,
  )

  // The stored settlement stands until another is picked from the catalogue.
  const settlementRef: string | null =
    settlement?.ref ?? point?.settlementRef ?? null

  useEffect(() => {
    if (settlementRef === null) return
    const controller = new AbortController()
    void integrationsApi
      .divisions(integrationId, settlementRef, 1, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({
              settlementRef,
              items: page.items.filter((item) => item.sendingAllowed),
            })
          }
        },
        (problem) => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({ settlementRef, items: [] })
            setLookupError(normalizeApiProblem(problem))
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, settlementRef])

  useEffect(() => {
    const controller = new AbortController()
    void integrationsApi
      .senders(integrationId, { signal: controller.signal })
      .then(
        (items) => {
          if (!controller.signal.aborted) setSenders(items)
        },
        (problem) => {
          if (!controller.signal.aborted) {
            setSenders([])
            setLookupError(normalizeApiProblem(problem))
          }
        },
      )
    return () => controller.abort()
  }, [integrationId])

  useEffect(() => {
    if (senderChoice === null) return
    const controller = new AbortController()
    void integrationsApi
      .senderContacts(integrationId, senderChoice, {
        signal: controller.signal,
      })
      .then(
        (items) => {
          if (!controller.signal.aborted)
            setContacts({ counterpartyRef: senderChoice, items })
        },
        (problem) => {
          if (!controller.signal.aborted) {
            setContacts({ counterpartyRef: senderChoice, items: [] })
            setLookupError(normalizeApiProblem(problem))
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, senderChoice])

  const divisions: NovaPoshtaDivision[] | null =
    settlementRef !== null && loadedDivisions?.settlementRef === settlementRef
      ? loadedDivisions.items
      : null

  // A branch picked for another settlement is not in this list, so it drops
  // out on its own rather than travelling to Core as a mismatch.
  const division: NovaPoshtaDivision | null =
    divisions?.find((item) => item.ref === divisionChoice) ?? null
  const warehouseRef = division?.ref ?? null

  const counterpartyRef =
    senders?.some((item) => item.ref === senderChoice) === true
      ? senderChoice
      : null
  const contactOptions =
    counterpartyRef !== null && contacts?.counterpartyRef === counterpartyRef
      ? contacts.items
      : null
  const contactRef =
    contactOptions?.some((item) => item.ref === contactChoice) === true
      ? contactChoice
      : null

  const trimmedPhone = phone.replace(/[\s()-]/g, '')
  const phoneValid = PHONE.test(trimmedPhone)
  const companyReady =
    !isCompany || (companyName.trim() !== '' && companyTin.trim() !== '')
  const ready =
    name.trim() !== '' &&
    senderName.trim() !== '' &&
    phoneValid &&
    settlementRef !== null &&
    warehouseRef !== null &&
    counterpartyRef !== null &&
    contactRef !== null &&
    companyReady

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !ready ||
      settlementRef === null ||
      warehouseRef === null ||
      counterpartyRef === null ||
      contactRef === null
    )
      return
    onSubmit({
      input: {
        name: name.trim(),
        senderName: senderName.trim(),
        phone: trimmedPhone,
        settlementRef,
        warehouseRef,
        counterpartyRef,
        contactRef,
        // Kept so the cabinet can name the branch later; the carrier reads refs.
        warehouseName: division?.name ?? null,
        settlementName: settlement?.name ?? point?.settlementName ?? null,
        companyName: isCompany ? companyName.trim() : null,
        companyTin: isCompany ? companyTin.trim() : null,
        isActive,
      },
      makeDefault: makeDefault && point?.isDefault !== true,
    })
  }

  const defaultLocked = point?.isDefault === true
  const deactivateLocked = point?.isDefault === true

  return (
    <Sheet
      description={t('formDescription')}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2.5">
          {onDeactivate !== undefined && (
            <Button
              disabled={pending || deactivateLocked}
              onClick={onDeactivate}
              title={
                deactivateLocked ? t('defaultCantDisable') : t('deactivateHint')
              }
              variant="danger"
            >
              {t('deactivate')}
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <Button disabled={pending} onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button
              aria-busy={pending}
              disabled={pending || !ready}
              form={FORM_ID}
              type="submit"
              variant="primary"
            >
              {point === null ? t('addPoint') : t('saveChanges')}
            </Button>
          </div>
        </div>
      }
      eyebrow={`${moduleLabel('integrations', locale)} · ${t('novaPoshta')}`}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      size="lg"
      title={
        point === null
          ? t('newPointTitle')
          : t('pointTitle', { name: point.name })
      }
    >
      <form className="grid gap-3.5" id={FORM_ID} noValidate onSubmit={submit}>
        {error !== null && <Notice tone="danger">{error}</Notice>}
        {lookupError !== null && (
          <Notice tone="warn">
            {integrationProblemMessage(lookupError, locale)}
          </Notice>
        )}

        <Field hint={t('pointNameHint')} label={t('pointNameLabel')} required>
          <TextInput
            onChange={(event) => setName(event.target.value)}
            placeholder={t('pointNamePlaceholder')}
            value={name}
          />
        </Field>

        <SettlementPicker
          integrationId={integrationId}
          onPick={setSettlement}
          picked={settlement}
          savedHint={point === null ? undefined : t('savedSettlementHint')}
          use="sending"
        />

        <Field
          hint={
            settlementRef === null
              ? t('pickSettlementFirst')
              : t('sendingBranchesOnly')
          }
          label={t('branchLabel')}
          required
        >
          <SelectInput
            disabled={settlementRef === null || divisions === null}
            onChange={(event) =>
              setDivisionChoice(
                event.target.value === '' ? null : event.target.value,
              )
            }
            value={warehouseRef ?? ''}
          >
            <option value="">
              {divisions === null ? t('loading') : t('pickBranch')}
            </option>
            {(divisions ?? []).map((item) => (
              <option key={item.ref} value={item.ref}>
                {item.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field hint={t('formSenderHint')} label={t('senderLabel')} required>
          <SelectInput
            disabled={senders === null}
            onChange={(event) => {
              setSenderChoice(
                event.target.value === '' ? null : event.target.value,
              )
              setContactChoice(null)
            }}
            value={counterpartyRef ?? ''}
          >
            <option value="">
              {senders === null
                ? t('loading')
                : senders.length === 0
                  ? t('noSenders')
                  : t('pickSender')}
            </option>
            {(senders ?? []).map((item) => (
              <option key={item.ref} value={item.ref}>
                {item.name}
                {item.tin == null ? '' : ` · ${item.tin}`}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          hint={
            counterpartyRef === null ? t('pickSenderFirst') : t('contactHint')
          }
          label={t('senderContactLabel')}
          required
        >
          <SelectInput
            disabled={counterpartyRef === null || contactOptions === null}
            onChange={(event) => {
              const next = event.target.value === '' ? null : event.target.value
              setContactChoice(next)
              // The waybill names this person as the sender's contact, so the
              // two fields below are the same person by definition. Typing
              // them again is an invitation to disagree with the carrier.
              const chosen = contactOptions?.find((item) => item.ref === next)
              if (chosen !== undefined) {
                setSenderName(chosen.name)
                if (chosen.phone != null && chosen.phone !== '')
                  setPhone(chosen.phone)
              }
            }}
            value={contactRef ?? ''}
          >
            <option value="">
              {contactOptions === null ? t('loading') : t('pickPerson')}
            </option>
            {(contactOptions ?? []).map((item) => (
              <option key={item.ref} value={item.ref}>
                {item.name}
                {item.phone == null ? '' : ` · ${item.phone}`}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label={t('senderNameLabel')} required>
          <TextInput
            onChange={(event) => setSenderName(event.target.value)}
            placeholder={t('senderNamePlaceholder')}
            value={senderName}
          />
        </Field>

        <Field
          error={phone !== '' && !phoneValid ? t('phoneError') : undefined}
          label={t('phoneLabel')}
          required
        >
          <TextInput
            className="font-mono"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+380"
            value={phone}
          />
        </Field>

        {isCompany && (
          <>
            <Field label={t('companyName')} required>
              <TextInput
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder={t('companyNamePlaceholder')}
                value={companyName}
              />
            </Field>
            <Field label={t('companyTin')} required>
              <TextInput
                className="font-mono"
                onChange={(event) => setCompanyTin(event.target.value)}
                placeholder={t('companyTinPlaceholder')}
                value={companyTin}
              />
            </Field>
          </>
        )}

        <div className="border-app-line bg-app-input grid gap-4 rounded-[14px] border px-5 py-4.5">
          <Toggle
            checked={isCompany}
            hint={t('isCompanyHint')}
            label={t('isCompanyLabel')}
            onChange={setIsCompany}
          />
          <Toggle
            checked={makeDefault}
            disabled={defaultLocked}
            hint={t('defaultHint')}
            label={t('defaultLabel')}
            onChange={setMakeDefault}
            title={defaultLocked ? t('alreadyDefault') : undefined}
          />
          <Toggle
            checked={isActive}
            disabled={defaultLocked}
            hint={t('activeHint')}
            label={t('active')}
            onChange={setIsActive}
            title={defaultLocked ? t('defaultCantDisable') : undefined}
          />
        </div>
      </form>
    </Sheet>
  )
}
