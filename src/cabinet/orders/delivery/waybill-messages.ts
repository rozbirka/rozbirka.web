import { defineMessages } from '@/i18n'

/**
 * Text of the order's Nova Poshta block and its waybill sheets (module 46
 * §4–6): the block itself, the delivery form, the confirmation, editing,
 * cancelling, reconciling an unknown result and attaching an external
 * waybill. Strings that already existed stay in `messages.ts` and
 * `drawer-messages.ts`.
 */
export const waybillMessages = defineMessages({
  uk: {
    // Block
    blockTitle: 'Доставка · Нова пошта',
    factRoute: 'Маршрут',
    factDestination: 'Куди',
    factSender: 'Відправник',
    factDeliveryCost: 'Вартість доставки',
    quoteDropped: 'розрахунок застарів',
    pillAttached: 'Прив’язана',
    pillSent: 'Відправлено',
    draftCaption: 'У чернетки немає номера ТТН, друку й відстеження.',
    checkAndCreate: 'Перевірити й створити ТТН',
    edit: 'Редагувати',
    createdSub: 'створена {when}',
    attachedSub: 'прив’язана {when} · з кабінету НП',
    cancelledSub: 'скасована {when}',
    npStatus: 'Статус НП: {status} · оновлено {time}',
    npStatusNoTime: 'Статус НП: {status}',
    npStatusNone: 'Статус НП: ще не надходив',
    createdToast: 'ТТН {number} створено.',
    depositNotice:
      'Мінімальна передоплата: {required}. Отримано від клієнта: {paid}. Спершу отримайте решту передоплати, щоб створити ТТН і передати посилку перевізнику.',
    payDeposit: 'Внести передоплату',
    staleSenderTitle: 'Перевірте відправника',
    staleSenderText:
      'Відправника в налаштуваннях Нової пошти змінено. Перевірте дані відправника й розрахуйте доставку заново, щоб створити ТТН.',
    checkAndQuote: 'Перевірити й розрахувати',
    createInvoice: 'Створити накладну',
    unknownTitle: 'Не вдалося підтвердити результат',
    unknownCreate:
      'Нова пошта не відповіла вчасно, тому ми не знаємо, чи створено накладну. Не створюйте накладну повторно — спершу перевірте результат.',
    unknownCancel:
      'Нова пошта не відповіла вчасно, тому ми не знаємо, чи скасовано накладну. Не створюйте накладну повторно — спершу перевірте результат.',
    checkResult: 'Перевірити результат',
    waitTitle: 'Очікуємо відповідь',
    waitCreate:
      'Нова пошта ще не підтвердила, чи створено накладну. Повторне створення недоступне, щоб не з’явилося дві ТТН.',
    waitCancel:
      'Нова пошта ще не підтвердила, чи скасовано накладну. Повторне створення недоступне, щоб не з’явилося дві ТТН.',
    checkNow: 'Перевірити зараз',
    busyCreating: 'Нова пошта створює накладну. Дочекайтеся результату.',
    busyCancelling: 'Нова пошта скасовує накладну. Дочекайтеся результату.',
    cancelledNotice:
      'Накладну скасовано. Замовлення відкрите — оберіть, що далі.',
    createNew: 'Створити нову ТТН',
    changeDelivery: 'Змінити доставку',
    cancelledToast: 'ТТН скасовано. Замовлення залишилося відкритим.',
    recreateTitle: 'Залишився один крок',
    recreateText:
      'Стару ТТН скасовано. Зміну відділення ще не завершено — створіть нову накладну в замовленні.',
    sentNotice:
      'Посилку вже відправлено. Отримувача, адресу й післяплату в Rozbirka змінити не можна — зробіть це в кабінеті або застосунку Нової пошти.',
    cancelWaybill: 'Скасувати ТТН',
    attachedToast: 'ТТН прив’язано до замовлення #{number}.',
    back: 'Назад',

    // Form (4.2–4.3)
    formTitle: 'Оформлення доставки',
    formDescription:
      'Замовлення #{number} · Нова пошта. Дані замовлення підставлено — перевірте їх.',
    formNote: 'Накладну створюєте окремо, після перевірки.',
    groupRecipient: 'Отримувач',
    groupTo: 'Куди',
    groupFrom: 'Звідки',
    groupParcel: 'Посилка',
    groupCod: 'Післяплата',
    recipientNameReview: 'Введіть прізвище та ім’я отримувача.',
    recipientLastName: 'Прізвище',
    recipientFirstName: 'Ім’я',
    recipientMiddleName: 'По батькові',
    optionalPatronymic: 'Необов’язково.',
    recipientSearch: 'Знайти клієнта',
    missingLastName: 'прізвище отримувача',
    missingFirstName: 'ім’я отримувача',
    errorLastName: 'Вкажіть прізвище отримувача',
    errorFirstName: 'Вкажіть ім’я отримувача',
    fullName: 'Ім’я та прізвище',
    phone: 'Телефон',
    division: 'Відділення',
    divisionPick: 'Оберіть відділення',
    dispatchPoint: 'Точка відправлення',
    senderHint: 'Відправник: {name}',
    places: 'Місць',
    weight: 'Вага',
    kg: 'кг',
    dimensions: 'Габарити',
    cm: 'см',
    codBalance: 'Залишок за замовленням',
    codDeclared: 'Оголошена вартість',
    codOnWaybill: 'Післяплата в накладній',
    codRule: 'Післяплата в накладній має дорівнювати залишку.',
    missing: 'Бракує даних: {list}. Введене збережено.',
    missingName: 'ім’я отримувача',
    missingPhone: 'телефон отримувача',
    missingSettlement: 'населений пункт',
    missingDivision: 'відділення отримання',
    missingPoint: 'точка відправлення',
    missingPlaces: 'кількість місць',
    missingWeight: 'вага посилки',
    missingDimensions: 'габарити посилки',
    missingGoods: 'сума за замовлення',
    errorName: 'Вкажіть ім’я та прізвище отримувача',
    errorPhone: 'Телефон у форматі +380 XX XXX XX XX',
    errorSettlement: 'Оберіть населений пункт зі списку',
    errorDivision: 'Оберіть відділення отримання',
    errorPoint: 'Оберіть точку відправлення',
    errorPlaces: 'Вкажіть ціле число місць',
    errorWeight: 'Вкажіть вагу в кілограмах',
    errorDimensions: 'Вкажіть габарити як 60×40×30',

    // Readiness (4.5–4.6)
    readinessDescription: 'Замовлення #{number} · перевірка перед ТТН',
    fixSettings: 'Виправте налаштування інтеграції',
    openSettings: 'Відкрити налаштування',

    // Confirmation (4.7–4.11)
    confirmDescription:
      'Замовлення #{number} · перевірте все перед створенням. Накладну буде створено в кабінеті Нової пошти.',
    groupWaybill: 'Накладна',
    parcelWithDims: '{parcel} · {dims} см',
    quoteDelivery: 'Доставка',
    quoteReturn: 'Оцінка повернення',
    quoteDeposit: 'Мінімальна передоплата',
    quoteSource: 'Розрахунок Нової пошти · {when}',
    depositFirst: 'Спершу отримайте мінімальну передоплату, щоб створити ТТН.',
    creating: 'Створюємо ТТН…',
    keepOpen: 'Не закривайте вікно',
    repeatBlocked: 'Повторне створення недоступне до перевірки',
    refusedTitle: 'ТТН не створено',
    refusedText:
      'Нова пошта відмовила у створенні ТТН. Дані збережено — перевірте їх або зверніться до підтримки Нової пошти.',

    // Edit (5.2–5.6)
    editTitle: 'Редагувати ТТН',
    editDescription:
      '{number} · до відправлення. Номер накладної не зміниться.',
    changedWas: 'Змінено · було …{tail}',
    changed: 'Змінено',
    editLimits:
      'Місто чи відділення отримання, відправника й післяплату в цій ТТН змінити не можна. Для цього потрібна нова накладна.',
    editLimitsCaption:
      'Змінити місто чи відділення → «Створити нову ТТН замість цієї».',
    needNewWaybill: 'Потрібна нова ТТН',
    saveChanges: 'Зберегти зміни',
    saving: 'Зберігаємо…',
    waitingNp: 'Чекаємо підтвердження Нової пошти',
    editConfirmed: 'Зміни підтверджено Новою поштою.',
    recreateBranchTitle: 'Змінити відділення через нову ТТН?',
    recreateBranchText:
      'Відділення отримання в цій накладній змінити не можна.',
    recreateRefusedText:
      'Нова пошта не змінює ці дані в чинній накладній — потрібна нова ТТН.',
    recreateConfirm: 'Скасувати стару й продовжити',
    recreateStepCancel:
      'Спершу скасуємо ТТН {number} у Новій пошті й дочекаємося підтвердження.',
    recreateStepBranch: 'Потім ви створите нову ТТН з новим відділенням.',
    recreateStepChanges: 'Потім ви створите нову ТТН зі зміненими даними.',
    recreateStepHistory: 'Стара накладна залишиться в історії замовлення.',

    // Cancel (5.7)
    cancelTitle: 'Скасувати накладну?',
    cancelText: 'ТТН {number} буде скасовано в Новій пошті.',
    cancelStepOpen: 'Замовлення #{number} залишиться відкритим.',
    cancelStepNext:
      'Після скасування можна змінити доставку або створити нову ТТН.',
    cancelStepHistory:
      'Скасована накладна залишиться в історії й у списку накладних.',

    // Label (5.10–5.11)
    labelDescription: 'Замовлення #{number} · етикетка',
    labelFailed:
      'Нова пошта не віддала етикетку. Накладна дійсна — спробуйте ще раз за хвилину.',
    tryAgain: 'Спробувати ще раз',

    // Reconcile (5.13–5.15)
    reconcileTitle: 'Перевірка результату',
    reconcileCancel:
      'Звіряємо з кабінетом Нової пошти, чи виконано скасування ТТН {number}.',
    reconcileCreate:
      'Звіряємо з кабінетом Нової пошти, чи створено ТТН для замовлення #{number}.',
    reconciling: 'Звіряємо з Новою поштою…',
    checking: 'Перевіряємо…',
    checkAgain: 'Перевірити ще раз',
    candidateDescription:
      'Створення ТТН для замовлення #{number} не підтверджено. Знайдіть накладну в кабінеті Нової пошти й введіть її номер.',
    candidateGroup: 'Кандидат із кабінету НП',
    candidateNumber: 'Номер',
    candidateNote:
      'Підтвердьте, лише якщо всі дані збігаються із замовленням. Інакше перевіримо ще раз пізніше.',
    candidateConfirm: 'Так, це накладна замовлення',
    candidateReject: 'Не та накладна',

    // External waybill (6.x)
    attachDescription:
      'Накладну створено в кабінеті Нової пошти — прив’яжіть її до замовлення #{number}.',
    attachCheck: 'Перевірити накладну',
    attachOther: 'Інший номер',
    attachConditionsText:
      'післяплата в накладній дорівнює {amount} · накладна належить тій самій точці відправлення · її ще не прив’язано до іншого замовлення',
    attachNeedsDraft:
      'Спершу оформіть доставку: прив’язка звіряє накладну з отримувачем і точкою відправлення з чернетки.',
    previewGroup: 'Попередній перегляд',
    previewChanges: 'Що зміниться в замовленні',
    previewState: 'Стан доставки',
    codMatchesValue: '{amount} · дорівнює залишку',
    stateNotSent: 'Створено, не відправлено',
    stateSent: 'Відправлено',
    stateReceived: 'Отримано',
    effectNotSent:
      'Замовлення отримає цю ТТН, а статус доставки оновлюватиметься автоматично. Оплата не змінюється.',
    effectSent:
      'Посилку вже відправлено: редагувати й скасувати ТТН у Rozbirka не вийде.',
    effectReceived:
      'Посилку вже отримано, але прив’язування не підтверджує оплату. Післяплату внесіть у замовленні або дочекайтеся звірки.',
    effectNoPayment: 'Прив’язування не підтверджує оплату.',
    notFound:
      'Накладну з таким номером не знайдено в кабінеті Нової пошти. Перевірте цифри.',
    alreadyLinked:
      'Ця ТТН уже прив’язана до іншого замовлення. Одна накладна — одне замовлення.',
    incompleteWhy: 'Неповні дані накладної',
    incompleteText:
      'Нова пошта повернула неповні дані: немає відділення отримувача. Спробуйте пізніше — прив’язати можна буде після оновлення даних.',
    diffWhy: 'Є розбіжності',
    diffGroup: 'Розбіжності',
    diffRecipientWaybill: 'Отримувач у ТТН',
    diffRecipientOrder: 'Отримувач у замовленні',
    diffCodWaybill: 'Післяплата в ТТН',
    diffCodOrder: 'Залишок замовлення',
    diffTitle: 'Прив’язати не можна',
    diffText:
      'Дані замовлення не змінюються автоматично. Виправте отримувача й залишок у замовленні, якщо помилка там, або змініть ТТН у кабінеті Нової пошти й перевірте ще раз.',
    staleTitle: 'Стан ТТН змінився',
    staleText:
      'Поки ви переглядали, стан накладної змінився на «{state}». Перегляньте дані ще раз перед прив’язуванням.',
  },
  'en-GB': {
    blockTitle: 'Delivery · Nova Poshta',
    factRoute: 'Route',
    factDestination: 'To',
    factSender: 'Sender',
    factDeliveryCost: 'Delivery cost',
    quoteDropped: 'quote out of date',
    pillAttached: 'Attached',
    pillSent: 'Sent',
    draftCaption: 'A draft has no waybill number, label or tracking.',
    checkAndCreate: 'Check and create waybill',
    edit: 'Edit',
    createdSub: 'created {when}',
    attachedSub: 'attached {when} · from the NP account',
    cancelledSub: 'cancelled {when}',
    npStatus: 'NP status: {status} · updated {time}',
    npStatusNoTime: 'NP status: {status}',
    npStatusNone: 'NP status: not received yet',
    createdToast: 'Waybill {number} created.',
    depositNotice:
      'Minimum prepayment: {required}. Received from customer: {paid}. Receive the remaining prepayment before creating the waybill and handing the parcel to the carrier.',
    payDeposit: 'Record prepayment',
    staleSenderTitle: 'Check the sender',
    staleSenderText:
      'The sender in the Nova Poshta settings has changed. Check the sender details and recalculate delivery to create a waybill.',
    checkAndQuote: 'Check and calculate',
    createInvoice: 'Create waybill',
    unknownTitle: 'Could not confirm the result',
    unknownCreate:
      'Nova Poshta did not answer in time, so we do not know whether the waybill was created. Do not create it again — check the result first.',
    unknownCancel:
      'Nova Poshta did not answer in time, so we do not know whether the waybill was cancelled. Do not create a waybill again — check the result first.',
    checkResult: 'Check result',
    waitTitle: 'Waiting for an answer',
    waitCreate:
      'Nova Poshta has not yet confirmed whether the waybill was created. Creating it again is unavailable so that two waybills do not appear.',
    waitCancel:
      'Nova Poshta has not yet confirmed whether the waybill was cancelled. Creating a new one is unavailable so that two waybills do not appear.',
    checkNow: 'Check now',
    busyCreating: 'Nova Poshta is creating the waybill. Wait for the result.',
    busyCancelling:
      'Nova Poshta is cancelling the waybill. Wait for the result.',
    cancelledNotice:
      'The waybill has been cancelled. The order is still open — choose what to do next.',
    createNew: 'Create new waybill',
    changeDelivery: 'Change delivery',
    cancelledToast: 'Waybill cancelled. The order is still open.',
    recreateTitle: 'One step left',
    recreateText:
      'The old waybill has been cancelled. The branch change is not finished yet — create a new waybill in the order.',
    sentNotice:
      'The parcel has already been sent. The recipient, address and cash on delivery cannot be changed in Rozbirka — do it in the Nova Poshta account or app.',
    cancelWaybill: 'Cancel waybill',
    attachedToast: 'Waybill attached to order #{number}.',
    back: 'Back',

    formTitle: 'Delivery details',
    formDescription:
      'Order #{number} · Nova Poshta. The order details are filled in — check them.',
    formNote: 'You create the waybill separately, after the check.',
    groupRecipient: 'Recipient',
    groupTo: 'To',
    groupFrom: 'From',
    groupParcel: 'Parcel',
    groupCod: 'Cash on delivery',
    recipientNameReview: 'Enter the recipient’s last and first names.',
    recipientLastName: 'Last name',
    recipientFirstName: 'First name',
    recipientMiddleName: 'Patronymic',
    optionalPatronymic: 'Optional.',
    recipientSearch: 'Find a customer',
    missingLastName: 'recipient last name',
    missingFirstName: 'recipient first name',
    errorLastName: 'Enter the recipient’s last name',
    errorFirstName: 'Enter the recipient’s first name',
    fullName: 'Full name',
    phone: 'Phone',
    division: 'Branch',
    divisionPick: 'Choose a branch',
    dispatchPoint: 'Dispatch point',
    senderHint: 'Sender: {name}',
    places: 'Pieces',
    weight: 'Weight',
    kg: 'kg',
    dimensions: 'Dimensions',
    cm: 'cm',
    codBalance: 'Order balance',
    codDeclared: 'Declared value',
    codOnWaybill: 'Cash on delivery on the waybill',
    codRule: 'Cash on delivery on the waybill must equal the balance.',
    missing: 'Missing details: {list}. What you entered is kept.',
    missingName: 'recipient name',
    missingPhone: 'recipient phone',
    missingSettlement: 'town or city',
    missingDivision: 'delivery branch',
    missingPoint: 'dispatch point',
    missingPlaces: 'number of pieces',
    missingWeight: 'parcel weight',
    missingDimensions: 'parcel dimensions',
    missingGoods: 'order amount',
    errorName: 'Enter the recipient’s full name',
    errorPhone: 'Phone in the format +380 XX XXX XX XX',
    errorSettlement: 'Choose a town or city from the list',
    errorDivision: 'Choose the delivery branch',
    errorPoint: 'Choose a dispatch point',
    errorPlaces: 'Enter a whole number of pieces',
    errorWeight: 'Enter the weight in kilograms',
    errorDimensions: 'Enter dimensions as 60×40×30',

    readinessDescription: 'Order #{number} · check before the waybill',
    fixSettings: 'Fix the integration settings',
    openSettings: 'Open settings',

    confirmDescription:
      'Order #{number} · check everything before creating. The waybill will be created in the Nova Poshta account.',
    groupWaybill: 'Waybill',
    parcelWithDims: '{parcel} · {dims} cm',
    quoteDelivery: 'Delivery',
    quoteReturn: 'Return estimate',
    quoteDeposit: 'Minimum prepayment',
    quoteSource: 'Nova Poshta quote · {when}',
    depositFirst: 'Receive the minimum prepayment before creating the waybill.',
    creating: 'Creating waybill…',
    keepOpen: 'Do not close the window',
    repeatBlocked: 'Creating again is unavailable until checked',
    refusedTitle: 'Waybill not created',
    refusedText:
      'Nova Poshta refused to create the waybill. The details are saved — review them or contact Nova Poshta support.',

    editTitle: 'Edit waybill',
    editDescription:
      '{number} · before dispatch. The waybill number will not change.',
    changedWas: 'Changed · was …{tail}',
    changed: 'Changed',
    editLimits:
      'The delivery town or branch, the sender and the cash on delivery cannot be changed on this waybill. That needs a new waybill.',
    editLimitsCaption:
      'Change town or branch → “Create a new waybill instead of this one”.',
    needNewWaybill: 'New waybill needed',
    saveChanges: 'Save changes',
    saving: 'Saving…',
    waitingNp: 'Waiting for Nova Poshta to confirm',
    editConfirmed: 'Nova Poshta confirmed the changes.',
    recreateBranchTitle: 'Change the branch with a new waybill?',
    recreateBranchText:
      'The delivery branch on this waybill cannot be changed.',
    recreateRefusedText:
      'Nova Poshta does not change these details on an existing waybill — a new waybill is needed.',
    recreateConfirm: 'Cancel the old one and continue',
    recreateStepCancel:
      'First we cancel waybill {number} at Nova Poshta and wait for confirmation.',
    recreateStepBranch: 'Then you create a new waybill with the new branch.',
    recreateStepChanges: 'Then you create a new waybill with the changes.',
    recreateStepHistory: 'The old waybill stays in the order history.',

    cancelTitle: 'Cancel the waybill?',
    cancelText: 'Waybill {number} will be cancelled at Nova Poshta.',
    cancelStepOpen: 'Order #{number} will stay open.',
    cancelStepNext:
      'After cancelling you can change the delivery or create a new waybill.',
    cancelStepHistory:
      'The cancelled waybill stays in the history and in the waybill list.',

    labelDescription: 'Order #{number} · label',
    labelFailed:
      'Nova Poshta did not return the label. The waybill is valid — try again in a minute.',
    tryAgain: 'Try again',

    reconcileTitle: 'Checking the result',
    reconcileCancel:
      'Checking with the Nova Poshta account whether waybill {number} was cancelled.',
    reconcileCreate:
      'Checking with the Nova Poshta account whether a waybill was created for order #{number}.',
    reconciling: 'Checking with Nova Poshta…',
    checking: 'Checking…',
    checkAgain: 'Check again',
    candidateDescription:
      'Creating the waybill for order #{number} is not confirmed. Find the waybill in the Nova Poshta account and enter its number.',
    candidateGroup: 'Candidate from the NP account',
    candidateNumber: 'Number',
    candidateNote:
      'Confirm only if every detail matches the order. Otherwise we will check again later.',
    candidateConfirm: 'Yes, this is the order’s waybill',
    candidateReject: 'Not this waybill',

    attachDescription:
      'The waybill was created in the Nova Poshta account — attach it to order #{number}.',
    attachCheck: 'Check waybill',
    attachOther: 'Another number',
    attachConditionsText:
      'cash on delivery on the waybill equals {amount} · the waybill belongs to the same dispatch point · it is not attached to another order yet',
    attachNeedsDraft:
      'Fill in the delivery first: attaching checks the waybill against the draft’s recipient and dispatch point.',
    previewGroup: 'Preview',
    previewChanges: 'What changes in the order',
    previewState: 'Delivery state',
    codMatchesValue: '{amount} · equals the balance',
    stateNotSent: 'Created, not sent',
    stateSent: 'Sent',
    stateReceived: 'Received',
    effectNotSent:
      'The order gets this waybill, and the delivery status updates automatically. Payment does not change.',
    effectSent:
      'The parcel has already been sent: you will not be able to edit or cancel the waybill in Rozbirka.',
    effectReceived:
      'The parcel has already been received, but attaching does not confirm payment. Record the cash on delivery in the order or wait for reconciliation.',
    effectNoPayment: 'Attaching does not confirm payment.',
    notFound:
      'No waybill with this number was found in the Nova Poshta account. Check the digits.',
    alreadyLinked:
      'This waybill is already attached to another order. One waybill — one order.',
    incompleteWhy: 'Incomplete waybill details',
    incompleteText:
      'Nova Poshta returned incomplete details: the recipient branch is missing. Try later — you can attach it once the details are updated.',
    diffWhy: 'There are mismatches',
    diffGroup: 'Mismatches',
    diffRecipientWaybill: 'Recipient on the waybill',
    diffRecipientOrder: 'Recipient on the order',
    diffCodWaybill: 'Cash on delivery on the waybill',
    diffCodOrder: 'Order balance',
    diffTitle: 'Cannot attach',
    diffText:
      'Order details are not changed automatically. Fix the recipient and balance in the order if the mistake is there, or change the waybill in the Nova Poshta account and check again.',
    staleTitle: 'The waybill state changed',
    staleText:
      'While you were looking, the waybill state changed to “{state}”. Review the details again before attaching.',
  },
  pl: {
    blockTitle: 'Dostawa · Nova Poshta',
    factRoute: 'Trasa',
    factDestination: 'Dokąd',
    factSender: 'Nadawca',
    factDeliveryCost: 'Koszt dostawy',
    quoteDropped: 'wycena nieaktualna',
    pillAttached: 'Powiązany',
    pillSent: 'Wysłano',
    draftCaption: 'Szkic nie ma numeru listu, etykiety ani śledzenia.',
    checkAndCreate: 'Sprawdź i utwórz list',
    edit: 'Edytuj',
    createdSub: 'utworzony {when}',
    attachedSub: 'powiązany {when} · z konta NP',
    cancelledSub: 'anulowany {when}',
    npStatus: 'Status NP: {status} · zaktualizowano {time}',
    npStatusNoTime: 'Status NP: {status}',
    npStatusNone: 'Status NP: jeszcze nie otrzymano',
    createdToast: 'List {number} utworzony.',
    depositNotice:
      'Minimalna przedpłata: {required}. Otrzymano od klienta: {paid}. Przyjmij pozostałą przedpłatę przed utworzeniem listu i przekazaniem paczki przewoźnikowi.',
    payDeposit: 'Wpisz przedpłatę',
    staleSenderTitle: 'Sprawdź nadawcę',
    staleSenderText:
      'Nadawca w ustawieniach Nova Poshta się zmienił. Sprawdź dane nadawcy i przelicz dostawę od nowa, aby utworzyć list.',
    checkAndQuote: 'Sprawdź i przelicz',
    createInvoice: 'Utwórz list',
    unknownTitle: 'Nie udało się potwierdzić wyniku',
    unknownCreate:
      'Nova Poshta nie odpowiedziała na czas, więc nie wiemy, czy list utworzono. Nie twórz go ponownie — najpierw sprawdź wynik.',
    unknownCancel:
      'Nova Poshta nie odpowiedziała na czas, więc nie wiemy, czy list anulowano. Nie twórz listu ponownie — najpierw sprawdź wynik.',
    checkResult: 'Sprawdź wynik',
    waitTitle: 'Czekamy na odpowiedź',
    waitCreate:
      'Nova Poshta jeszcze nie potwierdziła, czy list utworzono. Ponowne tworzenie jest niedostępne, aby nie powstały dwa listy.',
    waitCancel:
      'Nova Poshta jeszcze nie potwierdziła, czy list anulowano. Tworzenie nowego jest niedostępne, aby nie powstały dwa listy.',
    checkNow: 'Sprawdź teraz',
    busyCreating: 'Nova Poshta tworzy list. Poczekaj na wynik.',
    busyCancelling: 'Nova Poshta anuluje list. Poczekaj na wynik.',
    cancelledNotice:
      'List anulowano. Zamówienie jest otwarte — wybierz, co dalej.',
    createNew: 'Utwórz nowy list',
    changeDelivery: 'Zmień dostawę',
    cancelledToast: 'List anulowano. Zamówienie pozostało otwarte.',
    recreateTitle: 'Został jeden krok',
    recreateText:
      'Stary list anulowano. Zmiana oddziału nie jest jeszcze zakończona — utwórz nowy list w zamówieniu.',
    sentNotice:
      'Paczka została już wysłana. Odbiorcy, adresu i pobrania nie można zmienić w Rozbirka — zrób to na koncie lub w aplikacji Nova Poshta.',
    cancelWaybill: 'Anuluj list',
    attachedToast: 'List powiązano z zamówieniem #{number}.',
    back: 'Wstecz',

    formTitle: 'Dane dostawy',
    formDescription:
      'Zamówienie #{number} · Nova Poshta. Dane zamówienia są uzupełnione — sprawdź je.',
    formNote: 'List tworzysz osobno, po sprawdzeniu.',
    groupRecipient: 'Odbiorca',
    groupTo: 'Dokąd',
    groupFrom: 'Skąd',
    groupParcel: 'Paczka',
    groupCod: 'Pobranie',
    recipientNameReview: 'Wpisz nazwisko i imię odbiorcy.',
    recipientLastName: 'Nazwisko',
    recipientFirstName: 'Imię',
    recipientMiddleName: 'Imię odojcowskie',
    optionalPatronymic: 'Opcjonalnie.',
    recipientSearch: 'Znajdź klienta',
    missingLastName: 'nazwisko odbiorcy',
    missingFirstName: 'imię odbiorcy',
    errorLastName: 'Podaj nazwisko odbiorcy',
    errorFirstName: 'Podaj imię odbiorcy',
    fullName: 'Imię i nazwisko',
    phone: 'Telefon',
    division: 'Oddział',
    divisionPick: 'Wybierz oddział',
    dispatchPoint: 'Punkt nadania',
    senderHint: 'Nadawca: {name}',
    places: 'Miejsc',
    weight: 'Waga',
    kg: 'kg',
    dimensions: 'Wymiary',
    cm: 'cm',
    codBalance: 'Pozostało do zapłaty',
    codDeclared: 'Wartość deklarowana',
    codOnWaybill: 'Pobranie w liście',
    codRule: 'Pobranie w liście musi być równe pozostałej kwocie.',
    missing: 'Brakuje danych: {list}. Wprowadzone dane zostały zachowane.',
    missingName: 'imię odbiorcy',
    missingPhone: 'telefon odbiorcy',
    missingSettlement: 'miejscowość',
    missingDivision: 'oddział odbioru',
    missingPoint: 'punkt nadania',
    missingPlaces: 'liczba miejsc',
    missingWeight: 'waga paczki',
    missingDimensions: 'wymiary paczki',
    missingGoods: 'kwota zamówienia',
    errorName: 'Podaj imię i nazwisko odbiorcy',
    errorPhone: 'Telefon w formacie +380 XX XXX XX XX',
    errorSettlement: 'Wybierz miejscowość z listy',
    errorDivision: 'Wybierz oddział odbioru',
    errorPoint: 'Wybierz punkt nadania',
    errorPlaces: 'Podaj całkowitą liczbę miejsc',
    errorWeight: 'Podaj wagę w kilogramach',
    errorDimensions: 'Podaj wymiary jako 60×40×30',

    readinessDescription: 'Zamówienie #{number} · sprawdzenie przed listem',
    fixSettings: 'Popraw ustawienia integracji',
    openSettings: 'Otwórz ustawienia',

    confirmDescription:
      'Zamówienie #{number} · sprawdź wszystko przed utworzeniem. List zostanie utworzony na koncie Nova Poshta.',
    groupWaybill: 'List przewozowy',
    parcelWithDims: '{parcel} · {dims} cm',
    quoteDelivery: 'Dostawa',
    quoteReturn: 'Szacunek zwrotu',
    quoteDeposit: 'Minimalna przedpłata',
    quoteSource: 'Wycena Nova Poshta · {when}',
    depositFirst: 'Przyjmij minimalną przedpłatę przed utworzeniem listu.',
    creating: 'Tworzymy list…',
    keepOpen: 'Nie zamykaj okna',
    repeatBlocked: 'Ponowne tworzenie niedostępne do sprawdzenia',
    refusedTitle: 'List nie został utworzony',
    refusedText:
      'Nova Poshta odmówiła utworzenia listu. Dane są zapisane — sprawdź je lub skontaktuj się z pomocą Nova Poshta.',

    editTitle: 'Edytuj list',
    editDescription: '{number} · przed wysyłką. Numer listu się nie zmieni.',
    changedWas: 'Zmieniono · było …{tail}',
    changed: 'Zmieniono',
    editLimits:
      'Miejscowości ani oddziału odbioru, nadawcy i pobrania w tym liście zmienić nie można. Do tego potrzebny jest nowy list.',
    editLimitsCaption:
      'Zmiana miejscowości lub oddziału → „Utwórz nowy list zamiast tego”.',
    needNewWaybill: 'Potrzebny nowy list',
    saveChanges: 'Zapisz zmiany',
    saving: 'Zapisujemy…',
    waitingNp: 'Czekamy na potwierdzenie Nova Poshta',
    editConfirmed: 'Nova Poshta potwierdziła zmiany.',
    recreateBranchTitle: 'Zmienić oddział przez nowy list?',
    recreateBranchText: 'Oddziału odbioru w tym liście zmienić nie można.',
    recreateRefusedText:
      'Nova Poshta nie zmienia tych danych w istniejącym liście — potrzebny jest nowy list.',
    recreateConfirm: 'Anuluj stary i kontynuuj',
    recreateStepCancel:
      'Najpierw anulujemy list {number} w Nova Poshta i poczekamy na potwierdzenie.',
    recreateStepBranch: 'Potem utworzysz nowy list z nowym oddziałem.',
    recreateStepChanges: 'Potem utworzysz nowy list ze zmienionymi danymi.',
    recreateStepHistory: 'Stary list pozostanie w historii zamówienia.',

    cancelTitle: 'Anulować list?',
    cancelText: 'List {number} zostanie anulowany w Nova Poshta.',
    cancelStepOpen: 'Zamówienie #{number} pozostanie otwarte.',
    cancelStepNext:
      'Po anulowaniu można zmienić dostawę lub utworzyć nowy list.',
    cancelStepHistory:
      'Anulowany list pozostanie w historii i na liście listów.',

    labelDescription: 'Zamówienie #{number} · etykieta',
    labelFailed:
      'Nova Poshta nie zwróciła etykiety. List jest ważny — spróbuj ponownie za minutę.',
    tryAgain: 'Spróbuj ponownie',

    reconcileTitle: 'Sprawdzanie wyniku',
    reconcileCancel:
      'Sprawdzamy na koncie Nova Poshta, czy list {number} został anulowany.',
    reconcileCreate:
      'Sprawdzamy na koncie Nova Poshta, czy utworzono list dla zamówienia #{number}.',
    reconciling: 'Sprawdzamy w Nova Poshta…',
    checking: 'Sprawdzamy…',
    checkAgain: 'Sprawdź ponownie',
    candidateDescription:
      'Utworzenie listu dla zamówienia #{number} nie zostało potwierdzone. Znajdź list na koncie Nova Poshta i wpisz jego numer.',
    candidateGroup: 'Kandydat z konta NP',
    candidateNumber: 'Numer',
    candidateNote:
      'Potwierdź tylko wtedy, gdy wszystkie dane zgadzają się z zamówieniem. W przeciwnym razie sprawdzimy ponownie później.',
    candidateConfirm: 'Tak, to list tego zamówienia',
    candidateReject: 'To nie ten list',

    attachDescription:
      'List utworzono na koncie Nova Poshta — powiąż go z zamówieniem #{number}.',
    attachCheck: 'Sprawdź list',
    attachOther: 'Inny numer',
    attachConditionsText:
      'pobranie w liście wynosi {amount} · list należy do tego samego punktu nadania · nie jest jeszcze powiązany z innym zamówieniem',
    attachNeedsDraft:
      'Najpierw uzupełnij dostawę: powiązanie porównuje list z odbiorcą i punktem nadania ze szkicu.',
    previewGroup: 'Podgląd',
    previewChanges: 'Co się zmieni w zamówieniu',
    previewState: 'Stan dostawy',
    codMatchesValue: '{amount} · równe pozostałej kwocie',
    stateNotSent: 'Utworzony, nie wysłany',
    stateSent: 'Wysłano',
    stateReceived: 'Odebrano',
    effectNotSent:
      'Zamówienie otrzyma ten list, a status dostawy będzie aktualizowany automatycznie. Płatność się nie zmienia.',
    effectSent:
      'Paczka została już wysłana: edytować i anulować listu w Rozbirka nie będzie można.',
    effectReceived:
      'Paczka została już odebrana, ale powiązanie nie potwierdza płatności. Wpisz pobranie w zamówieniu lub poczekaj na uzgodnienie.',
    effectNoPayment: 'Powiązanie nie potwierdza płatności.',
    notFound:
      'Na koncie Nova Poshta nie znaleziono listu o takim numerze. Sprawdź cyfry.',
    alreadyLinked:
      'Ten list jest już powiązany z innym zamówieniem. Jeden list — jedno zamówienie.',
    incompleteWhy: 'Niepełne dane listu',
    incompleteText:
      'Nova Poshta zwróciła niepełne dane: brak oddziału odbiorcy. Spróbuj później — powiązać będzie można po aktualizacji danych.',
    diffWhy: 'Są rozbieżności',
    diffGroup: 'Rozbieżności',
    diffRecipientWaybill: 'Odbiorca w liście',
    diffRecipientOrder: 'Odbiorca w zamówieniu',
    diffCodWaybill: 'Pobranie w liście',
    diffCodOrder: 'Pozostało w zamówieniu',
    diffTitle: 'Nie można powiązać',
    diffText:
      'Dane zamówienia nie zmieniają się automatycznie. Popraw odbiorcę i pozostałą kwotę w zamówieniu, jeśli błąd jest tam, albo zmień list na koncie Nova Poshta i sprawdź ponownie.',
    staleTitle: 'Stan listu się zmienił',
    staleText:
      'Podczas przeglądania stan listu zmienił się na „{state}”. Przejrzyj dane ponownie przed powiązaniem.',
  },
})
