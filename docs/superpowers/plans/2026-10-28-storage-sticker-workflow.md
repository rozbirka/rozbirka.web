# Уніфікація друку стікерів місць зберігання — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Цей документ — план для погодження; реалізацію користувач ще не замовляв.

**Goal:** Перенести друк зон, секцій і полиць у режим «Місця зберігання» розділу «Стікери» та додати незалежну чергу за поведінкою мобільного застосунку.

**Architecture:** Зберегти `/app/:tenant/stickers` і чинний сценарій запчастин; режим місць зберігання визначати URL-параметрами. Використати наявні inventory API, `StickerWorkspace`, `DataTable`, генератор `buildZoneLabelHtml` і розвинути наявне ядро location-черги. Черга локальна, одна на користувача й бізнес, окрема від запчастин; браузерний друк просуває її тільки після явного підтвердження користувача.

**Tech Stack:** React 19, React Router 7, TypeScript 6, наявний app UI kit, localStorage, Vitest/Testing Library, Playwright. Без нових залежностей і змін API.

**Spec:** Погоджене користувачем охоплення та запропоновані деталі описані в розділах «Вимоги» й «Сценарій для вебу» цього документа. Джерело — ця розмова й перелічений нижче локальний код, перевірений 2026-10-28. Документ ще не є погодженим дизайном.

## Global Constraints

- «Запчастини ми лишаємо так як є»: не змінювати їхній вибір, кількість копій, збереження, генерацію, QR, друк, download/share чи права.
- «Тільки стікери зони, також тільки секції і також тільки полиці»: склад передає свої зони; зона — свої секції; секція — свої полиці. Дочірні рівні не додаються рекурсивно.
- «Конкретних секцій та полиць»: колекція обмежена конкретним батьком, а користувач може змінити набір перед створенням черги.
- Меню «⋯» має бути у верхніх діях відповідного екрана; на складі — поряд із «Редагувати». Друку всередині списків складів більше немає.
- Режими «Запчастини» / «Місця зберігання» знаходяться в розділі «Стікери».
- У черзі місць — максимум 200 невиконаних позицій, партія до 20; один об'єкт дає один стікер. Ці значення взяті з мобільного location-сценарію.
- Стан належить `{userId, tenantId}`; не переносити його між користувачами/бізнесами. Вихід і штатна зміна бізнесу очищають чергу через наявний lifecycle.
- Зберігати формат location-стікера 40×58 мм, сирий QR місця, поточні поля й мову документів бізнесу. Переробка друкованого макета не входить у цю задачу.
- Використати Node 22 і npm 11.16+ та наявні команди репозиторію. Для ручного локального запуску спочатку прочитати `LOCAL-DEVELOPMENT.md` і використовувати `npm run dev:local`.
- У checkout вже багато сторонніх локальних змін. Не скидати, не форматувати весь репозиторій і не включати ці зміни у власний коміт. Цей етап додає тільки план.

## Review Focus

1. Користувач з `inventory.view` без `parts.view` повинен потрапляти до місць зберігання; перенесення не створює нової вимоги `stickers.manage` для місць. Покриття: задачі 1, 6.
2. Повторний перехід, Back/Forward і refetch не повинні знову виділяти вже зняті позиції; явний новий перехід «вибрати всі» виконується один раз. Покриття: задачі 3, 5, 6.
3. Пізні відповіді API, повторне підтвердження, інша вкладка, скасована/нова черга й зміна бізнесу не можуть просунути чужий або змінений batch. Покриття: задачі 2, 4, 6.
4. Архівований/видалений об'єкт або порожній QR не мають непомітно зменшити друковану партію чи лічильник. Покриття: задачі 3, 4, 6.
5. Блокування popup, скасований друк, збережений PDF, частковий друк і недоступне localStorage не мають давати неправдивий прогрес або обіцянку збереження. Покриття: задачі 2, 4, 6.

---

## Перевірені джерела й поточний стан

Досліджено робочі файли, не deployed-версію:

