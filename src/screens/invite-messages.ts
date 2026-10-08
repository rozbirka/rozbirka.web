import { defineMessages } from '@/i18n'

export const inviteMessages = defineMessages({
  uk: {
    'expired.title': 'Посилання прострочене',
    'expired.body':
      'Термін дії запрошення минув. Попросіть власника розбірки надіслати нове посилання.',
    'used.title': 'Запрошення вже використано',
    'used.body':
      'За цим посиланням уже приєдналися. Якщо це були ви — увійдіть за своїм номером телефону.',
    'revoked.title': 'Запрошення скасовано',
    'revoked.body':
      'Власник розбірки скасував це запрошення. Попросіть надіслати нове.',
    'not-found.title': 'Недійсне посилання',
    'not-found.body':
      'Такого запрошення не існує. Перевірте, чи посилання скопійовано повністю.',
    'invalid.title': 'Запрошення недійсне',
    'invalid.body':
      'Це запрошення більше не діє. Попросіть власника розбірки надіслати нове.',
    'wrong-account.title': 'Запрошення для іншого номера',
    'wrong-account.body':
      'Це запрошення надіслали на інший номер телефону. Увійдіть за номером, на який воно надійшло.',
    'unknown.title': 'Не вдалося завантажити запрошення',
    'unknown.body': 'Зв’язок із сервером перервався. Спробуйте ще раз.',
    toHome: 'На головну',
    heading: 'Запрошення до розбірки',
    loading: 'Завантажуємо запрошення…',
    eyebrow: 'Запрошення',
    lead: 'Вас запрошують приєднатися до кабінету цієї розбірки.',
    role: 'Роль у кабінеті',
    invitedBy: 'Запросив',
    validUntil: 'Запрошення діє до',
    signInFirst:
      'Щоб приєднатися, спершу увійдіть за номером телефону, на який надійшло запрошення.',
    accept: 'Прийняти запрошення',
    accepted: 'Запрошення прийнято. Відкриваємо кабінет розбірки.',
    toCabinet: 'Перейти до кабінету',
    acceptFailedHint:
      'Спробуйте ще раз. Якщо не вдається — попросіть власника розбірки надіслати нове запрошення.',
    joining: 'Приєднуємо…',
    state: 'Стан запрошення',
    signInOther: 'Увійти іншим номером',
    signInPhone: 'Увійти за номером телефону',
    backHome: 'Повернутися на головну',
  },
  'en-GB': {
    'expired.title': 'Link expired',
    'expired.body':
      'This invitation has expired. Ask the business owner to send a new link.',
    'used.title': 'Invitation already used',
    'used.body':
      'Someone has already joined with this link. If it was you, log in with your phone number.',
    'revoked.title': 'Invitation cancelled',
    'revoked.body':
      'The business owner cancelled this invitation. Ask them to send a new one.',
    'not-found.title': 'Invalid link',
    'not-found.body':
      'This invitation doesn’t exist. Check that the whole link was copied.',
    'invalid.title': 'Invitation no longer valid',
    'invalid.body':
      'This invitation is no longer valid. Ask the business owner to send a new one.',
    'wrong-account.title': 'Invitation for another number',
    'wrong-account.body':
      'This invitation was sent to a different phone number. Log in with the number it was sent to.',
    'unknown.title': 'Couldn’t load the invitation',
    'unknown.body': 'The connection to the server was lost. Please try again.',
    toHome: 'Home',
    heading: 'Invitation to a business',
    loading: 'Loading invitation…',
    eyebrow: 'Invitation',
    lead: 'You’re invited to join this business’s cabinet.',
    role: 'Role in the cabinet',
    invitedBy: 'Invited by',
    validUntil: 'Invitation valid until',
    signInFirst:
      'To join, first log in with the phone number the invitation was sent to.',
    accept: 'Accept invitation',
    accepted: 'Invitation accepted. Opening the business cabinet.',
    toCabinet: 'Go to cabinet',
    acceptFailedHint:
      'Please try again. If it still fails, ask the business owner to send a new invitation.',
    joining: 'Joining…',
    state: 'Invitation status',
    signInOther: 'Log in with another number',
    signInPhone: 'Log in with phone number',
    backHome: 'Back to home page',
  },
  pl: {
    'expired.title': 'Link wygasł',
    'expired.body':
      'Zaproszenie wygasło. Poproś właściciela firmy o wysłanie nowego linku.',
    'used.title': 'Zaproszenie zostało już użyte',
    'used.body':
      'Ktoś już dołączył przez ten link. Jeśli to Ty — zaloguj się swoim numerem telefonu.',
    'revoked.title': 'Zaproszenie anulowane',
    'revoked.body':
      'Właściciel firmy anulował to zaproszenie. Poproś o wysłanie nowego.',
    'not-found.title': 'Nieprawidłowy link',
    'not-found.body':
      'Takie zaproszenie nie istnieje. Sprawdź, czy link został skopiowany w całości.',
    'invalid.title': 'Zaproszenie nieważne',
    'invalid.body':
      'To zaproszenie już nie obowiązuje. Poproś właściciela firmy o wysłanie nowego.',
    'wrong-account.title': 'Zaproszenie dla innego numeru',
    'wrong-account.body':
      'To zaproszenie wysłano na inny numer telefonu. Zaloguj się numerem, na który przyszło.',
    'unknown.title': 'Nie udało się wczytać zaproszenia',
    'unknown.body':
      'Połączenie z serwerem zostało przerwane. Spróbuj ponownie.',
    toHome: 'Strona główna',
    heading: 'Zaproszenie do firmy',
    loading: 'Wczytujemy zaproszenie…',
    eyebrow: 'Zaproszenie',
    lead: 'Zapraszamy Cię do panelu tej firmy.',
    role: 'Rola w panelu',
    invitedBy: 'Zaprasza',
    validUntil: 'Zaproszenie ważne do',
    signInFirst:
      'Aby dołączyć, najpierw zaloguj się numerem telefonu, na który przyszło zaproszenie.',
    accept: 'Przyjmij zaproszenie',
    accepted: 'Zaproszenie przyjęte. Otwieramy panel firmy.',
    toCabinet: 'Przejdź do panelu',
    acceptFailedHint:
      'Spróbuj ponownie. Jeśli się nie uda, poproś właściciela firmy o nowe zaproszenie.',
    joining: 'Dołączamy…',
    state: 'Stan zaproszenia',
    signInOther: 'Zaloguj się innym numerem',
    signInPhone: 'Zaloguj się numerem telefonu',
    backHome: 'Wróć na stronę główną',
  },
})
