# Patterns

Спільні контролі описані в [components](components.md); бізнес-семантика — у вимогах і [UX-CONTRACT](../../UX-CONTRACT.md). Тут — приклади композиції з поточної робочої версії, не нові бізнес-правила.

## Форми та валідація

Починати з Field + TextInput/SelectInput/TextArea, дій Button та Notice для помилки операції. [Login](../../src/screens/login.tsx) і [його тести](../../src/screens/login.test.tsx) показують auth-форми.

Форма володіє правилами введення, primitive — presentation та accessibility. Сервер лишається авторитетом для permissions і бізнес-обмежень. Field error замінює hint; не дублювати те саме повідомлення у кількох незалежних місцях без потреби. `Field required` — лише позначка: обов’язковість перевіряє форма (див. [components](components.md)).

Валідація: UX-CONTRACT вимагає `noValidate` для auth-форм. У кабінеті трапляються обидва підходи — власні правила з `noValidate` ([PartForm](../../src/cabinet/parts/PartsScreen.tsx), [CustomerForm](../../src/cabinet/customers/CustomersScreen.tsx)) і нативні `required`/`min` без `noValidate` ([CashTransferDrawer](../../src/cabinet/cash/CashTransferDrawer.tsx)). Обирати за сусідньою формою і не змішувати в межах однієї. Коли показувати помилку, теж вирішує форма: CustomerForm показує її після виходу з поля (`touched`), PartForm — після першої спроби зберегти й підказує наступну проблему у футері.

### Форма в шторці

Форми кабінету відкриваються в Sheet; FormDialog лишився для коротких модальних форм інвентаризації. Композиція:

- `<form id={FORM_ID}>` у тілі Sheet, кнопка submit у `footer` з атрибутом `form={FORM_ID}` — футер лишається видимим під час прокрутки;
- секції форми — SectionPanel `variant="plain"`, без карток у картці;
- закриття під час pending блокує caller: `onOpenChange={(next) => { if (!next && !pending) close() }}` і `disabled={pending}` на «Скасувати»;
- приклади: [PartForm](../../src/cabinet/parts/PartsScreen.tsx), [CashTransferDrawer](../../src/cabinet/cash/CashTransferDrawer.tsx), [CustomerForm](../../src/cabinet/customers/CustomersScreen.tsx). Ці файли мають локальні незакомічені зміни на момент опису.

## Асинхронна дія

[useOperation](../../src/components/app/use-operation.ts) надає idle/pending/done/failed, result/error і triggerProps. Він ігнорує одночасні виклики в одному hook instance та може показати success toast через provider. Це не серверна idempotency, не гарантія cancellation і не захист між різними вкладками. `reset()` під час запиту не зупиняє його: пізня відповідь усе одно змінить стан, а новий `run()` до її приходу буде проігноровано. При tenant/navigation changes перевіряти конкретного caller, не припускати універсальної stale-response гарантії.

[Notice](../../src/components/app/notice.tsx) — контекстний feedback, toast — коротке підтвердження; помилка, яка вимагає виправити поле, має залишатися доступною біля відповідного поля. Для прикладів використання та обмежень дивитися [operations tests](../../src/components/app/operations-kit.test.tsx).

## Список, пошук і вибір

[PartsScreen](../../src/cabinet/parts/PartsScreen.tsx) поєднує компоненти списку, фільтри, стани та предметні дії. Файл зараз змінюється в робочій гілці; не копіювати його бізнес-рішення як прийняту політику.

DataTable володіє відображенням і selection callbacks, не API fetching/sorting. Selection може містити рядки з інших сторінок; toggle page працює з доступними рядками поточної сторінки. Empty content зберігає footer, щоб користувач міг повернутися з порожньої сторінки. Пагінацію й правила скидання selection визначає caller.

`onRowClick` вішається на `<tr>` без фокуса з клавіатури — лише для миші, тому основна дія рядка має бути ще й посиланням чи кнопкою. Клік по кнопці в комірці спливає до рядка: якщо рядок має `onRowClick`, комірка дії має зупиняти поширення кліку (як це робить колонка вибору).

Дія в рядку: окрема колонка з `headerHidden` і [ActionMenu](../../src/components/app/action-menu.tsx) з іменем, що містить назву запису, → ConfirmDialog. Приклад — витрати авто в [CarsScreen](../../src/cabinet/cars/CarsScreen.tsx) (компонент `Expenses`); там діалог закривається до запиту, а помилка йде через `onProblem` у батьківський екран. Якщо pending/error мають лишатися в діалозі, передавати `pending`/`error` у ConfirmDialog і блокувати закриття в `onOpenChange`, доки йде запит.

[PartSearchPicker](../../src/components/parts/PartSearchPicker.tsx) використовує AbortController і request counters для асинхронних запитів; [тести](../../src/components/parts/PartSearchPicker.test.tsx) — джерело поведінкових прикладів. Для нового пошуку перевіряти race handling у конкретному сценарії.

## Діалоги та видалення

Sheet — для форм і складного контенту кабінету (див. «Форма в шторці»), FormDialog — для короткої модальної форми, ConfirmDialog — для підтвердження дії. Гарантії щодо pending різні: таблиця в [components](components.md). [AccountDeletion](../../src/components/account/account-deletion.tsx) є спільним власником видалення персонального акаунта; не реалізовувати його окремо для кожного екрана.

## Upload і багатокрокові процеси

FileField/PhotoFileField та UploadList представляють вибір і статуси файлів; вони не замінюють транспорт чи backend job. [ImportScreen](../../src/cabinet/imports/ImportScreen.tsx), [mapping](../../src/cabinet/imports/import-mapping.tsx), [confirmation](../../src/cabinet/imports/import-confirm.tsx) — поточна композиція імпорту. Кнопки входу до імпорту керуються tenant-прапором `parts.bulk-import` через спільний `FeatureGate`; історія лишається доступною за прямим URL. Ці файли та контракт джерела запчастин мають локальні зміни. Ліміти, retry і partial success перевіряти через UX-CONTRACT, API та вимоги; не виводити їх зі Stepper.

## Стани та відображення даних

Обирати окремо initial loading, порожній результат, заборону доступу та помилку запиту; не показувати EmptyState замість failure. SkeletonRows, ErrorState і DeniedState мають різне призначення. Amount/Quantity/DateValue містять форматування; звірити очікувану currency/unit і null semantics у props, не підміняти ними бізнес-розрахунки.
