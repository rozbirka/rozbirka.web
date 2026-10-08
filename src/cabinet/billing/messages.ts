import { defineMessages } from '@/i18n'

/**
 * Words the three billing screens share: plan vocabulary, payment statuses,
 * the "cannot manage" notices and the failures every mutation can hit.
 */
export const billingMessages = defineMessages({
  uk: {
    featureIntakeManagement: 'Приймання партій',
    featureReportsAdvanced: 'Розширені звіти',
    featureBulkExport: 'Масовий експорт',
    featureTeamCollaboration: 'Спільна робота команди',
    featureAdvancedAnalytics: 'Поглиблена аналітика',
    featureCompatSuggest: 'Підбір сумісності',
    featureMultiCashRegisters: 'Декілька кас',
    featureExtendedPhotos: 'Більше фото на позицію',
    featureQrCodes: 'QR-коди',

    limitCars: 'Авто',
    limitIntakes: 'Партії',
    limitParts: 'Запчастини',
    limitUsers: 'Команда',
    limitCashRegisters: 'Каси',

    perMonth: 'за місяць',
    perYear: 'за рік',
    perQuarter: 'за квартал',
    perOther: 'за {interval}',
    monthly: 'місяць',
    yearly: 'рік',
    quarterly: 'квартал',

    days: {
      one: '{count} день',
      few: '{count} дні',
      many: '{count} днів',
      other: '{count} дня',
    },

    paymentSuccess: 'Оплачено',
    paymentPending: 'Очікує',
    paymentFailed: 'Помилка',
    paymentReversed: 'Повернено',
    paymentCancelled: 'Скасовано',
    paymentCheckout: 'Перший платіж',
    paymentRecurring: 'Регулярне списання',
    paymentVerification: 'Верифікація',
    noInvoiceNumber: 'номер рахунку не повернувся',

    managementUnavailable:
      'Керування підпискою недоступне. Оновіть сторінку — можливо, підписку перенесли в App Store або Google Play.',
    contractManaged:
      'Корпоративний тариф підключено за договором. Зміни узгоджуються з менеджером Rozbirka.',
    emptyTitle: 'Немає даних білінгу',
    emptyDescription: 'Дані недоступні. Спробуйте оновити сторінку.',

    actionUnavailable:
      'Дія більше недоступна: права або стан підписки змінилися. Оновіть сторінку.',
    noRightToChange:
      'У вас більше немає права змінювати підписку. Попросіть власника розбірки надати доступ до білінгу.',
    subscriptionChanged:
      'Підписка вже змінилася. Оновіть сторінку та спробуйте ще раз.',
    checkoutNetwork:
      'Не вдалося розпочати оплату: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.',
    checkoutFailed: 'Не вдалося розпочати оплату. Спробуйте ще раз.',
    noPayments: 'Платежів ще не було.',
    loadingPayments: 'Завантажуємо платежі…',
  },
  'en-GB': {
    featureIntakeManagement: 'Batch intake',
    featureReportsAdvanced: 'Advanced reports',
    featureBulkExport: 'Bulk export',
    featureTeamCollaboration: 'Team collaboration',
    featureAdvancedAnalytics: 'Advanced analytics',
    featureCompatSuggest: 'Compatibility suggestions',
    featureMultiCashRegisters: 'Multiple tills',
    featureExtendedPhotos: 'More photos per item',
    featureQrCodes: 'QR codes',

    limitCars: 'Cars',
    limitIntakes: 'Batches',
    limitParts: 'Parts',
    limitUsers: 'Team',
    limitCashRegisters: 'Tills',

    perMonth: 'per month',
    perYear: 'per year',
    perQuarter: 'per quarter',
    perOther: 'per {interval}',
    monthly: 'Monthly',
    yearly: 'Yearly',
    quarterly: 'Quarterly',

    days: { one: '{count} day', other: '{count} days' },

    paymentSuccess: 'Paid',
    paymentPending: 'Pending',
    paymentFailed: 'Failed',
    paymentReversed: 'Refunded',
    paymentCancelled: 'Cancelled',
    paymentCheckout: 'First payment',
    paymentRecurring: 'Recurring charge',
    paymentVerification: 'Verification',
    noInvoiceNumber: 'no invoice number returned',

    managementUnavailable:
      'Subscription management is unavailable. Refresh the page — the subscription may have moved to the App Store or Google Play.',
    contractManaged:
      'Your corporate plan is under contract. Changes are agreed with your Rozbirka manager.',
    emptyTitle: 'No billing data',
    emptyDescription: 'The data is unavailable. Try refreshing the page.',

    actionUnavailable:
      'This action is no longer available: your permissions or the subscription have changed. Refresh the page.',
    noRightToChange:
      'You can no longer change the subscription. Ask the business owner for billing access.',
    subscriptionChanged:
      'The subscription has already changed. Refresh the page and try again.',
    checkoutNetwork:
      'Couldn’t start the payment: no network connection. Check your internet and try again.',
    checkoutFailed: 'Couldn’t start the payment. Please try again.',
    noPayments: 'No payments yet.',
    loadingPayments: 'Loading payments…',
  },
  pl: {
    featureIntakeManagement: 'Przyjmowanie partii',
    featureReportsAdvanced: 'Rozszerzone raporty',
    featureBulkExport: 'Eksport masowy',
    featureTeamCollaboration: 'Praca zespołowa',
    featureAdvancedAnalytics: 'Zaawansowana analityka',
    featureCompatSuggest: 'Dobór kompatybilności',
    featureMultiCashRegisters: 'Kilka kas',
    featureExtendedPhotos: 'Więcej zdjęć na pozycję',
    featureQrCodes: 'Kody QR',

    limitCars: 'Auta',
    limitIntakes: 'Partie',
    limitParts: 'Części',
    limitUsers: 'Zespół',
    limitCashRegisters: 'Kasy',

    perMonth: 'za miesiąc',
    perYear: 'za rok',
    perQuarter: 'za kwartał',
    perOther: 'za {interval}',
    monthly: 'Miesięcznie',
    yearly: 'Rocznie',
    quarterly: 'Kwartalnie',

    days: {
      one: '{count} dzień',
      few: '{count} dni',
      many: '{count} dni',
      other: '{count} dnia',
    },

    paymentSuccess: 'Opłacono',
    paymentPending: 'Oczekuje',
    paymentFailed: 'Błąd',
    paymentReversed: 'Zwrócono',
    paymentCancelled: 'Anulowano',
    paymentCheckout: 'Pierwsza płatność',
    paymentRecurring: 'Płatność cykliczna',
    paymentVerification: 'Weryfikacja',
    noInvoiceNumber: 'brak numeru rachunku',

    managementUnavailable:
      'Zarządzanie subskrypcją jest niedostępne. Odśwież stronę — subskrypcja mogła zostać przeniesiona do App Store lub Google Play.',
    contractManaged:
      'Plan firmowy działa na podstawie umowy. Zmiany uzgadnia się z menedżerem Rozbirka.',
    emptyTitle: 'Brak danych rozliczeń',
    emptyDescription: 'Dane są niedostępne. Spróbuj odświeżyć stronę.',

    actionUnavailable:
      'Ta czynność nie jest już dostępna: zmieniły się uprawnienia lub stan subskrypcji. Odśwież stronę.',
    noRightToChange:
      'Nie masz już uprawnień do zmiany subskrypcji. Poproś właściciela firmy o dostęp do rozliczeń.',
    subscriptionChanged:
      'Subskrypcja już się zmieniła. Odśwież stronę i spróbuj ponownie.',
    checkoutNetwork:
      'Nie udało się rozpocząć płatności: brak połączenia z siecią. Sprawdź internet i spróbuj ponownie.',
    checkoutFailed: 'Nie udało się rozpocząć płatności. Spróbuj ponownie.',
    noPayments: 'Nie było jeszcze płatności.',
    loadingPayments: 'Wczytywanie płatności…',
  },
})
