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
        setError('Не вдалося прочитати відправників із кабінету Нової пошти.')
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
        setError(normalizeApiProblem(problem).message)
      })
      .finally(() => setBusy(false))
  }

  return (
    <Card title="Доставка">
      <div className="grid gap-3.5">
        {error === null ? null : <Notice tone="danger">{error}</Notice>}
        {done ? <Notice tone="ok">Налаштування збережено.</Notice> : null}

        <Field
          hint="Відправник із кабінету Нової пошти. Усі накладні йдуть від його імені."
          label="Відправник"
        >
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
                ? 'Завантажуємо…'
                : senders.length === 0
                  ? 'Кабінет не повернув жодного відправника'
                  : 'Не обрано'}
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
            sender === null
              ? 'Спершу оберіть відправника.'
              : 'Ця особа буде вказана в накладній як контакт відправника.'
          }
          label="Контактна особа"
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
              {contactOptions === null ? 'Завантажуємо…' : 'Не обрано'}
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
          hint={
            till === null
              ? 'Без каси післяплату доведеться вносити вручну — замовлення чекатиме в черзі на звірку.'
              : 'Щойно клієнт забере посилку, післяплата зарахується в цю касу автоматично.'
          }
          label="Каса для післяплати"
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
                ? 'Завантажуємо…'
                : tills.length === 0
                  ? 'Немає активної каси з гривнею'
                  : 'Вносити вручну'}
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
          {busy ? 'Зберігаємо…' : 'Зберегти'}
        </Button>
      </div>
    </Card>
  )
}
