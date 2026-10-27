import { defineMessages } from '@/i18n'

/** Stable API error codes, translated independently of the server's fallback language. */
export const errorMessages = defineMessages({
  uk: {
    TENANT_EXISTS: 'Бізнес з такою назвою вже існує.',
    INVITE_USED: 'Це запрошення вже використано.',
    INVITE_EXPIRED: 'Термін дії запрошення закінчився.',
    INVALID_CREDENTIALS: 'Невірна електронна адреса або пароль.',
    USER_NOT_FOUND:
      'Обліковий запис не знайдено. Зареєструйтесь або скористайтесь посиланням-запрошенням.',
    INVALID_TOKEN: 'Недійсний або прострочений токен оновлення.',
    NOT_FOUND: 'Ресурс не знайдено.',
    CAR_CODE_EXISTS: 'Автомобіль із таким кодом уже існує.',
    CAR_HAS_SOLD_PARTS:
      'Неможливо видалити авто з проданими запчастинами. Заархівуйте його.',
    PART_ALREADY_SOLD: 'Ця запчастина вже продана.',
    QR_GENERATION_FAILED: 'Не вдалося згенерувати унікальний QR-код.',
    CONCURRENT_MODIFICATION: 'Інша операція змінила ці дані. Спробуйте ще раз.',
    INSUFFICIENT_BALANCE: "Баланс каси стане від'ємним.",
    INVALID_TRANSACTION_TYPE: 'Виберіть надходження або витрату.',
    CANNOT_CHANGE_OWN_PERMISSIONS:
      'Ви не можете змінювати власні права. Зверніться до власника розбірки.',
    CANNOT_MODIFY_SELF: 'Ви не можете змінювати власний обліковий запис.',
    CANNOT_DELETE_SELF: 'Ви не можете видалити власний обліковий запис.',
    INVALID_PASSWORD: 'Поточний пароль невірний.',
    FORBIDDEN: 'Доступ заборонено.',
    ACCOUNT_INACTIVE: 'Обліковий запис деактивовано.',
    TENANT_INACTIVE: 'Бізнес-акаунт деактивовано.',
    INVALID_SIGNATURE: 'Недійсний підпис платежу.',
    PAYMENT_REQUIRED: 'Підписка закінчилась. Будь ласка, поновіть.',
    INTERNAL_ERROR: 'Виникла непередбачена помилка.',
    VALIDATION_ERROR: 'Помилка валідації.',
    PHONE_EXISTS: 'Користувач з таким номером телефону вже існує.',
    PHONE_NOT_VERIFIED:
      'Номер телефону не підтверджено. Спочатку пройдіть верифікацію через OTP.',
    INVITE_REVOKED: 'Це запрошення було відкликано.',
    USER_ALREADY_HAS_TENANT: 'Користувач вже належить до бізнесу.',
    ACCOUNTING_CURRENCY_REQUIRED:
      'Оберіть валюту обліку перед збереженням ціни.',
    BUSINESS_SETTINGS_LOCKED:
      'Країна та часовий пояс заблоковані після першої операції, валюта обліку — після першої ціни.',
    INVALID_BUSINESS_SETTINGS:
      'Оберіть підтримувані країну, часовий пояс, мову та валюту.',
    CONCURRENT_UPDATE:
      'Дані змінилися під час операції. Оновіть сторінку та перевірте результат.',
    NOTEMPTYVALIDATOR: 'Це поле обов’язкове.',
    NOTNULLVALIDATOR: 'Це поле обов’язкове.',
    MAXIMUMLENGTHVALIDATOR: 'Перевищено максимальну довжину поля.',
    MINIMUMLENGTHVALIDATOR: 'Значення поля закоротке.',
    GREATERTHANVALIDATOR: 'Введіть значення більше дозволеного мінімуму.',
    GREATERTHANOREQUALVALIDATOR:
      'Значення має бути не меншим за дозволений мінімум.',
    EMAILVALIDATOR: 'Введіть коректну електронну адресу.',
    NOVA_POSHTA_DISABLED:
      'Інтеграцію Нової пошти вимкнено або не налаштовано. Перевірте налаштування.',
    NOVA_POSHTA_RATELIMITED:
      'Нова пошта тимчасово обмежила частоту запитів. Зачекайте перед повтором.',
    NOVA_POSHTA_UNAUTHORIZED:
      'Нова пошта не прийняла ключ API. Перевірте налаштування інтеграції.',
    NOVA_POSHTA_REJECTED:
      'Нова пошта відхилила запит. Перевірте отримувача та параметри посилки.',
    NOVA_POSHTA_NOTFOUND: 'Нова пошта не знайшла цей запис.',
    NOVA_POSHTA_UNAVAILABLE: 'Нова пошта зараз недоступна. Спробуйте пізніше.',
    NOVA_POSHTA_INVALIDRESPONSE:
      'Нова пошта повернула некоректну відповідь. Спробуйте ще раз.',
    NOVA_POSHTA_NOTSUBMITTED:
      'Запит до Нової пошти не був надісланий. Нічого не створено — спробуйте ще раз.',
    NOVA_POSHTA_OUTCOMEUNKNOWN:
      'Результат запиту невідомий. Оновіть статус перед повторною дією.',
    NP_SETUP_EXPIRED: 'Перевірка ключа застаріла. Вставте ключ ще раз.',
    NP_CONFIGURATION_CHANGED:
      'Налаштування Нової пошти вже змінив інший користувач. Оновіть дані й перевірте зміни ще раз.',
    NP_SETUP_INCOMPLETE:
      'Підключення не завершено: оберіть відправника, контакт і точку відправлення.',
    NP_CASH_REGISTER_UNAVAILABLE:
      'Обрана каса недоступна для післяплати. Оберіть активну касу з гривнею.',
    NP_HISTORICAL_SCOPE_EMPTY: 'У цьому кабінеті немає накладних без доступу.',
    NP_HISTORICAL_SCOPE_UNVERIFIED:
      'Нова пошта не підтвердила, що ключ відкриває накладні цього кабінету. Доступ не відновлено.',
    NP_HISTORICAL_ACCESS_UNAVAILABLE:
      'Нова пошта не відповіла. Ключ не перевірено — спробуйте ще раз за кілька хвилин.',
    NP_SETUP_REQUIRED:
      'Відправника, контакт і точку відправлення змінюють через перевірку з ключем Нової пошти.',
    SOURCE_HAS_PARTS:
      'Не можна видалити джерело, доки в ньому є невидалені запчастини.',
    PART_SOURCE_ARCHIVED:
      'До архівної машини не можна додавати нові запчастини. Виберіть інше джерело.',
    INVALID_PART_SOURCE_TYPE:
      'Джерело недоступне. Виберіть активну машину або надходження та повторіть дію.',
    ONBOARDING_UPDATE_REQUIRED: 'Вкажіть стан онбордингу для оновлення.',
    ONBOARDING_NOT_COMPLETED:
      'Завершіть онбординг перед тим, як його приховати.',
    INVALID_CURRENCY_PRECISION:
      'Сума має забагато десяткових знаків для своєї валюти.',
    WAREHOUSE_IN_USE:
      'Спочатку перемістіть усі запчастини, включно з «Без зони», до іншого складу. Після цього склад можна архівувати або деактивувати.',
    INVENTORY_ZONE_IN_USE:
      'Спочатку перемістіть усі запчастини до іншого місця. Після цього зону можна архівувати або деактивувати.',
    INVENTORY_ZONE_NOT_FOUND:
      'Місце недоступне. Виберіть активний склад і зону.',
    INVENTORY_LOCATION_PARENT_INACTIVE:
      'Спочатку розархівуйте батьківський склад і зону, після цього повторіть відновлення.',
    INVENTORY_ZONE_CODE_CONFLICT:
      'Цей код уже використовує інша зона. Вкажіть інший код або змініть код існуючої зони.',
    INVENTORY_SECTION_CODE_CONFLICT:
      'Цей код уже використовує інша секція. Вкажіть інший код або змініть код існуючої секції.',
    INVENTORY_ZONE_SYSTEM_UNASSIGNED:
      'Системну зону «Без зони» не можна змінювати, деактивувати або архівувати.',
    USER_INACTIVE: 'Обліковий запис користувача неактивний.',
    LANGUAGE_INVALID: 'Підтримувані мови: uk, en-GB та pl.',
    PHONE_INVALID:
      'Введіть дійсний український, британський або польський номер телефону.',
    INVALID_PHONE: 'Недійсний номер телефону.',
    OTP_COOLDOWN: 'Зачекайте перед запитом нового коду.',
    OTP_RATE_LIMITED: 'Забагато запитів коду. Спробуйте пізніше.',
    OTP_UNAVAILABLE:
      'Сервіс підтвердження тимчасово недоступний. Спробуйте пізніше.',
    OTP_INVALID: 'Недійсний код або строк його дії минув.',
    TOKEN_EXPIRED: 'Строк дії токена оновлення минув.',
    TOKEN_REUSE: 'Виявлено повторне використання токена. Усі сеанси завершено.',
    RATE_LIMITED: 'Забагато запитів. Спробуйте пізніше.',
    STATIC_OTP_NOT_FOUND: 'Обліковий запис зі статичним кодом не знайдено.',
    STATIC_OTP_EXISTS:
      'Для цього номера вже існує обліковий запис зі статичним кодом.',
    ACTOR_REQUIRED: 'Потрібен ідентифікатор адміністратора.',
    ACTOR_INVALID:
      'Ідентифікатор адміністратора не може перевищувати 100 символів.',
    INVALID_STATIC_OTP: 'Статичний код має містити рівно шість цифр.',
    CUSTOMER_PHONE_EXISTS: 'Клієнт із таким номером телефону вже існує.',
    INSUFFICIENT_QUANTITY:
      'Недостатньо запчастин у наявності. Перевірте кількість.',
    PARTS_NOT_AVAILABLE:
      'Вибрані запчастини вже недоступні. Оновіть список і перевірте кількість.',
    INTAKE_HAS_SOLD_PARTS:
      'Не можна видалити приймання з проданими запчастинами.',
    INVALID_INTAKE_SOURCE: 'Виберіть доступне приймання як джерело запчастини.',
    CONFLICTING_PART_SOURCE: 'Укажіть лише одне джерело запчастини.',
    MAX_REGISTERS_REACHED: 'Досягнуто ліміту кас для вашого тарифу.',
    REGISTER_HAS_TRANSACTIONS: 'Не можна видалити касу з операціями.',
    REGISTER_BALANCE_NOT_ZERO: 'Спочатку обнуліть баланс каси.',
    REGISTER_NOT_ACTIVE: 'Каса неактивна. Виберіть активну касу.',
    CURRENCY_NOT_ENABLED: 'Ця валюта недоступна для вибраної каси.',
    CURRENCY_HAS_TRANSACTIONS:
      'Не можна прибрати валюту, у якій уже є операції.',
    OTP_RATE_LIMIT: 'Забагато запитів коду. Спробуйте пізніше.',
    OTP_EXPIRED: 'Строк дії коду минув. Запросіть новий код.',
    OTP_MAX_ATTEMPTS: 'Забагато невдалих спроб. Запросіть новий код пізніше.',
    PHONE_NOT_FOUND: 'Облікового запису з таким номером не знайдено.',
    OWNER_TENANT_LIMIT_REACHED:
      'Досягнуто ліміту бізнесів, які ви можете створити.',
    EMPTY_FILE: 'Файл порожній. Виберіть інший файл.',
    FILE_TOO_LARGE: 'Файл перевищує дозволений розмір.',
    INVALID_FILE_TYPE: 'Цей формат файлу не підтримується.',
    INVALID_ENTITY_TYPE: 'Не вдалося прикріпити файл до цього об’єкта.',
    MEDIA_ASSET_ATTACHED: 'Файл уже прикріплений або недоступний.',
    ORDER_INVALID_STATUS:
      'Дія недоступна для поточного стану замовлення. Оновіть замовлення.',
    REFUND_REASON_REQUIRED: 'Укажіть причину повернення.',
    CUSTOMER_HAS_ORDERS: 'Не можна видалити клієнта, у якого є замовлення.',
    TENANT_BLOCKED: 'Доступ до бізнесу заблоковано. Зверніться до власника.',
    PAYMENT_PROVIDER_ERROR:
      'Не вдалося виконати оплату. Перевірте її стан перед повторною спробою.',
    IDEMPOTENCY_IN_PROGRESS:
      'Ця дія ще виконується. Зачекайте й перевірте результат.',
    IDEMPOTENCY_KEY_REUSED:
      'Запит уже використано з іншими даними. Оновіть сторінку й повторіть дію.',
    REPORT_EXPIRED: 'Строк зберігання звіту минув. Створіть новий звіт.',
    RATE_LIMIT_EXCEEDED: 'Забагато запитів. Зачекайте й спробуйте ще раз.',
    WAREHOUSE_NOT_FOUND: 'Склад недоступний. Виберіть активний склад.',
    WAREHOUSE_CODE_CONFLICT: 'Склад із таким кодом уже існує.',
    WAREHOUSE_SYSTEM_DEFAULT: 'Основний системний склад не можна архівувати.',
    WAREHOUSE_IN_ACTIVE_INVENTORY:
      'Склад бере участь в інвентаризації. Спочатку завершіть її.',
    INVENTORY_ZONE_IN_ACTIVE_INVENTORY:
      'Зона бере участь в інвентаризації. Спочатку завершіть її.',
    INVENTORY_SHELF_NOT_FOUND: 'Полиця недоступна. Виберіть іншу полицю.',
    INVENTORY_SECTION_NOT_FOUND: 'Секція недоступна. Виберіть іншу секцію.',
    INVENTORY_SECTION_IN_USE:
      'Спочатку перемістіть запчастини й приберіть активні полиці із цієї секції.',
    INVENTORY_SHELF_CODE_CONFLICT: 'Полиця з таким кодом уже існує.',
    INVENTORY_SHELF_IN_USE: 'Спочатку перемістіть запчастини із цієї полиці.',
    PART_IN_ACTIVE_INVENTORY:
      'Запчастина бере участь в інвентаризації. Спочатку завершіть її.',
    INVENTORY_SESSION_STATE_CONFLICT:
      'Стан інвентаризації змінився. Оновіть сторінку.',
    INVENTORY_PART_ALREADY_LOCKED:
      'Запчастину вже перевіряють в іншій інвентаризації.',
    INVENTORY_ZONE_LEASE_HELD: 'Цю зону зараз перевіряє інший працівник.',
    INVENTORY_ZONE_LEASE_EXPIRED:
      'Час роботи із зоною минув. Відкрийте її повторно.',
    INVENTORY_SCAN_DUPLICATE: 'Цю запчастину вже відскановано.',
    INVENTORY_SCAN_NOT_FOUND: 'Сканування не знайдено. Оновіть список.',
    INVENTORY_ZONE_ALREADY_COMPLETED: 'Перевірку цієї зони вже завершено.',
    INVENTORY_PART_CHANGED_DURING_SESSION:
      'Запчастина змінилася під час інвентаризації. Перевірте її повторно.',
    INVENTORY_ADJUSTMENT_CONFLICT:
      'Дані змінилися перед коригуванням. Оновіть їх і повторіть дію.',
    PART_COMPATIBILITY_VERSION_CONFLICT:
      'Сумісність уже змінив інший працівник. Оновіть дані.',
  },
  'en-GB': {
    TENANT_EXISTS: 'A business with this name already exists.',
    INVITE_USED: 'This invite has already been used.',
    INVITE_EXPIRED: 'This invite has expired.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    USER_NOT_FOUND:
      'No account found. Please register first or use an invite link.',
    INVALID_TOKEN: 'Invalid or expired refresh token.',
    NOT_FOUND: 'The requested resource was not found.',
    CAR_CODE_EXISTS: 'A car with this code already exists.',
    CAR_HAS_SOLD_PARTS:
      'Cannot delete a car with sold parts. Archive it instead.',
    PART_ALREADY_SOLD: 'This part has already been sold.',
    QR_GENERATION_FAILED: 'Failed to generate unique QR code.',
    CONCURRENT_MODIFICATION:
      'Another operation modified this data. Please retry.',
    INSUFFICIENT_BALANCE: 'Cash register balance would become negative.',
    INVALID_TRANSACTION_TYPE: 'Choose an income or expense transaction.',
    CANNOT_CHANGE_OWN_PERMISSIONS:
      'You cannot change your own permissions. Contact the business owner.',
    CANNOT_MODIFY_SELF: 'You cannot modify your own account.',
    CANNOT_DELETE_SELF: 'You cannot delete your own account.',
    INVALID_PASSWORD: 'Current password is incorrect.',
    FORBIDDEN: 'Access denied.',
    ACCOUNT_INACTIVE: 'Account is deactivated.',
    TENANT_INACTIVE: 'Business account is deactivated.',
    INVALID_SIGNATURE: 'Invalid payment signature.',
    PAYMENT_REQUIRED: 'Subscription expired. Please renew.',
    INTERNAL_ERROR: 'An unexpected error occurred.',
    VALIDATION_ERROR: 'Validation failed.',
    PHONE_EXISTS: 'A user with this phone number already exists.',
    PHONE_NOT_VERIFIED:
      'Phone number is not verified. Please verify via OTP first.',
    INVITE_REVOKED: 'This invite has been revoked.',
    USER_ALREADY_HAS_TENANT: 'User already belongs to a business.',
    ACCOUNTING_CURRENCY_REQUIRED:
      'Choose an accounting currency before saving a price.',
    BUSINESS_SETTINGS_LOCKED:
      'Country and timezone are locked after the first operation; accounting currency is locked after the first price.',
    INVALID_BUSINESS_SETTINGS:
      'Choose a supported country, timezone, language and currency.',
    CONCURRENT_UPDATE:
      'The data changed during this operation. Refresh and check the result.',
    NOTEMPTYVALIDATOR: 'This field is required.',
    NOTNULLVALIDATOR: 'This field is required.',
    MAXIMUMLENGTHVALIDATOR: 'This field exceeds the maximum length.',
    MINIMUMLENGTHVALIDATOR: 'This field is too short.',
    GREATERTHANVALIDATOR: 'Enter a value above the allowed minimum.',
    GREATERTHANOREQUALVALIDATOR:
      'Enter a value at least equal to the allowed minimum.',
    EMAILVALIDATOR: 'Enter a valid email address.',
    NOVA_POSHTA_DISABLED:
      'Nova Poshta is disabled or not configured. Check integration settings.',
    NOVA_POSHTA_RATELIMITED:
      'Nova Poshta temporarily limited requests. Wait before retrying.',
    NOVA_POSHTA_UNAUTHORIZED:
      'Nova Poshta rejected the API key. Check integration settings.',
    NOVA_POSHTA_REJECTED:
      'Nova Poshta rejected the request. Check recipient and parcel details.',
    NOVA_POSHTA_NOTFOUND: 'Nova Poshta did not find this record.',
    NOVA_POSHTA_UNAVAILABLE: 'Nova Poshta is unavailable. Try again later.',
    NOVA_POSHTA_INVALIDRESPONSE:
      'Nova Poshta returned an invalid response. Try again.',
    NOVA_POSHTA_NOTSUBMITTED:
      'The request was not submitted to Nova Poshta. Nothing was created; try again.',
    NOVA_POSHTA_OUTCOMEUNKNOWN:
      'The request outcome is unknown. Refresh the status before retrying.',
    NP_SETUP_EXPIRED: 'The key check has expired. Paste the key again.',
    NP_CONFIGURATION_CHANGED:
      'Someone else has already changed the Nova Poshta settings. Refresh the data and check the changes again.',
    NP_SETUP_INCOMPLETE:
      'Setup is not finished: choose a sender, a contact and a dispatch point.',
    NP_CASH_REGISTER_UNAVAILABLE:
      'The chosen till cannot take cash on delivery. Choose an active till holding hryvnia.',
    NP_HISTORICAL_SCOPE_EMPTY: 'This account has no waybills without access.',
    NP_HISTORICAL_SCOPE_UNVERIFIED:
      'Nova Poshta did not confirm that the key opens this account’s waybills. Access was not restored.',
    NP_HISTORICAL_ACCESS_UNAVAILABLE:
      'Nova Poshta did not respond. The key was not checked — try again in a few minutes.',
    NP_SETUP_REQUIRED:
      'The sender, contact and dispatch point are changed through a check with the Nova Poshta key.',
    SOURCE_HAS_PARTS:
      'A source cannot be deleted while it contains active parts.',
    PART_SOURCE_ARCHIVED:
      'New parts cannot be added to an archived car. Choose another source.',
    INVALID_PART_SOURCE_TYPE:
      'The source is unavailable. Choose an active car or intake and try again.',
    ONBOARDING_UPDATE_REQUIRED: 'Specify an onboarding state to update.',
    ONBOARDING_NOT_COMPLETED: 'Complete onboarding before hiding it.',
    INVALID_CURRENCY_PRECISION:
      'The amount has too many decimal places for its currency.',
    WAREHOUSE_IN_USE:
      'Move all parts, including those in No zone, to another warehouse before archiving or deactivating this warehouse.',
    INVENTORY_ZONE_IN_USE:
      'Move all parts to another location before archiving or deactivating this zone.',
    INVENTORY_ZONE_NOT_FOUND:
      'This location is unavailable. Choose an active warehouse and zone.',
    INVENTORY_LOCATION_PARENT_INACTIVE:
      'Restore the parent warehouse and zone before restoring this location.',
    INVENTORY_ZONE_CODE_CONFLICT:
      'Another zone already uses this code. Use another code or change the existing zone’s code.',
    INVENTORY_SECTION_CODE_CONFLICT:
      'Another section already uses this code. Use another code or change the existing section’s code.',
    INVENTORY_ZONE_SYSTEM_UNASSIGNED:
      'The system “No zone” location cannot be changed, deactivated or archived.',
    USER_INACTIVE: 'User account is inactive.',
    LANGUAGE_INVALID: 'Supported languages are uk, en-GB and pl.',
    PHONE_INVALID: 'Enter a valid Ukrainian, British or Polish phone number.',
    INVALID_PHONE: 'Phone number is invalid.',
    OTP_COOLDOWN: 'Please wait before requesting another code.',
    OTP_RATE_LIMITED: 'Too many OTP requests. Please try again later.',
    OTP_UNAVAILABLE:
      'The verification service is temporarily unavailable. Please try again later.',
    OTP_INVALID: 'Invalid or expired code.',
    TOKEN_EXPIRED: 'Refresh token has expired.',
    TOKEN_REUSE: 'Token reuse detected. All sessions revoked.',
    RATE_LIMITED: 'Too many requests. Please try again later.',
    STATIC_OTP_NOT_FOUND: 'Static OTP account was not found.',
    STATIC_OTP_EXISTS: 'A static OTP account already exists for this phone.',
    ACTOR_REQUIRED: 'Admin actor identifier is required.',
    ACTOR_INVALID: 'Admin actor identifier must not exceed 100 characters.',
    INVALID_STATIC_OTP: 'Static OTP code must contain exactly six digits.',
    CUSTOMER_PHONE_EXISTS: 'A customer with this phone number already exists.',
    INSUFFICIENT_QUANTITY:
      'Not enough parts are available. Check the quantity.',
    PARTS_NOT_AVAILABLE:
      'The selected parts are no longer available. Refresh the list and check the quantity.',
    INTAKE_HAS_SOLD_PARTS: 'An intake with sold parts cannot be deleted.',
    INVALID_INTAKE_SOURCE: 'Choose an available intake as the part source.',
    CONFLICTING_PART_SOURCE: 'Specify only one source for the part.',
    MAX_REGISTERS_REACHED: 'Your plan’s cash register limit has been reached.',
    REGISTER_HAS_TRANSACTIONS:
      'A cash register with transactions cannot be deleted.',
    REGISTER_BALANCE_NOT_ZERO: 'Settle the cash register balance first.',
    REGISTER_NOT_ACTIVE:
      'This cash register is inactive. Choose an active register.',
    CURRENCY_NOT_ENABLED:
      'This currency is not enabled for the selected cash register.',
    CURRENCY_HAS_TRANSACTIONS:
      'A currency with existing transactions cannot be removed.',
    OTP_RATE_LIMIT: 'Too many code requests. Please try again later.',
    OTP_EXPIRED: 'The code has expired. Request a new code.',
    OTP_MAX_ATTEMPTS:
      'Too many unsuccessful attempts. Request a new code later.',
    PHONE_NOT_FOUND: 'No account was found for this phone number.',
    OWNER_TENANT_LIMIT_REACHED:
      'You have reached the limit of businesses you can create.',
    EMPTY_FILE: 'The file is empty. Choose another file.',
    FILE_TOO_LARGE: 'The file exceeds the allowed size.',
    INVALID_FILE_TYPE: 'This file format is not supported.',
    INVALID_ENTITY_TYPE: 'The file cannot be attached to this item.',
    MEDIA_ASSET_ATTACHED: 'The file is already attached or unavailable.',
    ORDER_INVALID_STATUS:
      'This action is unavailable for the current order status. Refresh the order.',
    REFUND_REASON_REQUIRED: 'Enter a reason for the refund.',
    CUSTOMER_HAS_ORDERS: 'A customer with orders cannot be deleted.',
    TENANT_BLOCKED: 'Access to this business is blocked. Contact the owner.',
    PAYMENT_PROVIDER_ERROR:
      'The payment could not be completed. Check its status before retrying.',
    IDEMPOTENCY_IN_PROGRESS:
      'This action is still in progress. Wait and check the result.',
    IDEMPOTENCY_KEY_REUSED:
      'This request was already used with different data. Refresh the page and try again.',
    REPORT_EXPIRED: 'This report has expired. Create a new report.',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Wait and try again.',
    WAREHOUSE_NOT_FOUND:
      'This warehouse is unavailable. Choose an active warehouse.',
    WAREHOUSE_CODE_CONFLICT: 'A warehouse with this code already exists.',
    WAREHOUSE_SYSTEM_DEFAULT:
      'The default system warehouse cannot be archived.',
    WAREHOUSE_IN_ACTIVE_INVENTORY:
      'This warehouse is in an active stocktake. Complete it first.',
    INVENTORY_ZONE_IN_ACTIVE_INVENTORY:
      'This zone is in an active stocktake. Complete it first.',
    INVENTORY_SHELF_NOT_FOUND:
      'This shelf is unavailable. Choose another shelf.',
    INVENTORY_SECTION_NOT_FOUND:
      'This section is unavailable. Choose another section.',
    INVENTORY_SECTION_IN_USE:
      'Move the parts and remove active shelves from this section first.',
    INVENTORY_SHELF_CODE_CONFLICT: 'A shelf with this code already exists.',
    INVENTORY_SHELF_IN_USE: 'Move the parts off this shelf first.',
    PART_IN_ACTIVE_INVENTORY:
      'This part is in an active stocktake. Complete it first.',
    INVENTORY_SESSION_STATE_CONFLICT:
      'The stocktake status has changed. Refresh the page.',
    INVENTORY_PART_ALREADY_LOCKED:
      'This part is already being checked in another stocktake.',
    INVENTORY_ZONE_LEASE_HELD:
      'Another team member is currently checking this zone.',
    INVENTORY_ZONE_LEASE_EXPIRED:
      'Your time with this zone has expired. Open it again.',
    INVENTORY_SCAN_DUPLICATE: 'This part has already been scanned.',
    INVENTORY_SCAN_NOT_FOUND: 'The scan was not found. Refresh the list.',
    INVENTORY_ZONE_ALREADY_COMPLETED: 'This zone has already been checked.',
    INVENTORY_PART_CHANGED_DURING_SESSION:
      'This part changed during the stocktake. Check it again.',
    INVENTORY_ADJUSTMENT_CONFLICT:
      'The data changed before the adjustment. Refresh it and try again.',
    PART_COMPATIBILITY_VERSION_CONFLICT:
      'Another team member changed the compatibility. Refresh the data.',
  },
  pl: {
    TENANT_EXISTS: 'Firma o tej nazwie już istnieje.',
    INVITE_USED: 'To zaproszenie zostało już wykorzystane.',
    INVITE_EXPIRED: 'To zaproszenie wygasło.',
    INVALID_CREDENTIALS: 'Nieprawidłowy adres e-mail lub hasło.',
    USER_NOT_FOUND:
      'Nie znaleziono konta. Zarejestruj się lub użyj linku zaproszenia.',
    INVALID_TOKEN: 'Nieprawidłowy lub wygasły token odświeżania.',
    NOT_FOUND: 'Nie znaleziono żądanego zasobu.',
    CAR_CODE_EXISTS: 'Samochód z tym kodem już istnieje.',
    CAR_HAS_SOLD_PARTS:
      'Nie można usunąć samochodu ze sprzedanymi częściami. Zarchiwizuj go.',
    PART_ALREADY_SOLD: 'Ta część została już sprzedana.',
    QR_GENERATION_FAILED: 'Nie udało się wygenerować unikalnego kodu QR.',
    CONCURRENT_MODIFICATION:
      'Inna operacja zmieniła te dane. Spróbuj ponownie.',
    INSUFFICIENT_BALANCE: 'Saldo kasy stałoby się ujemne.',
    INVALID_TRANSACTION_TYPE: 'Wybierz transakcję przychodu lub wydatku.',
    CANNOT_CHANGE_OWN_PERMISSIONS:
      'Nie możesz zmieniać własnych uprawnień. Skontaktuj się z właścicielem firmy.',
    CANNOT_MODIFY_SELF: 'Nie możesz zmieniać własnego konta.',
    CANNOT_DELETE_SELF: 'Nie możesz usunąć własnego konta.',
    INVALID_PASSWORD: 'Bieżące hasło jest nieprawidłowe.',
    FORBIDDEN: 'Brak dostępu.',
    ACCOUNT_INACTIVE: 'Konto jest dezaktywowane.',
    TENANT_INACTIVE: 'Konto firmy jest dezaktywowane.',
    INVALID_SIGNATURE: 'Nieprawidłowy podpis płatności.',
    PAYMENT_REQUIRED: 'Subskrypcja wygasła. Odnów ją.',
    INTERNAL_ERROR: 'Wystąpił nieoczekiwany błąd.',
    VALIDATION_ERROR: 'Błąd walidacji.',
    PHONE_EXISTS: 'Użytkownik z tym numerem telefonu już istnieje.',
    PHONE_NOT_VERIFIED:
      'Numer telefonu nie jest potwierdzony. Najpierw potwierdź go kodem SMS.',
    INVITE_REVOKED: 'To zaproszenie zostało wycofane.',
    USER_ALREADY_HAS_TENANT: 'Użytkownik należy już do firmy.',
    ACCOUNTING_CURRENCY_REQUIRED:
      'Wybierz walutę ewidencji przed zapisaniem ceny.',
    BUSINESS_SETTINGS_LOCKED:
      'Kraj i strefa czasowa są zablokowane po pierwszej operacji, a waluta ewidencji po pierwszej cenie.',
    INVALID_BUSINESS_SETTINGS:
      'Wybierz obsługiwany kraj, strefę czasową, język i walutę.',
    CONCURRENT_UPDATE:
      'Dane zmieniły się podczas operacji. Odśwież i sprawdź wynik.',
    NOTEMPTYVALIDATOR: 'To pole jest wymagane.',
    NOTNULLVALIDATOR: 'To pole jest wymagane.',
    MAXIMUMLENGTHVALIDATOR: 'Przekroczono maksymalną długość pola.',
    MINIMUMLENGTHVALIDATOR: 'Wartość pola jest zbyt krótka.',
    GREATERTHANVALIDATOR: 'Wprowadź wartość większą niż dozwolone minimum.',
    GREATERTHANOREQUALVALIDATOR:
      'Wartość nie może być mniejsza niż dozwolone minimum.',
    EMAILVALIDATOR: 'Wprowadź poprawny adres e-mail.',
    NOVA_POSHTA_DISABLED:
      'Nova Poshta jest wyłączona lub nieskonfigurowana. Sprawdź ustawienia integracji.',
    NOVA_POSHTA_RATELIMITED:
      'Nova Poshta tymczasowo ograniczyła liczbę żądań. Poczekaj przed ponowną próbą.',
    NOVA_POSHTA_UNAUTHORIZED:
      'Nova Poshta odrzuciła klucz API. Sprawdź ustawienia integracji.',
    NOVA_POSHTA_REJECTED:
      'Nova Poshta odrzuciła żądanie. Sprawdź odbiorcę i dane przesyłki.',
    NOVA_POSHTA_NOTFOUND: 'Nova Poshta nie znalazła tego wpisu.',
    NOVA_POSHTA_UNAVAILABLE:
      'Nova Poshta jest niedostępna. Spróbuj ponownie później.',
    NOVA_POSHTA_INVALIDRESPONSE:
      'Nova Poshta zwróciła nieprawidłową odpowiedź. Spróbuj ponownie.',
    NOVA_POSHTA_NOTSUBMITTED:
      'Żądanie nie zostało wysłane do Nova Poshta. Nic nie utworzono; spróbuj ponownie.',
    NOVA_POSHTA_OUTCOMEUNKNOWN:
      'Wynik żądania jest nieznany. Odśwież status przed ponowną próbą.',
    NP_SETUP_EXPIRED: 'Sprawdzenie klucza wygasło. Wklej klucz ponownie.',
    NP_CONFIGURATION_CHANGED:
      'Ustawienia Nowej Poczty zmienił już inny użytkownik. Odśwież dane i sprawdź zmiany ponownie.',
    NP_SETUP_INCOMPLETE:
      'Podłączenie nie jest zakończone: wybierz nadawcę, kontakt i punkt nadania.',
    NP_CASH_REGISTER_UNAVAILABLE:
      'Wybrana kasa nie przyjmie pobrania. Wybierz aktywną kasę z hrywną.',
    NP_HISTORICAL_SCOPE_EMPTY:
      'To konto nie ma listów przewozowych bez dostępu.',
    NP_HISTORICAL_SCOPE_UNVERIFIED:
      'Nowa Poczta nie potwierdziła, że klucz otwiera listy przewozowe tego konta. Dostępu nie przywrócono.',
    NP_HISTORICAL_ACCESS_UNAVAILABLE:
      'Nowa Poczta nie odpowiedziała. Klucz nie został sprawdzony — spróbuj ponownie za kilka minut.',
    NP_SETUP_REQUIRED:
      'Nadawcę, kontakt i punkt nadania zmienia się przez sprawdzenie z kluczem Nowej Poczty.',
    SOURCE_HAS_PARTS: 'Nie można usunąć źródła, które zawiera aktywne części.',
    PART_SOURCE_ARCHIVED:
      'Nie można dodawać części do zarchiwizowanego samochodu. Wybierz inne źródło.',
    INVALID_PART_SOURCE_TYPE:
      'Źródło jest niedostępne. Wybierz aktywny samochód lub przyjęcie i spróbuj ponownie.',
    ONBOARDING_UPDATE_REQUIRED: 'Wskaż stan wdrożenia do aktualizacji.',
    ONBOARDING_NOT_COMPLETED: 'Zakończ wdrożenie przed jego ukryciem.',
    INVALID_CURRENCY_PRECISION:
      'Kwota ma zbyt wiele miejsc dziesiętnych dla swojej waluty.',
    WAREHOUSE_IN_USE:
      'Najpierw przenieś wszystkie części, również z „Bez strefy”, do innego magazynu. Następnie możesz zarchiwizować lub dezaktywować ten magazyn.',
    INVENTORY_ZONE_IN_USE:
      'Najpierw przenieś wszystkie części do innej lokalizacji. Następnie możesz zarchiwizować lub dezaktywować tę strefę.',
    INVENTORY_ZONE_NOT_FOUND:
      'Ta lokalizacja jest niedostępna. Wybierz aktywny magazyn i strefę.',
    INVENTORY_LOCATION_PARENT_INACTIVE:
      'Najpierw przywróć nadrzędny magazyn i strefę, a następnie ponów przywracanie.',
    INVENTORY_ZONE_CODE_CONFLICT:
      'Ten kod jest już używany przez inną strefę. Użyj innego kodu lub zmień kod istniejącej strefy.',
    INVENTORY_SECTION_CODE_CONFLICT:
      'Ten kod jest już używany przez inną sekcję. Użyj innego kodu lub zmień kod istniejącej sekcji.',
    INVENTORY_ZONE_SYSTEM_UNASSIGNED:
      'Systemowej strefy „Bez strefy” nie można zmieniać, dezaktywować ani archiwizować.',
    USER_INACTIVE: 'Konto użytkownika jest nieaktywne.',
    LANGUAGE_INVALID: 'Obsługiwane języki: uk, en-GB i pl.',
    PHONE_INVALID:
      'Podaj poprawny ukraiński, brytyjski lub polski numer telefonu.',
    INVALID_PHONE: 'Nieprawidłowy numer telefonu.',
    OTP_COOLDOWN: 'Poczekaj przed zamówieniem kolejnego kodu.',
    OTP_RATE_LIMITED: 'Zbyt wiele próśb o kod. Spróbuj ponownie później.',
    OTP_UNAVAILABLE:
      'Usługa weryfikacji jest chwilowo niedostępna. Spróbuj ponownie później.',
    OTP_INVALID: 'Kod jest nieprawidłowy lub wygasł.',
    TOKEN_EXPIRED: 'Token odświeżania wygasł.',
    TOKEN_REUSE:
      'Wykryto ponowne użycie tokena. Wszystkie sesje zostały unieważnione.',
    RATE_LIMITED: 'Zbyt wiele żądań. Spróbuj ponownie później.',
    STATIC_OTP_NOT_FOUND: 'Nie znaleziono konta ze stałym kodem.',
    STATIC_OTP_EXISTS: 'Konto ze stałym kodem dla tego numeru już istnieje.',
    ACTOR_REQUIRED: 'Identyfikator administratora jest wymagany.',
    ACTOR_INVALID:
      'Identyfikator administratora nie może przekraczać 100 znaków.',
    INVALID_STATIC_OTP: 'Stały kod musi zawierać dokładnie sześć cyfr.',
    CUSTOMER_PHONE_EXISTS: 'Klient z tym numerem telefonu już istnieje.',
    INSUFFICIENT_QUANTITY: 'Brak wystarczającej liczby części. Sprawdź ilość.',
    PARTS_NOT_AVAILABLE:
      'Wybrane części nie są już dostępne. Odśwież listę i sprawdź ilość.',
    INTAKE_HAS_SOLD_PARTS:
      'Nie można usunąć przyjęcia ze sprzedanymi częściami.',
    INVALID_INTAKE_SOURCE: 'Wybierz dostępne przyjęcie jako źródło części.',
    CONFLICTING_PART_SOURCE: 'Podaj tylko jedno źródło części.',
    MAX_REGISTERS_REACHED: 'Osiągnięto limit kas dla Twojego planu.',
    REGISTER_HAS_TRANSACTIONS: 'Nie można usunąć kasy z transakcjami.',
    REGISTER_BALANCE_NOT_ZERO: 'Najpierw rozlicz saldo kasy.',
    REGISTER_NOT_ACTIVE: 'Ta kasa jest nieaktywna. Wybierz aktywną kasę.',
    CURRENCY_NOT_ENABLED: 'Ta waluta nie jest dostępna dla wybranej kasy.',
    CURRENCY_HAS_TRANSACTIONS:
      'Nie można usunąć waluty z istniejącymi transakcjami.',
    OTP_RATE_LIMIT: 'Zbyt wiele próśb o kod. Spróbuj ponownie później.',
    OTP_EXPIRED: 'Kod wygasł. Poproś o nowy kod.',
    OTP_MAX_ATTEMPTS: 'Zbyt wiele nieudanych prób. Poproś o nowy kod później.',
    PHONE_NOT_FOUND: 'Nie znaleziono konta z tym numerem telefonu.',
    OWNER_TENANT_LIMIT_REACHED: 'Osiągnięto limit firm, które możesz utworzyć.',
    EMPTY_FILE: 'Plik jest pusty. Wybierz inny plik.',
    FILE_TOO_LARGE: 'Plik przekracza dozwolony rozmiar.',
    INVALID_FILE_TYPE: 'Ten format pliku nie jest obsługiwany.',
    INVALID_ENTITY_TYPE: 'Nie można dołączyć pliku do tego obiektu.',
    MEDIA_ASSET_ATTACHED: 'Plik jest już dołączony lub niedostępny.',
    ORDER_INVALID_STATUS:
      'Ta czynność jest niedostępna dla obecnego statusu zamówienia. Odśwież zamówienie.',
    REFUND_REASON_REQUIRED: 'Podaj powód zwrotu.',
    CUSTOMER_HAS_ORDERS: 'Nie można usunąć klienta z zamówieniami.',
    TENANT_BLOCKED:
      'Dostęp do tej firmy jest zablokowany. Skontaktuj się z właścicielem.',
    PAYMENT_PROVIDER_ERROR:
      'Nie udało się zrealizować płatności. Sprawdź jej status przed ponowną próbą.',
    IDEMPOTENCY_IN_PROGRESS:
      'Ta czynność jest nadal w toku. Poczekaj i sprawdź wynik.',
    IDEMPOTENCY_KEY_REUSED:
      'To żądanie zostało już użyte z innymi danymi. Odśwież stronę i spróbuj ponownie.',
    REPORT_EXPIRED: 'Ten raport wygasł. Utwórz nowy raport.',
    RATE_LIMIT_EXCEEDED: 'Zbyt wiele żądań. Poczekaj i spróbuj ponownie.',
    WAREHOUSE_NOT_FOUND:
      'Ten magazyn jest niedostępny. Wybierz aktywny magazyn.',
    WAREHOUSE_CODE_CONFLICT: 'Magazyn z tym kodem już istnieje.',
    WAREHOUSE_SYSTEM_DEFAULT:
      'Nie można zarchiwizować domyślnego magazynu systemowego.',
    WAREHOUSE_IN_ACTIVE_INVENTORY:
      'Ten magazyn bierze udział w inwentaryzacji. Najpierw ją zakończ.',
    INVENTORY_ZONE_IN_ACTIVE_INVENTORY:
      'Ta strefa bierze udział w inwentaryzacji. Najpierw ją zakończ.',
    INVENTORY_SHELF_NOT_FOUND: 'Ta półka jest niedostępna. Wybierz inną półkę.',
    INVENTORY_SECTION_NOT_FOUND:
      'Ta sekcja jest niedostępna. Wybierz inną sekcję.',
    INVENTORY_SECTION_IN_USE:
      'Najpierw przenieś części i usuń aktywne półki z tej sekcji.',
    INVENTORY_SHELF_CODE_CONFLICT: 'Półka z tym kodem już istnieje.',
    INVENTORY_SHELF_IN_USE: 'Najpierw przenieś części z tej półki.',
    PART_IN_ACTIVE_INVENTORY:
      'Ta część bierze udział w inwentaryzacji. Najpierw ją zakończ.',
    INVENTORY_SESSION_STATE_CONFLICT:
      'Status inwentaryzacji zmienił się. Odśwież stronę.',
    INVENTORY_PART_ALREADY_LOCKED:
      'Ta część jest już sprawdzana w innej inwentaryzacji.',
    INVENTORY_ZONE_LEASE_HELD: 'Inny pracownik sprawdza obecnie tę strefę.',
    INVENTORY_ZONE_LEASE_EXPIRED:
      'Czas pracy z tą strefą upłynął. Otwórz ją ponownie.',
    INVENTORY_SCAN_DUPLICATE: 'Ta część została już zeskanowana.',
    INVENTORY_SCAN_NOT_FOUND: 'Nie znaleziono skanu. Odśwież listę.',
    INVENTORY_ZONE_ALREADY_COMPLETED:
      'Sprawdzanie tej strefy zostało już zakończone.',
    INVENTORY_PART_CHANGED_DURING_SESSION:
      'Ta część zmieniła się podczas inwentaryzacji. Sprawdź ją ponownie.',
    INVENTORY_ADJUSTMENT_CONFLICT:
      'Dane zmieniły się przed korektą. Odśwież je i spróbuj ponownie.',
    PART_COMPATIBILITY_VERSION_CONFLICT:
      'Inny pracownik zmienił zgodność. Odśwież dane.',
  },
})

/** PART_NOT_EDITABLE uses one code for both states; Core names the state in its message. */
export const partEditErrorMessages = defineMessages({
  uk: {
    reserved: 'Запчастина у резерві. Редагування та зміна ціни недоступні.',
    sold: 'Запчастину вже продано. Редагування та зміна ціни недоступні.',
    unavailable:
      'Редагування та зміна ціни недоступні: запчастина у резерві або вже продана.',
  },
  'en-GB': {
    reserved:
      'This part is reserved. Editing and price changes are unavailable.',
    sold: 'This part has been sold. Editing and price changes are unavailable.',
    unavailable:
      'Editing and price changes are unavailable: this part is reserved or has been sold.',
  },
  pl: {
    reserved:
      'Ta część jest zarezerwowana. Edycja i zmiana ceny są niedostępne.',
    sold: 'Ta część została sprzedana. Edycja i zmiana ceny są niedostępne.',
    unavailable:
      'Edycja i zmiana ceny są niedostępne: część jest zarezerwowana lub została już sprzedana.',
  },
})
