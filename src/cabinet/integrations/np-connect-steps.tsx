import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Button, Field, Notice, SelectInput, TextInput } from '@/components/app'
import { cashApi, type CashRegister } from '@/api/cash'
import type {
  NovaPoshtaContact,
  NovaPoshtaCounterparty,
  NovaPoshtaDivision,
  NovaPoshtaSettlement,
} from '@/api/integrations'
import { novaPoshtaSetupApi } from '@/api/nova-poshta-setup'
import { useT } from '@/i18n'
import { npConnectMessages } from './np-connect-messages'
import { npFormsMessages } from './np-forms-messages'
import { integrationsMessages } from './integrations-messages'
import { SettlementPicker } from './settlement-picker'
import {
  contactLine,
  KEY_MASK,
  pointLine,
  senderLine,
  uahTills,
  type SetupPoint,
} from './np-setup-model'

/** One wizard step: the card whose heading takes focus when the step opens. */
export function StepCard({
  children,
  headingRef,
  lead,
  title,
}: {
  children: ReactNode
  headingRef: RefObject<HTMLHeadingElement | null>
  lead: string
  title: string
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="rz-card min-w-0">
      <header className="rz-card__head py-2.5">
        <div className="grid min-w-0 gap-0.5">
          <h2
            className="rz-h-card outline-none"
            id={id}
            ref={headingRef}
            tabIndex={-1}
          >
            {title}
          </h2>
          <p className="rz-caption m-0 text-pretty">{lead}</p>
        </div>
      </header>
      <div className="rz-card__body grid gap-3">{children}</div>
    </section>
  )
}

/** «Назад» and the step's one primary action, with a note under them. */
export function StepButtons({
  back,
  busy = false,
  extra,
  icon,
  label,
  note,
  nextDisabled = false,
  onNext,
}: {
  back?: (() => void) | undefined
  busy?: boolean
  extra?: ReactNode
  icon?: ReactNode
  label: string
  note?: string
  nextDisabled?: boolean
  onNext?: () => void
}) {
  const t = useT(npConnectMessages)
  return (
    <div className="grid gap-1.5">
      <div className="rz-btn-row">
        {extra}
        {back === undefined ? null : (
          <Button disabled={busy} onClick={back}>
            <ArrowLeft aria-hidden />
            {t('back')}
          </Button>
        )}
        <Button
          aria-busy={busy}
          disabled={busy || nextDisabled}
          onClick={onNext}
          type={onNext === undefined ? 'submit' : 'button'}
          variant="primary"
        >
          {busy ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            (icon ?? <ArrowRight aria-hidden />)
          )}
          {label}
        </Button>
      </div>
      {note === undefined || note === '' ? null : (
        <p className="rz-caption m-0 text-pretty">{note}</p>
      )}
    </div>
  )
}

/** Step 1: the key, checked with the carrier before anything else is read. */
export function KeyStep({
  busy,
  error,
  headingRef,
  notice,
  onChange,
  onSubmit,
  value,
  verified,
}: {
  busy: boolean
  /** Field error after a rejected key; the field takes focus. */
  error: string | null
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Any other failure of the last attempt. */
  notice: string | null
  onChange: (value: string) => void
  onSubmit: () => void
  value: string
  /** A verified session already stands; an empty field just moves on. */
  verified: boolean
}) {
  const t = useT(npConnectMessages)
  const ti = useT(integrationsMessages)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const empty = value.trim() === ''

  useEffect(() => {
    if (error !== null) inputRef.current?.focus()
  }, [error])

  return (
    <StepCard headingRef={headingRef} lead={t('keyLead')} title={t('keyTitle')}>
      <form
        className="grid gap-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {notice === null ? null : <Notice tone="danger">{notice}</Notice>}
        <Notice tone="info">{t('keyHelp')}</Notice>
        <Field
          error={error ?? undefined}
          hint={t('keyHint')}
          label={t('keyLabel')}
          required
        >
          <TextInput
            autoComplete="off"
            className="rz-mono"
            onChange={(event) => onChange(event.target.value)}
            placeholder={verified ? KEY_MASK : ti('keyPlaceholder')}
            readOnly={busy}
            ref={inputRef}
            spellCheck={false}
            value={value}
          />
        </Field>
        <StepButtons
          busy={busy}
          icon={verified && empty ? undefined : <ShieldCheck aria-hidden />}
          label={
            busy
              ? t('keyVerifying')
              : verified && empty
                ? t('next')
                : t('keyVerify')
          }
          nextDisabled={empty && !verified}
          note={
            busy
              ? t('keyVerifyingNote')
              : empty
                ? verified
                  ? t('progressKey')
                  : t('keyEmptyNote')
                : ''
          }
        />
      </form>
    </StepCard>
  )
}

