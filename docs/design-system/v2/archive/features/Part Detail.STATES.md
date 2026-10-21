# C2 · Деталь — картка · карта станів

Маршрут: `/app/:tenant/parts/:partId`. As-is: `PartsScreen.tsx` (деталь), рядки — `part-detail-messages.ts`. Прототип: `Part Detail.dc.html?state=<id>`.

| id | Стан | Умова в коді | Компоненти | Рядки (part-detail · key) |
|---|---|---|---|---|
| `data` | Дані | деталь завантажено | Card ×7, `.rz-kpis`, `.rz-facts`, `.rz-table`, `.rz-timeline`, `.rz-code` | `photos`, `photosCount`, `salePrice`, `perUnit`, `freeStockWorth`, `moreReserved`, `stock`, `tile*`, `placement`, `sales`, `salesTabs`, `col*`, `compatibility`, `donorReadonly`, `notes`, `history`, `showAll` |
| `loading` | Завантаження | запит деталі | `.rz-skel` | `loading` |
| `error` | Помилка | запит упав | `.rz-state--danger` | `loadErrorTitle`, `loadErrorDescription`, `backToWarehouse` |
| `noprice` | Без ціни | `salePrice == null` | `.rz-notice--warn` + primary «Вказати ціну» | `noPriceTitle`, `noPriceBody`, `setPrice` |
| `nophotos` | Без фото | `photos.length === 0` | текст | `galleryEmpty` |
| `allsold` | Усе продано | `available = reserved = 0` | KPI + footer | `allSold`, `noneFree` |
| `allreserved` | Усе в резерві | `available = 0, reserved > 0` | KPI + footer | `allReserved`, `noneFreeReserved` |
| `locked` | В інвентаризації | деталь у відкритій сесії | `.rz-notice--info` | parts-list · `inventoryLocked` |
| `notplaced` | Не розміщена | місця немає | dot | `notPlaced`, `notInStock` |
| `nomodule` | Без складського модуля | тарифна фіча складу вимкнена | dot, без «Перемістити» | `placementNeedsModule` |
| `confirm` | Видалення | меню «…» → «Видалити деталь» | `.rz-confirm`, фокус на «Скасувати» | `deleteTitle`, `deleteConsequence`, `deletePart` |
| `conflict` | Конфлікт | сервер відхилив (деталь у замовленні) | `.rz-notice--danger` у діалозі | `deleteConflict` / `deleteFailed` |
| `readonly` | Лише перегляд | підписка не дозволяє зміни | `.rz-banner--warn`, усі дії disabled | access · `state.blocked.*` |

«Додати в замовлення» вимкнено завжди, з причиною `addToOrderHint`. Так зараз працює код.