- Web HEAD: `b0bf3d299a99705858c68e015479cfc925334451` + наявні локальні зміни.
- Mobile HEAD: `7081b75d364600c3856dce974ef4f8b6d853626f` + локальні зміни поза дослідженим location printing.
- Mobile: `../rozbirka.mobile/app/warehouses/labels.tsx` — вибір, створення/додавання, відновлення іншої колекції, batch, часткове підтвердження, скасування.
- Mobile: `../rozbirka.mobile/src/stores/locationPrintQueueCore.ts` і `.test.mjs` — одна колекція `{kind, parentId}`, окремий namespace, актуальні QR, захист старої print-сесії.
- Mobile: `../rozbirka.mobile/src/stores/printQueueSchema.ts`, `printQueueStoreCore.ts`, `printQueuePersistence.ts` — 200 залишкових ID, TTL 24 години від `updatedAt`, dedup, додавання, вилучення, hydration/cleanup.
- Mobile: `../rozbirka.mobile/src/components/printing/{PrintQueueCard,LocationQueueEditor,LocationLabelOutput}.tsx` і `src/printing/locationLabelBatch.ts` — UI, PDF без підтвердження, ручне підтвердження для звичайного друку, поштучні acknowledgements Bluetooth.
- Web: `src/cabinet/stickers/{StickersScreen,StickerWorkspace,StickerSheetPreview}.tsx` — чинний сценарій деталей і повторно використовувана оболонка.
- Web: `src/cabinet/inventory/LocationLabelPrinter.tsx` — зараз друкує напряму; при вході видаляє стару чергу, тому повернення функцій черги потребує зміни lifecycle.
- Web: `src/cabinet/inventory/{location-label-queue,location-label-data,zone-label-output}.ts` та тести — ядро черги, direct-child API selection і незмінюваний друкований макет.
- Web: `src/cabinet/warehouses/{WarehousesScreen,WarehouseZoneBrowser}.tsx`, `src/cabinet/inventory/LocationBrowser.tsx` — точки входу й вбудований print workspace.
- Web: `src/cabinet/{module-registry,ModuleBoundary,CabinetNavigation,use-latest-mutation-guard,tenant-reset-registry}` — права, lifecycle й навігація.

### Як саме працює мобільна черга

| Поведінка | Факт у мобайлі | Перенесення на веб |
| --- | --- | --- |
| Окремість | Черга місць має власний namespace, незалежний від деталей | Зберегти незалежність, не переробляти чергу деталей |
| Колекція | Один тип і один батько; змішане додавання відхиляється | Така сама межа; інша колекція пропонує продовжити/скасувати поточну |
| Створення | Явна дія з поточного вибору, без негайного друку | Так само; автоматичне виділення після переходу ще не створює чергу |
| Початковий вибір | На мобільному location-екрані порожній | Відмінність за вимогою користувача: перехід із складів виділяє потрібну колекцію |
| Додавання | Нові ID тієї самої колекції дописуються; дублікати залишкових ID ігноруються | Так само; уже додані рядки позначаються «У черзі» |
| Ліміти | До 200 залишкових ID; партія 20 | Так само; `totalCount` може перевищити 200 після друку й наступних додавань |
| Прогрес | `totalCount - remainingIds.length` | У вебядрі можна зберегти явний `printedCount`, підтримуючи цей інваріант |
| Вилучення | Зменшує залишок і total, не збільшує надруковане | Так само; прибрані позиції не є виконаними |
| Друк | Наступні ID в порядку черги; звичайний друк запитує «Ні / Частково / Так» | Лише явне підтвердження batch; браузер не дає поштучного підтвердження принтера |
| Bluetooth | Підтверджені принтером позиції прибираються поштучно | Не переносити Bluetooth/NIIMBOT у межах цього плану |
| PDF | Файл не є доказом друку й не просуває чергу | Поточне браузерне «Зберегти як PDF», без зміни черги |
| Відновлення | SecureStore, owner envelope, 24 години після останнього збереження | localStorage з owner envelope й таким самим TTL; без синхронізації з мобайлом |
| Завершення | Після останнього підтвердженого/видаленого ID активна черга зникає | Повідомлення розрізняє завершення друку та спорожнення через видалення |

## Вимоги й межі

### Вже визначено користувачем

1. Запчастини залишити в поточному вигляді та поведінці.
2. Перемістити меню дій у верх екранів місць зберігання.
3. Прибрати вбудований друк із складів; направляти у «Стікери».
4. Додати перемикання двох режимів у «Стікерах».
5. Передавати тільки один рівень конкретного батька та початково виділяти його об'єкти.
6. Додати location-чергу за зразком мобільної.

