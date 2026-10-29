import { defineMessages } from '@/i18n'

/**
 * Switching Nova Poshta off and on again (design module 46 §2.12–2.15): the
 * confirmation, the switched-off overview and the way back.
 */
export const npDisconnectMessages = defineMessages({
  uk: {
    disconnect: 'Відключити',
    reconnect: 'Підключити знову',
    reconnecting: 'Підключаємо…',
    headOff: 'Відключена',
    statusOff: 'Відключено',
    offBy: 'Відключено · {name} · {date}.',
    offAt: 'Відключено · {date}.',
    offKept: 'Ключ і налаштування збережено.',
    keyKept: 'збережено',
    accessStopped: 'Зупинено',
    offTitle: 'Інтеграцію відключено',
    offText:
      'Нові ТТН і операції через Нову пошту недоступні, статуси не оновлюються. Створені накладні, історія й прив’язки до замовлень доступні для перегляду. Відправлення в Новій пошті не скасовано.',
    confirmTitle: 'Відключити Нову пошту?',
    confirmLater: 'Інтеграцію можна підключити знову пізніше.',
    confirmOnTheRoad: 'Є відправлення, які ще в дорозі.',
    inTransit: '{count} ТТН у дорозі.',
    inTransitCod: '{count} ТТН у дорозі, {cod} з них із післяплатою {sum}.',
    followUp:
      'Після відключення їхні статуси не оновлюватимуться — стежте за ними в кабінеті Нової пошти.',
    followUpCod:
      'Після відключення їхні статуси не оновлюватимуться — стежте за ними в кабінеті Нової пошти, а післяплату вносьте в замовлення вручну.',
    keepData:
      'Створені ТТН, історія, прив’язки до замовлень і налаштування збережуться й лишаться доступними для перегляду.',
    keepBlocked:
      'Нові ТТН і всі операції через Нову пошту стануть недоступні: друк, редагування, скасування, оновлення статусу.',
    keepTracking:
      'Фонове відстеження зупиниться — статуси накладних більше не оновлюватимуться.',
    keepParcels: 'Відправлення в Новій пошті не скасовуються.',
    done: 'Нову пошту відключено. Дані збережено.',
  },
  'en-GB': {
    disconnect: 'Disconnect',
    reconnect: 'Connect again',
    reconnecting: 'Connecting…',
    headOff: 'Disconnected',
    statusOff: 'Disconnected',
    offBy: 'Disconnected · {name} · {date}.',
    offAt: 'Disconnected · {date}.',
    offKept: 'The key and settings are kept.',
    keyKept: 'kept',
    accessStopped: 'Stopped',
    offTitle: 'The integration is disconnected',
    offText:
      'New waybills and operations through Nova Poshta are unavailable, and statuses are not updated. Created waybills, history and order links stay available to view. Shipments in Nova Poshta are not cancelled.',
    confirmTitle: 'Disconnect Nova Poshta?',
    confirmLater: 'You can connect the integration again later.',
    confirmOnTheRoad: 'Some shipments are still on the road.',
    inTransit: {
      one: '{count} waybill on the road.',
      other: '{count} waybills on the road.',
    },
    inTransitCod: {
      one: '{count} waybill on the road, {cod} of them with cash on delivery of {sum}.',
      other:
        '{count} waybills on the road, {cod} of them with cash on delivery of {sum}.',
    },
    followUp:
      'Once disconnected, their statuses will not be updated — follow them in your Nova Poshta account.',
    followUpCod:
      'Once disconnected, their statuses will not be updated — follow them in your Nova Poshta account and enter the cash on delivery in the orders by hand.',
    keepData:
      'Created waybills, history, order links and settings are kept and stay available to view.',
    keepBlocked:
      'New waybills and every operation through Nova Poshta become unavailable: printing, editing, cancelling, status updates.',
    keepTracking:
      'Background tracking stops — waybill statuses will no longer be updated.',
    keepParcels: 'Shipments in Nova Poshta are not cancelled.',
    done: 'Nova Poshta is disconnected. Your data is kept.',
  },
  pl: {
    disconnect: 'Odłącz',
    reconnect: 'Podłącz ponownie',
    reconnecting: 'Podłączamy…',
    headOff: 'Odłączona',
    statusOff: 'Odłączona',
    offBy: 'Odłączono · {name} · {date}.',
    offAt: 'Odłączono · {date}.',
    offKept: 'Klucz i ustawienia zostały zachowane.',
    keyKept: 'zachowany',
    accessStopped: 'Wstrzymany',
    offTitle: 'Integracja jest odłączona',
    offText:
      'Nowe listy przewozowe i operacje przez Nową Pocztę są niedostępne, statusy się nie aktualizują. Utworzone listy, historia i powiązania z zamówieniami pozostają do wglądu. Przesyłki w Nowej Poczcie nie zostały anulowane.',
    confirmTitle: 'Odłączyć Nową Pocztę?',
    confirmLater: 'Integrację można później podłączyć ponownie.',
    confirmOnTheRoad: 'Część przesyłek jest jeszcze w drodze.',
    inTransit: {
      one: '{count} list przewozowy w drodze.',
      few: '{count} listy przewozowe w drodze.',
      many: '{count} listów przewozowych w drodze.',
      other: '{count} listu przewozowego w drodze.',
    },
    inTransitCod: {
      one: '{count} list przewozowy w drodze, z czego {cod} z pobraniem na {sum}.',
      few: '{count} listy przewozowe w drodze, z czego {cod} z pobraniem na {sum}.',
      many: '{count} listów przewozowych w drodze, z czego {cod} z pobraniem na {sum}.',
      other:
        '{count} listu przewozowego w drodze, z czego {cod} z pobraniem na {sum}.',
    },
    followUp:
      'Po odłączeniu ich statusy nie będą się aktualizować — śledź je w panelu Nowej Poczty.',
    followUpCod:
      'Po odłączeniu ich statusy nie będą się aktualizować — śledź je w panelu Nowej Poczty, a pobrania wpisuj do zamówień ręcznie.',
    keepData:
      'Utworzone listy przewozowe, historia, powiązania z zamówieniami i ustawienia zostaną zachowane i pozostaną do wglądu.',
    keepBlocked:
      'Nowe listy przewozowe i wszystkie operacje przez Nową Pocztę staną się niedostępne: druk, edycja, anulowanie, aktualizacja statusu.',
    keepTracking:
      'Śledzenie w tle zostanie zatrzymane — statusy listów przestaną się aktualizować.',
    keepParcels: 'Przesyłki w Nowej Poczcie nie są anulowane.',
    done: 'Nowa Poczta została odłączona. Dane zachowano.',
  },
})
