import { defineMessages } from '@/i18n'

const providerReasons = [
  'invalid',
  'required',
  'capital_letters',
  'contact_links',
  'phone_numbers',
  'punctuation',
  'location_mismatch',
  'image_unavailable',
] as const

export function readOlxProviderIssue(issue: string) {
  const [field = '', code] = issue.split(':', 2)
  const reason = providerReasons.find((item) => item === code)
  return { field, reason: reason ? (`provider_${reason}` as const) : undefined }
}

const validationFields: Record<string, keyof typeof olxPublicationMessages.uk> =
  {
    title: 'fieldTitle',
    description: 'fieldDescription',
    category_id: 'fieldCategory',
    advertiser_type: 'fieldAdvertiser',
    attributes: 'fieldAttributes',
    contact: 'fieldContact',
    'contact.name': 'fieldContactName',
    'contact.phone': 'fieldPhone',
    location: 'fieldLocation',
    'location.city_id': 'fieldCity',
    'location.district_id': 'fieldDistrict',
    images: 'fieldPhotos',
    price: 'fieldPrice',
  }

export function olxProviderFieldLabel(field: string) {
  return field.startsWith('attributes.')
    ? 'fieldAttributes'
    : Object.hasOwn(validationFields, field)
      ? validationFields[field]
      : undefined
}