### Запропоновані деталі плану

- Одна активна location-черга, як у мобайлі; без змішування складів/зон/секцій.
- Звичайний вхід у «Місця зберігання» без параметрів відновлює контекст активної черги; без черги пропонує вибрати колекцію.
- Для ручного вибору: тип «Зони / Секції / Полиці» і послідовні селектори «Склад → Зона → Секція» тільки до потрібного батька. Зміна вищого рівня скидає нижчі. Власних стікерів складу не додаємо.
- Перевищення 200 у початковому виділенні не обрізається мовчки: показати кількість і причину недоступності створення черги; дозволити зменшити вибір.
- Вебдрук має явну панель підтвердження з можливістю відкласти його. Факт `afterprint` або закриття вікна сам не змінює чергу.
- Файловий експорт лишається браузерним PDF, а не новим генератором PDF.
- Друковані шаблони не уніфікуємо із запчастинами в цьому scope.

### Розглянуті підходи

1. **Залишити друк у складах і додати чергу там.** Менше перенесень, але суперечить запитаному єдиному розділу друку; відкинуто.
2. **Розділ «Стікери» з двома незалежними режимами та location-чергою.** Відповідає обраному користувачем напряму, дозволяє не змінювати сценарій деталей; основа цього плану.
3. **Одна універсальна змішана черга деталей і місць.** Потребує зміни деталей і правил змішування; не входить у погоджений scope.

## Сценарій для вебу

### Вхід і маршрути

Канонічний маршрут залишається `/app/:tenant/stickers`:

| Звідки | Перехід | Результат |
| --- | --- | --- |
| Склад, верхнє «⋯» → «Друк стікерів зон» | `?type=locations&kind=zone&parent=<warehouseId>&select=all` | Тільки активні звичайні зони цього складу |
| Зона, верхнє «⋯» → «Друк стікерів секцій» | `?type=locations&kind=section&parent=<zoneId>&select=all` | Тільки активні секції цієї зони |
| Секція, верхнє «⋯» → «Друк стікерів полиць» | `?type=locations&kind=shelf&parent=<sectionId>&select=all` | Тільки активні полиці цієї секції |
| Старе посилання складів `?labels=1&label=...` | Redirect/replace у відповідний canonical target | Передані `label` стають явним subset; без них — усі |
| Чинне посилання деталей `?part=...` | Без зміни URL-семантики | Режим запчастин, чинне додавання |

Назви батька/шлях отримувати через API, не довіряти URL. `kind` приймає лише `zone|section|shelf`. Відсутній/невідомий батько дає зрозумілий стан вибору/помилки, не запит усіх об'єктів бізнесу. Зіставляти реальні parent IDs; не завантажувати всіх нащадків.

`select=all` застосовується один раз після першого успішного завантаження відповідної колекції. Після застосування seed-параметри прибираються через replace; refetch, pagination і пошук не перевиділяють список. Для нового явного переходу з джерела створюється новий seed; ідентичність компонента не має залежати від прибирання seed-параметрів. Звичайне ручне перемикання колекції не виконує автоматичне «вибрати всі».

### Компонування

- Верхня панель «Стікери», перемикач «Запчастини / Місця зберігання», поточний контекст і дія повернення до джерела.
- Location-режим: контекст типу/батька; картка активної черги з прогресом і діями; пошук, вибір, таблиця та pagination; поруч на desktop — існуюче прев'ю стікерів. На вузькому екрані блоки йдуть послідовно без горизонтального overflow.
- Таблиця: checkbox, назва, код; шлях батька в контексті/метаданих. Використати `DataTable` з `selectOnRowClick: 'always'`, доступні labels і клавіатуру. У черзі — badge й недоступний checkbox із поясненням.
- До черги: «Створити чергу · N» і «Зберегти PDF · N»; PDF не створює/не змінює чергу. Після створення поточний вибір очищується.
- У своїй колекції з чергою: «Додати до черги · N» для нових позицій. При іншій колекції — її поточний вибір можна переглядати, але створення/append заблоковано; картка дає «Продовжити чергу» або «Скасувати чергу».
- Черга: назва типу й батька, надруковано/всього/залишилось, «Друк наступних N», «PDF наступних N», «Змінити чергу», «Скасувати чергу».
- «Змінити чергу» — наявний `Sheet`, пошук і вибір залишкових позицій, включно з недоступними; їх можна прибрати без зарахування як надрукованих.
- Підтвердження batch: «Усі надруковано», «Частково», «Нічого не надруковано». «Частково» відкриває вибір тільки ID цього batch; підтверджуються саме вибрані ID, навіть несуцільний набір.

