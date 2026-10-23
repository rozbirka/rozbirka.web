# Web platform behavior

## Responsive

[DataTable](../../src/components/app/data-table.tsx) і [CSS](../../src/index.css) перебудовують таблицю в картки нижче 768px зі спільним DOM та явними ARIA roles. Не створювати другу приховану копію даних для мобільного viewport без потреби.

Кабінет має `.cabinet-shell__content` із `env(safe-area-inset-bottom)` у padding. У `index.html` немає `viewport-fit=cover`, тому на iOS цей inset, найімовірніше, дорівнює 0 — фактичний відступ перевіряти на пристрої, а не виводити з CSS; [CabinetNavigation](../../src/cabinet/CabinetNavigation.tsx) та [RedesignShell](../../src/cabinet/redesign-shell.tsx) задають власне компонування. Маркетинговий [SiteHeader](../../src/components/site/header.tsx) перемикає навігацію через responsive classes. Один breakpoint не є універсальним правилом для всіх компонентів.

Висоти контролів — з токенів v2: 28/32px на desktop, 44px на `pointer: coarse`, 56px (`glove`) для складу й сканера. Під час зміни щільності таблиці або toolbar перевіряти реальний tap target, довгі українські назви й overflow; не зменшувати controls лише для красивого скриншота.

Хрестик Sheet — `.rz-btn--icon` (28/32px) із розширеною псевдоелементом областю натискання. Її перевіряємо browser hit-testing і кліком поза видимою рамкою: `boundingBox()` не включає псевдоелемент.

## Keyboard і focus

Field/input context зв’язує label, hint та error. Radix у FormDialog/Sheet/ConfirmDialog відповідає за dialog primitives; перевіряти focus entry/return і keyboard actions у конкретній композиції. Закриття під час pending залежить від компонента і caller.

Глобальний `:focus-visible` та reduced-motion rules живуть у index.css. Зберігати видимий focus; іконковій дії потрібне ім’я. У [SiteHeader](../../src/components/site/header.tsx) є Escape і повернення focus до menu trigger; це не доказ повного focus trap для будь-якого menu.

## Навігація, сесія та SSR

[Routes](../../src/routes/routes.tsx), [AuthContext](../../src/auth/AuthContext.tsx) та [guards](../../src/auth/guards.tsx) задають навігацію й client gates. [Module registry](../../src/cabinet/module-registry.ts) — джерело складу модулів кабінету. Client visibility не замінює backend authorization.

[Main entry](../../src/main.tsx) розрізняє hydrateRoot і createRoot; [server entry](../../src/entry-server.tsx) бере участь у prerender. Новий route перевіряти разом із SEO/prerender правилами з AGENTS.md, а не лише через client navigation.

## Повідомлення про помилки

У поточній робочій гілці [normalizeApiProblem](../../src/api/errors.ts) локалізує помилки за стабільним кодом через [каталог](../../src/api/error-messages.ts) мовою інтерфейсу (`uk`, `en-GB`, `pl`). Каталог покриває 93 спільні константи Core, помилки входу й стандартні повідомлення валідації. Невідомий текст сервера замінюється локалізованим повідомленням за типом збою; початкова відповідь залишається в `cause`, коди, HTTP-статус і `retryAfterSeconds` зберігаються для логіки відновлення. Невідомі повідомлення полів отримують загальну підказку перевірити введені дані, прив’язку до поля збережено. Нові конкретні серверні помилки треба додавати до всіх трьох мов каталогу, щоб зберігати точну причину. Не показувати необроблений `error.message` або `response.error.message`; конфлікт номера клієнта, стандартний `useOperation` і помилки завдань звітів також проходять спільну локалізацію.

## Межі перевірки

Ці документи описують web, включно з вузькими viewport, а не native mobile. Наявність CSS/ARIA не засвідчує WCAG conformance чи проходження браузерних тестів. Потрібні фактичні перевірки за [verification](verification.md).