type Loaded<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; items: T[] }
  | { kind: 'error' }

/** Step 2: who waybills go out as, read from the carrier's own cabinet. */
export function SenderStep({
  contact,
  headingRef,
  integrationId,
  onBack,
  onContact,
  onNext,
  onSender,
  sender,
  sessionId,
}: {
  contact: NovaPoshtaContact | null
  headingRef: RefObject<HTMLHeadingElement | null>
  integrationId: string
  onBack: () => void
  onContact: (contact: NovaPoshtaContact | null) => void
  onNext: () => void
  onSender: (sender: NovaPoshtaCounterparty | null) => void
  sender: NovaPoshtaCounterparty | null
  sessionId: string
}) {
  const t = useT(npConnectMessages)
  const tf = useT(npFormsMessages)
  const [senders, setSenders] = useState<Loaded<NovaPoshtaCounterparty>>({
    kind: 'loading',
  })
  const [contacts, setContacts] = useState<{
    senderRef: string
    state: Loaded<NovaPoshtaContact>
  } | null>(null)
  const [reloads, setReloads] = useState(0)
  const [reset, setReset] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void novaPoshtaSetupApi
      .senders(integrationId, sessionId, { signal: controller.signal })
      .then(
        (items) => {
          if (!controller.signal.aborted) setSenders({ kind: 'ready', items })
        },
        () => {
          if (!controller.signal.aborted) setSenders({ kind: 'error' })
        },
      )
    return () => controller.abort()
  }, [integrationId, reloads, sessionId])

  const senderRef = sender?.ref ?? null
  useEffect(() => {
    if (senderRef === null) return
    const controller = new AbortController()
    void novaPoshtaSetupApi
      .senderContacts(integrationId, sessionId, senderRef, {
        signal: controller.signal,
      })
      .then(
        (items) => {
          if (!controller.signal.aborted)
            setContacts({ senderRef, state: { kind: 'ready', items } })
        },
        () => {
          if (!controller.signal.aborted)
            setContacts({ senderRef, state: { kind: 'error' } })
        },
      )
    return () => controller.abort()
  }, [integrationId, reloads, senderRef, sessionId])

  const senderItems = senders.kind === 'ready' ? senders.items : []
  const contactState: Loaded<NovaPoshtaContact> | null =
    senderRef === null
      ? null
      : contacts?.senderRef === senderRef
        ? contacts.state
        : { kind: 'loading' }
  const contactItems = contactState?.kind === 'ready' ? contactState.items : []
  const blocked =
    senders.kind === 'error' ||
    (senders.kind === 'ready' && senders.items.length === 0)
  const reload = () => {
    setSenders({ kind: 'loading' })
    setContacts(null)
    setReloads((value) => value + 1)
  }

  return (
    <StepCard
      headingRef={headingRef}
      lead={t('senderLead')}
      title={t('senderTitle')}
    >
      <Field hint={tf('formSenderHint')} label={tf('senderLabel')} required>
        <SelectInput
          disabled={senders.kind !== 'ready' || senders.items.length === 0}
          onChange={(event) => {
            const next =
              senderItems.find((item) => item.ref === event.target.value) ??
              null
            if (next?.ref === sender?.ref) return
            setReset(contact !== null && next !== null)
            onSender(next)
          }}
          value={sender?.ref ?? ''}
        >
          <option value="">
            {senders.kind === 'loading'
              ? tf('loading')
              : senders.kind === 'error'
                ? t('senderUnavailable')
                : senders.items.length === 0
                  ? tf('noSenders')
                  : tf('notChosen')}
          </option>
          {senderItems.map((item) => (
            <option key={item.ref} value={item.ref}>
              {senderLine(item)}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field
        hint={sender === null ? tf('pickSenderFirst') : tf('contactHint')}
        label={tf('contactLabel')}
        required
      >
        <SelectInput
          disabled={contactState?.kind !== 'ready'}
          onChange={(event) => {
            setReset(false)
            onContact(
              contactItems.find((item) => item.ref === event.target.value) ??
                null,
            )
          }}
          value={contact?.ref ?? ''}
        >
          <option value="">
            {contactState === null
              ? t('senderWaiting')
              : contactState.kind === 'loading'
                ? tf('loading')
                : tf('pickPerson')}
          </option>
          {contactItems.map((item) => (
            <option key={item.ref} value={item.ref}>
              {contactLine(item)}
            </option>
          ))}
        </SelectInput>
      </Field>

      {senders.kind === 'ready' && senders.items.length === 0 ? (
        <Notice tone="warn">{t('sendersEmptyNote')}</Notice>
      ) : null}
      {senders.kind === 'error' ? (
        <Notice tone="danger">{t('sendersErrorNote')}</Notice>
      ) : null}
      {contactState?.kind === 'error' ? (
        <Notice tone="danger">{t('contactsErrorNote')}</Notice>
      ) : null}
      {reset && contact === null ? (
        <Notice tone="info">{t('senderResetNote')}</Notice>
      ) : null}

      <StepButtons
        back={onBack}
        extra={
          blocked || contactState?.kind === 'error' ? (
            <Button onClick={reload}>
              <RefreshCw aria-hidden />
              {t('refreshList')}
            </Button>
          ) : null
        }
        label={t('next')}
        nextDisabled={contact === null || blocked}
        onNext={onNext}
      />
    </StepCard>
  )
}

/** Step 3: the till a post-payment lands in, or none at all. */
export function TillStep({
  headingRef,
  onBack,
  onChange,
  onNext,
  till,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onChange: (till: CashRegister | null) => void
  onNext: () => void
  /** `undefined` until something is chosen; `null` is «без каси». */
  till: CashRegister | null | undefined
}) {
  const t = useT(npConnectMessages)
  const tf = useT(npFormsMessages)
  const name = useId()
  const [tills, setTills] = useState<Loaded<CashRegister>>({
    kind: 'loading',
  })

  useEffect(() => {
    const controller = new AbortController()
    void cashApi.list(true, { signal: controller.signal }).then(
      (items) => {
        if (!controller.signal.aborted)
          setTills({ kind: 'ready', items: uahTills(items) })
      },
      () => {
        if (!controller.signal.aborted) setTills({ kind: 'error' })
      },
    )
    return () => controller.abort()
  }, [])

  // The first till is the usual answer, so it starts chosen.
  const first = tills.kind === 'ready' ? (tills.items[0] ?? null) : null
  useEffect(() => {
    if (till === undefined && first !== null) onChange(first)
  }, [first, onChange, till])

  const items = tills.kind === 'ready' ? tills.items : []
  const options: {
    key: string
    label: string
    hint: string
    value: CashRegister | null
  }[] = [
    ...items.map((item) => ({
      key: item.id,
      label: item.name,
      hint: till?.id === item.id ? t('tillAuto') : t('tillCurrency'),
      value: item,
    })),
    { key: 'none', label: t('tillNone'), hint: t('tillNoneHint'), value: null },
  ]

  return (
    <StepCard
      headingRef={headingRef}
      lead={t('tillLead')}
      title={t('tillTitle')}
    >
      {tills.kind === 'loading' ? (
        <p className="rz-muted m-0">{tf('loading')}</p>
      ) : (
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="sr-only">{t('tillTitle')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.map((option) => (
              <label className="rz-choice-card" key={option.key}>
                <input
                  checked={
                    option.value === null
                      ? till === null
                      : till?.id === option.value.id
                  }
                  className="rz-radio mt-0.5 shrink-0"
                  name={name}
                  onChange={() => onChange(option.value)}
                  type="radio"
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="rz-strong font-semibold">
                    {option.label}
                  </span>
                  <span className="rz-caption">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {tills.kind === 'error' ? (
        <Notice tone="warn">{t('tillsError')}</Notice>
      ) : null}
      {till === null ? <Notice tone="warn">{t('tillNoneNote')}</Notice> : null}
      <p className="rz-caption m-0 text-pretty">{t('tillCaption')}</p>
      <StepButtons
        back={onBack}
        label={t('next')}
        nextDisabled={till === undefined}
        onNext={onNext}
      />
    </StepCard>
  )
}

/** Step 4: the city and branch parcels leave from, from the carrier's catalogue. */
export function PointStep({
  division,
  headingRef,
  integrationId,
  onBack,
  onDivision,
  onNext,
  onSettlement,
  sessionId,
  settlement,
}: {
  division: NovaPoshtaDivision | null
  headingRef: RefObject<HTMLHeadingElement | null>
  integrationId: string
  onBack: () => void
  onDivision: (division: NovaPoshtaDivision | null) => void
  onNext: () => void
  onSettlement: (settlement: NovaPoshtaSettlement | null) => void
  sessionId: string
  settlement: NovaPoshtaSettlement | null
}) {
  const t = useT(npConnectMessages)
  const tf = useT(npFormsMessages)
  const [divisions, setDivisions] = useState<{
    settlementRef: string
    state: Loaded<NovaPoshtaDivision>
  } | null>(null)
  const [reloads, setReloads] = useState(0)
  const settlementRef = settlement?.ref ?? null

  useEffect(() => {
    if (settlementRef === null) return
    const controller = new AbortController()
    void novaPoshtaSetupApi
      .divisions(integrationId, sessionId, settlementRef, 1, {
        signal: controller.signal,
      })
      .then(
        (page) => {
          if (!controller.signal.aborted)
            setDivisions({
              settlementRef,
              state: {
                kind: 'ready',
                items: page.items.filter((item) => item.sendingAllowed),
              },
            })
        },
        () => {
          if (!controller.signal.aborted)
            setDivisions({ settlementRef, state: { kind: 'error' } })
        },
      )
    return () => controller.abort()
  }, [integrationId, reloads, sessionId, settlementRef])

  const state: Loaded<NovaPoshtaDivision> | null =
    settlementRef === null
      ? null
      : divisions?.settlementRef === settlementRef
        ? divisions.state
        : { kind: 'loading' }
  const items = state?.kind === 'ready' ? state.items : []

  return (
    <StepCard
      headingRef={headingRef}
      lead={t('pointLead')}
      title={t('pointTitle')}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SettlementPicker
          integrationId={integrationId}
          onPick={(next) => {
            if (next?.ref === settlement?.ref) return
            onSettlement(next)
            onDivision(null)
          }}
          picked={settlement}
          search={(term, signal) =>
            novaPoshtaSetupApi.settlements(integrationId, sessionId, term, 1, {
              signal,
            })
          }
          use="sending"
        />
        <Field
          hint={state === null ? undefined : tf('sendingBranchesOnly')}
          label={tf('branchLabel')}
          required
        >
          <SelectInput
            disabled={state?.kind !== 'ready'}
            onChange={(event) =>
              onDivision(
                items.find((item) => item.ref === event.target.value) ?? null,
              )
            }
            value={division?.ref ?? ''}
          >
            <option value="">
              {state === null
                ? tf('pickSettlementFirst')
                : state.kind === 'loading'
                  ? tf('loading')
                  : tf('pickBranch')}
            </option>
            {items.map((item) => (
              <option key={item.ref} value={item.ref}>
                {item.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      {state?.kind === 'error' ? (
        <Notice tone="danger">{t('divisionsError')}</Notice>
      ) : null}
      <StepButtons
        back={onBack}
        extra={
          state?.kind === 'error' ? (
            <Button
              onClick={() => {
                setDivisions(null)
                setReloads((value) => value + 1)
              }}
            >
              <RefreshCw aria-hidden />
              {t('retry')}
            </Button>
          ) : null
        }
        label={t('next')}
        nextDisabled={division === null}
        onNext={onNext}
      />
    </StepCard>
  )
}

/** Step 5: everything chosen, each line one «Змінити» away from its step. */
export function ReviewStep({
  busy,
  contact,
  error,
  headingRef,
  onBack,
  onChange,
  onComplete,
  point,
  sender,
  till,
}: {
  busy: boolean
  contact: NovaPoshtaContact
  error: string | null
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onChange: (step: 0 | 1 | 2 | 3) => void
  onComplete: () => void
  point: SetupPoint
  sender: NovaPoshtaCounterparty
  till: CashRegister | null
}) {
  const t = useT(npConnectMessages)
  const tf = useT(npFormsMessages)
  const errorRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (error !== null) errorRef.current?.focus()
  }, [error])
  const rows: { label: string; value: string; step: 0 | 1 | 2 | 3 }[] = [
    {
      label: t('keyLabel'),
      value: t('reviewKey', { mask: KEY_MASK }),
      step: 0,
    },
    { label: t('reviewSender'), value: senderLine(sender), step: 1 },
    { label: t('reviewContact'), value: contactLine(contact), step: 1 },
    {
      label: tf('tillLabel'),
      value: till === null ? t('reviewNoTill') : till.name,
      step: 2,
    },
    { label: t('stepPoint'), value: pointLine(point), step: 3 },
  ]
  return (
    <>
      <section aria-labelledby="np-review" className="rz-card min-w-0">
        <header className="rz-card__head py-2.5">
          <div className="grid min-w-0 gap-0.5">
            <h2
              className="rz-h-card outline-none"
              id="np-review"
              ref={headingRef}
              tabIndex={-1}
            >
              {t('reviewTitle')}
            </h2>
            <p className="rz-caption m-0 text-pretty">{t('reviewLead')}</p>
          </div>
        </header>
        <ul className="m-0 grid list-none p-0">
          {rows.map((row) => (
            <li
              className="border-app-line flex items-center gap-3 border-t px-(--rz-card-p) py-2.5"
              key={row.label}
            >
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="rz-strong font-medium">{row.label}</span>
                <span className="rz-caption font-mono text-pretty">
                  {row.value}
                </span>
              </span>
              <Button
                aria-label={`${t('change')}: ${row.label}`}
                disabled={busy}
                onClick={() => onChange(row.step)}
                size="sm"
              >
                {t('change')}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rz-card min-w-0">
        <div className="rz-card__body grid gap-3">
          {error === null ? null : (
            <div className="outline-none" ref={errorRef} tabIndex={-1}>
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
          <p className="rz-caption m-0 text-pretty">{t('reviewCaption')}</p>
          <StepButtons
            back={onBack}
            busy={busy}
            icon={<Check aria-hidden />}
            label={busy ? t('completing') : t('complete')}
            onNext={onComplete}
          />
        </div>
      </section>
    </>
  )
}