Це текстовий опис UI, не готовий візуальний макет.

### Межі стану й друку

- Вибір і черга різні: виділення всіх після переходу не запускає друк/створення. Одна копія на місце; вже чергові ID не додаються повторно, але підтверджений раніше об'єкт можна знову поставити на повторний друк, як у мобайлі.
- При batch — повторно завантажити актуальну колекцію/батька, зібрати точно перші `min(20, remaining)` ID у порядку черги. Не підставляти інші ID при зникненні одного з них.
- Якщо поточний batch містить недоступне місце, показати проблему й «Змінити чергу»; жодного часткового друку або автоматичного списання.
- Popup відкрити синхронно на клік до await; при помилці/скасуванні scope закрити порожнє вікно. Використати `buildZoneLabelHtml` і чинний документний locale.
- «Друк» зберігає незмінний snapshot `{queueId, target, batchIds, scope generation, revision}`. Жодного списання до явного підтвердження. PDF, popup-blocked, помилка API/QR, print cancel й закриття сторінки залишають batch у черзі.
- `afterprint`/повернення фокуса може лише показати запит підтвердження; залишити ручну дію «Підтвердити результат», якщо подія не прийшла. PDF-шлях не створює запит підтвердження.
- Редагування/скасування/зовнішня зміна черги, tenant transition і вихід інвалідовують старий snapshot. Повторне підтвердження спожитого snapshot — no-op. Під час підготовки batch заблокувати повторні output/mutation дії.
- TTL 24 години після останньої успішної зміни черги; простий перегляд/refetch TTL не продовжує. Старі/пошкоджені/чужі дані не відновлюються. При недоступному storage черга може працювати в пам'яті з явним повідомленням, що відновлення після закриття не гарантоване.
- Один storage event іншої вкладки інвалідовує локальні output/confirmation сесії та перечитує актуальну чергу. Це захист стану, не гарантія неможливості двох фізичних друків із різних вкладок.

## План реалізації

### Task 1: Режими, URL і права доступу

**Files:** Create `src/cabinet/stickers/sticker-route.ts`, `sticker-route.test.ts`, `sticker-access.ts`, `sticker-access.test.ts`, `StickersModuleBoundary.tsx`; modify `src/routes/routes.tsx`, `src/cabinet/ModuleBoundary.tsx`, `src/cabinet/CabinetNavigation.tsx`; tests `src/routes/routes.test.tsx`, `src/cabinet/ModuleBoundary.test.tsx`, `src/cabinet/CabinetShell.test.tsx`.

**Interfaces:**

- `type StickerMode = 'parts' | 'locations'`.
- `type LocationCollection = { kind: 'zone' | 'section' | 'shelf'; parentId: string }`.
- `parseStickerRoute(params: URLSearchParams): { mode: StickerMode; collection: LocationCollection | null; selectAll: boolean; selectedIds: string[]; invalid: boolean }` — валідує параметри, не змінює чинне трактування `part`.
- `locationStickersHref(tenantSlug: string, collection: LocationCollection, selection: 'all' | readonly string[]): string` — єдиний builder переходів.
- `stickerAccessDefinition(mode: StickerMode): CabinetModuleDefinition` — parts повертає чинне визначення; locations зберігає key/route/nav «stickers», але використовує `inventory.view` для view/output, без parts quota; чинні subscription constraints зберігаються.
- `ModuleBoundaryProps.definition?: CabinetModuleDefinition` — необов'язкове визначення з довіреного коду; решта модулів незмінна. `StickersModuleBoundary` обирає визначення за валідованим режимом до перевірки доступу.

