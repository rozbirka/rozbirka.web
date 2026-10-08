import { defineMessages } from '@/i18n'

/**
 * Statuses, error codes, diagnostics and tracking states of integrations.
 * Keys carry the code Core sends (`error.<code>`, `tracking.<State>`), so the
 * label helpers look a code up without a second map.
 */
export const integrationLabelMessages = defineMessages({
  uk: {
    'status.draft': 'Не налаштована',
    'status.active': 'Підключена',
    'status.inactive': 'Вимкнена',
    'status.error': 'Помилка',
    'mark.nova_poshta': 'НП',
    'kind.nova_poshta': 'Доставка',
    'error.integration_not_configured':
      'Ключ доступу ще не збережено. Додайте його, щоб перевірити підключення.',
    'error.integration_settings_invalid':
      'Збережені дані підключення не підходять. Замініть ключ доступу.',
    'error.integration_account_unverified':
      'Сервіс відхилив ключ: він недійсний або відкликаний у кабінеті перевізника.',
    'error.integration_provider_unavailable':
      'Сервіс не відповів на запит. Дані збережені — спробуйте перевірити ще раз за кілька хвилин.',
    'error.integration_verification_required':
      'Підключення потрібно перевірити, перш ніж вмикати інтеграцію.',
    'error.integration_operation_in_progress':
      'Попередня дія ще виконується. Дочекайтеся її завершення.',
    'error.integration_already_exists': 'Таку інтеграцію вже підключено.',
    'error.integration_country_unavailable':
      'Нова пошта доступна лише для бізнесів в Україні. Інтеграції для вашої країни зʼявляться пізніше.',
    'error.nova_poshta_unauthorized':
      'Нова пошта не прийняла ключ — він недійсний або відкликаний.',
    'error.nova_poshta_rejected': 'Нова пошта відхилила запит.',
    'error.nova_poshta_ratelimited':
      'Нова пошта обмежила частоту запитів. Спробуйте за кілька хвилин.',
    'error.nova_poshta_unavailable':
      'Нова пошта зараз недоступна. Спробуйте за кілька хвилин.',
    'error.nova_poshta_invalidresponse':
      'Нова пошта відповіла у незрозумілому форматі. Спробуйте ще раз.',
    'error.nova_poshta_notsubmitted':
      'Запит до Нової пошти не був надісланий. Спробуйте ще раз.',
    'error.nova_poshta_disabled':
      'Інтеграція Нової пошти вимкнена або не налаштована.',
    'error.dispatch_point_required':
      'Немає точки відправлення за замовчуванням — оформити доставку буде неможливо.',
    'error.dispatch_point_unavailable':
      'Відділення точки відправлення не приймає відправлень.',
    'error.division_not_found':
      'Відділення точки відправлення більше не знайдено.',
    'error.unknown': 'Сервіс повернув помилку: {code}',
    'check.configuration': 'Ключ доступу збережено',
    'check.authorization': 'Ключ приймає сервіс',
    'check.default_dispatch_point': 'Є точка відправлення за замовчуванням',
    'check.sender_division': 'Відділення відправника приймає відправлення',
    'tracking.Disabled': 'Не підключено',
    'tracking.Disabled.detail':
      'Автоматичні оновлення вимкнені. Статуси доставки оновлюються періодичною перевіркою.',
    'tracking.Connecting': 'Підключаємо',
    'tracking.Connecting.detail':
      'Підключаємо оновлення — реєструємо підписку в Новій пошті.',
    'tracking.AwaitingVerification': 'Очікуємо підтвердження',
    'tracking.AwaitingVerification.detail':
      'Очікуємо підтвердження від Нової пошти: перше оновлення на нашу адресу ще не надійшло.',
    'tracking.Connected': 'Підключено',
    'tracking.Connected.detail': 'Нові накладні підключатимуться автоматично.',
    'tracking.RetryPending': 'Спроба не вдалася',
    'tracking.RetryPending.detail':
      'Не вдалося завершити дію. Повторимо автоматично.',
    'tracking.NeedsCredentials': 'Перевірте API-ключ',
    'tracking.NeedsCredentials.detail':
      'Нова пошта не прийняла ключ. Введіть діючий ключ, щоб продовжити підключення.',
    'tracking.NeedsReview': 'Потрібна перевірка',
    'tracking.NeedsReview.detail': 'Підключення потребує перевірки.',
    'tracking.Disconnecting': 'Відключаємо',
    'tracking.Disconnecting.detail':
      'Відключаємо оновлення — чекаємо підтвердження від Нової пошти.',
    'tracking.unknown': 'Стан невідомий',
    'tracking.unknown.detail':
      'Сервіс повернув стан, якого ця версія кабінету не знає. Оновіть стан — нічого не зламано.',
    'reason.callback_not_received':
      'Нова пошта не надіслала жодного оновлення на нашу адресу. Перевірте, чи ключ має доступ до підписок, і повторіть спробу.',
    'reason.ambiguous_subscription':
      'У кабінеті Нової пошти знайдено кілька підписок на ту саму адресу. Приберіть зайві в кабінеті перевізника, тоді повторіть.',
    'reason.subscription_not_confirmed':
      'Нова пошта не підтвердила створення підписки. Повторіть спробу — якщо повториться, перевірте підписки в кабінеті перевізника.',
    'reason.integration_inactive':
      'Інтеграція вимкнена. Увімкніть її, щоб отримувати оновлення.',
    'reason.provider_unauthorized':
      'Нова пошта не прийняла ключ — він недійсний або відкликаний.',
    'reason.provider_rejected': 'Нова пошта відхилила запит на підписку.',
    'reason.provider_notfound': 'Нова пошта не знайшла цієї підписки.',
    'reason.provider_unavailable':
      'Нова пошта не відповідає. Спробуємо ще раз.',
    'reason.provider_ratelimited':
      'Нова пошта обмежила частоту запитів. Спробуємо ще раз пізніше.',
    'reason.provider_invalidresponse':
      'Нова пошта відповіла у незрозумілому форматі. Спробуємо ще раз.',
    'reason.provider_notsubmitted':
      'Запит до Нової пошти не був надісланий. Нічого не створено.',
    'reason.provider_outcomeunknown':
      'Не вдалося підтвердити результат запиту до Нової пошти.',
    'reason.provider_disabled':
      'Інтеграцію Нової пошти вимкнено або не налаштовано.',
    'reason.unknown':
      'Сервіс не завершив дію й не назвав причини, яку ми вміємо пояснити. Спробуйте повторити.',
    'problem.tracking_credentials_required':
      'Потрібен API-ключ Нової пошти — збереженого ключа для підписок немає.',
    'problem.tracking_credentials_invalid':
      'Такий ключ не підходить. Скопіюйте ключ із кабінету Нової пошти ще раз.',
    'problem.tracking_callback_not_configured':
      'У цьому середовищі автоматичні оновлення ще не налаштовані.',
    'problem.tracking_busy':
      'Ця дія вже виконується. Стан оновлено — перевірте його за кілька секунд.',
    'problem.tracking_manual_webhook_configured':
      'Для цієї інтеграції вже налаштований ручний вебхук. Приберіть збережений секрет нижче — самі ми його не вимикаємо.',
    'problem.tracking_disconnect_required':
      'Спершу завершіть відключення попередньої підписки, тоді підключайте нову.',
    'problem.tracking_retry_unavailable':
      'Повторювати вже нічого: стан підписки змінився. Оновіть стан.',
    'problem.forbidden':
      'Немає доступу: потрібні права на налаштування команди.',
    'problem.notFound': 'Підписки для цієї інтеграції немає. Оновіть стан.',
    'problem.network':
      'Немає звʼязку з сервером. Ми не повторюємо дію самі — перевірте стан і за потреби натисніть ще раз.',
    'problem.generic':
      'Не вдалося виконати дію. Перевірте стан і спробуйте ще раз.',
    'unavailable.title': 'Нова пошта недоступна',
  },
  'en-GB': {
    'status.draft': 'Not set up',
    'status.active': 'Connected',
    'status.inactive': 'Turned off',
    'status.error': 'Error',
    'mark.nova_poshta': 'NP',
    'kind.nova_poshta': 'Delivery',
    'error.integration_not_configured':
      'No access key saved yet. Add one to check the connection.',
    'error.integration_settings_invalid':
      'The saved connection details don’t work. Replace the access key.',
    'error.integration_account_unverified':
      'The service rejected the key: it is invalid or was revoked in the carrier’s account.',
    'error.integration_provider_unavailable':
      'The service didn’t respond. Your details are saved — try checking again in a few minutes.',
    'error.integration_verification_required':
      'The connection needs to be checked before the integration can be turned on.',
    'error.integration_operation_in_progress':
      'The previous action is still running. Wait for it to finish.',
    'error.integration_already_exists':
      'This integration is already connected.',
    'error.integration_country_unavailable':
      'Nova Poshta is only available for businesses in Ukraine. Integrations for your country will come later.',
    'error.nova_poshta_unauthorized':
      'Nova Poshta didn’t accept the key — it is invalid or revoked.',
    'error.nova_poshta_rejected': 'Nova Poshta rejected the request.',
    'error.nova_poshta_ratelimited':
      'Nova Poshta is limiting requests. Try again in a few minutes.',
    'error.nova_poshta_unavailable':
      'Nova Poshta is unavailable right now. Try again in a few minutes.',
    'error.nova_poshta_invalidresponse':
      'Nova Poshta replied in an unexpected format. Try again.',
    'error.nova_poshta_notsubmitted':
      'The request to Nova Poshta wasn’t sent. Try again.',
    'error.nova_poshta_disabled':
      'The Nova Poshta integration is turned off or not set up.',
    'error.dispatch_point_required':
      'There’s no default dispatch point — you won’t be able to arrange delivery.',
    'error.dispatch_point_unavailable':
      'The dispatch point’s branch doesn’t accept parcels.',
    'error.division_not_found':
      'The dispatch point’s branch can no longer be found.',
    'error.unknown': 'The service returned an error: {code}',
    'check.configuration': 'Access key saved',
    'check.authorization': 'The service accepts the key',
    'check.default_dispatch_point': 'Default dispatch point set',
    'check.sender_division': 'Sender’s branch accepts parcels',
    'tracking.Disabled': 'Not connected',
    'tracking.Disabled.detail':
      'Automatic updates are off. Delivery statuses are refreshed by a periodic check.',
    'tracking.Connecting': 'Connecting',
    'tracking.Connecting.detail':
      'Connecting updates — registering the subscription with Nova Poshta.',
    'tracking.AwaitingVerification': 'Awaiting confirmation',
    'tracking.AwaitingVerification.detail':
      'Waiting for confirmation from Nova Poshta: the first update hasn’t reached our address yet.',
    'tracking.Connected': 'Connected',
    'tracking.Connected.detail':
      'New waybills will be connected automatically.',
    'tracking.RetryPending': 'Attempt failed',
    'tracking.RetryPending.detail':
      'Couldn’t finish the action. We’ll retry automatically.',
    'tracking.NeedsCredentials': 'Check the API key',
    'tracking.NeedsCredentials.detail':
      'Nova Poshta didn’t accept the key. Enter a valid key to continue connecting.',
    'tracking.NeedsReview': 'Needs review',
    'tracking.NeedsReview.detail': 'The connection needs to be reviewed.',
    'tracking.Disconnecting': 'Disconnecting',
    'tracking.Disconnecting.detail':
      'Disconnecting updates — waiting for confirmation from Nova Poshta.',
    'tracking.unknown': 'Unknown state',
    'tracking.unknown.detail':
      'The service returned a state this version of the cabinet doesn’t know. Refresh the state — nothing is broken.',
    'reason.callback_not_received':
      'Nova Poshta hasn’t sent a single update to our address. Check that the key has access to subscriptions and try again.',
    'reason.ambiguous_subscription':
      'Several subscriptions to the same address were found in the Nova Poshta account. Remove the extra ones in the carrier’s account, then try again.',
    'reason.subscription_not_confirmed':
      'Nova Poshta didn’t confirm the subscription. Try again — if it happens again, check the subscriptions in the carrier’s account.',
    'reason.integration_inactive':
      'The integration is turned off. Turn it on to receive updates.',
    'reason.provider_unauthorized':
      'Nova Poshta didn’t accept the key — it is invalid or revoked.',
    'reason.provider_rejected':
      'Nova Poshta rejected the subscription request.',
    'reason.provider_notfound': 'Nova Poshta couldn’t find this subscription.',
    'reason.provider_unavailable':
      'Nova Poshta isn’t responding. We’ll try again.',
    'reason.provider_ratelimited':
      'Nova Poshta is limiting requests. We’ll try again later.',
    'reason.provider_invalidresponse':
      'Nova Poshta replied in an unexpected format. We’ll try again.',
    'reason.provider_notsubmitted':
      'The request to Nova Poshta wasn’t sent. Nothing was created.',
    'reason.provider_outcomeunknown':
      'Couldn’t confirm the result of the request to Nova Poshta.',
    'reason.provider_disabled':
      'The Nova Poshta integration is turned off or not set up.',
    'reason.unknown':
      'The service didn’t finish the action and gave no reason we can explain. Try again.',
    'problem.tracking_credentials_required':
      'A Nova Poshta API key is needed — there’s no saved key for subscriptions.',
    'problem.tracking_credentials_invalid':
      'This key doesn’t work. Copy the key from your Nova Poshta account again.',
    'problem.tracking_callback_not_configured':
      'Automatic updates aren’t set up in this environment yet.',
    'problem.tracking_busy':
      'This action is already running. The state has been refreshed — check it in a few seconds.',
    'problem.tracking_manual_webhook_configured':
      'A manual webhook is already set up for this integration. Remove the saved secret below — we don’t turn it off ourselves.',
    'problem.tracking_disconnect_required':
      'Finish disconnecting the previous subscription first, then connect a new one.',
    'problem.tracking_retry_unavailable':
      'Nothing left to retry: the subscription state has changed. Refresh the state.',
    'problem.forbidden':
      'No access: you need permission to manage team settings.',
    'problem.notFound':
      'There’s no subscription for this integration. Refresh the state.',
    'problem.network':
      'No connection to the server. We don’t repeat the action ourselves — check the state and click again if needed.',
    'problem.generic':
      'Couldn’t complete the action. Check the state and try again.',
    'unavailable.title': 'Nova Poshta isn’t available',
  },
  pl: {
    'status.draft': 'Nieskonfigurowana',
    'status.active': 'Połączona',
    'status.inactive': 'Wyłączona',
    'status.error': 'Błąd',
    'mark.nova_poshta': 'NP',
    'kind.nova_poshta': 'Dostawa',
    'error.integration_not_configured':
      'Klucz dostępu nie został jeszcze zapisany. Dodaj go, aby sprawdzić połączenie.',
    'error.integration_settings_invalid':
      'Zapisane dane połączenia nie pasują. Wymień klucz dostępu.',
    'error.integration_account_unverified':
      'Usługa odrzuciła klucz: jest nieprawidłowy lub został unieważniony w panelu przewoźnika.',
    'error.integration_provider_unavailable':
      'Usługa nie odpowiedziała. Dane są zapisane — spróbuj sprawdzić ponownie za kilka minut.',
    'error.integration_verification_required':
      'Połączenie trzeba sprawdzić, zanim włączysz integrację.',
    'error.integration_operation_in_progress':
      'Poprzednia czynność jeszcze trwa. Poczekaj na jej zakończenie.',
    'error.integration_already_exists': 'Ta integracja jest już połączona.',
    'error.integration_country_unavailable':
      'Nova Poshta jest dostępna tylko dla firm na Ukrainie. Integracje dla Twojego kraju pojawią się później.',
    'error.nova_poshta_unauthorized':
      'Nova Poshta nie przyjęła klucza — jest nieprawidłowy lub unieważniony.',
    'error.nova_poshta_rejected': 'Nova Poshta odrzuciła żądanie.',
    'error.nova_poshta_ratelimited':
      'Nova Poshta ograniczyła liczbę zapytań. Spróbuj za kilka minut.',
    'error.nova_poshta_unavailable':
      'Nova Poshta jest teraz niedostępna. Spróbuj za kilka minut.',
    'error.nova_poshta_invalidresponse':
      'Nova Poshta odpowiedziała w nieoczekiwanym formacie. Spróbuj ponownie.',
    'error.nova_poshta_notsubmitted':
      'Żądanie do Nova Poshta nie zostało wysłane. Spróbuj ponownie.',
    'error.nova_poshta_disabled':
      'Integracja Nova Poshta jest wyłączona lub nieskonfigurowana.',
    'error.dispatch_point_required':
      'Brak domyślnego punktu nadania — nie da się zlecić dostawy.',
    'error.dispatch_point_unavailable':
      'Oddział punktu nadania nie przyjmuje przesyłek.',
    'error.division_not_found':
      'Oddziału punktu nadania nie można już znaleźć.',
    'error.unknown': 'Usługa zwróciła błąd: {code}',
    'check.configuration': 'Klucz dostępu zapisany',
    'check.authorization': 'Usługa akceptuje klucz',
    'check.default_dispatch_point': 'Ustawiono domyślny punkt nadania',
    'check.sender_division': 'Oddział nadawcy przyjmuje przesyłki',
    'tracking.Disabled': 'Nie połączono',
    'tracking.Disabled.detail':
      'Automatyczne aktualizacje są wyłączone. Statusy dostaw odświeża okresowe sprawdzanie.',
    'tracking.Connecting': 'Łączenie',
    'tracking.Connecting.detail':
      'Łączymy aktualizacje — rejestrujemy subskrypcję w Nova Poshta.',
    'tracking.AwaitingVerification': 'Oczekiwanie na potwierdzenie',
    'tracking.AwaitingVerification.detail':
      'Czekamy na potwierdzenie od Nova Poshta: pierwsza aktualizacja nie dotarła jeszcze na nasz adres.',
    'tracking.Connected': 'Połączono',
    'tracking.Connected.detail':
      'Nowe listy przewozowe będą podłączane automatycznie.',
    'tracking.RetryPending': 'Próba nieudana',
    'tracking.RetryPending.detail':
      'Nie udało się dokończyć czynności. Ponowimy automatycznie.',
    'tracking.NeedsCredentials': 'Sprawdź klucz API',
    'tracking.NeedsCredentials.detail':
      'Nova Poshta nie przyjęła klucza. Wpisz ważny klucz, aby kontynuować łączenie.',
    'tracking.NeedsReview': 'Wymaga sprawdzenia',
    'tracking.NeedsReview.detail': 'Połączenie wymaga sprawdzenia.',
    'tracking.Disconnecting': 'Odłączanie',
    'tracking.Disconnecting.detail':
      'Odłączamy aktualizacje — czekamy na potwierdzenie od Nova Poshta.',
    'tracking.unknown': 'Nieznany stan',
    'tracking.unknown.detail':
      'Usługa zwróciła stan, którego ta wersja panelu nie zna. Odśwież stan — nic się nie zepsuło.',
    'reason.callback_not_received':
      'Nova Poshta nie wysłała żadnej aktualizacji na nasz adres. Sprawdź, czy klucz ma dostęp do subskrypcji, i spróbuj ponownie.',
    'reason.ambiguous_subscription':
      'W panelu Nova Poshta znaleziono kilka subskrypcji na ten sam adres. Usuń zbędne w panelu przewoźnika, a potem spróbuj ponownie.',
    'reason.subscription_not_confirmed':
      'Nova Poshta nie potwierdziła utworzenia subskrypcji. Spróbuj ponownie — jeśli to się powtórzy, sprawdź subskrypcje w panelu przewoźnika.',
    'reason.integration_inactive':
      'Integracja jest wyłączona. Włącz ją, aby otrzymywać aktualizacje.',
    'reason.provider_unauthorized':
      'Nova Poshta nie przyjęła klucza — jest nieprawidłowy lub unieważniony.',
    'reason.provider_rejected': 'Nova Poshta odrzuciła żądanie subskrypcji.',
    'reason.provider_notfound': 'Nova Poshta nie znalazła tej subskrypcji.',
    'reason.provider_unavailable':
      'Nova Poshta nie odpowiada. Spróbujemy ponownie.',
    'reason.provider_ratelimited':
      'Nova Poshta ograniczyła liczbę zapytań. Spróbujemy ponownie później.',
    'reason.provider_invalidresponse':
      'Nova Poshta odpowiedziała w nieoczekiwanym formacie. Spróbujemy ponownie.',
    'reason.provider_notsubmitted':
      'Żądanie do Nova Poshta nie zostało wysłane. Nic nie utworzono.',
    'reason.provider_outcomeunknown':
      'Nie udało się potwierdzić wyniku żądania do Nova Poshta.',
    'reason.provider_disabled':
      'Integracja Nova Poshta jest wyłączona lub nieskonfigurowana.',
    'reason.unknown':
      'Usługa nie dokończyła czynności i nie podała przyczyny, którą umiemy wyjaśnić. Spróbuj ponownie.',
    'problem.tracking_credentials_required':
      'Potrzebny jest klucz API Nova Poshta — brak zapisanego klucza do subskrypcji.',
    'problem.tracking_credentials_invalid':
      'Ten klucz nie pasuje. Skopiuj klucz z panelu Nova Poshta jeszcze raz.',
    'problem.tracking_callback_not_configured':
      'W tym środowisku automatyczne aktualizacje nie są jeszcze skonfigurowane.',
    'problem.tracking_busy':
      'Ta czynność już trwa. Stan został odświeżony — sprawdź go za kilka sekund.',
    'problem.tracking_manual_webhook_configured':
      'Dla tej integracji skonfigurowano już ręczny webhook. Usuń zapisany sekret poniżej — sami go nie wyłączamy.',
    'problem.tracking_disconnect_required':
      'Najpierw dokończ odłączanie poprzedniej subskrypcji, potem podłącz nową.',
    'problem.tracking_retry_unavailable':
      'Nie ma już czego ponawiać: stan subskrypcji się zmienił. Odśwież stan.',
    'problem.forbidden':
      'Brak dostępu: potrzebne są uprawnienia do ustawień zespołu.',
    'problem.notFound': 'Dla tej integracji nie ma subskrypcji. Odśwież stan.',
    'problem.network':
      'Brak połączenia z serwerem. Nie powtarzamy czynności sami — sprawdź stan i w razie potrzeby kliknij ponownie.',
    'problem.generic':
      'Nie udało się wykonać czynności. Sprawdź stan i spróbuj ponownie.',
    'unavailable.title': 'Nova Poshta jest niedostępna',
  },
})
