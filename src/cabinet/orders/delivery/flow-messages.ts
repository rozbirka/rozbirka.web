import { defineMessages } from '@/i18n'

/**
 * Text of the order's «Оплата» block, the return and cancellation card and
 * their sheets and dialogs (module 46 §9–10). The Ukrainian strings are the
 * design's own copy; strings that already existed stay where they were.
 */
export const deliveryFlowMessages = defineMessages({
  uk: {
    // Order pill
    chipReturn: 'Повернення',
    // «Оплата» block (§9)
    paymentTitle: 'Оплата',
    factDue: 'Погоджена сума замовлення, грн',
    factPaid: 'Отримано від клієнта',
    factLeft: 'Залишок',
    pillPaid: 'Оплачено',
    noteTotalUnknown:
      'Вкажіть погоджену суму замовлення у гривнях під час оформлення доставки.',
    pillAwaitingCod: 'Очікуємо післяплату',
    pillManual: 'Внесіть вручну',
    pillReconcile: 'Потрібна звірка',
    pillAwaitingRefund: 'Потрібен розрахунок',
    pillRefundedPart: 'Повернено частково',
    pillRefunded: 'Повернено',
    pillLate: 'Потрібно повернути отримані кошти',
    pillNotApplicable: 'Не застосовується',
    subDeposit: 'передоплата',
    subCod: 'післяплата',
    subOther: 'оплата',
    subRefunded: 'повернено {amount}',
    subLate: 'післяплата · після скасування',
    noteAwaitingCod:
      'Нова пошта ще не переказала післяплату. Зазвичай це 1–2 робочі дні; зарахуємо автоматично в «{till}».',
    noteAwaitingCodBare:
      'Нова пошта ще не переказала післяплату. Зазвичай це 1–2 робочі дні.',
    noteAutoBooked:
      'Післяплату {amount} зараховано автоматично в «{till}» {date}.',
    noteNoTill:
      'Для Нової пошти не обрано касу, тому післяплату не зараховано автоматично. Внесіть її вручну, коли кошти надійдуть.',
    noteAutoFailedTill:
      'Не вдалося автоматично зарахувати післяплату: каса «{till}» архівована. Внесіть оплату вручну в активну касу.',
    noteAutoFailed:
      'Не вдалося автоматично зарахувати післяплату. Внесіть оплату вручну в активну касу.',
    reconcileTitle: 'Суми не збігаються',
    noteReconcile:
      'Нова пошта повідомила про переказ, що не збігається із залишком {left}. Не позначаємо як оплачене, доки ви не звірите суму у «Фінансах».',
    reconcileAction: 'Звірити у «Фінансах»',
    notePaidEarly:
      'Оплату отримано. Замовлення завершиться, коли посилку отримають.',
    noFinance:
      'Вносити оплату й повертати кошти може користувач із правом «Фінанси».',
    savedToast: 'Оплату {amount} внесено.',
    savedCompletedToast: 'Оплату {amount} внесено. Замовлення завершено.',
    lateNote:
      'Після скасування Нова пошта переказала {amount}. Зафіксуйте надходження й поверніть кошти клієнту. Замовлення лишається скасованим.',
    lateRecord: 'Зафіксувати надходження',
    lateLink: 'Прив’язати операцію',
    refundAction: 'Завершити розрахунок',
    refundRest: 'Завершити розрахунок',
    deliveredAwaitingCod: 'Доставлено · Очікуємо післяплату',
    // «Внести оплату» for the post-payment (9.8–9.9)
    codDescription: 'Замовлення #{number} · післяплата за ТТН {waybill}',
    codFooter: 'Операція з’явиться у «Фінансах»',
    codSubmit: 'Внести {amount}',
    paymentSaveFailed:
      'Не вдалося зберегти оплату. Дані збережено — спробуйте ще раз.',
    // Header (§10)
    startReturn: 'Почати повернення',
    sentTitle: 'Скасування після відправлення',
    sentNote:
      'Посилку вже відправлено, тому скасувати замовлення напряму не можна. Дочекайтеся повернення товару від Нової пошти (або попросіть отримувача відмовитися), прийміть його й поверніть кошти.',
    sentReason: 'Посилку вже відправлено',
    // Start return (10.2)
    startTitle: 'Почати повернення?',
    startText: 'Замовлення #{number} повернеться в роботу.',
    startGoods: 'Ми чекатимемо товар — його приймете вручну, коли прибуде.',
    startStock:
      'Товар не повернеться в залишок, доки ви не підтвердите приймання.',
    startMoney:
      'Кошти не списуються автоматично: повернення клієнту — окремий крок.',
    // Cancel before dispatch (10.13–10.14)
    cancelTitle: 'Скасувати замовлення?',
    cancelText: 'Замовлення #{number} буде скасовано, резерв товарів знято.',
    cancelWaybill: 'Спершу скасуємо ТТН {number} у Новій пошті.',
    cancelRefund:
      'Внесені {amount} потрібно буде повернути клієнту — це окремий крок.',
    cancelFinal: 'Скасоване замовлення не можна відновити.',
    cancelledToast: 'Замовлення скасовано.',
    cancelCard: 'Скасування замовлення',
    cancelStepWaybill: 'Скасувати ТТН {number}',
    cancelStepWaybillBare: 'Скасувати ТТН',
    cancelStepRefund: 'Повернути передоплату {amount}',
    cancelStepOrder: 'Скасувати замовлення',
    stepCancelled: 'скасовано',
    stepUnconfirmed: 'не підтверджено',
    oneStepTitle: 'Залишився один крок',
    oneStepNote:
      'ТТН уже скасовано. Щоб завершити скасування, поверніть передоплату {amount}.',
    oneStepNoteBare:
      'Щоб завершити скасування, поверніть передоплату {amount}.',
    unknownCancelNote:
      'Нова пошта не підтвердила скасування ТТН. Замовлення залишається відкритим — спершу перевірте результат.',
    continueNote: 'ТТН скасовано. Завершіть скасування замовлення.',
    // Return card (10.3–10.12)
    returnTitle: 'Повернення',
    stepStarted: 'Повернення розпочато',
    stepAwaitGoods: 'Очікуємо товар',
    stepAccepted: 'Товар прийнято',
    stepRefunded: 'Кошти повернено',
    stepCancelledOrder: 'Замовлення скасовано',
    stepDone: 'виконано',
    stepNow: 'зараз',
    stepSince: 'з {date}',
    inStock: {
      one: '{count} одиниця в наявності',
      few: '{count} одиниці в наявності',
      many: '{count} одиниць в наявності',
      other: '{count} одиниці в наявності',
    },
    waitNote: 'Чекаємо посилку. ТТН повернення: {number} · прямує до {place}.',
    waitNoteNumber: 'Чекаємо посилку. ТТН повернення: {number}.',
    waitNoteBare: 'Чекаємо посилку.',
    acceptAction: 'Прийняти товар',
    awaitRefundNote:
      'Товар уже на складі. У нас залишилося {amount} коштів клієнта. Визначте витрати на доставку та завершіть розрахунок.',
    partialNote:
      'Повернено {done} із {total}. Залишилось {left} — повернення не завершено.',
    refundedToast: 'Кошти повернено. Замовлення скасовано.',
    refundedOnlyToast: 'Кошти повернено.',
    // Accept the return (10.4–10.5)
    acceptTitle: 'Прийняти повернення',
    acceptDescription: 'Замовлення #{number} · ТТН повернення {waybill}',
    acceptDescriptionBare: 'Замовлення #{number}',
    acceptGroup: 'Склад повернення',
    acceptQty: '{received} з {total}',
    acceptMissing: 'немає в посилці',
    conditionLabel: 'Стан товару',
    conditionIntact: 'Без пошкоджень',
    conditionDamaged: 'Є пошкодження',
    noteLabel: 'Нотатка',
    notePlaceholder: 'Пошкодження, комплектність',
    noteRequired: 'Опишіть пошкодження.',
    acceptInfo: {
      one: 'Статусу Нової пошти недостатньо: підтвердьте, що фізично отримали весь товар. Після підтвердження {count} одиниця повернеться в наявність.',
      few: 'Статусу Нової пошти недостатньо: підтвердьте, що фізично отримали весь товар. Після підтвердження {count} одиниці повернуться в наявність.',
      many: 'Статусу Нової пошти недостатньо: підтвердьте, що фізично отримали весь товар. Після підтвердження {count} одиниць повернуться в наявність.',
      other:
        'Статусу Нової пошти недостатньо: підтвердьте, що фізично отримали весь товар. Після підтвердження {count} одиниці повернуться в наявність.',
    },
    missingTitle: 'Повернення неповне',
    missingNote:
      'Прийняти можна лише повне повернення. Неповернуті одиниці не повертаються в залишок — завершіть претензію з Новою поштою або зверніться до власника.',
    unitsAll: {
      one: '{received} з {count} одиниці',
      other: '{received} з {count} одиниць',
    },
    unitsPart: {
      one: 'Отримано {received} з {count} одиниці',
      other: 'Отримано {received} з {count} одиниць',
    },
    acceptSubmit: 'Підтвердити повернення в наявність',
    // Refund (10.7–10.11)
    settlementStep: 'Розрахунок із клієнтом',
    refundPaymentHint:
      'Виберіть касу, з якої повертаєте гроші. Rozbirka записує виплату в обліку — сам переказ клієнту ви робите окремо.',
    settlementIntro:
      'Рахуємо тільки отримані гроші. Післяплату, яку клієнт не сплатив, повертати не потрібно.',
    settlementResultGroup: '{step}. Що робимо з грошима',
    settlementKept: 'Залишаємо за доставку',
    settlementNoRefund:
      'Усі {held}, що залишилися у нас, покривають доставку. Клієнту нічого повертати не потрібно.',
    settlementPartial:
      'Із {held} залишаємо {retained} за доставку, а {refund} повертаємо клієнту.',
    settlementFull:
      'Клієнту повертаємо всі {refund}. На доставку з цих грошей нічого не залишаємо.',
    retentionNotePlaceholder:
      'Наприклад, відправлення та зворотна доставка за квитанціями',
    refundMethod: '{step}. Як обліковуємо виплату',
    refundMethodCreate: 'Повернення з каси',
    refundMethodLink: 'Повернення вже є у «Фінансах»',
    refundTitle: 'Завершити розрахунок',
    refundDescription:
      'Замовлення #{number} · визначте, скільки залишаємо за доставку та скільки повертаємо клієнту.',
    refundGroup: '1. Гроші клієнта',
    refundUnsettled: 'Зараз у нас',
    refundRetained: 'Утримано за доставку',
    retentionGroup: '2. Витрати на доставку',
    retentionLabel: 'Залишаємо за доставку',
    retentionHint:
      'Введіть підтверджені витрати на відправлення та повернення посилки. Якщо нічого не утримуємо — залиште 0.',
    retentionInvalid:
      'Вкажіть невід’ємну суму, не більше двох знаків після коми.',
    retentionOver:
      'Можна залишити не більше грошей, які зараз у нас ({amount}).',
    retentionNoteLabel: 'За що залишаємо ці гроші',
    retentionNoteRequired: 'Поясніть, які витрати покриває ця сума.',
    settleWithoutRefund: 'Завершити без виплати клієнту',
    confirmRetentionTitle: 'Завершити розрахунок без виплати?',
    confirmRetentionText:
      'Залишаємо {amount} за доставку. Підстава: {note}. Клієнту повертаємо 0 грн. Видатку з каси не буде.',
    pillRetained: 'Утримано за доставку',
    stepSettled: 'Розрахунок завершено',
    noCashRefund: 'без повернення коштів',
    retainedNote: 'Утримано за фактичну доставку: {amount}.',
    factRefunded: 'Повернено клієнту',
    refundBooked: 'Клієнт сплатив',
    refundDone: 'Уже повернули клієнту',
    refundLeft: 'Повертаємо клієнту',
    method: 'Спосіб',
    methodCreate: 'Створити операцію',
    methodLink: 'Прив’язати наявну',
    amountLabel: 'Сума',
    tillLabel: 'Каса',
    tillOption: '{name} · UAH',
    amountInvalid: 'Вкажіть суму цифрами.',
    amountOver: 'Більше за залишок до повернення ({amount})',
    amountUnder: 'Rozbirka фіксує лише повне повернення — {amount}.',
    noTills: 'Активних кас немає. Створіть касу у «Фінансах».',
    operationLabel: 'Операція у «Фінансах»',
    operationPlaceholder: 'Номер або сума операції',
    operationNone: 'У цій касі немає видатків на цю суму.',
    operationPick: 'Оберіть операцію.',
    operationAmount:
      'Сума операції має дорівнювати залишку до повернення ({amount}).',
    operationTaken: 'Операцію вже прив’язано до іншого замовлення.',
    operationsFailed: 'Не вдалося завантажити операції каси.',
    submitRefund: 'Підтвердити повернення {amount}',
    submitLink: 'Прив’язати операцію',
    confirmTitle: 'Повернути клієнту {amount}?',
    confirmText:
      'Каса «{till}» · UAH. Rozbirka не переказує гроші — зробіть переказ клієнту окремо.',
    confirmAction: 'Зафіксувати {amount}',
    saveFailed: 'Не вдалося зберегти. Дані збережено — спробуйте ще раз.',
    // Late carrier payment (10.16)
    lateDescription:
      'Замовлення #{number} · післяплата за ТТН {waybill} надійшла після скасування.',
    lateAmount: 'Сума виплати',
    lateFee: 'Комісія',
    lateReason: 'Підстава звірки',
    lateReasonHint:
      'Обов’язково, якщо сума чи комісія відрізняється від післяплати {amount} або після ручної звірки.',
    lateReasonRequired: 'Вкажіть підставу підтвердження суми й комісії.',
    lateFeeInvalid: 'Комісія має бути меншою за суму виплати.',
    lateReceipt: 'Надходження у «Фінансах»',
    lateNoReceipts: 'У цій касі немає вільних надходжень на цю суму.',
    lateToast: 'Надходження зафіксовано. Поверніть кошти клієнту.',
  },
  'en-GB': {
    chipReturn: 'Return',
    paymentTitle: 'Payment',
    factDue: 'Agreed order total, UAH',
    factPaid: 'Received from customer',
    factLeft: 'Balance',
    pillPaid: 'Paid',
    noteTotalUnknown:
      'Set the agreed order total in hryvnias when arranging delivery.',
    pillAwaitingCod: 'Awaiting cash on delivery',
    pillManual: 'Record manually',
    pillReconcile: 'Needs reconciling',
    pillAwaitingRefund: 'Settlement needed',
    pillRefundedPart: 'Partly refunded',
    pillRefunded: 'Refunded',
    pillLate: 'Money received must be returned',
    pillNotApplicable: 'Not applicable',
    subDeposit: 'prepayment',
    subCod: 'cash on delivery',
    subOther: 'payment',
    subRefunded: '{amount} refunded',
    subLate: 'cash on delivery · after cancellation',
    noteAwaitingCod:
      'Nova Poshta has not transferred the cash on delivery yet. This usually takes 1–2 working days; we will book it automatically to “{till}”.',
    noteAwaitingCodBare:
      'Nova Poshta has not transferred the cash on delivery yet. This usually takes 1–2 working days.',
    noteAutoBooked:
      'Cash on delivery of {amount} was booked automatically to “{till}” on {date}.',
    noteNoTill:
      'No till is chosen for Nova Poshta, so the cash on delivery was not booked automatically. Record it manually once the money arrives.',
    noteAutoFailedTill:
      'The cash on delivery could not be booked automatically: the till “{till}” is archived. Record the payment manually to an active till.',
    noteAutoFailed:
      'The cash on delivery could not be booked automatically. Record the payment manually to an active till.',
    reconcileTitle: 'Amounts do not match',
    noteReconcile:
      'Nova Poshta reported a transfer that does not match the balance of {left}. We will not mark it paid until you reconcile the amount in Finance.',
    reconcileAction: 'Reconcile in Finance',
    notePaidEarly:
      'Payment received. The order completes once the parcel is collected.',
    noFinance:
      'Payments and refunds can be recorded by a user with the Finance permission.',
    savedToast: 'Payment of {amount} recorded.',
    savedCompletedToast: 'Payment of {amount} recorded. Order completed.',
    lateNote:
      'After cancellation Nova Poshta transferred {amount}. Record the receipt and refund the customer. The order stays cancelled.',
    lateRecord: 'Record receipt',
    lateLink: 'Link transaction',
    refundAction: 'Settle the order',
    refundRest: 'Settle the order',
    deliveredAwaitingCod: 'Delivered · Awaiting cash on delivery',
    codDescription: 'Order #{number} · cash on delivery for waybill {waybill}',
    codFooter: 'The transaction will appear in Finance',
    codSubmit: 'Record {amount}',
    paymentSaveFailed:
      'The payment could not be saved. Your entries are kept — try again.',
    startReturn: 'Start return',
    sentTitle: 'Cancelling after dispatch',
    sentNote:
      'The parcel has already been sent, so the order cannot be cancelled directly. Wait for Nova Poshta to return the goods (or ask the recipient to refuse them), accept them and refund the money.',
    sentReason: 'The parcel has already been sent',
    startTitle: 'Start a return?',
    startText: 'Order #{number} goes back into progress.',
    startGoods:
      'We will wait for the goods — you accept them manually when they arrive.',
    startStock:
      'The goods do not go back into stock until you confirm receipt.',
    startMoney:
      'No money is taken automatically: refunding the customer is a separate step.',
    cancelTitle: 'Cancel the order?',
    cancelText:
      'Order #{number} will be cancelled and its goods released from reservation.',
    cancelWaybill: 'Waybill {number} is cancelled with Nova Poshta first.',
    cancelRefund:
      'The {amount} paid will have to be refunded to the customer — a separate step.',
    cancelFinal: 'A cancelled order cannot be restored.',
    cancelledToast: 'Order cancelled.',
    cancelCard: 'Order cancellation',
    cancelStepWaybill: 'Cancel waybill {number}',
    cancelStepWaybillBare: 'Cancel waybill',
    cancelStepRefund: 'Refund the prepayment of {amount}',
    cancelStepOrder: 'Cancel the order',
    stepCancelled: 'cancelled',
    stepUnconfirmed: 'not confirmed',
    oneStepTitle: 'One step left',
    oneStepNote:
      'The waybill is already cancelled. To finish cancelling, refund the prepayment of {amount}.',
    oneStepNoteBare: 'To finish cancelling, refund the prepayment of {amount}.',
    unknownCancelNote:
      'Nova Poshta did not confirm the waybill cancellation. The order stays open — check the result first.',
    continueNote: 'The waybill is cancelled. Finish cancelling the order.',
    returnTitle: 'Return',
    stepStarted: 'Return started',
    stepAwaitGoods: 'Awaiting goods',
    stepAccepted: 'Goods accepted',
    stepRefunded: 'Money refunded',
    stepCancelledOrder: 'Order cancelled',
    stepDone: 'done',
    stepNow: 'now',
    stepSince: 'since {date}',
    inStock: {
      one: '{count} unit in stock',
      other: '{count} units in stock',
    },
    waitNote:
      'Waiting for the parcel. Return waybill: {number} · on its way to {place}.',
    waitNoteNumber: 'Waiting for the parcel. Return waybill: {number}.',
    waitNoteBare: 'Waiting for the parcel.',
    acceptAction: 'Accept goods',
    awaitRefundNote:
      'The goods are back in stock. We still hold {amount} of the customer’s money. Confirm delivery costs and settle the order.',
    partialNote:
      '{done} of {total} refunded. {left} left — the refund is not finished.',
    refundedToast: 'Money refunded. Order cancelled.',
    refundedOnlyToast: 'Money refunded.',
    acceptTitle: 'Accept return',
    acceptDescription: 'Order #{number} · return waybill {waybill}',
    acceptDescriptionBare: 'Order #{number}',
    acceptGroup: 'Returned items',
    acceptQty: '{received} of {total}',
    acceptMissing: 'not in the parcel',
    conditionLabel: 'Condition',
    conditionIntact: 'Undamaged',
    conditionDamaged: 'Damaged',
    noteLabel: 'Note',
    notePlaceholder: 'Damage, completeness',
    noteRequired: 'Describe the damage.',
    acceptInfo: {
      one: 'The Nova Poshta status is not enough: confirm you physically received all the goods. Once confirmed, {count} unit goes back into stock.',
      other:
        'The Nova Poshta status is not enough: confirm you physically received all the goods. Once confirmed, {count} units go back into stock.',
    },
    missingTitle: 'Incomplete return',
    missingNote:
      'Only a complete return can be accepted. Units that did not come back stay out of stock — settle the claim with Nova Poshta or contact the owner.',
    unitsAll: {
      one: '{received} of {count} unit',
      other: '{received} of {count} units',
    },
    unitsPart: {
      one: 'Received {received} of {count} unit',
      other: 'Received {received} of {count} units',
    },
    acceptSubmit: 'Confirm return to stock',
    settlementStep: 'Customer settlement',
    refundPaymentHint:
      'Choose the cash account for the refund. Rozbirka records the payout; you transfer the money to the customer separately.',
    settlementIntro:
      'Only money actually received counts here. Cash on delivery that the customer never paid does not need to be refunded.',
    settlementResultGroup: '{step}. What happens to the money',
    settlementKept: 'Keep for delivery',
    settlementNoRefund:
      'All {held} still held covers delivery. Nothing needs to be refunded to the customer.',
    settlementPartial:
      'Of {held}, keep {retained} for delivery and refund {refund} to the customer.',
    settlementFull:
      'Refund the full {refund} to the customer. Keep none of this money for delivery.',
    retentionNotePlaceholder:
      'For example, outward and return delivery supported by receipts',
    refundMethod: '{step}. Record the payout',
    refundMethodCreate: 'Refund from a cash account',
    refundMethodLink: 'Already recorded in Finance',
    refundTitle: 'Settle the order',
    refundDescription:
      'Order #{number} · decide how much to keep for delivery and how much to refund to the customer.',
    refundGroup: '1. Customer’s money',
    refundUnsettled: 'We currently hold',
    refundRetained: 'Retained for delivery',
    retentionGroup: '2. Delivery costs',
    retentionLabel: 'Keep for delivery',
    retentionHint:
      'Enter confirmed outward and return delivery costs. Leave 0 if nothing is to be retained.',
    retentionInvalid:
      'Enter a non-negative amount with no more than two decimal places.',
    retentionOver:
      'You can keep no more than the money currently held ({amount}).',
    retentionNoteLabel: 'What these costs cover',
    retentionNoteRequired: 'Explain which costs this amount covers.',
    settleWithoutRefund: 'Complete without a customer payout',
    confirmRetentionTitle: 'Complete settlement without a payout?',
    confirmRetentionText:
      'Keep {amount} for delivery. Reason: {note}. Refund to the customer: 0 UAH. No cash expense will be created.',
    pillRetained: 'Retained for delivery',
    stepSettled: 'Settlement completed',
    noCashRefund: 'without a cash refund',
    retainedNote: 'Retained for actual delivery: {amount}.',
    factRefunded: 'Refunded to customer',
    refundBooked: 'Customer paid',
    refundDone: 'Already refunded',
    refundLeft: 'Refund to customer',
    method: 'Method',
    methodCreate: 'New transaction',
    methodLink: 'Link existing',
    amountLabel: 'Amount',
    tillLabel: 'Till',
    tillOption: '{name} · UAH',
    amountInvalid: 'Enter the amount in digits.',
    amountOver: 'More than the amount left to refund ({amount})',
    amountUnder: 'Rozbirka records only a full refund — {amount}.',
    noTills: 'There are no active tills. Create one in Finance.',
    operationLabel: 'Transaction in Finance',
    operationPlaceholder: 'Transaction number or amount',
    operationNone: 'This till has no expenses for this amount.',
    operationPick: 'Choose a transaction.',
    operationAmount:
      'The transaction must equal the amount left to refund ({amount}).',
    operationTaken: 'This transaction is already linked to another order.',
    operationsFailed: 'The till transactions could not be loaded.',
    submitRefund: 'Confirm refund of {amount}',
    submitLink: 'Link transaction',
    confirmTitle: 'Refund {amount} to the customer?',
    confirmText:
      'Till “{till}” · UAH. Rozbirka does not transfer money — make the transfer to the customer yourself.',
    confirmAction: 'Record {amount}',
    saveFailed: 'Could not save. Your entries are kept — try again.',
    lateDescription:
      'Order #{number} · cash on delivery for waybill {waybill} arrived after cancellation.',
    lateAmount: 'Payout amount',
    lateFee: 'Fee',
    lateReason: 'Reconciliation basis',
    lateReasonHint:
      'Required when the amount or fee differs from the cash on delivery of {amount}, or after manual reconciliation.',
    lateReasonRequired: 'State what confirms the amount and the fee.',
    lateFeeInvalid: 'The fee must be less than the payout.',
    lateReceipt: 'Receipt in Finance',
    lateNoReceipts: 'This till has no unclaimed receipts for this amount.',
    lateToast: 'Receipt recorded. Refund the customer.',
  },
  pl: {
    chipReturn: 'Zwrot',
    paymentTitle: 'Płatność',
    factDue: 'Uzgodniona kwota zamówienia, UAH',
    factPaid: 'Otrzymano od klienta',
    factLeft: 'Pozostało',
    pillPaid: 'Opłacone',
    noteTotalUnknown:
      'Ustal uzgodnioną kwotę zamówienia w hrywnach podczas organizowania dostawy.',
    pillAwaitingCod: 'Czekamy na pobranie',
    pillManual: 'Wprowadź ręcznie',
    pillReconcile: 'Wymaga uzgodnienia',
    pillAwaitingRefund: 'Potrzebne rozliczenie',
    pillRefundedPart: 'Zwrócono częściowo',
    pillRefunded: 'Zwrócono',
    pillLate: 'Trzeba zwrócić otrzymane środki',
    pillNotApplicable: 'Nie dotyczy',
    subDeposit: 'przedpłata',
    subCod: 'pobranie',
    subOther: 'płatność',
    subRefunded: 'zwrócono {amount}',
    subLate: 'pobranie · po anulowaniu',
    noteAwaitingCod:
      'Nowa Poczta nie przelała jeszcze pobrania. Zwykle trwa to 1–2 dni robocze; zaksięgujemy je automatycznie w kasie „{till}”.',
    noteAwaitingCodBare:
      'Nowa Poczta nie przelała jeszcze pobrania. Zwykle trwa to 1–2 dni robocze.',
    noteAutoBooked:
      'Pobranie {amount} zaksięgowano automatycznie w kasie „{till}” {date}.',
    noteNoTill:
      'Dla Nowej Poczty nie wybrano kasy, więc pobranie nie zostało zaksięgowane automatycznie. Wprowadź je ręcznie, gdy środki wpłyną.',
    noteAutoFailedTill:
      'Nie udało się automatycznie zaksięgować pobrania: kasa „{till}” jest zarchiwizowana. Wprowadź płatność ręcznie do aktywnej kasy.',
    noteAutoFailed:
      'Nie udało się automatycznie zaksięgować pobrania. Wprowadź płatność ręcznie do aktywnej kasy.',
    reconcileTitle: 'Kwoty się nie zgadzają',
    noteReconcile:
      'Nowa Poczta zgłosiła przelew, który nie zgadza się z saldem {left}. Nie oznaczymy go jako opłacony, dopóki nie uzgodnisz kwoty w „Finansach”.',
    reconcileAction: 'Uzgodnij w „Finansach”',
    notePaidEarly:
      'Płatność otrzymana. Zamówienie zakończy się, gdy przesyłka zostanie odebrana.',
    noFinance:
      'Płatności i zwroty może wprowadzać użytkownik z uprawnieniem „Finanse”.',
    savedToast: 'Wprowadzono płatność {amount}.',
    savedCompletedToast:
      'Wprowadzono płatność {amount}. Zamówienie zakończone.',
    lateNote:
      'Po anulowaniu Nowa Poczta przelała {amount}. Zaksięguj wpływ i zwróć środki klientowi. Zamówienie pozostaje anulowane.',
    lateRecord: 'Zaksięguj wpływ',
    lateLink: 'Powiąż operację',
    refundAction: 'Zakończ rozliczenie',
    refundRest: 'Zakończ rozliczenie',
    deliveredAwaitingCod: 'Doręczono · Czekamy na pobranie',
    codDescription: 'Zamówienie #{number} · pobranie za list {waybill}',
    codFooter: 'Operacja pojawi się w „Finansach”',
    codSubmit: 'Wprowadź {amount}',
    paymentSaveFailed:
      'Nie udało się zapisać płatności. Dane zostały zachowane — spróbuj ponownie.',
    startReturn: 'Rozpocznij zwrot',
    sentTitle: 'Anulowanie po wysyłce',
    sentNote:
      'Przesyłka została już wysłana, więc nie można bezpośrednio anulować zamówienia. Poczekaj na zwrot towaru od Nowej Poczty (lub poproś odbiorcę o odmowę), przyjmij go i zwróć środki.',
    sentReason: 'Przesyłka została już wysłana',
    startTitle: 'Rozpocząć zwrot?',
    startText: 'Zamówienie #{number} wróci do realizacji.',
    startGoods: 'Będziemy czekać na towar — przyjmiesz go ręcznie, gdy dotrze.',
    startStock: 'Towar nie wróci na stan, dopóki nie potwierdzisz przyjęcia.',
    startMoney:
      'Środki nie są pobierane automatycznie: zwrot dla klienta to osobny krok.',
    cancelTitle: 'Anulować zamówienie?',
    cancelText:
      'Zamówienie #{number} zostanie anulowane, a rezerwacja towaru zdjęta.',
    cancelWaybill: 'Najpierw anulujemy list {number} w Nowej Poczcie.',
    cancelRefund:
      'Wpłacone {amount} trzeba będzie zwrócić klientowi — to osobny krok.',
    cancelFinal: 'Anulowanego zamówienia nie można przywrócić.',
    cancelledToast: 'Zamówienie anulowane.',
    cancelCard: 'Anulowanie zamówienia',
    cancelStepWaybill: 'Anuluj list {number}',
    cancelStepWaybillBare: 'Anuluj list',
    cancelStepRefund: 'Zwróć przedpłatę {amount}',
    cancelStepOrder: 'Anuluj zamówienie',
    stepCancelled: 'anulowano',
    stepUnconfirmed: 'niepotwierdzone',
    oneStepTitle: 'Został jeden krok',
    oneStepNote:
      'List jest już anulowany. Aby zakończyć anulowanie, zwróć przedpłatę {amount}.',
    oneStepNoteBare: 'Aby zakończyć anulowanie, zwróć przedpłatę {amount}.',
    unknownCancelNote:
      'Nowa Poczta nie potwierdziła anulowania listu. Zamówienie pozostaje otwarte — najpierw sprawdź wynik.',
    continueNote: 'List anulowano. Dokończ anulowanie zamówienia.',
    returnTitle: 'Zwrot',
    stepStarted: 'Zwrot rozpoczęty',
    stepAwaitGoods: 'Czekamy na towar',
    stepAccepted: 'Towar przyjęty',
    stepRefunded: 'Środki zwrócone',
    stepCancelledOrder: 'Zamówienie anulowane',
    stepDone: 'wykonano',
    stepNow: 'teraz',
    stepSince: 'od {date}',
    inStock: {
      one: '{count} sztuka na stanie',
      few: '{count} sztuki na stanie',
      many: '{count} sztuk na stanie',
      other: '{count} sztuki na stanie',
    },
    waitNote:
      'Czekamy na przesyłkę. List zwrotny: {number} · w drodze do {place}.',
    waitNoteNumber: 'Czekamy na przesyłkę. List zwrotny: {number}.',
    waitNoteBare: 'Czekamy na przesyłkę.',
    acceptAction: 'Przyjmij towar',
    awaitRefundNote:
      'Towar jest już na stanie. Pozostaje u nas {amount} pieniędzy klienta. Potwierdź koszty dostawy i zakończ rozliczenie.',
    partialNote:
      'Zwrócono {done} z {total}. Pozostało {left} — zwrot nie jest zakończony.',
    refundedToast: 'Środki zwrócone. Zamówienie anulowane.',
    refundedOnlyToast: 'Środki zwrócone.',
    acceptTitle: 'Przyjmij zwrot',
    acceptDescription: 'Zamówienie #{number} · list zwrotny {waybill}',
    acceptDescriptionBare: 'Zamówienie #{number}',
    acceptGroup: 'Skład zwrotu',
    acceptQty: '{received} z {total}',
    acceptMissing: 'brak w przesyłce',
    conditionLabel: 'Stan towaru',
    conditionIntact: 'Bez uszkodzeń',
    conditionDamaged: 'Uszkodzony',
    noteLabel: 'Notatka',
    notePlaceholder: 'Uszkodzenia, kompletność',
    noteRequired: 'Opisz uszkodzenia.',
    acceptInfo: {
      one: 'Status Nowej Poczty nie wystarczy: potwierdź, że fizycznie otrzymałeś cały towar. Po potwierdzeniu {count} sztuka wróci na stan.',
      few: 'Status Nowej Poczty nie wystarczy: potwierdź, że fizycznie otrzymałeś cały towar. Po potwierdzeniu {count} sztuki wrócą na stan.',
      many: 'Status Nowej Poczty nie wystarczy: potwierdź, że fizycznie otrzymałeś cały towar. Po potwierdzeniu {count} sztuk wróci na stan.',
      other:
        'Status Nowej Poczty nie wystarczy: potwierdź, że fizycznie otrzymałeś cały towar. Po potwierdzeniu {count} sztuki wrócą na stan.',
    },
    missingTitle: 'Zwrot niepełny',
    missingNote:
      'Przyjąć można tylko pełny zwrot. Niezwrócone sztuki nie wracają na stan — zakończ reklamację z Nową Pocztą lub skontaktuj się z właścicielem.',
    unitsAll: {
      one: '{received} z {count} sztuki',
      other: '{received} z {count} sztuk',
    },
    unitsPart: {
      one: 'Otrzymano {received} z {count} sztuki',
      other: 'Otrzymano {received} z {count} sztuk',
    },
    acceptSubmit: 'Potwierdź zwrot na stan',
    settlementStep: 'Rozliczenie z klientem',
    refundPaymentHint:
      'Wybierz kasę, z której zwracasz pieniądze. Rozbirka księguje wypłatę; przelew do klienta wykonujesz osobno.',
    settlementIntro:
      'Liczymy tylko otrzymane pieniądze. Nie trzeba zwracać pobrania, którego klient nie zapłacił.',
    settlementResultGroup: '{step}. Co robimy z pieniędzmi',
    settlementKept: 'Zatrzymujemy za dostawę',
    settlementNoRefund:
      'Całe {held}, które pozostało u nas, pokrywa dostawę. Klientowi nie trzeba nic zwracać.',
    settlementPartial:
      'Z {held} zatrzymujemy {retained} za dostawę, a {refund} zwracamy klientowi.',
    settlementFull:
      'Zwracamy klientowi całe {refund}. Nic z tych pieniędzy nie zatrzymujemy za dostawę.',
    retentionNotePlaceholder:
      'Na przykład wysyłka i przesyłka zwrotna potwierdzone rachunkami',
    refundMethod: '{step}. Jak księgujemy wypłatę',
    refundMethodCreate: 'Zwrot z kasy',
    refundMethodLink: 'Zwrot już jest w Finansach',
    refundTitle: 'Zakończ rozliczenie',
    refundDescription:
      'Zamówienie #{number} · określ, ile zatrzymujemy za dostawę, a ile zwracamy klientowi.',
    refundGroup: '1. Pieniądze klienta',
    refundUnsettled: 'Obecnie u nas',
    refundRetained: 'Zatrzymano na dostawę',
    retentionGroup: '2. Koszty dostawy',
    retentionLabel: 'Zatrzymujemy za dostawę',
    retentionHint:
      'Wpisz potwierdzone koszty wysyłki i przesyłki zwrotnej. Pozostaw 0, jeśli nic nie zatrzymujemy.',
    retentionInvalid:
      'Wpisz nieujemną kwotę z maksymalnie dwoma miejscami po przecinku.',
    retentionOver:
      'Można zatrzymać najwyżej kwotę, która obecnie pozostaje u nas ({amount}).',
    retentionNoteLabel: 'Za co zatrzymujemy te pieniądze',
    retentionNoteRequired: 'Wyjaśnij, jakie koszty pokrywa ta kwota.',
    settleWithoutRefund: 'Zakończ bez wypłaty klientowi',
    confirmRetentionTitle: 'Zakończyć rozliczenie bez wypłaty?',
    confirmRetentionText:
      'Zatrzymujemy {amount} za dostawę. Podstawa: {note}. Zwracamy klientowi 0 UAH. Nie powstanie rozchód z kasy.',
    pillRetained: 'Zatrzymano na dostawę',
    stepSettled: 'Rozliczenie zakończone',
    noCashRefund: 'bez zwrotu pieniędzy',
    retainedNote: 'Zatrzymano na rzeczywistą dostawę: {amount}.',
    factRefunded: 'Zwrócono klientowi',
    refundBooked: 'Klient zapłacił',
    refundDone: 'Już zwrócono klientowi',
    refundLeft: 'Zwracamy klientowi',
    method: 'Sposób',
    methodCreate: 'Nowa operacja',
    methodLink: 'Powiąż istniejącą',
    amountLabel: 'Kwota',
    tillLabel: 'Kasa',
    tillOption: '{name} · UAH',
    amountInvalid: 'Podaj kwotę cyframi.',
    amountOver: 'Więcej niż pozostało do zwrotu ({amount})',
    amountUnder: 'Rozbirka księguje tylko pełny zwrot — {amount}.',
    noTills: 'Brak aktywnych kas. Utwórz kasę w „Finansach”.',
    operationLabel: 'Operacja w „Finansach”',
    operationPlaceholder: 'Numer lub kwota operacji',
    operationNone: 'W tej kasie nie ma wydatków na tę kwotę.',
    operationPick: 'Wybierz operację.',
    operationAmount:
      'Kwota operacji musi być równa kwocie do zwrotu ({amount}).',
    operationTaken: 'Ta operacja jest już powiązana z innym zamówieniem.',
    operationsFailed: 'Nie udało się wczytać operacji kasy.',
    submitRefund: 'Potwierdź zwrot {amount}',
    submitLink: 'Powiąż operację',
    confirmTitle: 'Zwrócić klientowi {amount}?',
    confirmText:
      'Kasa „{till}” · UAH. Rozbirka nie przelewa pieniędzy — wykonaj przelew do klienta osobno.',
    confirmAction: 'Zaksięguj {amount}',
    saveFailed:
      'Nie udało się zapisać. Dane zostały zachowane — spróbuj ponownie.',
    lateDescription:
      'Zamówienie #{number} · pobranie za list {waybill} wpłynęło po anulowaniu.',
    lateAmount: 'Kwota wypłaty',
    lateFee: 'Prowizja',
    lateReason: 'Podstawa uzgodnienia',
    lateReasonHint:
      'Wymagane, jeśli kwota lub prowizja różni się od pobrania {amount} albo po ręcznym uzgodnieniu.',
    lateReasonRequired: 'Podaj podstawę potwierdzenia kwoty i prowizji.',
    lateFeeInvalid: 'Prowizja musi być mniejsza niż kwota wypłaty.',
    lateReceipt: 'Wpływ w „Finansach”',
    lateNoReceipts: 'W tej kasie nie ma wolnych wpływów na tę kwotę.',
    lateToast: 'Wpływ zaksięgowany. Zwróć środki klientowi.',
  },
})
