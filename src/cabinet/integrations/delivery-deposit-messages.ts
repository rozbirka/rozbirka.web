import { defineMessages } from '@/i18n/messages'

export const deliveryDepositMessages = defineMessages({
  uk: {
    title: 'Депозит за доставку',
    label: 'Вимагати депозит за доставку',
    on: 'ТТН не створюється, поки клієнт не внесе вартість доставки в обидва боки. Вимкніть, якщо готові відправляти без передоплати.',
    off: 'Відправляєте без передоплати. Якщо посилку не заберуть, обидві дороги оплачує розбірка.',
    saved: 'Налаштування депозиту збережено.',
    error: 'Не вдалося зберегти налаштування депозиту. Спробуйте ще раз.',
    denied: 'Ви більше не маєте права змінювати налаштування депозиту.',
    ownerOnly: 'Змінити вимогу депозиту може лише власник бізнесу.',
  },
  'en-GB': {
    title: 'Delivery deposit',
    label: 'Require a delivery deposit',
    on: 'No waybill is created until the customer pays for delivery both ways. Turn this off if you’re ready to ship without prepayment.',
    off: 'You ship without prepayment. If the parcel isn’t collected, your business pays for delivery both ways.',
    saved: 'Delivery deposit settings saved.',
    error: 'Couldn’t save delivery deposit settings. Please try again.',
    denied:
      'You no longer have permission to change delivery deposit settings.',
    ownerOnly: 'Only the business owner can change the deposit requirement.',
  },
  pl: {
    title: 'Kaucja za dostawę',
    label: 'Wymagaj kaucji za dostawę',
    on: 'List przewozowy nie powstanie, dopóki klient nie opłaci dostawy w obie strony. Wyłącz, jeśli możesz wysyłać bez przedpłaty.',
    off: 'Wysyłasz bez przedpłaty. Jeśli paczka nie zostanie odebrana, dostawę w obie strony opłaca firma.',
    saved: 'Zapisano ustawienia kaucji za dostawę.',
    error: 'Nie udało się zapisać ustawień kaucji. Spróbuj ponownie.',
    denied: 'Nie masz już uprawnień do zmiany ustawień kaucji.',
    ownerOnly: 'Tylko właściciel firmy może zmienić wymóg kaucji.',
  },
})
