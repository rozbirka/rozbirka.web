import { useEffect, useState } from 'react'
import { Button, Card, Field, Notice, SelectInput } from '@/components/app'
import { cashApi, type CashRegister } from '@/api/cash'
import {
  integrationsApi,
  type NovaPoshtaContact,
  type NovaPoshtaCounterparty,
  type NovaPoshtaPreferences,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { commonMessages, useLocale, useT } from '@/i18n'
import {
  integrationProblemMessage,
  isCountryUnavailableProblem,
  novaPoshtaUnavailableText,
} from './integration-labels'
import { npFormsMessages } from './np-forms-messages'

/**
 * What the yard decides about delivery once, rather than on every parcel: the
 * sender its waybills go out as, and the till a post-payment lands in.
 *
 * Both belong here and not on a dispatch point. One API key dispatches as one
 * counterparty, and money collected at a counter goes to one place however
 * many branches the yard sends from.
 */
export function DeliveryPreferencesPanel({
  integrationId,
}: {
  integrationId: string
}) {
  const { locale } = useLocale()
  const t = useT(npFormsMessages)
  const tc = useT(commonMessages)
  const [saved, setSaved] = useState<NovaPoshtaPreferences | null>(null)
  const [senders, setSenders] = useState<NovaPoshtaCounterparty[] | null>(null)
  const [contacts, setContacts] = useState<{
    counterpartyRef: string
    items: NovaPoshtaContact[]
  } | null>(null)
  const [tills, setTills] = useState<CashRegister[] | null>(null)
  const [sender, setSender] = useState<string | null>(null)
  const [contact, setContact] = useState<string | null>(null)
  const [till, setTill] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<'senders' | 'country' | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled([
      integrationsApi.preferences(integrationId, { signal: controller.signal }),
      integrationsApi.senders(integrationId, { signal: controller.signal }),
      cashApi.list(true, { signal: controller.signal }),
    ]).then(([preferences, senderList, cashList]) => {
      if (controller.signal.aborted) return
      if (preferences.status === 'fulfilled') {
        setSaved(preferences.value)
        setSender(preferences.value.senderCounterpartyRef)
        setContact(preferences.value.senderContactRef)
        setTill(preferences.value.codCashRegisterId)
      }
      setSenders(senderList.status === 'fulfilled' ? senderList.value : [])
      // A post-payment is collected in hryvnia, so a till that does not keep
      // hryvnia is not a place it can land.
      setTills(
        cashList.status === 'fulfilled'
          ? cashList.value.filter((item) => 'UAH' in item.balances)
          : [],
      )
      if (senderList.status === 'rejected')
        setLoadError(
          isCountryUnavailableProblem(normalizeApiProblem(senderList.reason))
            ? 'country'
            : 'senders',
        )
    })
    return () => controller.abort()
  }, [integrationId])

  useEffect(() => {
    if (sender === null) return
    const controller = new AbortController()
    void integrationsApi
      .senderContacts(integrationId, sender, { signal: controller.signal })
      .then(
        (items) => {
          if (!controller.signal.aborted)
            setContacts({ counterpartyRef: sender, items })
        },
        () => {
          if (!controller.signal.aborted)
            setContacts({ counterpartyRef: sender, items: [] })
        },
      )
    return () => controller.abort()
  }, [integrationId, sender])

  const contactOptions =
    sender !== null && contacts?.counterpartyRef === sender
      ? contacts.items
      : null
  const chosenContact =
    contactOptions?.some((item) => item.ref === contact) === true
      ? contact
      : null
  const changed =
    saved !== null &&
    (sender !== saved.senderCounterpartyRef ||
      chosenContact !== saved.senderContactRef ||
      till !== saved.codCashRegisterId)

  const save = () => {
    if (busy || !changed) return
    setBusy(true)
    setError(null)
    setLoadError(null)
    setDone(false)
    void integrationsApi
      .savePreferences(integrationId, {
        codCashRegisterId: till,
        senderCounterpartyRef: sender,
        senderContactRef: chosenContact,
      })
      .then((next) => {
        setSaved(next)
        setDone(true)
      })
      .catch((problem: unknown) => {
        setError(
          integrationProblemMessage(normalizeApiProblem(problem), locale),
        )
      })
      .finally(() => setBusy(false))
  }

  return (
    <Card title={t('deliveryCard')}>
      <div className="grid gap-3.5">
        {error === null ? null : <Notice tone="danger">{error}</Notice>}
        {loadError === null ? null : (
          <Notice tone="danger">
            {loadError === 'country'
              ? novaPoshtaUnavailableText(locale).message
              : t('sendersError')}
          </Notice>
        )}
        {done ? <Notice tone="ok">{t('prefsSaved')}</Notice> : null}

        <Field hint={t('senderHint')} label={t('senderLabel')}>
          <SelectInput
            disabled={busy || senders === null}
            onChange={(event) => {
              setSender(event.target.value === '' ? null : event.target.value)
              setContact(null)
              setDone(false)
            }}
            value={sender ?? ''}
          >
            <option value="">
              {senders === null
                ? t('loading')
                : senders.length === 0
                  ? t('noSenders')
                  : t('notChosen')}
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
          hint={sender === null ? t('pickSenderFirst') : t('contactHint')}
          label={t('contactLabel')}
        >
          <SelectInput
            disabled={busy || sender === null || contactOptions === null}
            onChange={(event) => {
              setContact(event.target.value === '' ? null : event.target.value)
              setDone(false)
            }}
            value={chosenContact ?? ''}
          >
            <option value="">
              {contactOptions === null ? t('loading') : t('notChosen')}
            </option>
            {(contactOptions ?? []).map((item) => (
              <option key={item.ref} value={item.ref}>
                {item.name}
                {item.phone == null ? '' : ` · ${item.phone}`}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          hint={till === null ? t('tillNoneHint') : t('tillHint')}
          label={t('tillLabel')}
        >
          <SelectInput
            disabled={busy || tills === null}
            onChange={(event) => {
              setTill(event.target.value === '' ? null : event.target.value)
              setDone(false)
            }}
            value={till ?? ''}
          >
            <option value="">
              {tills === null
                ? t('loading')
                : tills.length === 0
                  ? t('noUahTill')
                  : t('manualEntry')}
            </option>
            {(tills ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Button
          aria-busy={busy}
          className="justify-center"
          disabled={busy || !changed}
          onClick={save}
          variant="primary"
        >
          {busy ? tc('saving') : tc('save')}
        </Button>
      </div>
    </Card>
  )
}