export const olxPublicationMessages = defineMessages({
  uk: {
    diagnosticsRestricted:
      'Оголошення потребує уваги. Причину бачить працівник із правом керування інтеграцією OLX.',
    partExcluded:
      'Запчастину виключено з публікації OLX. Поверніть її через меню «Майданчики» у списку деталей.',
    invalidContent:
      'Виправте дані запчастини або публічний опис і повторіть оновлення.',
    providerRejected:
      'OLX відхилив запит. Перевірте дані оголошення або повідомлення в кабінеті OLX.',
    providerRejectedWithFields:
      'OLX відхилив дані оголошення. Перевірте зазначені поля.',
    provider_invalid:
      'OLX не прийняв це значення. Перевірте його й спробуйте ще раз.',
    provider_required: 'OLX вимагає заповнити це поле.',
    provider_capital_letters:
      'OLX виявив забагато великих літер. Змініть регістр тексту.',
    provider_contact_links:
      'Приберіть посилання й адреси електронної пошти. OLX їх тут не приймає.',
    provider_phone_numbers:
      'Приберіть номери телефонів. OLX їх тут не приймає.',
    provider_punctuation:
      'Скоротіть повтори розділових знаків, наприклад «!!!» або «???».',
    provider_location_mismatch:
      'Координати не відповідають вибраному місту або району OLX.',
    provider_image_unavailable:
      'OLX не зміг завантажити фото. Перевірте або замініть фото в картці запчастини.',
    reconnectRequired:
      'Потрібно перепідключити акаунт. Відкрийте налаштування OLX.',
    rateLimited: 'Досягнуто ліміт запитів OLX. Повторіть перевірку пізніше.',
    temporaryFailure: 'OLX тимчасово недоступний. Повторіть перевірку пізніше.',
    advertMismatch: 'Дані оголошення на OLX змінилися. Перевірте прив’язку.',
    paymentHint: 'Потрібна оплата на OLX. Оплатити можна в кабінеті OLX.',
    moderationHeading: 'Причина модерації OLX',
    moderationUnavailable:
      'Причина поки недоступна. Перевірте оголошення в кабінеті OLX.',
    fieldTitle: 'Заголовок',
    fieldDescription: 'Опис',
    fieldCategory: 'Категорія',
    fieldAdvertiser: 'Тип продавця',
    fieldAttributes: 'Характеристики',
    fieldContact: 'Контактні дані',
    fieldContactName: 'Ім’я контактної особи',
    fieldPhone: 'Телефон',
    fieldLocation: 'Місто або район',
    fieldCity: 'Місто',
    fieldDistrict: 'Район',
    fieldPhotos: 'Фото',
    fieldPrice: 'Ціна або валюта',
    restore: 'Відновити на OLX',
    confirmRestore: 'Відновити оголошення OLX',
    restoreConsequence:
      'Розбірка перевірить наявність запчастини й надішле запит на відновлення цього оголошення.',
    restore_pending: 'Очікує підтвердження відновлення OLX',
    restoreChanged: 'Оновіть статус OLX перед відновленням.',
    manualRestoreHint: 'Потрібне ручне відновлення оголошення.',
    linkExisting: 'Прив’язати оголошення OLX',
    linkAdvert: 'Оголошення OLX',
    linkConfirm: 'Підтвердити прив’язування',
    linkConsequence:
      'Назву, ціну й фото оновимо з картки запчастини. Для опису використаємо текст із чернетки Розбірки, якщо він є. Телефон і місто залишаться з OLX.',
    linkUnavailable:
      'Якщо запчастина недоступна, активне оголошення буде знято.',
    linkAlreadyUsed:
      'Це оголошення вже прив’язане або ним керує Розбірка. Виберіть інше.',
    linkPartChanged: 'Дані OLX цієї запчастини змінилися. Оновіть картку.',
    linkError:
      'Не вдалося прив’язати оголошення. Перевірте підключення OLX і повторіть дію.',
    channels: 'Майданчики',
    openDetails: 'Відкрити деталі OLX',
    advert: 'Оголошення',
    providerState: 'Стан на OLX',
    statusSection: 'Статус оголошення OLX',
    statusNotChecked: 'Ще не перевірено',
    statusRefreshError:
      'Не вдалося оновити статус. Показуємо останній відомий стан.',
    providerStatusPending:
      'OLX присвоїв номер оголошення. Статус ще не надійшов.',
    linkedHint:
      'Ціна, наявність, назва й фото оновлюються з картки запчастини.',
    accessLost: 'Доступ до акаунта OLX втрачено. Оголошення не оновлюються.',
    advertAlreadyLinked: 'Прив’язано',
    backToDetails: 'Назад до деталей OLX',
    statusUnavailable: 'Статус недоступний',
    loadingPublication: 'Завантажуємо стан OLX…',
    preparePublication: 'Підготувати публікацію',
    editDescription: 'Редагувати опис',
    refreshStatus: 'Оновити статус',
    openPublish: 'Опублікувати',
    listingTitle: 'Оголошення OLX',
    openPart: 'Відкрити запчастину',
    listingNoPartAccess:
      'Для керування цим оголошенням потрібен доступ до прив’язаної запчастини.',
    listingLinkFirst:
      'Прив’яжіть оголошення до запчастини, щоб керувати ним у Розбірці.',
    listingLinkPart: 'Перейти до прив’язування',
    listingActions: 'Інші дії з оголошенням OLX',
    backToStatus: 'До статусу OLX',
    moderationPending: 'OLX прийняв оголошення. Воно очікує модерації.',
    providerDisabled:
      'Оголошенню присвоєно номер, але зараз OLX показує його як вимкнене.',
    sendingPublication: 'Надсилаємо оголошення в OLX…',
    listingStartHint:
      'Створіть оголошення з цієї запчастини або прив’яжіть те, що вже є у вашому акаунті.',
    notPublished: 'Не опубліковано',
    connectHint: 'Підключіть акаунт OLX у налаштуваннях інтеграції.',
    askAdmin: 'Попросіть адміністратора бізнесу перевірити підключення OLX.',
    settings: 'Налаштування OLX',
    loadPublicationError: 'Не вдалося завантажити стан публікації OLX.',
    partUnavailable: 'Запчастина недоступна для публікації.',
    title: 'Публікація OLX',
    partTabDraft: 'Чернетка оголошення',
    partTabRejected: 'Відхилено',
    partTabReady: 'Готова до публікації',
    partTabDraftHint: 'Назва, ціна й фото беруться з картки запчастини.',
    partTabSource: 'З картки запчастини',
    partTabIssues: 'Поля з помилками',
    partTabAvailable: 'Доступно',
    partTabReconcile: 'Потрібна звірка',
    partTabReconcileNow: 'Звірити зараз',
    partTabPayment: 'Потрібна оплата на OLX',
    partTabPay: 'Оплатити на OLX',
    partTabNoStock: 'Немає вільного залишку',
    partTabStockRestore:
      'Коли з’явиться вільний залишок, Розбірка перевірить можливість відновлення.',
    partTabDescriptionLength: '{count} симв.',
    partTabExcluded: 'Виключено',
    partTabExclude: 'Виключити з публікації',
    partTabInclude: 'Повернути до публікації',
    partTabConfirmExclude: 'Виключити запчастину з OLX?',
    partTabExcludeConsequence:
      'Розбірка припинить публікацію й автоматичне відновлення запчастини. Активне оголошення можна зняти окремо.',
    partTabExcludedHint:
      'Ця запчастина виключена з публікації та автоматичного відновлення.',
    partTabRepublish: 'Опублікувати повторно',
    partTabSaveUpdate: 'Зберегти й оновити на OLX',
    partTabDisconnected: 'OLX не підключено',
    partTabIntegrations: 'Перейти до інтеграцій',
    partTabDraftLocked: 'Редагування буде доступне після звірки з OLX.',
    save: 'Зберегти чернетку',
    saved: 'Чернетку збережено',
    saveUpdate: 'Зберегти зміни',
    updateQueued: 'Зміни збережено й передано на оновлення OLX.',
    update_pending: 'Очікує оновлення OLX',
    updating: 'Оновлюємо оголошення',
    syncError:
      'Остання операція не завершена. Перевірте підключення й дані та оновіть публікацію. Нове оголошення не створюємо.',
    publish: 'Опублікувати на OLX',
    remove: 'Зняти з публікації',
    confirmPublish: 'Створити оголошення в OLX',
    publishConsequence:
      'Надішлемо оголошення в підключений акаунт і покажемо номер та статус, які поверне OLX. Автоматичну оплату та продовження вимкнено.',
    confirmRemove: 'Зняти оголошення з OLX',
    removeConsequence:
      'Оголошення перестане бути доступним покупцям після підтвердження OLX. Якщо воно ще на модерації, зняття залишиться в очікуванні до наступної перевірки.',
    draft: 'Чернетка',
    creating: 'Створення ще не підтверджене',
    unknown: 'Результат створення невідомий',
    linked: 'Оголошення прив’язано',
    remove_pending: 'Зняття очікує підтвердження OLX',
    removing: 'Знімаємо оголошення',
    removed: 'Знято з публікації',
    deleted: 'Оголошення видалено',
    delete_unknown: 'Видалення ще не підтверджене',
    rejected: 'OLX відхилив запит',
    unknownHint:
      'Оголошення могло бути створене. Оновіть публікацію: ми перевіримо результат за нашим ідентифікатором. Повторне створення заблоковане.',
    limitedHint:
      'Ліміт OLX вичерпано або потрібна оплата. Автоматичної оплати немає.',
    noWrite: 'Потрібно дозволити публікацію в OLX.',
    grant: 'Дозволити публікацію в OLX',
    grantHint:
      'OLX підключено для читання. Підтвердьте доступ, щоб створювати, редагувати й знімати оголошення. Якщо почали редагувати чернетку, збережіть її перед переходом.',
    grantByManager:
      'OLX підключено для читання. Попросіть працівника з правом керування OLX дозволити публікацію.',
    publicationUnavailable: 'Публікація через Розбірку зараз недоступна.',
    publicationReady: 'Доступ до публікації надано.',
    returnCancelled: 'Підтвердження доступу скасовано.',
    returnStorageError:
      'Не вдалося підготувати повернення до форми. Спробуйте ще раз.',
    returnFinishPartEdit:
      'Завершіть редагування назви або ціни перед переходом в OLX.',
    returnDraftChanged:
      'Збережена чернетка змінилася під час підтвердження доступу. Показуємо її актуальну версію.',
    noEdit: 'Для редагування чернетки потрібне право керування запчастинами.',
    error:
      'Операцію не завершено. Дані форми залишилися на екрані; оновіть публікацію перед повтором.',
    changed:
      'Чернетку змінили в іншій вкладці. Відкрийте її заново перед збереженням.',
    invalid:
      'Запчастина або дані змінилися. Повторіть перевірку перед публікацією.',
    reconnect: 'Перевірте підключення та права OLX.',
    pending: 'Виконуємо…',
    open: 'Відкрити на OLX',
  },
  'en-GB': {
    diagnosticsRestricted:
      'The advert needs attention. Anyone with permission to manage the OLX integration can see the reason.',
    partExcluded:
      'This part is excluded from OLX publication. Include it from the Marketplaces menu in the parts list.',
    invalidContent:
      'Correct the part details or public description and retry the update.',
    providerRejected:
      'OLX rejected the request. Check the advert details or the message in your OLX account.',
    providerRejectedWithFields:
      'OLX rejected the advert details. Check the indicated fields.',
    provider_invalid: 'OLX rejected this value. Check it and try again.',
    provider_required: 'OLX requires this field.',
    provider_capital_letters:
      'OLX found too many capital letters. Change the letter case.',
    provider_contact_links:
      'Remove links and email addresses. OLX does not allow them here.',
    provider_phone_numbers:
      'Remove phone numbers. OLX does not allow them here.',
    provider_punctuation: 'Reduce repeated punctuation such as “!!!” or “???”.',
    provider_location_mismatch:
      'The coordinates do not match the selected OLX city or district.',
    provider_image_unavailable:
      'OLX could not load a photo. Check or replace the photos in the part record.',
    reconnectRequired: 'Reconnect the account in OLX settings.',
    rateLimited: 'The OLX request limit was reached. Check again later.',
    temporaryFailure: 'OLX is temporarily unavailable. Check again later.',
    advertMismatch:
      'The advert details changed on OLX. Check the linked advert.',
    paymentHint: 'Payment is required. Complete it in your OLX account.',
    moderationHeading: 'OLX moderation reason',
    moderationUnavailable:
      'The reason is unavailable. Check the advert in your OLX account.',
    fieldTitle: 'Title',
    fieldDescription: 'Description',
    fieldCategory: 'Category',
    fieldAdvertiser: 'Seller type',
    fieldAttributes: 'Attributes',
    fieldContact: 'Contact details',
    fieldContactName: 'Contact name',
    fieldPhone: 'Phone',
    fieldLocation: 'City or district',
    fieldCity: 'City',
    fieldDistrict: 'District',
    fieldPhotos: 'Photos',
    fieldPrice: 'Price or currency',
    restore: 'Reactivate on OLX',
    confirmRestore: 'Reactivate this OLX advert',
    restoreConsequence:
      'Rozbirka will check the part is in stock and ask OLX to reactivate this advert.',
    restore_pending: 'Reactivation awaiting OLX confirmation',
    restoreChanged: 'Refresh the OLX status before reactivating.',
    manualRestoreHint: 'This advert requires manual reactivation.',
    linkExisting: 'Link an OLX advert',
    linkAdvert: 'OLX advert',
    linkConfirm: 'Confirm link',
    linkConsequence:
      'The title, price and photos will come from the part. The description will come from the Rozbirka draft if present. The phone number and city will be kept from OLX.',
    linkUnavailable:
      'If the part is unavailable, an active advert will be withdrawn.',
    linkAlreadyUsed:
      'This advert is already linked or managed by Rozbirka. Select another advert.',
    linkPartChanged: 'The OLX details for this part changed. Reload the part.',
    linkError:
      'Could not link the advert. Check the OLX connection and try again.',
    channels: 'Marketplaces',
    openDetails: 'Open OLX details',
    advert: 'Advert',
    providerState: 'Status on OLX',
    statusSection: 'OLX advert status',
    statusNotChecked: 'Not checked yet',
    statusRefreshError:
      'Could not refresh the status. Showing the last known status.',
    providerStatusPending:
      'OLX assigned an advert number. The status is still pending.',
    linkedHint:
      'The part record supplies the price, availability, title and photos.',
    accessLost:
      'Access to the OLX account was lost. Advert updates are paused.',
    advertAlreadyLinked: 'Linked',
    backToDetails: 'Back to OLX details',
    statusUnavailable: 'Status unavailable',
    loadingPublication: 'Loading OLX status…',
    preparePublication: 'Prepare advert',
    editDescription: 'Edit description',
    refreshStatus: 'Refresh status',
    openPublish: 'Publish',
    listingTitle: 'OLX advert',
    openPart: 'Open part',
    listingNoPartAccess:
      'You need access to the linked part to manage this advert.',
    listingLinkFirst: 'Link this advert to a part to manage it in Rozbirka.',
    listingLinkPart: 'Go to linking',
    listingActions: 'More actions for the OLX advert',
    backToStatus: 'Back to OLX status',
    moderationPending: 'OLX accepted the advert. It is awaiting moderation.',
    providerDisabled:
      'The advert has an ID and is currently marked disabled by OLX.',
    sendingPublication: 'Sending the advert to OLX…',
    listingStartHint:
      'Create an advert from this part or link one already in your OLX account.',
    notPublished: 'Not published',
    connectHint: 'Connect your OLX account in integration settings.',
    askAdmin: 'Ask a business admin to check the OLX connection.',
    settings: 'OLX settings',
    loadPublicationError: 'Could not load the OLX publication status.',
    partUnavailable: 'This part is unavailable for publication.',
    title: 'OLX publication',
    partTabDraft: 'Advert draft',
    partTabRejected: 'Rejected',
    partTabReady: 'Ready to publish',
    partTabDraftHint: 'The part record supplies the title, price and photos.',
    partTabSource: 'From the part record',
    partTabIssues: 'Fields with errors',
    partTabAvailable: 'Available',
    partTabReconcile: 'Needs reconciliation',
    partTabReconcileNow: 'Reconcile now',
    partTabPayment: 'Payment required on OLX',
    partTabPay: 'Pay on OLX',
    partTabNoStock: 'No free stock',
    partTabStockRestore:
      'When stock is available, Rozbirka will check whether reactivation is possible.',
    partTabDescriptionLength: '{count} chars',
    partTabExcluded: 'Excluded',
    partTabExclude: 'Exclude from publication',
    partTabInclude: 'Include in publication',
    partTabConfirmExclude: 'Exclude this part from OLX?',
    partTabExcludeConsequence:
      'Rozbirka will stop publishing and automatically reactivating this part. You can withdraw an active advert separately.',
    partTabExcludedHint:
      'This part is excluded from publication and automatic reactivation.',
    partTabRepublish: 'Publish again',
    partTabSaveUpdate: 'Save and update on OLX',
    partTabDisconnected: 'OLX is disconnected',
    partTabIntegrations: 'Go to integrations',
    partTabDraftLocked: 'Editing becomes available after reconciling with OLX.',
    save: 'Save draft',
    saved: 'Draft saved',
    saveUpdate: 'Save changes',
    updateQueued: 'Changes saved and queued for OLX update.',
    update_pending: 'OLX update pending',
    updating: 'Updating advert',
    syncError:
      'The last operation was not completed. Check the connection and details, then refresh the publication. No new advert is created.',
    publish: 'Publish on OLX',
    remove: 'Withdraw advert',
    confirmPublish: 'Create an OLX advert',
    publishConsequence:
      'We’ll send the advert to the connected account and show the ID and status returned by OLX. Automatic payment and renewal are disabled.',
    confirmRemove: 'Withdraw the OLX advert',
    removeConsequence:
      'The advert will become unavailable to buyers after OLX confirms withdrawal. If moderation is pending, withdrawal remains pending until the next check.',
    draft: 'Draft',
    creating: 'Creation not yet confirmed',
    unknown: 'Creation outcome unknown',
    linked: 'Advert linked',
    remove_pending: 'Withdrawal awaiting OLX confirmation',
    removing: 'Withdrawing advert',
    removed: 'Advert withdrawn',
    deleted: 'Advert deleted',
    delete_unknown: 'Deletion not yet confirmed',
    rejected: 'OLX rejected the request',
    unknownHint:
      'The advert may already exist. Refresh to look up our external identifier. Creating another advert is blocked.',
    limitedHint: 'OLX limit reached or payment required. No automatic charges.',
    noWrite: 'OLX publication access is required.',
    grant: 'Allow OLX publication',
    grantHint:
      'OLX is connected for reading. Grant access to create, edit and withdraw adverts. If you started editing a draft, save it before leaving.',
    grantByManager:
      'OLX is connected for reading. Ask someone with OLX integration management permission to enable publication.',
    publicationUnavailable:
      'Publication through Rozbirka is currently unavailable.',
    publicationReady: 'Publication access has been granted.',
    returnCancelled: 'The access confirmation was cancelled.',
    returnStorageError: 'Could not prepare to return to the form. Try again.',
    returnFinishPartEdit:
      'Finish editing the title or price before going to OLX.',
    returnDraftChanged:
      'The saved draft changed during authorisation. Showing its current version.',
    noEdit: 'Editing a draft requires part management permission.',
    error:
      'The operation was not completed. Your entries remain on screen; refresh the publication before retrying.',
    changed: 'Another tab changed this draft. Reopen it before saving.',
    invalid: 'The part or its details changed. Check again before publishing.',
    reconnect: 'Check the OLX connection and permissions.',
    pending: 'Working…',
    open: 'Open on OLX',
  },
  pl: {
    diagnosticsRestricted:
      'Ogłoszenie wymaga uwagi. Przyczynę widzi osoba z uprawnieniem do zarządzania integracją OLX.',
    partExcluded:
      'Część jest wykluczona z publikacji w OLX. Przywróć ją w menu platform na liście części.',
    invalidContent:
      'Popraw dane części lub opis publiczny i ponów aktualizację.',
    providerRejected:
      'OLX odrzucił żądanie. Sprawdź dane ogłoszenia lub wiadomość na koncie OLX.',
    providerRejectedWithFields:
      'OLX odrzucił dane ogłoszenia. Sprawdź wskazane pola.',
    provider_invalid: 'OLX odrzucił tę wartość. Sprawdź ją i spróbuj ponownie.',
    provider_required: 'OLX wymaga uzupełnienia tego pola.',
    provider_capital_letters:
      'OLX wykrył za dużo wielkich liter. Zmień wielkość liter.',
    provider_contact_links:
      'Usuń linki i adresy e-mail. OLX ich tutaj nie akceptuje.',
    provider_phone_numbers:
      'Usuń numery telefonów. OLX ich tutaj nie akceptuje.',
    provider_punctuation:
      'Ogranicz powtarzające się znaki interpunkcyjne, np. „!!!” lub „???”.',
    provider_location_mismatch:
      'Współrzędne nie pasują do wybranego miasta lub dzielnicy OLX.',
    provider_image_unavailable:
      'OLX nie mógł wczytać zdjęcia. Sprawdź lub wymień zdjęcia w karcie części.',
    reconnectRequired: 'Połącz ponownie konto w ustawieniach OLX.',
    rateLimited: 'Osiągnięto limit zapytań OLX. Sprawdź ponownie później.',
    temporaryFailure:
      'OLX jest tymczasowo niedostępny. Sprawdź ponownie później.',
    advertMismatch: 'Dane ogłoszenia zmieniły się w OLX. Sprawdź powiązanie.',
    paymentHint: 'Wymagana jest płatność. Opłać ogłoszenie na koncie OLX.',
    moderationHeading: 'Powód moderacji OLX',
    moderationUnavailable:
      'Powód jest niedostępny. Sprawdź ogłoszenie na koncie OLX.',
    fieldTitle: 'Tytuł',
    fieldDescription: 'Opis',
    fieldCategory: 'Kategoria',
    fieldAdvertiser: 'Typ sprzedawcy',
    fieldAttributes: 'Parametry',
    fieldContact: 'Dane kontaktowe',
    fieldContactName: 'Osoba kontaktowa',
    fieldPhone: 'Telefon',
    fieldLocation: 'Miasto lub dzielnica',
    fieldCity: 'Miasto',
    fieldDistrict: 'Dzielnica',
    fieldPhotos: 'Zdjęcia',
    fieldPrice: 'Cena lub waluta',
    restore: 'Wznów w OLX',
    confirmRestore: 'Wznów ogłoszenie OLX',
    restoreConsequence:
      'Rozbirka sprawdzi dostępność części i poprosi OLX o wznowienie tego ogłoszenia.',
    restore_pending: 'Oczekiwanie na potwierdzenie wznowienia w OLX',
    restoreChanged: 'Odśwież status w OLX przed wznowieniem.',
    manualRestoreHint: 'Ogłoszenie wymaga ręcznego wznowienia.',
    linkExisting: 'Powiąż ogłoszenie OLX',
    linkAdvert: 'Ogłoszenie OLX',
    linkConfirm: 'Potwierdź powiązanie',
    linkConsequence:
      'Tytuł, cena i zdjęcia zostaną pobrane z karty części. Opis będzie pochodzić ze szkicu Rozbirka, jeśli istnieje. Telefon i miasto pozostaną z OLX.',
    linkUnavailable:
      'Jeśli część jest niedostępna, aktywne ogłoszenie zostanie zdjęte.',
    linkAlreadyUsed:
      'To ogłoszenie jest już powiązane lub zarządza nim Rozbirka. Wybierz inne.',
    linkPartChanged:
      'Dane OLX tej części uległy zmianie. Odśwież kartę części.',
    linkError:
      'Nie udało się powiązać ogłoszenia. Sprawdź połączenie z OLX i spróbuj ponownie.',
    channels: 'Platformy',
    openDetails: 'Otwórz szczegóły OLX',
    advert: 'Ogłoszenie',
    providerState: 'Status w OLX',
    statusSection: 'Status ogłoszenia OLX',
    statusNotChecked: 'Jeszcze nie sprawdzono',
    statusRefreshError:
      'Nie udało się odświeżyć statusu. Wyświetlamy ostatni znany status.',
    providerStatusPending:
      'OLX nadał ogłoszeniu numer. Status nie jest jeszcze dostępny.',
    linkedHint:
      'Cena, dostępność, tytuł i zdjęcia są aktualizowane z karty części.',
    accessLost:
      'Utracono dostęp do konta OLX. Aktualizacje ogłoszeń są wstrzymane.',
    advertAlreadyLinked: 'Powiązano',
    backToDetails: 'Wróć do szczegółów OLX',
    statusUnavailable: 'Status niedostępny',
    loadingPublication: 'Wczytywanie statusu OLX…',
    preparePublication: 'Przygotuj ogłoszenie',
    editDescription: 'Edytuj opis',
    refreshStatus: 'Odśwież status',
    openPublish: 'Opublikuj',
    listingTitle: 'Ogłoszenie OLX',
    openPart: 'Otwórz część',
    listingNoPartAccess:
      'Aby zarządzać tym ogłoszeniem, potrzebujesz dostępu do powiązanej części.',
    listingLinkFirst:
      'Powiąż ogłoszenie z częścią, aby zarządzać nim w Rozbirce.',
    listingLinkPart: 'Przejdź do powiązań',
    listingActions: 'Więcej działań dla ogłoszenia OLX',
    backToStatus: 'Wróć do statusu OLX',
    moderationPending: 'OLX przyjął ogłoszenie. Oczekuje ono na moderację.',
    providerDisabled:
      'Ogłoszenie ma numer, a OLX wyświetla je obecnie jako wyłączone.',
    sendingPublication: 'Wysyłanie ogłoszenia do OLX…',
    listingStartHint:
      'Utwórz ogłoszenie na podstawie tej części lub powiąż istniejące z konta OLX.',
    notPublished: 'Nie opublikowano',
    connectHint: 'Połącz konto OLX w ustawieniach integracji.',
    askAdmin: 'Poproś administratora firmy o sprawdzenie połączenia OLX.',
    settings: 'Ustawienia OLX',
    loadPublicationError: 'Nie udało się wczytać statusu ogłoszenia OLX.',
    partUnavailable: 'Tej części nie można opublikować.',
    title: 'Publikacja OLX',
    partTabDraft: 'Szkic ogłoszenia',
    partTabRejected: 'Odrzucono',
    partTabReady: 'Gotowy do publikacji',
    partTabDraftHint: 'Nazwa, cena i zdjęcia pochodzą z karty części.',
    partTabSource: 'Z karty części',
    partTabIssues: 'Pola z błędami',
    partTabAvailable: 'Dostępne',
    partTabReconcile: 'Wymaga uzgodnienia',
    partTabReconcileNow: 'Uzgodnij teraz',
    partTabPayment: 'Wymagana płatność w OLX',
    partTabPay: 'Zapłać w OLX',
    partTabNoStock: 'Brak dostępnego zapasu',
    partTabStockRestore:
      'Gdy pojawi się zapas, Rozbirka sprawdzi możliwość wznowienia.',
    partTabDescriptionLength: '{count} znaków',
    partTabExcluded: 'Wykluczono',
    partTabExclude: 'Wyklucz z publikacji',
    partTabInclude: 'Przywróć do publikacji',
    partTabConfirmExclude: 'Wykluczyć tę część z OLX?',
    partTabExcludeConsequence:
      'Rozbirka wstrzyma publikację i automatyczne wznawianie tej części. Aktywne ogłoszenie możesz wycofać osobno.',
    partTabExcludedHint:
      'Część jest wykluczona z publikacji i automatycznego wznawiania.',
    partTabRepublish: 'Opublikuj ponownie',
    partTabSaveUpdate: 'Zapisz i zaktualizuj w OLX',
    partTabDisconnected: 'OLX nie jest podłączony',
    partTabIntegrations: 'Przejdź do integracji',
    partTabDraftLocked: 'Edycja będzie dostępna po uzgodnieniu z OLX.',
    save: 'Zapisz szkic',
    saved: 'Szkic zapisany',
    saveUpdate: 'Zapisz zmiany',
    updateQueued: 'Zmiany zapisano i przekazano do aktualizacji OLX.',
    update_pending: 'Aktualizacja OLX oczekuje',
    updating: 'Aktualizowanie ogłoszenia',
    syncError:
      'Ostatnia operacja nie została zakończona. Sprawdź połączenie i dane, a następnie odśwież publikację. Nie tworzymy nowego ogłoszenia.',
    publish: 'Opublikuj w OLX',
    remove: 'Zdejmij ogłoszenie',
    confirmPublish: 'Utwórz ogłoszenie w OLX',
    publishConsequence:
      'Wyślemy ogłoszenie na połączone konto i pokażemy numer oraz status zwrócone przez OLX. Automatyczne płatności i przedłużanie są wyłączone.',
    confirmRemove: 'Zdejmij ogłoszenie z OLX',
    removeConsequence:
      'Ogłoszenie przestanie być dostępne po potwierdzeniu OLX. Podczas moderacji zdjęcie pozostanie w oczekiwaniu do następnego sprawdzenia.',
    draft: 'Szkic',
    creating: 'Utworzenie niepotwierdzone',
    unknown: 'Nieznany wynik utworzenia',
    linked: 'Ogłoszenie powiązane',
    remove_pending: 'Zdjęcie oczekuje na potwierdzenie OLX',
    removing: 'Zdejmowanie ogłoszenia',
    removed: 'Ogłoszenie zdjęte',
    deleted: 'Ogłoszenie usunięte',
    delete_unknown: 'Usunięcie niepotwierdzone',
    rejected: 'OLX odrzucił żądanie',
    unknownHint:
      'Ogłoszenie może już istnieć. Odśwież, aby wyszukać nasz identyfikator. Ponowne utworzenie jest zablokowane.',
    limitedHint:
      'Limit OLX osiągnięty lub wymagana płatność. Bez automatycznej opłaty.',
    noWrite: 'Wymagany dostęp do publikacji w OLX.',
    grant: 'Zezwól na publikację w OLX',
    grantHint:
      'OLX jest połączony w trybie odczytu. Zezwól na tworzenie, edycję i zdejmowanie ogłoszeń. Jeśli edytujesz szkic, zapisz go przed przejściem.',
    grantByManager:
      'OLX jest połączony w trybie odczytu. Poproś osobę z uprawnieniem do zarządzania integracją OLX o włączenie publikacji.',
    publicationUnavailable:
      'Publikacja przez Rozbirkę jest obecnie niedostępna.',
    publicationReady: 'Przyznano dostęp do publikacji.',
    returnCancelled: 'Anulowano potwierdzenie dostępu.',
    returnStorageError:
      'Nie udało się przygotować powrotu do formularza. Spróbuj ponownie.',
    returnFinishPartEdit:
      'Zakończ edycję tytułu lub ceny przed przejściem do OLX.',
    returnDraftChanged:
      'Zapisany szkic zmienił się podczas autoryzacji. Wyświetlamy jego aktualną wersję.',
    noEdit: 'Edycja szkicu wymaga uprawnienia zarządzania częściami.',
    error:
      'Operacja nie została zakończona. Dane pozostają na ekranie; odśwież publikację przed ponowieniem.',
    changed: 'Inna karta zmieniła szkic. Otwórz go ponownie przed zapisem.',
    invalid: 'Część lub dane zmieniły się. Sprawdź ponownie przed publikacją.',
    reconnect: 'Sprawdź połączenie i uprawnienia OLX.',
    pending: 'Przetwarzanie…',
    open: 'Otwórz w OLX',
  },
})

export const olxPublicationFailures: Record<
  string,
  keyof typeof olxPublicationMessages.uk
> = {
  OLX_CONTENT_INVALID: 'invalidContent',
  OLX_WRITE_REJECTED: 'providerRejected',
  OLX_RECONNECT_REQUIRED: 'reconnectRequired',
  OLX_CONNECTION_CHANGED: 'reconnectRequired',
  OLX_NOT_CONNECTED: 'reconnectRequired',
  OLX_WRITE_SCOPE_REQUIRED: 'noWrite',
  OLX_PAYMENT_REQUIRED: 'paymentHint',
  OLX_RATE_LIMITED: 'rateLimited',
  OLX_UNAVAILABLE: 'temporaryFailure',
  OLX_ADVERT_MISMATCH: 'advertMismatch',
  OLX_PART_EXCLUDED: 'partExcluded',
}
