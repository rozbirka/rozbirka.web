import { defineMessages } from '@/i18n'

/** The supported new-session inputs: zones, draft creation and starting. */
export const newSessionMessages = defineMessages({
  uk: {
    typeFull: 'Повна',
    typeFullHint: 'Усі активні зони вибраного складу',
    typeZones: 'По зонах',
    typeZonesHint: 'Вибрані зони повністю',
    fallbackWarehouse: 'Склад',
    summaryFull: 'повна',
    summaryZones: 'по зонах',
    saving: 'Зберігаємо…',
    saveDraft: 'Зберегти чернетку',
    starting: 'Запускаємо…',
    start: 'Розпочати сесію',
    startFailedAfterCreate:
      'Сесію {number} створено, але запуск не вдалося підтвердити. {error}',
    title: 'Нова сесія інвентаризації',
    intro:
      'Поки сесія активна, позиції в її зонах не можна редагувати вручну. Рахують у мобільному застосунку.',
    noPermission: 'Для створення інвентаризації потрібен дозвіл керування.',
    typeTitle: 'Тип перевірки',
    typeHint: 'Визначає, які зони входять у сесію.',
    zonesTitle: 'Склад і зони',
    zonesHintFull: 'Повна перевірка охоплює всі активні зони вибраного складу.',
    zonesHintPick: 'Виберіть зони, які входять у сесію.',
    warehouse: 'Склад',
    noActiveZones: 'На цьому складі немає активних зон.',
    scopeTitle: 'Обсяг сесії',
    noZonesPicked: 'Зони не вибрані',
    zonesCount: 'Зон',
    pickOne: 'Виберіть хоча б одну зону.',
    afterStart:
      'Після старту зони блокуються для ручних змін. «Зберегти чернетку» створює сесію, не запускаючи підрахунок.',
  },
  'en-GB': {
    typeFull: 'Full',
    typeFullHint: 'All active zones of the selected warehouse',
    typeZones: 'By zone',
    typeZonesHint: 'Selected zones in full',
    fallbackWarehouse: 'Warehouse',
    summaryFull: 'full',
    summaryZones: 'by zone',
    saving: 'Saving…',
    saveDraft: 'Save draft',
    starting: 'Starting…',
    start: 'Start session',
    startFailedAfterCreate:
      'Session {number} was created, but its start could not be confirmed. {error}',
    title: 'New stocktake session',
    intro:
      'While the session is active, items in its zones can’t be edited manually. Counting happens in the mobile app.',
    noPermission: 'You need the manage permission to create a stocktake.',
    typeTitle: 'Count type',
    typeHint: 'Sets which zones the session covers.',
    zonesTitle: 'Warehouse and zones',
    zonesHintFull:
      'A full count covers every active zone of the selected warehouse.',
    zonesHintPick: 'Select the zones the session covers.',
    warehouse: 'Warehouse',
    noActiveZones: 'This warehouse has no active zones.',
    scopeTitle: 'Session scope',
    noZonesPicked: 'No zones selected',
    zonesCount: 'Zones',
    pickOne: 'Select at least one zone.',
    afterStart:
      'Once started, zones are locked for manual changes. “Save draft” creates the session without starting the count.',
  },
  pl: {
    typeFull: 'Pełna',
    typeFullHint: 'Wszystkie aktywne strefy wybranego magazynu',
    typeZones: 'Według stref',
    typeZonesHint: 'Wybrane strefy w całości',
    fallbackWarehouse: 'Magazyn',
    summaryFull: 'pełna',
    summaryZones: 'według stref',
    saving: 'Zapisywanie…',
    saveDraft: 'Zapisz szkic',
    starting: 'Uruchamiamy…',
    start: 'Rozpocznij sesję',
    startFailedAfterCreate:
      'Sesja {number} została utworzona, ale nie udało się potwierdzić jej uruchomienia. {error}',
    title: 'Nowa sesja inwentaryzacji',
    intro:
      'Dopóki sesja jest aktywna, pozycji w jej strefach nie można edytować ręcznie. Liczenie odbywa się w aplikacji mobilnej.',
    noPermission:
      'Do utworzenia inwentaryzacji potrzebne jest uprawnienie zarządzania.',
    typeTitle: 'Rodzaj liczenia',
    typeHint: 'Określa, które strefy wchodzą do sesji.',
    zonesTitle: 'Magazyn i strefy',
    zonesHintFull:
      'Pełne liczenie obejmuje wszystkie aktywne strefy wybranego magazynu.',
    zonesHintPick: 'Wybierz strefy, które wchodzą do sesji.',
    warehouse: 'Magazyn',
    noActiveZones: 'W tym magazynie nie ma aktywnych stref.',
    scopeTitle: 'Zakres sesji',
    noZonesPicked: 'Nie wybrano stref',
    zonesCount: 'Stref',
    pickOne: 'Wybierz co najmniej jedną strefę.',
    afterStart:
      'Po starcie strefy są blokowane dla ręcznych zmian. „Zapisz szkic” tworzy sesję bez uruchamiania liczenia.',
  },
})
