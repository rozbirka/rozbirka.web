import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  Field,
  Notice,
  SelectInput,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import { integrationsApi } from '@/api/integrations'
import { novaPoshtaSetupApi } from '@/api/nova-poshta-setup'
import { normalizeApiProblem } from '@/api/errors'
import { commonMessages, useLocale, useT } from '@/i18n'
import { integrationProblemMessage } from './integration-labels'
import { integrationsMessages } from './integrations-messages'
import { npConnectMessages } from './np-connect-messages'
import { npSettingsMessages } from './np-settings-messages'
import {
  contactLine,
  isRejectedKey,
  pointFromDispatchPoint,
  pointLine,
  problemCode,
  senderLine,
  setupConfiguration,
} from './np-setup-model'
import {
  defaultPoint,
  useSenderContacts,
  type NpDeliverySettings,
  type NpDeliverySettingsState,
} from './use-np-delivery-settings'

interface Selection {
  senderRef: string | null
  contactRef: string | null
  pointId: string | null
  tillId: string | null
}

type Problem =
  | { kind: 'error'; text: string }
  | { kind: 'save' }
  | { kind: 'conflict' }

const baseline = (data: NpDeliverySettings): Selection => ({
  senderRef: data.preferences.senderCounterpartyRef,
  contactRef: data.preferences.senderContactRef,
  pointId: defaultPoint(data.points)?.id ?? null,
  tillId: data.preferences.codCashRegisterId,
})

const CONFLICT_CODES = new Set([
  'np_configuration_changed',
  'concurrent_update',
])

export interface NpSettingsEditor {
  /** «Скасувати» and «Перевірити зміни», for the page topbar. */
  actions: ReactNode
  body: ReactNode
}

/**
 * Changing what an existing connection dispatches with (module 46 §2.2–2.8).
 *
 * The till alone is a preference Core changes in place. A sender, contact or
 * point is re-checked against the carrier, which only a setup session can
 * do — and a session needs the key again, because Core never hands the
 * stored one back. Nothing changes until the summary is confirmed.
 */