- [ ] Тести: parts links незмінні; три точні target-переходи; invalid/duplicate/conflicting params дають визначений invalid-стан; query не приймає permission із URL. Для явного `type=locations` location-параметри мають пріоритет, `part` до location-черги не потрапляє.
- [ ] Тести матриці доступу: parts-only, inventory-only, обидва, жодного, blocked subscription, loading/error. Для inventory-only звичайний вхід у «Стікери» веде в locations; недоступний режим не запускає API запитів.
- [ ] Запустити нові тести до реалізації й переконатися, що вони падають через відсутню поведінку.
- [ ] Реалізувати route builder/parser, boundary й sidebar: пункт «Стікери» видимий при доступності хоча б одного режиму; default link для inventory-only має `type=locations`. Перемикач не дає отримати ширші права.
- [ ] Перевірити всі інші споживачі навігації/пошуку команд через `rg`; якщо вони будують «Стікери» окремо, застосувати ту саму mode-access функцію, не послаблювати загальну `evaluateModuleAccess`.
- [ ] Запустити `npx vitest run src/cabinet/stickers/sticker-route.test.ts src/cabinet/stickers/sticker-access.test.ts src/routes/routes.test.tsx src/cabinet/ModuleBoundary.test.tsx src/cabinet/CabinetShell.test.tsx`; очікується PASS. Окремий локальний коміт тільки файлів задачі після перевірки diff.

### Task 2: Ядро location-черги та persistence

**Files:** Modify `src/cabinet/inventory/location-label-queue.ts`, `.test.ts`; create `src/cabinet/stickers/location-queue-store.ts`, `.test.ts`, `use-location-print-queue.ts`, `.test.tsx`.

**Interfaces:** Залишити `LocationLabelTarget` як collection + завантажена `parentName`; використати наявні `LocationLabelQueue`, `createLabelQueue`, `acknowledgeLabels`, `nextLabelBatch`. Додати `appendLabelQueue(queue, target, ids, now): QueueMutationResult`, `removeQueueLabels(queue, ids, now): LocationLabelQueue | null`, `type QueueMutationResult = { ok: true; queue: LocationLabelQueue; addedCount: number } | { ok: false; reason: 'empty' | 'limit' | 'target-mismatch' | 'active-queue' | 'invalid' }`. Для детермінованості приймати `now` у core-операціях; no-op не змінює TTL/revision. Store створюється через `createLocationQueueStore({ storage, now, uuid })`, надає snapshot/subscribe/hydrate/start/append/acknowledge/remove/discard/clear; `useLocationPrintQueue(scope)` підписується через React `useSyncExternalStore` і повертає цей snapshot та guarded operations. Store належить location-режиму, не додаємо Zustand.

- [ ] Тести: 201-й залишковий ID відхиляє весь append; dedup; стабільний порядок; інший target і повторний start не замінюють активну чергу; після підтвердження частини можна append при `totalCount > 200`, якщо залишок ≤200.
- [ ] Тести: `acknowledgeLabels(['a','c'])` з 20 ID прибирає лише їх; повторне підтвердження й unknown ID не змінюють прогрес; remove зменшує total без збільшення printed; останній ID очищає чергу.
- [ ] Тести persistence: новий ключ `rozbirka.location-labels.queue.v2:<encoded-user>:<encoded-tenant>` з явним owner envelope; reload; TTL від останньої mutation; malformed/expired/чужий envelope; storage errors; подія іншої вкладки; parts-key незмінний.
- [ ] Тести lifecycle: reset працює навіть після unmount location-екрана; пізня hydration не відновлює стан після logout/switch; старий batch не підтверджує нову/змінену чергу.
- [ ] Запустити ці тести й зафіксувати очікуваний FAIL; після цього розширити ядро, реалізувати store/hook, `revision` і перевірку expected queue/batch на mutation.
- [ ] Прибрати безумовне очищення черги при вході у location-екран. Старий v1 ключ видаляти тільки як legacy у hydration/cleanup; активний v2 ніколи не очищати через звичайний mount або перемикання режиму. `tenantResetRegistry` реєструється store-модулем незалежно від mounted hook.
- [ ] Повторити `npx vitest run src/cabinet/inventory/location-label-queue.test.ts src/cabinet/stickers/location-queue-store.test.ts src/cabinet/stickers/use-location-print-queue.test.tsx`; PASS. Перевірити diff й окремо закомітити.

### Task 3: Екран «Місця зберігання» й одноразовий вибір

