import { defineMessages } from '@/i18n'

export const plansMessages = defineMessages({
  uk: {
    crumb: 'Налаштування · Підписка · Тарифи',
    title: 'Тарифи',
    lead: 'Порівняйте ліміти й можливості, перш ніж міняти тариф.',
    loading: 'Завантажуємо тарифи…',
    loadFailedTitle: 'Тарифи не завантажилися',
    billingPeriod: 'Період оплати',
    managedByProvider:
      'Цією підпискою керує {provider}. Змінюйте або скасовуйте її в налаштуваннях магазину.',
    selected: 'Обрано',
    currentPlan: 'Поточний тариф',
    trialFree: '{days} безкоштовно',
    noTrial: 'Без пробного періоду',
    photosPerItem: 'Фото на позицію',
    noFeaturesListed: 'Можливостей тариф не перелічує.',
    includedInPlan: 'є в тарифі',
    notInPlan: 'немає в тарифі',
    alreadyActive: 'Цей тариф уже діє.',
    choose: 'Обрати',
    whatsIncluded: 'Що входить у кожен тариф',
    comparison: 'Порівняння тарифів',
    feature: 'Можливість',
    included: 'є',
    notIncluded: 'немає',
    noProration:
      'Залишок оплаченого періоду кабінет не перераховує — оплата починається з нового рахунку.',
    noPlanCopy:
      'Опису «кому цей тариф» і позначок знижки в тарифах теж немає: є назва, сума, валюта, період, ліміти й перелік можливостей.',
    loadNetwork:
      'Не вдалося завантажити тарифи: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.',
    loadForbidden:
      'У вас немає доступу до тарифів цієї розбірки. Попросіть власника надати доступ до білінгу.',
    loadFailed: 'Не вдалося завантажити тарифи. Спробуйте ще раз.',
  },
  'en-GB': {
    crumb: 'Settings · Subscription · Plans',
    title: 'Plans',
    lead: 'Compare limits and features before you change plan.',
    loading: 'Loading plans…',
    loadFailedTitle: 'Plans didn’t load',
    billingPeriod: 'Billing period',
    managedByProvider:
      'This subscription is managed by {provider}. Change or cancel it in the store settings.',
    selected: 'Selected',
    currentPlan: 'Current plan',
    trialFree: '{days} free',
    noTrial: 'No free trial',
    photosPerItem: 'Photos per item',
    noFeaturesListed: 'This plan doesn’t list any features.',
    includedInPlan: 'included in the plan',
    notInPlan: 'not in the plan',
    alreadyActive: 'This plan is already active.',
    choose: 'Choose',
    whatsIncluded: 'What each plan includes',
    comparison: 'Plan comparison',
    feature: 'Feature',
    included: 'included',
    notIncluded: 'not included',
    noProration:
      'The rest of a paid period isn’t credited — payment starts with a new invoice.',
    noPlanCopy:
      'Plans also have no “who it’s for” description or discount badges: just a name, amount, currency, period, limits and a list of features.',
    loadNetwork:
      'Couldn’t load plans: no network connection. Check your internet and try again.',
    loadForbidden:
      'You don’t have access to this business’s plans. Ask the owner for billing access.',
    loadFailed: 'Couldn’t load plans. Please try again.',
  },
  pl: {
    crumb: 'Ustawienia · Subskrypcja · Plany',
    title: 'Plany',
    lead: 'Porównaj limity i funkcje, zanim zmienisz plan.',
    loading: 'Wczytywanie planów…',
    loadFailedTitle: 'Nie udało się wczytać planów',
    billingPeriod: 'Okres rozliczeniowy',
    managedByProvider:
      'Tą subskrypcją zarządza {provider}. Zmień ją lub anuluj w ustawieniach sklepu.',
    selected: 'Wybrany',
    currentPlan: 'Obecny plan',
    trialFree: '{days} za darmo',
    noTrial: 'Bez okresu próbnego',
    photosPerItem: 'Zdjęcia na pozycję',
    noFeaturesListed: 'Plan nie wymienia żadnych funkcji.',
    includedInPlan: 'jest w planie',
    notInPlan: 'brak w planie',
    alreadyActive: 'Ten plan już działa.',
    choose: 'Wybierz',
    whatsIncluded: 'Co zawiera każdy plan',
    comparison: 'Porównanie planów',
    feature: 'Funkcja',
    included: 'jest',
    notIncluded: 'brak',
    noProration:
      'Pozostała część opłaconego okresu nie jest przeliczana — płatność zaczyna się od nowego rachunku.',
    noPlanCopy:
      'Plany nie mają też opisu „dla kogo” ani oznaczeń rabatu: jest nazwa, kwota, waluta, okres, limity i lista funkcji.',
    loadNetwork:
      'Nie udało się wczytać planów: brak połączenia z siecią. Sprawdź internet i spróbuj ponownie.',
    loadForbidden:
      'Nie masz dostępu do planów tej firmy. Poproś właściciela o dostęp do rozliczeń.',
    loadFailed: 'Nie udało się wczytać planów. Spróbuj ponownie.',
  },
})
