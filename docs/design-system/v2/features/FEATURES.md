# FEATURES — екрани Rozbirka v2

Кожен екран — одна фіча з усіма її станами.
- Відкрити конкретний стан: `<файл>?state=<id>`.
- Подивитися всі стани фічі на одній сторінці: `Board.dc.html?f=<файл>`.
- Список фіч і станів лежить у `manifest.json`.

Фічі зібрані трьома способами:
- **Власні файли** для двох найскладніших екранів: `Parts List.dc.html`, `Part Detail.dc.html`.
- **`List.dc.html?screen=<id>`** — типовий список. Зміст бере з `screens/<id>.json`; стани: дані, завантаження, порожньо, нічого не знайдено, помилка, немає прав, лише перегляд.
- **`Record.dc.html?screen=<id>`** — картка, налаштування, форма або вхід. Блоки, стани, банери й заміни для окремих станів описані в `screens/<id>.json`.

Щоб додати екран, достатньо нового JSON у `screens/` і рядка в `manifest.json`. Нова розмітка не потрібна.

## Покриття маршрутів (`src/routes/routes.tsx`)
| Маршрут | Фіча | Файл |
|---|---|---|
| `/app/:t/dashboard` | C7 Головна | Record?screen=dashboard |
| `/app/:t/parts` | C1 Запчастини | Parts List |
| `/app/:t/parts/:id` | C2 Деталь | Part Detail |
| `/app/:t/parts/new`, `/:id/edit` | C3 Форма деталі | Record?screen=partform |
| `/app/:t/parts/imports` | C14 Імпорт | List?screen=imports |
| `/app/:t/orders` | C4 Замовлення | List?screen=orders |
| `/app/:t/orders/:id` | C5 Замовлення | Record?screen=order |
| `/app/:t/inventory/*` | C6 Інвентаризація | List?screen=inventory + components/Scanner |
| `/app/:t/scan` | Сканер | components/Scanner |
| `/app/:t/customers` | C8 Клієнти | List?screen=customers |
| `/app/:t/cars` | C10 Автомобілі | List?screen=cars |
| `/app/:t/intakes` | C11 Приймання | List?screen=intakes |
| `/app/:t/cash` | C12 Каси | List?screen=cash |
| `/app/:t/team` | C13 Команда | List?screen=team |
| `/app/:t/settings/billing/*` | C15 Підписка | Record?screen=subscription |
| `/app/:t/settings/business` | C16 Бізнес | Record?screen=business |
| `/app/:t/settings/profile` | C17 Профіль | Record?screen=profile |
| `/app/:t/reports` | C18 Звіти | Record?screen=reports |
| `/app/:t/settings/integrations[/:id]` | C19 Інтеграції | Record?screen=integrations |
| `/login` | C20 Вхід | Record?screen=login |
| `/invite/:code` | C21 Запрошення | Record?screen=invite |
| `/app/:t/stickers` | C9 Друк | components/Print |
| `*` (404), тариф, доступ | спільні | components/States |

## Додані екрани
| Маршрут | Фіча | Файл |
|---|---|---|
| `cars/:carId` | C22 Автомобіль | Record?screen=car |
| `cars/new`, `/:id/edit` | C23 Форма авто | Record?screen=carform |
| `customers/:id` | C24 Клієнт | Record?screen=customer |
| `customers/new`, `/:id/edit` | C25 Форма клієнта | Record?screen=customerform |
| `intakes/:id`, `/parts/batch` | C26 Приймання | Record?screen=intake |
| `parts/imports/:id` | C27 Кроки імпорту | Record?screen=importflow |
| `inventory/sessions/:id/*` | C28 Сесія інвентаризації | Record?screen=session |
| `settings/integrations/:id/*` | C29 Нова пошта | Record?screen=novaposhta |
| `settings/billing/plans` | C30 Тарифи | Record?screen=plans |
| `settings/billing/payments` | C31 Платежі | Record?screen=payments |
| онбординг розбірки | C32 | Record?screen=onboarding |
| `/account`, `/account/security` | C33 | Record?screen=account |
| `/privacy` | C34 | Record?screen=privacy |

Тепер усі маршрути з `routes.tsx` мають екран.

## Що не звірено з кодом
У кожному `screens/*.json` поле `unverified` перелічує рядки, яких я не знайшов пошуком по коду (назви колонок, emptyBody, частина дій). Такі рядки — заглушки, і агенти не мають копіювати їх як остаточні. Найбільше незвіреного в `orders`, `partform`, `login`, `invite` і `reports`: їхні файли повідомлень я не прочитав повністю.
