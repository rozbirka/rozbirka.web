import { defineMessages } from '@/i18n'

export const unassignedMessages = defineMessages({
  uk: {
    title: 'Без зони',
    lead: 'Запчастини складу «{warehouse}», для яких ще не вибрано зону. Знайдіть запчастину та натисніть «Розмістити».',
    list: 'Запчастини без зони',
    empty: 'Усі запчастини цього складу вже мають зону.',
    missingZone: 'Не вдалося визначити зону нерозміщених запчастин.',
    placed: 'Розміщення «{name}» збережено.',
    archived: 'Склад в архіві. Список доступний для перегляду.',
  },
  'en-GB': {
    title: 'No zone',
    lead: 'Parts in “{warehouse}” without a zone. Find a part and choose “Place”.',
    list: 'Parts without a zone',
    empty: 'All parts in this warehouse already have a zone.',
    missingZone: 'Couldn’t identify the zone for unplaced parts.',
    placed: 'Placement of “{name}” saved.',
    archived: 'This warehouse is archived. The list is read-only.',
  },
  pl: {
    title: 'Bez strefy',
    lead: 'Części magazynu „{warehouse}” bez przypisanej strefy. Znajdź część i wybierz „Umieść”.',
    list: 'Części bez strefy',
    empty: 'Wszystkie części tego magazynu mają już strefę.',
    missingZone: 'Nie udało się ustalić strefy nieumieszczonych części.',
    placed: 'Zapisano lokalizację „{name}”.',
    archived:
      'Magazyn jest zarchiwizowany. Lista jest dostępna tylko do odczytu.',
  },
})
