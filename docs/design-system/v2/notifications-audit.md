# Сповіщення: розбіжності коду з правилом

Правило — модуль 00, розділ 5 (`00 Вхід і старт.dc.html?s=5`).
Гілка: `codex/separate-warehouses-inventory`.

## Успіх показано як Notice, має бути тост ok
- `business/business-settings-screen.tsx:280` — «Налаштування бізнесу збережено.»
- `business/region-settings.tsx:493` — «Регіон і мову документів збережено.»
- `business/accounting-currency-section.tsx:191` — «Валюту обліку збережено.»
- `integrations/delivery-preferences-panel.tsx:149` — «Налаштування збережено.»
- `customers/CustomersScreen.tsx:768` — «Телефон скопійовано» (у `webhook-panel.tsx:217` те саме — тост)
- `cars/CarsScreen.tsx:936` — статус копіювання
- `inventory/placement-messages.ts` `saved` — «Розміщення збережено»

## Залишити Notice (стан, що діє далі, або інструкція)
- `integrations/webhook-panel.tsx:264` — «Черга чиста» (стан)
- `onboarding/first-part-completion.tsx:23` — крок онбордингу
- `cars/CarsScreen.tsx:1875` — перевірити: якщо це результат дії — тост

## Доповнити ToastProvider
- `duration` для тоста з «Скасувати» — 10 000 мс.
- `tone: 'danger'` з дією «Повторити» — `duration: 0` (до закриття).
- Іконка danger: `AlertTriangle` — у дизайні `icon-triangle-alert` (узгоджено).

# Фокус полів (той самий файл — для розробників)
- Глобальне `:focus-visible` кільце малюється на `<input>` всередині складених полів (пошук з іконкою, input-group, stepper) — виходить друга рамка всередині. Виправлення: внутрішній контрол `box-shadow:none; outline:none`, фокус показує обгортка через `:focus-within`. Див. v2/kit.css.