**Files:** Move нинішню реалізацію `src/cabinet/stickers/StickersScreen.tsx` у `PartStickersScreen.tsx` без змін бізнес-логіки; create новий wrapper `StickersScreen.tsx`, `StickerModeSwitch.tsx`, `LocationStickersScreen.tsx`, `LocationCollectionPicker.tsx`, `location-stickers-messages.ts`, `LocationStickersScreen.test.tsx`; modify `StickerWorkspace.tsx`, `src/cabinet/inventory/location-label-data.ts` і `.test.ts`.

**Interfaces:** `StickerModeSwitch({ mode, onChange, allowedModes })` використовує app `Segmented`; `StickerWorkspace.navigation?: ReactNode` — слот перемикача в сторінці під topbar, без зміни основних actions. `PartStickersScreen` приймає лише цей presentation-slot додатково до чинного definition. `loadLocationLabelCollection(collection, signal): Promise<{ target: LocationLabelTarget; labels: PrintableZoneLabel[] }>` перевіряє реального батька через `getWarehouse|getZone|getSection`, його доступність і точну належність дітей; `loadLocationLabels` лишається низькорівневим child-loader. `LocationStickersScreen` споживає валідований target із Task 1 і store із Task 2; picker викликає route navigation, а не власний друк.

- [ ] Тести: кожний вхід завантажує тільки свій рівень/батька; system-unassigned, inactive і без QR не потрапляють у printable selection; parent missing/error/archived дає повідомлення; abort при зміні target.
- [ ] Тести: seed all/subset виконується один раз після success; після ручного deselect refetch не повертає виділення; при retry після першої помилки seed ще спрацьовує; при 201 об'єкті немає мовчазного обрізання чи створення 200-item черги.
- [ ] Тести: пошук/пагінація не гублять вибір; select results охоплює всі знайдені, не тільки видиму сторінку; чергові ID недоступні для нового вибору; empty/no matches/load failure/retry.
- [ ] Тести picker: для зон потрібен склад, для секцій — конкретна зона, для полиць — конкретна секція; зміна верхнього батька скидає нижчі; без target відновлюється active queue context або показується picker. Жодних unrestricted queries через порожній parent.
- [ ] Запустити ці тести до UI-коду, отримати FAIL; реалізувати wrapper/перемикач, список, picker, початковий вибір і loading/error states з існуючих app-компонентів. Оригінальні part-тести запускати через новий wrapper у default-mode.
- [ ] Перевірити `npx vitest run src/cabinet/stickers/LocationStickersScreen.test.tsx src/cabinet/stickers/StickersScreen.test.tsx src/cabinet/stickers/StickerWorkspace.test.tsx src/cabinet/inventory/location-label-data.test.ts`; PASS. Окремий коміт після перевірки незмінності part-логіки.

### Task 4: Картка черги, редагування й batch-друк

**Files:** Create `src/cabinet/stickers/LocationPrintQueueCard.tsx`, `LocationQueueEditor.tsx`, `LocationBatchConfirmation.tsx`, `location-batch-output.ts`, `location-batch-output.test.ts`, `location-queue-workflow.test.tsx`; integrate у `LocationStickersScreen.tsx`; extend `location-stickers-messages.ts` для uk/en-GB/pl. Reuse `src/cabinet/inventory/zone-label-output.ts` без зміни макета.

**Interfaces:** `type LocationBatchSnapshot = { queueId: string; target: LocationLabelTarget; batchIds: readonly string[]; userId: string; tenantId: string; generation: number; revision: number }`. `resolveLocationBatch(queue, freshLabels): PrintableZoneLabel[]` або помилка unavailable — точний ordered batch без silent skip. `prepareLocationBatch(snapshot, { signal, isCurrent }): Promise<string>` повертає HTML тільки після fresh-parent/collection перевірки. UI власник відкриває popup синхронно й викликає prepare; confirmation/editor отримують immutable IDs та callback, store повторно перевіряє ownership/snapshot при submit. Editor має `mode: 'remove' | 'confirm'` і вибирає ID тільки з переданого набору.

