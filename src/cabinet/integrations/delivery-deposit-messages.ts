import { defineMessages } from '@/i18n/messages'

export const deliveryDepositMessages = defineMessages({
  uk: {
    title: 'Мінімальна передоплата',
    label: 'Вимагати мінімальну передоплату',
    on: 'До створення ТТН клієнт має внести мінімальну передоплату. Для довіреного клієнта можна зробити виняток у замовленні. Отримані кошти зараховуються в оплату замовлення.',
    off: 'Розбірка відправляє без обов’язкової передоплати. Якщо посилку не заберуть, доставку в обидва боки оплачує розбірка.',
    saved: 'Налаштування передоплати збережено.',
    error: 'Не вдалося зберегти налаштування передоплати. Спробуйте ще раз.',
    denied: 'Ви більше не маєте права змінювати налаштування передоплати.',
    ownerOnly: 'Змінити вимогу передоплати може лише власник бізнесу.',
  },
  'en-GB': {
    title: 'Minimum prepayment',
    label: 'Require minimum prepayment',
    on: 'The customer must pay the minimum prepayment before a waybill is created. You can make an exception for a trusted customer in the order. Money received counts towards the order payment.',
    off: 'The business ships without mandatory prepayment. If the parcel is not collected, the business pays for delivery both ways.',
    saved: 'Prepayment settings saved.',
    error: 'Could not save prepayment settings. Please try again.',
    denied: 'You no longer have permission to change prepayment settings.',
    ownerOnly: 'Only the business owner can change the prepayment requirement.',
  },
  pl: {
    title: 'Minimalna przedpłata',
    label: 'Wymagaj minimalnej przedpłaty',
    on: 'Klient musi wpłacić minimalną przedpłatę przed utworzeniem listu. Dla zaufanego klienta można zrobić wyjątek w zamówieniu. Otrzymane środki zaliczamy na poczet zamówienia.',
    off: 'Firma wysyła bez obowiązkowej przedpłaty. Jeśli paczka nie zostanie odebrana, firma opłaca dostawę w obie strony.',
    saved: 'Zapisano ustawienia przedpłaty.',
    error: 'Nie udało się zapisać ustawień przedpłaty. Spróbuj ponownie.',
    denied: 'Nie masz już uprawnień do zmiany ustawień przedpłaty.',
    ownerOnly: 'Tylko właściciel firmy może zmienić wymóg przedpłaty.',
  },
})
