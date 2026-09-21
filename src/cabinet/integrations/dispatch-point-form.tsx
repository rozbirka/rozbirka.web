import { useEffect, useState, type FormEvent } from 'react'
import {
  Field,
  FormDialog,
  Notice,
  SelectInput,
  TextInput,
} from '@/components/app'
import {
  integrationsApi,
  type NovaPoshtaDispatchPoint,
  type NovaPoshtaDispatchPointInput,
  type NovaPoshtaDivision,
  type NovaPoshtaSettlement,
} from '@/api/integrations'

/** Core's own contact rule, so a bad phone is caught before the round trip. */
const PHONE = /^\+?[1-9]\d{7,14}$/

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
  const point = draft.point
  const [name, setName] = useState(point?.name ?? '')
  const [senderName, setSenderName] = useState(point?.senderName ?? '')
  const [phone, setPhone] = useState(point?.phone ?? '')
  const [isCompany, setIsCompany] = useState(point?.companyName !== null)
  const [companyName, setCompanyName] = useState(point?.companyName ?? '')
  const [companyTin, setCompanyTin] = useState(point?.companyTin ?? '')
  const [isActive, setIsActive] = useState(point?.isActive ?? true)
  const [makeDefault, setMakeDefault] = useState(point?.isDefault ?? false)

  const [query, setQuery] = useState(draft.settlementName ?? '')
  const [foundSettlements, setFoundSettlements] = useState<{
    term: string
    items: NovaPoshtaSettlement[]
  } | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadedDivisions, setLoadedDivisions] = useState<{
    settlementId: number
    items: NovaPoshtaDivision[]
  } | null>(null)
  // Derived during render: picking another settlement empties the list without
  // a second pass through the effect.
  const [divisionChoice, setDivisionChoice] = useState<number | null>(
    point?.divisionId ?? null,
  )
  const [lookupError, setLookupError] = useState<string | null>(null)

  // Derived during render, so a shorter query drops the stale suggestions.
  const term = query.trim()
  const settlements: NovaPoshtaSettlement[] =
    term.length >= 2 && foundSettlements?.term === term
      ? foundSettlements.items
      : []

  // An untouched search box keeps the point's own settlement; once the box is
  // used, only a name the catalogue actually returned counts as a choice.
  const settlementId: number | null =
    term === ''
      ? (point?.settlementId ?? null)
      : (settlements.find((item) => item.name === term)?.id ?? null)

  useEffect(() => {
    if (term.length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      void integrationsApi
        .settlements(integrationId, term, 1, { signal: controller.signal })
        .then(
          (page) => {
            if (controller.signal.aborted) return
            setFoundSettlements({ term, items: page.items })
            setSearching(false)
          },
          () => {
            if (controller.signal.aborted) return
            setLookupError(
              'Довідник населених пунктів Нової пошти зараз недоступний.',
            )
            setSearching(false)
          },
        )
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [integrationId, term])

  useEffect(() => {
    if (settlementId === null) return
    const controller = new AbortController()
    void integrationsApi
      .divisions(integrationId, settlementId, 1, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({
              settlementId,
              items: page.items.filter((item) => item.sendingAllowed),
            })
          }
        },
        () => {
          if (!controller.signal.aborted) {
            setLoadedDivisions({ settlementId, items: [] })
            setLookupError(
              'Довідник відділень Нової пошти зараз недоступний. Спробуйте ще раз.',
            )
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, settlementId])

  const divisions: NovaPoshtaDivision[] | null =
    settlementId !== null && loadedDivisions?.settlementId === settlementId
      ? loadedDivisions.items
      : null

  // A branch picked for another settlement is not in this list, so it drops
  // out on its own rather than travelling to Core as a mismatch.
  const divisionId: number | null =
    divisions?.some((item) => item.id === divisionChoice) === true
      ? divisionChoice
      : null

  const trimmedPhone = phone.replace(/[\s()-]/g, '')
  const phoneValid = PHONE.test(trimmedPhone)
  const companyReady =
    !isCompany || (companyName.trim() !== '' && companyTin.trim() !== '')
  const ready =
    name.trim() !== '' &&
    senderName.trim() !== '' &&
    phoneValid &&
    settlementId !== null &&
    divisionId !== null &&
    companyReady

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ready || settlementId === null || divisionId === null) return
    onSubmit({
      input: {
        name: name.trim(),
        senderName: senderName.trim(),
        phone: trimmedPhone,
        settlementId,
        divisionId,
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
    <FormDialog
      description="Дані точки підставляються у відправника накладної під час оформлення доставки."
      error={error}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onSubmit={submit}
      open
      pending={pending}
      size="lg"
      submitDisabled={!ready}
      submitLabel={point === null ? 'Додати точку' : 'Зберегти зміни'}
      title={
        point === null ? 'Нова точка відправлення' : `Точка «${point.name}»`
      }
    >
      {lookupError !== null && <Notice tone="warn">{lookupError}</Notice>}

      <Field hint="Видно лише всередині Rozbirka." label="Назва точки" required>
        <TextInput
          onChange={(event) => setName(event.target.value)}
          placeholder="напр. Головний склад"
          value={name}
        />
      </Field>

      <Field
        hint={
          searching
            ? 'Шукаємо в довіднику Нової пошти…'
            : 'Почніть вводити назву — підкажемо з довідника Нової пошти.'
        }
        label="Населений пункт"
        required
      >
        <TextInput
          list="dispatch-settlements"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Житомир"
          value={query}
        />
      </Field>
      <datalist id="dispatch-settlements">
        {settlements.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>

      <Field
        hint={
          settlementId === null
            ? 'Спершу оберіть населений пункт.'
            : 'Показані лише відділення, які приймають відправлення.'
        }
        label="Відділення відправлення"
        required
      >
        <SelectInput
          disabled={settlementId === null || divisions === null}
          onChange={(event) =>
            setDivisionChoice(
              event.target.value === '' ? null : Number(event.target.value),
            )
          }
          value={divisionId === null ? '' : String(divisionId)}
        >
          <option value="">
            {divisions === null ? 'Завантажуємо…' : 'Оберіть відділення'}
          </option>
          {(divisions ?? []).map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.name}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Ім’я відправника" required>
        <TextInput
          onChange={(event) => setSenderName(event.target.value)}
          placeholder="ПІБ контактної особи"
          value={senderName}
        />
      </Field>

      <Field
        error={
          phone !== '' && !phoneValid
            ? 'Телефон у міжнародному форматі, напр. +380672147730'
            : undefined
        }
        label="Телефон відправника"
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
          <Field label="Назва компанії" required>
            <TextInput
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Юридична назва"
              value={companyName}
            />
          </Field>
          <Field label="Ідентифікаційний код" required>
            <TextInput
              className="font-mono"
              onChange={(event) => setCompanyTin(event.target.value)}
              placeholder="ЄДРПОУ або ІПН"
              value={companyTin}
            />
          </Field>
        </>
      )}

      <div className="border-app-line bg-app-input grid gap-4 rounded-[14px] border px-5 py-4.5">
        <Toggle
          checked={isCompany}
          hint="Додає назву та ідентифікаційний код у накладну."
          label="Відправник — компанія"
          onChange={setIsCompany}
        />
        <Toggle
          checked={makeDefault}
          disabled={defaultLocked}
          hint="Підставляється в оформлення доставки. Менеджер може вибрати іншу."
          label="Точка за замовчуванням"
          onChange={setMakeDefault}
          title={
            defaultLocked
              ? 'Ця точка вже типова. Щоб змінити, зробіть типовою іншу точку.'
              : undefined
          }
        />
        <Toggle
          checked={isActive}
          disabled={defaultLocked}
          hint="Неактивні точки не пропонуються під час оформлення."
          label="Активна"
          onChange={setIsActive}
          title={
            defaultLocked
              ? 'Типову точку не можна вимкнути — спершу зробіть типовою іншу.'
              : undefined
          }
        />
      </div>

      {onDeactivate !== undefined && (
        <div>
          <button
            className="border-state-danger/35 text-state-danger enabled:hover:bg-state-danger-soft inline-flex min-h-11 items-center rounded-[11px] border px-4 text-[14px] font-medium disabled:cursor-not-allowed disabled:opacity-55"
            disabled={pending || deactivateLocked}
            onClick={onDeactivate}
            title={
              deactivateLocked
                ? 'Типову точку не можна вимкнути — спершу зробіть типовою іншу.'
                : 'Точка перестане пропонуватися при оформленні. Створені накладні не змінюються.'
            }
            type="button"
          >
            Вимкнути точку
          </button>
        </div>
      )}
    </FormDialog>
  )
}
