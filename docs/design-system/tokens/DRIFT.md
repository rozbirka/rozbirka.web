# DRIFT — розбіжності між темою і кодом

Джерело: `rozbirka.web@main` 5d46b1f. Пошук по коду обмежений за часом, тож список може бути неповним. Рядки вказано станом на цей коміт.

## A. Посилання на неіснуючі токени (рендеряться без стилю)

| Клас | Де | Наслідок |
|---|---|---|
| `bg-brand-soft` | `cabinet/customers/CustomersScreen.tsx:919`, `cabinet/inventory/InventoryScreen.tsx:2831` | `--color-brand-soft` не визначено в `@theme`, фон прозорий |
| `bg-app-inset` | `cabinet/orders/delivery/DeliveryStepDrawer.tsx:106` | `--color-app-inset` не визначено, фон прозорий |

## B. Значення, які мали б бути токенами

| Значення | Частота | Де | Коментар |
|---|---|---|---|
| `rounded-[20px]` (картка) | ~90 | `card.tsx:30` + майже всі секції екранів | Тема має `panel 12`, `sheet 16`, `card 32` (лендинг). Найчастіший радіус кабінету не є токеном |
| `rounded-[18px]` | ~30 | `imports/*`, `CommandPalette`, частина `cars/inventory/intakes` | Та сама роль картки, що й 20px |
| `rounded-[14px]` | ~40 | вкладені блоки, popover, PillGroup, групи вкладок | |
| `rounded-[9px]`/`[10px]`/`[11px]`/`[12px]` | багато | вкладки, поля, рядки вибору | 9 і 11 не збігаються з `control 10` / `panel 12` |
| `text-white` | всюди в заголовках | `card`, `page-header`, `panel`, `section-panel`, `spec-grid` | Поруч з `app-ink #f6f4f2`: два «білих» |
| `bg-white/[0.025…0.09]` | всюди | button, segmented, menu, skeleton | Шкала заливок при взаємодії існує лише як literal |
| `shadow-2xl` / `shadow-lg` | 10+ | оверлеї | Токенів тіней немає |
| Font sizes `10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 16, 17, 18, 19, 22, 25, 26, 34, 46` | всюди | — | Шкали немає; 13 і 13.5 використовуються для однієї ролі (вкладки) |

## C. Кольори поза темою

| Значення | Де | Коментар |
|---|---|---|
| `text-neutral-400/500` | `cabinet/CabinetNavigation.tsx:301,317,333,365` | У кабінеті мали б бути `app-muted/dim`. Тести billing/business явно перевіряють відсутність `text-neutral-*` — навігація це правило порушує |
| `text-neutral-300/400/500` | `site/*` (features, hero, language-switcher, footer) | Лендинг використовує нейтральні Tailwind-кольори замість токенів |
| `#3b6fd4`, `#1c1c1e`, `#e9e7e4` … (13 кольорів × 3 мови) | `cabinet/cars/CarsScreen.tsx:554–582` | Свотчі кольору авто, ключі мапи — локалізовані назви кольорів. Це дані, не тема |
| `#fff`, `#000`, `#666` | `cabinet/inventory/zone-label-output.ts:63,69` | CSS друку етикеток (поза UI), допустимо |
| `#34A853` … | `site/store-badges.tsx` | Логотип Google Play, допустимо |
| `.cabinet-rail-tooltip` → `--color-surface-2` + `rgb(255 255 255/0.1)` | `src/index.css` | У кабінеті використано токен лендингу і рамку, якої немає в `app-line/line-2` |
| `hover:border-white/20` | `InventoryScreen.tsx:607` | Поза `app-line-2 (0.13)` |
| `bg-state-warn/[0.07]`, `bg-state-danger/10`, `border-state-warn/26`, `/25`, `/35`, `/20` | `PartsScreen:1576`, `cash-card:189`, `imports/*` | Кожен екран обирає власну прозорість замість `*-soft (0.13)` |

## D. Поведінка

| Що | Де | Коментар |
|---|---|---|
| `focus-visible:ring-2 ring-white/40` | `DashboardScreen:329`, `OnboardingChecklist:502,575`, `OrderPaymentDrawer:328`, `PaymentDrawer:268` | Глобальний focus — outline brand 2px. Тут фокус білий |
| Групи вкладок зібрані вручну | `payments-screen:337`, `plans-screen:217`, `cash-list:151`, `import-history:291`, `import-review:227`, `DashboardScreen:306`, `PartsScreen:2117` | Не використовують `Segmented`/`PillGroup`, і геометрія щоразу інша (контейнер 11/12/14, вкладки 8/9/10, висота 34/36/44) |
| Три радіуси оверлеїв | CommandPalette 18, ActionMenu `sheet 16`, popovers 14 | |
| Body bg | `--background oklch(0.145 0 0)` (shadcn) vs `--color-app-canvas #0b0b0b` | Body фарбує shadcn-шар, кабінет — app-canvas. Візуально майже однакові, але це різні токени |

## Як це враховано в пакеті

- `tokens.css` Layer 1 — точні назви та значення з `index.css`.
- Найчастіші хардкоди позначено як `x-status: observed` і винесено в семантичні аліаси `--rz-*`, щоб прототипи виглядали як реальний застосунок.
- Варіанти з розділів A і C в аліаси не потрапили. Агентам заборонено їх відтворювати (див. CLAUDE.md, етап 8).
