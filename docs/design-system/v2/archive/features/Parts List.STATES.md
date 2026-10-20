# C1 · Запчастини — список · карта станів

Маршрут: `/app/:tenant/parts`. As-is: `src/cabinet/parts/PartsScreen.tsx`. Прототип: `Parts List.dc.html?state=<id>`. Усі стани поруч: `Board.dc.html?f=Parts%20List.dc.html`.

Колонка «Умова в коді» називає, звідки береться стан. Позначка **(звірити)** означає, що назви файлу або функції я взяв із назв модулів і ще не перевірив їх у коді.

| id | Стан | Умова в коді | Компоненти | Рядки (namespace · key) |
|---|---|---|---|---|
| `data` | Дані | список завантажено, `items.length > 0` | `.rz-toolbar`, `.rz-seg`, `.rz-filter`, `.rz-table`, `.rz-pager` | parts-list · `title`, `searchPlaceholder`, `filterStatus`, `statusInStock/Reserved/Sold`, `col*`, `total*`, `pageOf` |
| — | рядок заблоковано | деталь у відкритій інвентаризації | `input.rz-check:disabled` + `icon-lock` + `title` | parts-list · `inventoryLocked` |
| `peek` | Peek | клік по рядку; ≥1200px — колонка, нижче — шторка | `.rz-peek`, `.rz-kpis`, `.rz-facts`, `.rz-timeline` | part-detail · `stock`, `tileAvailable/Reserved/Sold`, `salePrice`, `perUnit`, `placement`, `compatibility`, `history`, `printSticker`, `addToOrder`, `addToOrderHint` |
| `selection` | Вибір | `selected.size > 0` → BulkBar замість тулбара | `.rz-bulk` | app · `bulkSelected`, `selectPage`, `clearSelection`; part-detail · `printSticker` |
| `loading` | Завантаження | запит у процесі | `.rz-skel` у рядках таблиці | app · `loadingData` (озвучення) |
| `empty` | Порожньо | `total === 0` і фільтрів немає | `.rz-state--brand` | parts-list · `emptyTitle`, `emptyDescription`, `addPart`, `importParts` |
| `filtered` | Нічого не знайдено | `items.length === 0` при активних фільтрах | `.rz-state` | parts-list · `emptyFilteredTitle`, `emptyFilteredDescription`, `resetFilters` |
| `network` | Немає мережі | помилка API з категорією `network` (`src/api/errors.ts`, звірити) | `.rz-state--danger`, `.rz-state__meta` | parts-list · `networkTitle`, `networkDescription`; common · `retry`; app · `correlation` |
| `server` | Помилка сервера | помилка 5xx або `unknown` | `.rz-state--danger` | parts-list · `serverTitle`, `serverDescription` |
| `denied` | Немає прав | немає `parts.view` → `evaluateModuleAccess(...).kind !== 'allowed'` (`policy.ts`) | `.rz-state` замість модуля | access · `deniedTitle`, `deniedBody`, `toDashboard` |
| `quota` | Ліміт | `quotaResource: 'parts'` вичерпано | `.rz-notice--warn`, `.rz-btn--primary:disabled` + `title` | parts-list · `accessQuota`; access · `quotaBody`, `comparePlans` |
| `readonly` | Лише перегляд | стан підписки не дозволяє зміни (`allowedSubscriptionStates`) | `.rz-banner--warn`, усі дії `disabled` | access · `state.blocked.*`, `toSubscription`; parts-list · `accessSubscription` |
| `origin` | Скинутий фільтр | у URL прийшов знятий фільтр «Вільні запчастини» | `.rz-notice--info` | parts-list · `removedOrigin` |
| `noflag` | Без імпорту | `useFeatureFlag('parts.bulk-import') === false` | кнопки «Імпорт запчастин» немає | — |
| `mobile` | Mobile | ширина <768px | `.rz-tabbar`, картки `.rz-stack` › `.rz-card` | ті самі + shell · `nav.more` |

## Поведінка
- Фільтри застосовуються одразу, кнопки «Застосувати» немає. Після помилки фільтри зберігаються.
- Ліміт і підписка: дія видна, але вимкнена, а причину пояснює текст. Без права перегляду модуль замінюється екраном «Недостатньо прав».
- Peek: Esc закриває, ↑/↓ переходять до сусіднього запису, «Відкрити на всю сторінку» веде на `/parts/:partId`.
- Права, тарифні фічі, підписка й фіче-флаг — чотири окремі перевірки. Сервер перевіряє все повторно.