- [ ] Тести create/append/cancel: створення не друкує; append дозволений лише своїй колекції; інший target показує Continue; cancel потребує стандартного `ConfirmDialog`, відмова зберігає чергу; pending блокує повторну дію.
- [ ] Тести print: з 25 ID output отримує перші 20, порядок і актуальні QR; missing/archived/порожній QR у batch блокує всю партію; popup відкривається до await, при abort/error закривається; `print()` не просуває чергу.
- [ ] Тести confirmation: all прибирає рівно batch; partial прибирає довільну підмножину batch; none/close/PDF/cancel нічого не змінюють; подвійний submit не рахується двічі; об'єкт поза batch підтвердити не можна.
- [ ] Тести ownership: logout, switch tenant/user, зміна target/mode, cancel/start нової черги й storage event до завершення async не дають записати HTML або підтвердити застарілий результат.
- [ ] Тести editor: недоступний queued ID відображається з placeholder і видаляється; remove не збільшує printed; видалення всіх показує спорожнення, останнє підтвердження — завершення. Читання/редагування не ламає progress і TTL.
- [ ] Запустити нові тести до реалізації, отримати FAIL; реалізувати картку, editor, confirmation, output й toast states. PDF використовує наявне браузерне «Зберегти як PDF» з поясненням, без confirmation. Повернення після друку показує ручне підтвердження, ніколи не auto-ack.
- [ ] Запустити `npx vitest run src/cabinet/stickers/location-batch-output.test.ts src/cabinet/stickers/location-queue-workflow.test.tsx src/cabinet/inventory/zone-label-output.test.ts`; PASS. Перевірити й окремо закомітити.

### Task 5: Верхні меню й відключення вбудованого друку

**Files:** Modify `src/cabinet/warehouses/WarehousesScreen.tsx`, `WarehouseZoneBrowser.tsx`, `src/cabinet/inventory/LocationBrowser.tsx`, `LocationLabelPrinter.tsx`, `LocationLabelPrinter.test.tsx`, `location-labels.css`; tests `src/cabinet/warehouses/WarehouseZoneBrowser.test.tsx`, new `storage-sticker-navigation.test.tsx`.

**Interfaces:** Усі нові посилання формуються `locationStickersHref` із Task 1. `LocationLabelPrinter.tsx` після перенесення може залишитись тільки compatibility-redirect для старих `labels=1` переходів; не має fetch/selection/print/store reset. Застарілі `printWorkspace` props і залежні гілки прибираються з `WarehouseZoneBrowser`/`LocationBrowser` після заміни всіх callers.

- [ ] Тести: верхнє меню складу поряд із Edit веде до зон саме цього warehouse; default warehouse також має друк, хоча Archive недоступний. Print доступний за `inventory.view`, без права редагувати.
- [ ] Тести: верхнє меню зони веде до її секцій; секції — до її полиць. Меню нижніх таблиць не відкриває друк. Дії редагування/архівації, row menus й створення дочірніх об'єктів збережені під чинними правами.
- [ ] Тести: системна «Без зони» й архівні/недоступні батьки не отримують нової дії друку; друк деталей із «Без зони» й інші part links залишаються чинними.
- [ ] Тести: старі `labels=1` URL, включно з legacy inventory routes і subset `label`, роблять один replace у canonical route без відкриття popup; Back не запускає loop. Чужі/невалідні IDs не потрапляють у selection.
- [ ] Запустити ці тести, отримати FAIL; підняти меню з header таблиць у верхні actions. На складі об'єднати друк з уже наявним верхнім меню, не створювати друге «⋯». На зоні/секції підняти релевантні дії й зберегти робочі handlers без дублювання форм; якщо Edit вже у меню, не створювати новий сценарій редагування заради розташування.
- [ ] Прибрати in-place rendering `LocationLabelsPage`, `labelsOpen` layout-гілки й локальні print-refs. Старі тести «prints selected labels directly without creating or showing a queue» замінити redirect-тестами; їхні ownership/error assertions перенести у Task 4, не видаляти разом із поведінкою.
- [ ] Запустити `npx vitest run src/cabinet/warehouses/storage-sticker-navigation.test.tsx src/cabinet/warehouses/WarehouseZoneBrowser.test.tsx src/cabinet/inventory/LocationLabelPrinter.test.tsx src/routes/routes.test.tsx`; PASS. Окремий коміт після перевірки всіх callers через `rg`.

### Task 6: Приймання, регресії й документація

**Files:** Extend `e2e/cabinet-shell.spec.ts` наявними cabinet fixtures; modify `docs/ui/components.md`, `docs/ui/patterns.md` тільки у відповідних частинах. Не робити fixture-refactor або новий framework у межах задачі.