export function useNpSettingsEditor({
  integrationId,
  onCancel,
  onSaved,
  reload,
  requireLatestMutation,
  settings,
}: {
  integrationId: string
  onCancel: () => void
  onSaved: () => void
  reload: () => void
  requireLatestMutation: () => unknown
  settings: NpDeliverySettingsState
}): NpSettingsEditor {
  const { locale } = useLocale()
  const t = useT(npSettingsMessages)
  const tc = useT(commonMessages)
  const tk = useT(npConnectMessages)
  const ti = useT(integrationsMessages)
  const data = settings.kind === 'ready' ? settings.data : null
  const saved = data === null ? null : baseline(data)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)
  const [summary, setSummary] = useState(false)
  const [pending, setPending] = useState<{
    id: string
    version: string
  } | null>(null)
  const checkRef = useRef<HTMLButtonElement | null>(null)
  const keyRef = useRef<HTMLInputElement | null>(null)
  const current = selection ?? saved
  const contacts = useSenderContacts(integrationId, current?.senderRef ?? null)

  useEffect(() => {
    if (keyError !== null) keyRef.current?.focus()
  }, [keyError])

  const sender =
    data?.senders?.find((item) => item.ref === current?.senderRef) ?? null
  const savedSender =
    data?.senders?.find((item) => item.ref === saved?.senderRef) ?? null
  const contact =
    contacts?.find((item) => item.ref === current?.contactRef) ?? null
  const point =
    data?.points.find((item) => item.id === current?.pointId) ?? null
  const savedPoint =
    data?.points.find((item) => item.id === saved?.pointId) ?? null
  const till = data?.tills.find((item) => item.id === current?.tillId) ?? null
  const savedTill =
    data?.tills.find((item) => item.id === saved?.tillId) ?? null

  const changed = {
    sender: current !== null && current.senderRef !== saved?.senderRef,
    contact: current !== null && current.contactRef !== saved?.contactRef,
    point: current !== null && current.pointId !== saved?.pointId,
    till: current !== null && current.tillId !== saved?.tillId,
  }
  const needsSession = changed.sender || changed.contact || changed.point
  const dirty = needsSession || changed.till
  const complete = current?.contactRef != null && current.pointId !== null

  const update = (patch: Partial<Selection>) => {
    if (current === null) return
    setSelection({ ...current, ...patch })
    setProblem(null)
  }

  const dropPending = () => {
    if (pending === null) return
    void novaPoshtaSetupApi
      .cancel(integrationId, pending.id, pending.version)
      .catch(() => undefined)
    setPending(null)
  }

  const check = async () => {
    if (busy !== null || !dirty || !complete || data === null) return
    setProblem(null)
    setKeyError(null)
    if (!needsSession) {
      setSummary(true)
      return
    }
    const value = key.trim()
    if (value === '') {
      setKeyError(t('keyRequired'))
      return
    }
    if (sender === null || contact === null || point === null) return
    setBusy('check')
    let started: { id: string; version: string } | null = null
    try {
      requireLatestMutation()
      started = await novaPoshtaSetupApi.begin(integrationId, value)
      const configured = await novaPoshtaSetupApi.configure(
        integrationId,
        started.id,
        started.version,
        setupConfiguration(
          sender,
          contact,
          pointFromDispatchPoint(point),
          current?.tillId ?? null,
        ),
      )
      setPending({ id: configured.id, version: configured.version })
      setSummary(true)
    } catch (failure) {
      const normalized = normalizeApiProblem(failure)
      const code = problemCode(normalized)
      if (started === null && isRejectedKey(normalized))
        setKeyError(tk('keyRejected'))
      else if (CONFLICT_CODES.has(code)) setProblem({ kind: 'conflict' })
      else if (
        started !== null &&
        (normalized.kind === 'validation' ||
          code === 'nova_poshta_rejected' ||
          code === 'np_setup_incomplete')
      )
        setProblem({
          kind: 'error',
          text: t('senderRejected', { name: sender.name }),
        })
      else
        setProblem({
          kind: 'error',
          text: integrationProblemMessage(normalized, locale),
        })
      if (started !== null)
        void novaPoshtaSetupApi
          .cancel(integrationId, started.id, started.version)
          .catch(() => undefined)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (busy !== null || data === null || current === null) return
    setSummary(false)
    setProblem(null)
    setBusy('save')
    try {
      requireLatestMutation()
      if (needsSession) {
        if (pending === null) {
          setProblem({ kind: 'error', text: t('checkExpired') })
          return
        }
        await novaPoshtaSetupApi.complete(
          integrationId,
          pending.id,
          pending.version,
        )
        setPending(null)
      } else {
        await integrationsApi.savePreferences(integrationId, {
          codCashRegisterId: current.tillId,
          senderCounterpartyRef: data.preferences.senderCounterpartyRef,
          senderContactRef: data.preferences.senderContactRef,
        })
      }
      setSelection(null)
      setKey('')
      onSaved()
    } catch (failure) {
      const code = problemCode(normalizeApiProblem(failure))
      if (CONFLICT_CODES.has(code)) {
        setPending(null)
        setProblem({ kind: 'conflict' })
      } else if (code === 'np_setup_expired') {
        setPending(null)
        setProblem({ kind: 'error', text: t('checkExpired') })
      } else setProblem({ kind: 'save' })
    } finally {
      setBusy(null)
    }
  }

  const fieldText = {
    sender: t('fieldSender'),
    contact: t('fieldContact'),
    point: t('fieldPoint'),
    till: t('fieldTill'),
  }
  const lines: string[] = []
  if (changed.sender)
    lines.push(
      t('changeLine', {
        field: fieldText.sender,
        from: savedSender?.name ?? '—',
        to: sender?.name ?? '—',
      }),
    )
  if (changed.contact)
    lines.push(
      t('changeLine', {
        field: fieldText.contact,
        from:
          data?.points.find((item) => item.id === saved?.pointId)?.senderName ??
          '—',
        to: contact?.name ?? '—',
      }),
    )
  if (changed.point)
    lines.push(
      t('changeLine', {
        field: fieldText.point,
        from:
          savedPoint === null
            ? '—'
            : pointLine(pointFromDispatchPoint(savedPoint)),
        to: point === null ? '—' : pointLine(pointFromDispatchPoint(point)),
      }),
    )
  if (changed.till)
    lines.push(
      t('changeLine', {
        field: fieldText.till,
        from: savedTill?.name ?? ti('stateOff'),
        to: till?.name ?? ti('stateOff'),
      }),
    )
  const unchanged = (['sender', 'contact', 'point', 'till'] as const)
    .filter((field) => !changed[field])
    .map((field, index) =>
      index === 0
        ? fieldText[field]
        : fieldText[field].toLocaleLowerCase(locale),
    )
  if (unchanged.length > 0) {
    const fields =
      unchanged.length === 1
        ? unchanged[0]!
        : `${unchanged.slice(0, -1).join(', ')} ${t('and')} ${unchanged.at(-1)!}`
    lines.push(
      unchanged.length === 1
        ? t('unchangedOne', { fields })
        : t('unchangedMany', { fields }),
    )
  }
  if (needsSession) lines.push(t('draftsNote'))

  const locked = busy !== null

  const actions = (
    <>
      <Button
        disabled={locked}
        onClick={() => {
          dropPending()
          setSelection(null)
          setKey('')
          setProblem(null)
          onCancel()
        }}
      >
        {tc('cancel')}
      </Button>
      <Button
        aria-busy={locked}
        disabled={locked || !dirty || !complete}
        onClick={() => void check()}
        ref={checkRef}
        variant="primary"
      >
        {locked ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <ShieldCheck aria-hidden />
        )}
        {busy === 'save' ? tc('saving') : t('checkChanges')}
      </Button>
    </>
  )

  const body =
    settings.kind === 'loading' ? (
      <section className="rz-card min-w-0">
        <div className="rz-card__body">
          <SkeletonRows embedded label={ti('loading')} rows={4} />
        </div>
      </section>
    ) : settings.kind === 'error' || data === null || current === null ? (
      <Notice
        action={
          <Button onClick={reload} size="sm">
            {tc('retry')}
          </Button>
        }
        tone="danger"
      >
        {t('shippingLoadError')}
      </Notice>
    ) : (
      <>
        {problem?.kind === 'save' ? (
          <Notice
            action={
              <Button disabled={locked} onClick={() => void save()} size="sm">
                {t('saveAgain')}
              </Button>
            }
            tone="danger"
          >
            {t('saveFailed')}
          </Notice>
        ) : null}
        {problem?.kind === 'conflict' ? (
          <Notice
            action={
              <Button
                onClick={() => {
                  setProblem(null)
                  reload()
                }}
                size="sm"
              >
                {t('refreshData')}
              </Button>
            }
            block
            role="alert"
            tone="warn"
          >
            <p className="rz-strong m-0 font-semibold">{t('conflictTitle')}</p>
            <p className="m-0 mt-1">{t('conflictText')}</p>
          </Notice>
        ) : null}
        <Notice tone="info">{t('editNote')}</Notice>
        <section aria-labelledby="np-edit" className="rz-card min-w-0">
          <header className="rz-card__head py-2.5">
            <h2 className="rz-h-card" id="np-edit">
              {t('shippingCard')}
            </h2>
          </header>
          <div className="rz-card__body grid gap-3">
            <Field
              hint={
                changed.sender && savedSender !== null
                  ? t('changedFrom', { old: savedSender.name })
                  : t('senderHint')
              }
              label={t('sender')}
            >
              <SelectInput
                disabled={locked || data.senders === null}
                onChange={(event) =>
                  update({
                    senderRef: event.target.value || null,
                    contactRef: null,
                  })
                }
                value={current.senderRef ?? ''}
              >
                {current.senderRef === null ? (
                  <option value="">—</option>
                ) : null}
                {(data.senders ?? []).map((item) => (
                  <option key={item.ref} value={item.ref}>
                    {senderLine(item)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t('contact')}>
              <SelectInput
                disabled={locked || contacts === null}
                onChange={(event) =>
                  update({ contactRef: event.target.value || null })
                }
                value={contact?.ref ?? ''}
              >
                {contact === null ? (
                  <option value="">
                    {contacts === null ? ti('loading') : '—'}
                  </option>
                ) : null}
                {(contacts ?? []).map((item) => (
                  <option key={item.ref} value={item.ref}>
                    {contactLine(item)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t('point')}>
              <SelectInput
                disabled={locked}
                onChange={(event) =>
                  update({ pointId: event.target.value || null })
                }
                value={current.pointId ?? ''}
              >
                {current.pointId === null ? <option value="">—</option> : null}
                {data.points.map((item) => (
                  <option key={item.id} value={item.id}>
                    {pointLine(pointFromDispatchPoint(item)) || item.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field hint={t('tillHint')} label={t('till')}>
              <SelectInput
                disabled={locked}
                onChange={(event) =>
                  update({ tillId: event.target.value || null })
                }
                value={current.tillId ?? ''}
              >
                <option value="">{t('noTill')}</option>
                {data.tills.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {needsSession ? (
              <Field
                error={keyError ?? undefined}
                hint={t('keyForChange')}
                label={t('keyLabel')}
                required
              >
                <TextInput
                  autoComplete="off"
                  className="rz-mono"
                  onChange={(event) => {
                    setKey(event.target.value)
                    setKeyError(null)
                  }}
                  placeholder={ti('keyPlaceholder')}
                  readOnly={locked}
                  ref={keyRef}
                  spellCheck={false}
                  value={key}
                />
              </Field>
            ) : null}
            {problem?.kind === 'error' ? (
              <Notice tone="danger">{problem.text}</Notice>
            ) : null}
          </div>
        </section>
        <ConfirmDialog
          confirmLabel={t('saveChanges')}
          consequence={
            needsSession ? t('summaryVerified') : t('summaryTillOnly')
          }
          destructive={false}
          effects={lines}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            checkRef.current?.focus()
          }}
          onConfirm={() => void save()}
          onOpenChange={(open) => {
            if (!open) {
              setSummary(false)
              if (busy === null) dropPending()
            }
          }}
          open={summary}
          title={t('summaryTitle')}
        />
      </>
    )

  return { actions, body }
}