- [ ] Додати браузерні сценарії до UI-реалізації відповідної задачі та спершу перевірити очікуваний FAIL: warehouse→zones, zone→sections, section→shelves; правильний mode/context і preselection; menu keyboard/focus; немає in-place print UI.
- [ ] Сценарій 25 місць: створити чергу, print 20, підтвердити лише 7 довільних, reload — залишилося 18; наступний batch містить тільки непідтверджені; завершення очищає чергу.
- [ ] Перевірити PDF/no-print з незмінним прогресом; append/remove; іншу колекцію й Continue; недоступну позицію; cancel; blocked popup; logout/tenant change; відсутній storage; stale confirmation після зовнішньої зміни черги.
- [ ] Регресія parts: default route, `?part=...`, quantity, prepare/preview, print, download/share, збережена part-черга до/після перемикання, старі part entry points. Інші права не відкривають parts API.
- [ ] Перевірити desktop і viewport 390 px, світлу/темну тему, довгі назви/шляхи, uk/en-GB/pl; екранна мова й мова друкованого документа незалежні. Axe + keyboard: доступні назви режимів/рядків, disabled reasons, focus після dialog/editor, відсутність горизонтального overflow.
- [ ] Виконати `npm run check` і `npm run build:qa` на Node 22/npm 11.16+. Потім `npx playwright test e2e/cabinet-shell.spec.ts --project=chromium --grep "storage stickers"` і відповідні нові сценарії на webkit/ios. Позначити fixture-перевірки як fixture, не як інтеграцію з реальним Core.
- [ ] Вручну перевірити браузерний print/PDF preview: кожен location-стікер на окремій 40×58 мм сторінці, без обрізання й порожньої останньої сторінки; зразок сирого QR місця читається чинним сканером. Фізичний принтер — окрема непідтверджена перевірка, якщо його немає.
- [ ] Оновити тематичні UI docs: два режими, direct-child navigation, правила черги й ручного підтвердження; показати фактичні результати команд, SHA/dirty-state й неперевірені сценарії. Коміт тільки власних змін; без push/PR/deploy у межах цього плану.

## Критерії готовності

- [ ] Друк місць зберігання запускається зі спільного розділу «Стікери», не всередині складів.
- [ ] Три переходи передають тільки правильну колекцію, без змішування рівнів/батьків; preselection не дорівнює створеній черзі.
- [ ] Запчастини працюють за чинним сценарієм, мають незалежний стан і права.
- [ ] Location-черга відновлюється локально в межах TTL, підтримує create/append/remove/continue/cancel, batch 20 і максимум 200 залишкових позицій.
- [ ] Тільки явне підтвердження реального друку змінює прогрес; partial не губить решту; PDF не списує позиції.
- [ ] Недоступні об'єкти й stale operations не дають прихованого часткового результату або зміни чужої черги.
- [ ] Права inventory-only не втрачені після перенесення; відсутність edit/parts permission не підміняє право на location-друк.
- [ ] Пройдені названі code/browser checks; візуальний і фізичний друк позначені рівно за фактично перевіреними сценаріями.

## Статус цього документа

Після підготовки цього плану користувач дозволив реалізацію в окремій гілці. Реалізовано у `codex/storage-sticker-queue` в окремому checkout `rozbirka.web-storage-stickers`, від коміту `b0bf3d299a99705858c68e015479cfc925334451`; сторонні незакомічені зміни вихідного checkout залишено на місці. Core і мобільний застосунок не змінювалися.

Завдання 1–5 реалізовано. Для завдання 6 виконано повний `npm run check` (2467 тестів), QA build та 21 браузерний fixture-сценарій у Chromium/WebKit/iOS-профілі. Незалежний огляд виявив гонку записів між вкладками й недостатню перевірку активних предків; обидва виправлення перевірено через RED→GREEN. Мутації UI серіалізуються scoped Web Locks за наявності підтримки; store також відхиляє конфлікт зі вже збереженою зміною до надходження storage event.

Повний ручний флоу, фактичні перевірки й неперевірені умови: [QA guide](../../qa/2026-10-28-storage-stickers.md). Фізичний принтер і реальна авторизована інтеграція з Core не входять у підтверджені fixture-результати. Замість окремих проміжних комітів зроблено один узгоджений feature-коміт: зміни boundary, wrapper, черги й переходів взаємозалежні. Гілка залишається окремою для перевірки користувачем.
