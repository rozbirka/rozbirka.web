import { nav, frame, crumbs, one, two, grid, card, stateCard, sb, notice, table, dialog, toast, finalize, head, btn, pill, field, item, sheet, menu, choice, seg, toolbar } from '../kit.js';
// Тексти: overview-messages.ts, warehouse-messages.ts, location-browser-messages.ts, location-contents-messages.ts,
// location-label-messages.ts, placement-messages.ts, warehouses/unassigned-messages.ts (гілка codex/separate-warehouses-inventory).
export default async function build() {
  const W = 'Основний склад';
  const K = (label, value, unit, meta) => ({ label, value, unit: unit || '', meta: meta || '', style: 'font-size:var(--rz-fs-display);color:var(--rz-text-strong)' });
  const kpis = (arr) => card({ kpis: arr });
  const back = (label) => btn(label, 'icon-chevron-left', 'ghost');
  const more = (aria) => btn('', 'icon-ellipsis', 'icon', { aria });

  // 1 · Список складів
  const crL = crumbs(['Склад', 'Склади']);
  const addW = btn('Додати склад', 'icon-plus', 'primary');
  const whCols = [['Склад'], ['Запчастин', 'right', 120], ['Зон', 'right', 80], ['', 'right', 40]];
  const whRows = (stock) => [
    [{ main: W, sub: 'MAIN · за замовчуванням' }, stock ? { num: '1 102' } : { text: 'залишки недоступні', tone: 'dim' }, { num: 6 }, { text: '›', tone: 'dim' }],
    [{ main: 'Гараж', sub: 'GAR' }, stock ? { num: 182 } : { text: 'залишки недоступні', tone: 'dim' }, { num: 2 }, { text: '›', tone: 'dim' }],
    [{ main: 'Старий ангар', sub: 'OLD · архівний' }, stock ? { num: 0 } : { text: 'залишки недоступні', tone: 'dim' }, { num: 1 }, { text: '›', tone: 'dim' }],
  ];
  const whList = (stock) => card({ title: 'Список складів', hint: 'Виберіть склад, щоб переглянути його зони та запчастини.', table: table(whCols, whRows(stock), { h: 48, dim: [2] }) });
  const whHead = head('Склади', { sub: 'Усі місця зберігання запчастин вашої розбірки.' });
  const whK = (stock) => kpis([K('Складів', '3', '', 'Активних: 2 · архівних: 1'), K('Запчастин на складах', stock ? '1 284' : '—', '', stock ? '' : 'залишки недоступні')]);
  const L = (label, x) => frame({ label, crumbs: crL, actions: [addW], head: whHead, ...x });
  const newWh = sheet('Новий склад', 'Склад — це приміщення; зони додаються вже всередині нього.', [{ fields: [field('Назва', '', { req: true, span: 2, ph: 'Наприклад, Основний склад' }), field('Код', '', { req: true, span: 2, mono: true, hint: 'Код формується з назви автоматично. За потреби його можна змінити.' })] }], { submit: 'Додати склад' });
  const s1 = [
    L('Дані', { toolbar: toolbar('Назва або код'), blocks: [one([whK(true), whList(true)])] }),
    L('Залишки недоступні', { note: 'немає parts.view', toolbar: toolbar('Назва або код'), blocks: [one([whK(false), whList(false)])] }),
    L('Порожньо', { blocks: [one([stateCard('brand', 'icon-warehouse', 'Складів ще немає', 'Створіть перший склад, щоб розкласти запчастини по зонах.', [sb('Додати склад', 'icon-plus', 'primary')], '', 480)])] }),
    L('Нічого не знайдено', { toolbar: toolbar('Назва або код', null, null, { query: 'zzz' }), blocks: [one([whK(true), stateCard('', 'icon-search-x', 'Складів за цією назвою або кодом не знайдено.', '', null, '', 240)])] }),
    L('Новий склад', { toolbar: toolbar('Назва або код'), blocks: [one([whK(true), whList(true)])], o: newWh }),
    frame({ label: 'Немає прав', crumbs: crL, blocks: [one([stateCard('', 'icon-lock', 'Недостатньо прав', 'Доступ до цього розділу відкриває власник розбірки в «Команді».', [sb('До головної', 'icon-house')], '', 540)])] }),
  ];

  // 2 · Склад
  const crW = crumbs(['Склад', 'Склади', W]);
  const wActs = [back('До складів'), btn('Редагувати', 'icon-pencil'), more('Інші дії зі складом')];
  const wHead = (archived) => head(W, { sub: 'код MAIN · 6 зон · 1 102 позиції · 14 без зони · склад за замовчуванням', chips: [archived ? pill('Архівний') : pill('Активний', 'ok')] });
  const wK = kpis([K('Запчастин на складі', '1 102', 'позицій', '6 зон · 14 без зони'), K('Зони із запчастинами', '5', 'із 6', '')]);
  const zRows = [
    [{ main: 'Без зони', sub: 'UNASSIGNED · системна' }, { text: '›', tone: 'dim' }, ''],
    [{ main: 'Стелажі А', sub: 'A1' }, { text: '›', tone: 'dim' }, { act: true }],
    [{ main: 'Стелажі Б', sub: 'B1' }, { text: '›', tone: 'dim' }, { act: true }],
    [{ main: 'Кузовщина', sub: 'KZ' }, { text: '›', tone: 'dim' }, { act: true }],
    [{ main: 'Двигуни', sub: 'DV' }, { text: '›', tone: 'dim' }, { act: true }],
    [{ main: 'Колеса', sub: 'KL' }, { text: '›', tone: 'dim' }, { act: true }],
    [{ main: 'Двір', sub: 'YARD · архівна' }, { text: '›', tone: 'dim' }, { act: true }],
  ];
  const zCard = (rows) => card({ title: 'Зони', hint: 'Виберіть зону, щоб переглянути її секції', action: 'Додати зону', actionIcon: 'icon-plus', table: table([['Зона'], ['', 'right', 40], ['', 'right', 40]], rows, { h: 44, dim: [6] }) });
  const Wf = (label, x) => frame({ label, crumbs: crW, actions: wActs, head: wHead(), toolbar: toolbar('Назва або код'), blocks: [one([wK, zCard(zRows)])], ...x });
  const zoneSheet = (title, desc, name, code) => sheet(title, desc, [{ fields: [field('Назва', name, { req: true, span: 2 }), field('Код', code, { req: true, span: 2, mono: true, hint: 'Код формується з назви автоматично. За потреби його можна змінити.' })] }]);
  const s2 = [
    Wf('Дані'),
    Wf('Інші дії зі складом', { o: menu([{ label: 'Експорт залишків', icon: 'icon-download', off: 'true', title: 'Вивантажити залишки складу файлом поки не можна' }, { label: 'Архівувати склад', icon: 'icon-archive', danger: true }]) }),
    Wf('Дії із зонами', { note: 'меню біля «Додати зону»', o: menu([{ label: 'Друк стікерів зон', icon: 'icon-printer' }]) }),
    Wf('Дії із зоною', { o: menu([{ label: 'Редагувати зону Стелажі А', icon: 'icon-pencil' }, { label: 'Архівувати зону Стелажі А', icon: 'icon-archive', danger: true }]) }),
    Wf('Нова зона', { o: zoneSheet('Нова зона', 'У зоні створюють секції, а в секціях — місця або полиці для деталей.', '', '') }),
    Wf('Редагувати зону', { o: zoneSheet('Редагувати зону', 'Зона «A1» складу «' + W + '».', 'Стелажі А', 'A1') }),
    Wf('Редагувати склад', { o: zoneSheet('Редагувати склад', 'Назва і код видно всюди, де зустрічається цей склад.', W, 'MAIN') }),
    Wf('Архівувати склад?', { o: dialog('Архівувати склад?', 'Склад «' + W + '» зникне зі списків і з фільтрів. Запчастини залишаться на своїх зонах.', 'Архівувати склад', 'danger') }),
    Wf('Архівувати зону?', { o: dialog('Архівувати зону?', 'Зона «Стелажі А» більше не зʼявиться у виборі місця. Запчастини, що в ній лежать, доведеться перекласти вручну.', 'Архівувати зону', 'danger') }),
    Wf('Зон ще немає', { blocks: [one([wK, card({ title: 'Зони', action: 'Додати зону', actionIcon: 'icon-plus', table: table([['Зона'], ['', 'right', 40], ['', 'right', 40]], [zRows[0]], { h: 44 }) }), stateCard('brand', 'icon-layout-grid', 'Зон ще немає — додайте першу, щоб розкладати запчастини по місцях.', '', [sb('Додати зону', 'icon-plus', 'primary')], '', 220)])] }),
    Wf('Друк заблоковано', { o: toast('Браузер заблокував вікно друку.', 'danger') }),
  ];

  // 3 · Зона → секції → полиці → запчастини
  const crZ = crumbs(['Склад', 'Склади', W, 'Стелажі А']);
  const zActs = [back('До складу'), more('Дії із зоною Стелажі А')];
  const zHead = (chip) => head('Стелажі А', { sub: 'код A1 · Склад → Зона → Секція → Полиця', chips: [chip || pill('Активна', 'ok')] });
  const secCard = (active) => card({ title: 'Секції', count: '3', action: 'Додати секцію', actionIcon: 'icon-plus', table: table([['Назва'], ['Полиць', 'right', 80], ['Позицій', 'right', 80], ['', 'right', 40]], [
    [{ main: 'Стелаж 1', sub: 'A1-S1' }, { num: 4 }, { num: 38 }, { act: true }],
    [{ main: 'Стелаж 2', sub: 'A1-S2' }, { num: 3 }, { num: 21 }, { act: true }],
    [{ main: 'Стелаж 3', sub: 'A1-S3' }, { num: 0 }, { num: 5 }, { act: true }],
  ], { h: 44, active }) });
  const shelfCard = card({ title: 'Полиці', count: '4', action: 'Додати полицю', actionIcon: 'icon-plus', table: table([['Назва'], ['Позицій', 'right', 80], ['', 'right', 40]], [
    [{ main: 'Без полиці', sub: '' }, { num: 6 }, ''],
    [{ main: 'Полиця 1', sub: 'A1-S1-P1' }, { num: 12 }, { act: true }],
    [{ main: 'Полиця 2', sub: 'A1-S1-P2' }, { num: 9 }, { act: true }],
    [{ main: 'Полиця 3', sub: 'A1-S1-P3' }, { num: 11 }, { act: true }],
  ], { h: 40, active: 1 }) });
  const pick = (title, text) => card({ title, state: { cls: 'rz-state', role: 'status', icon: 'icon-mouse-pointer-click', title: text, body: '', btns: null, meta: '', h: '176px', unverified: false } });
  const partsCard = (x) => card({ title: 'Вміст секції', count: 'Позицій: 38', table: table([['Запчастина'], ['Кількість', 'right', 100], ['Статус', 'left', 120], ['', 'right', 120]], [
    [{ main: 'Фара передня ліва', sub: '3G1941005' }, { num: 1 }, { pill: 'На складі', cls: 'ok' }, { link: 'Розмістити' }],
    [{ main: 'Генератор', sub: '03L903023F' }, { num: 1 }, { pill: 'У резерві', cls: 'warn' }, { link: 'Розмістити' }],
    [{ main: 'Колісний диск R17', sub: '5G0601025' }, { num: 4 }, { pill: 'На складі', cls: 'ok' }, { link: 'Розмістити' }],
  ], { h: 40 }), ...(x || {}) });
  const Zf = (label, x) => frame({ label, crumbs: crZ, actions: zActs, head: zHead(), toolbar: toolbar('Знайти секцію за назвою або кодом'), blocks: [grid([secCard(0), shelfCard], 2), one([partsCard()])], ...x });
  const nameCode = (title, desc, hint) => sheet(title, desc, [{ fields: [field('Назва', '', { req: true, span: 2 }), field('Код', '', { req: true, span: 2, mono: true, hint })] }]);
  const s3 = [
    Zf('Секцію й полицю вибрано'),
    Zf('Секцію не вибрано', { blocks: [grid([secCard(-1), pick('Полиці', 'Виберіть секцію, щоб переглянути її полиці')], 2), one([pick('Вміст секції', 'Виберіть полицю, щоб переглянути її запчастини')])] }),
    Zf('Секцій поки немає', { notices: [notice('info', 'icon-info', 'У зоні створюйте секції, а в секціях — полиці. Запчастину можна розмістити й у секції без полиці.')], toolbar: null, blocks: [one([stateCard('brand', 'icon-rows-3', 'Секцій поки немає', '', [sb('Додати секцію', 'icon-plus', 'primary')], '', 360)])] }),
    Zf('Полиць поки немає', { blocks: [grid([secCard(2), card({ title: 'Полиці', action: 'Додати полицю', actionIcon: 'icon-plus', state: { cls: 'rz-state', role: 'status', icon: 'icon-rows-3', title: 'Полиць поки немає', body: '', btns: null, meta: '', h: '176px', unverified: false } })], 2), one([partsCard({ count: 'Позицій: 5' })])] }),
    frame({ label: 'Системна зона «Без зони»', crumbs: crumbs(['Склад', 'Склади', W, 'Без зони']), actions: [back('До складу')], head: head('Без зони', { sub: 'UNASSIGNED', chips: [pill('системна')] }), notices: [notice('info', 'icon-info', '«Без зони» — місце для нерозміщених деталей. Секції та полиці тут не створюються.')] }),
    Zf('Архівна зона', { head: zHead(pill('Архівна')), notices: [notice('warn', 'icon-archive', 'Зону архівовано. Створення секцій і полиць недоступне.')], blocks: [grid([card({ ...secCard(0), action: '' }), card({ ...shelfCard, action: '' })], 2)] }),
    Zf('Дії з секцією', { o: menu([{ label: 'Редагувати секцію', icon: 'icon-pencil' }, { label: 'Друк QR секції', icon: 'icon-qr-code' }, { label: 'Архівувати секцію', icon: 'icon-archive', danger: true, off: 'true', title: 'Спочатку приберіть полиці з секції.' }]) }),
    Zf('Дії з полицею', { o: menu([{ label: 'Редагувати полицю', icon: 'icon-pencil' }, { label: 'Друк QR полиці', icon: 'icon-qr-code' }, { label: 'Архівувати полицю', icon: 'icon-archive', danger: true, off: 'true', title: 'Полиці з деталями спочатку потрібно звільнити.' }]) }),
    Zf('Нова секція', { o: nameCode('Нова секція', 'Стелажі А · A1', 'Короткий код для етикеток і пошуку — наприклад A1.') }),
    Zf('Нова полиця', { o: nameCode('Нова полиця', 'Стелажі А · Стелаж 1', 'Короткий код для етикеток і пошуку — наприклад A1.') }),
    Zf('Архівувати секцію', { o: dialog('Архівувати секцію', 'Спочатку приберіть полиці з секції.', 'Архівувати секцію', 'danger') }),
    Zf('Йде інвентаризація', { notices: [notice('warn', 'icon-lock', 'Розміщення заблоковано під час інвентаризації.')] }),
    Zf('Місце недоступне', { blocks: [one([stateCard('danger', 'icon-map-pin-off', 'Місце недоступне або належить іншій секції.', '', [sb('До зони', 'icon-chevron-left')], '', 420)])] }),
  ];

  // 4 · Без зони + масове розміщення
  const crU = crumbs(['Склад', 'Склади', W, 'Без зони']);
  const uHead = head('Без зони', { sub: 'Запчастини складу «' + W + '», для яких ще не вибрано зону. Розміщуйте по одній або виберіть кілька запчастин для спільного розміщення.' });
  const uRows = [
    [{ check: true }, { main: 'Фара передня ліва', sub: '3G1941005' }, { num: 1 }, { pill: 'На складі', cls: 'ok' }, { link: 'Розмістити' }],
    [{ check: true }, { main: 'Генератор', sub: '03L903023F' }, { num: 1 }, { pill: 'На складі', cls: 'ok' }, { link: 'Розмістити' }],
    [{ check: true }, { main: 'Колісний диск R17', sub: '5G0601025' }, { num: 4 }, { pill: 'На складі', cls: 'ok' }, { link: 'Розмістити' }],
    [{ check: false }, { main: 'Дзеркало праве', sub: '5G1857508' }, { num: 1 }, { pill: 'У резерві', cls: 'warn' }, { link: 'Розмістити' }],
  ];
  const uCols = [['☐', 'left', 36], ['Запчастина'], ['Кількість', 'right', 100], ['Статус', 'left', 120], ['', 'right', 120]];
  const uCard = (sel, rows) => card({ title: 'Запчастини без зони', count: '14', table: table(uCols, (rows || uRows).map((r, i) => (sel ? r : [{ check: false }, ...r.slice(1)])), { h: 44, sel: sel ? [0, 1, 2] : [] }) });
  const bulk = { count: '3', label: 'запчастин', page: 'Обрати всі на сторінці (4)', actions: [{ icon: 'icon-map-pin', label: 'Розмістити вибрані' }, { icon: 'icon-printer', label: 'Друк стікера' }] };
  const U = (label, x) => frame({ label, crumbs: crU, actions: [back('До складу')], head: uHead, toolbar: toolbar('Пошук запчастин', null, null, { end: 'Вибір зберігається між сторінками й під час пошуку.' }), blocks: [one([uCard(false)])], ...x });
  const selParts = (x) => ({ rowsLabel: 'Вибрані запчастини', rows: [item('Фара передня ліва', '3G1941005', x && x[0]), item('Генератор', '03L903023F', x && x[1]), item('Колісний диск R17', '5G0601025', x && x[2])] });
  const bs = (groups, x) => sheet('Розмістити вибрані запчастини', W, [{ title: 'Вибрано: 3', caption: 'Виберіть одну зону цього складу для всіх вибраних запчастин. Наявні фізичні прив’язки збережуться.' }, ...groups], { submit: 'Розмістити', ...(x || {}) });
  const zoneF = (v, x) => ({ fields: [field('Зона', v, { select: true, span: 2, ph: 'Виберіть зону', ...(x || {}) })] });
  const SEL = { bulk, toolbar: null, blocks: [one([uCard(true)])] };
  const s4 = [
    U('Дані'),
    U('Вибрано 3', SEL),
    U('Розміщення збережено', { note: 'тост ok', o: toast('Розміщення «Фара передня ліва» збережено.'), blocks: [one([uCard(false, uRows.slice(1))])] }),
    U('Порожньо', { toolbar: null, blocks: [one([stateCard('brand', 'icon-circle-check', 'Усі запчастини цього складу вже мають зону.', '', null, '', 420)])] }),
    U('Архівний склад', { notices: [notice('info', 'icon-archive', 'Склад в архіві. Список доступний для перегляду.')] }),
    U('Зону не визначено', { toolbar: null, blocks: [one([stateCard('danger', 'icon-triangle-alert', 'Не вдалося визначити зону нерозміщених запчастин.', '', [sb('Повторити', 'icon-refresh-cw')], '', 420)])] }),
    U('Розмістити · вибір зони', { ...SEL, o: bs([zoneF(''), selParts()], { submitOff: true }) }),
    U('Розмістити · зону вибрано', { ...SEL, o: bs([zoneF('Стелажі А · A1'), selParts()]) }),
    U('Розмістити · триває', { ...SEL, o: bs([zoneF('Стелажі А · A1', { lock: true }), selParts()], { busy: true, submit: 'Розміщення: 1 із 3', submitOff: true }) }),
    U('Розмістити · частково', { ...SEL, o: bs([zoneF('Стелажі А · A1', { lock: true }), { notes: [notice('info', 'icon-info', 'Розміщено: 1 із 3'), notice('danger', 'icon-circle-alert', 'Генератор: Не вдалося зберегти зміни.', '', { unverified: true })], caption: '«Колісний диск R17» вже не в «Без зони». Її розміщення не змінено.' }, selParts([{ tag: '✓', tagTone: 'ok' }, { tag: '✕', tagTone: 'danger' }, { tag: '—', tagTone: 'dim' }])], { cancel: 'Готово', submit: 'Повторити для нерозміщених' }) }),
    U('Розмістити · немає зон', { ...SEL, o: bs([{ notes: [notice('info', 'icon-info', 'Немає активних зон для розміщення. Додайте зону на екрані складу.')] }, selParts()], { submitOff: true }) }),
  ];

  // 5 · Розміщення запчастини
  const crP = crumbs(['Склад', 'Запчастини', 'Фара передня ліва']);
  const step = (n, title, hint, body) => card({ title: n + ' · ' + title, hint, ...body });
  const whStep = (on) => step('01', 'Склад', 'Фізичне приміщення, де лежить запчастина.', { form: { choices: [choice(W, '6 зон', on === 0), choice('Гараж', '2 зони', on === 1)], caption: '☐ Зберегти тільки на рівні складу' } });
  const zoneStep = (on) => step('02', 'Зона', 'Виберіть зони складу або створіть нову. За потреби далі вкажіть конкретну полицю.', { form: { fields: [field('Пошук зони', '', { icon: 'icon-search', hideLabel: true, ph: 'Назва або код зони, наприклад A1', span: 4 })], choices: [choice('Стелажі А', 'A1 · 38 позицій', on), choice('Стелажі Б', 'B1 · 21 позиція', false), choice('Кузовщина', 'KZ · 0 позицій', false)], caption: 'порожня · є позиції · найзавантаженіша' } });
  const secStep = (v) => step('03', 'Секція / стелаж', 'Секцію можна вказати після зони або зберегти деталь у зоні.', { form: { fields: [field('Секція / стелаж', v, { select: true, span: 4, ph: 'Без секції — залишити в зоні' })] } });
  const shelfStep = (v) => step('04', 'Місце/полиця', 'Місце належить секції вибраної зони й має власний QR-код.', { form: { fields: [field('Місце/полиця', v, { select: true, span: 4, ph: 'Без полиці' })] } });
  const sum = (lvl, ok, caption) => card({ title: 'Нове розміщення', facts: [{ k: 'Рівень', v: lvl, sub: '', style: 'display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;padding:8px 0', vStyle: 'margin:0;color:var(--rz-text-strong);font-weight:600' }, { k: 'Було', v: 'Без зони', sub: '', style: 'display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;padding:8px 0;border-top:1px solid var(--rz-border)', vStyle: 'margin:0;color:var(--rz-text-muted)' }], form: { buttons: [{ ...sb('Зберегти розміщення', '', 'primary'), off: ok ? 'false' : 'true', style: 'width:100%' }], caption } });
  const P = (label, left, right, x) => frame({ label, crumbs: crP, actions: [back('До деталі'), btn('Розмістити', '', 'primary')], head: head('Розміщення на складі', { sub: '1 шт. на складі' }), blocks: [two(left, right, 320)], ...x });
  const s5 = [
    P('До полиці', [whStep(0), zoneStep(true), grid([secStep('Стелаж 1 · A1-S1'), shelfStep('Полиця 2 · A1-S1-P2')], 2)], [sum(W + ' → Стелажі А → Стелаж 1 → Полиця 2', true, 'Збереження замінить увесь набір зон цієї запчастини, а не тільки вибраний склад.')]),
    P('До секції', [whStep(0), zoneStep(true), grid([secStep('Стелаж 1 · A1-S1'), shelfStep('')], 2)], [sum(W + ' → Стелажі А → Стелаж 1', true, 'Збереження замінить увесь набір зон цієї запчастини, а не тільки вибраний склад.')]),
    P('Лише склад', [{ ...whStep(0), form: { ...whStep(0).form, caption: '☑ Зберегти тільки на рівні складу' } }], [sum('Лише склад', true, '')]),
    P('Нічого не вибрано', [whStep(0), zoneStep(false)], [sum('—', false, 'Виберіть хоча б одну зону — запчастина не може лишитися без місця.')], { notices: [notice('info', 'icon-info', 'Виберіть зону для запчастини. За потреби уточніть секцію та полицю.')] }),
    P('Немає активних зон', [whStep(1), step('02', 'Зона', '', { state: { cls: 'rz-state', role: 'status', icon: 'icon-layout-grid', title: 'На цьому складі немає активних зон.', body: '', btns: null, meta: '', h: '160px', unverified: false } })], [sum('—', false, 'Виберіть склад або зону.')]),
    P('Збережено', [whStep(0), zoneStep(true)], [sum(W + ' → Стелажі А', false, '')], { note: 'тост ok', o: toast('Розміщення збережено') }),
    P('Нічого не змінилося', [whStep(0), zoneStep(true)], [sum(W + ' → Стелажі А', false, '')], { note: 'тост info', o: toast('Нічого не змінилося — набір зон уже такий.', 'info') }),
  ];

  // 6 · QR-етикетки місць
  const lTabs = (on) => card({ seg: seg(['Етикетки зон', 'Етикетки секцій', 'Етикетки полиць'], on), title: 'Друк QR-етикеток', hint: 'QR-етикетки місць зберігання. Оберіть потрібні або всі та підготуйте до друку.' });
  const lRows = (sel, q) => [['Стелажі А', 'A1'], ['Стелажі Б', 'B1'], ['Кузовщина', 'KZ'], ['Двигуни', 'DV'], ['Колеса', 'KL']].map(([n, c], i) => [{ check: sel.includes(i) }, { text: n, tone: 'strong' }, { mono: c }, q && i < 2 ? { pill: 'У черзі', cls: 'info' } : '']);
  const lTable = (sel, q) => card({ table: table([['☐', 'left', 36], ['Назва'], ['Код', 'left', 120], ['', 'right', 120]], lRows(sel, q), { h: 40, sel }) });
  const lBulk = (n) => ({ count: String(n), label: 'обрано', page: 'Обрати всі · 5', actions: [{ icon: 'icon-printer', label: 'Створити чергу · ' + n }] });
  const queue = card({ title: 'Активна черга', hint: 'Етикеток у черзі: 6', form: { notes: [], caption: '2 з 6 надруковано · 4 залишилось', buttons: [sb('Друк · 4', 'icon-printer', 'primary'), sb('PDF · 4', 'icon-file-down'), sb('Змінити чергу', 'icon-pencil', 'ghost'), sb('Скасувати чергу', 'icon-x', 'ghost')], btnNote: 'Щоб зберегти PDF, у вікні друку браузера оберіть «Зберегти як PDF». Етикетки залишаться в черзі.' } });
  const crQ = crumbs(['Склад', 'Склади', W]);
  const Q = (label, blocks, x) => frame({ label, crumbs: crQ, actions: [back('До списку'), btn('Завершити вибір', 'icon-check')], head: head('Зони', { sub: 'Дії із зонами → Друк стікерів зон' }), blocks, ...x });
  const s6 = [
    Q('Нічого не вибрано', [one([lTabs(0), lTable([])])], { toolbar: toolbar('Назва або код') }),
    Q('Вибір етикеток', [one([lTabs(0), lTable([0, 1, 2])])], { note: 'BulkBar замість тулбара', bulk: lBulk(3) }),
    Q('Активна черга', [two([lTable([], true)], [queue], 420)]),
    Q('Готуємо друк', [two([lTable([], true)], [{ ...queue, form: { ...queue.form, buttons: [{ ...sb('Підготовка…', 'icon-loader-circle', 'primary'), off: 'true' }] } }], 420)]),
    Q('Що вдалося надрукувати?', [two([lTable([], true)], [queue], 420)], { o: dialog('Що вдалося надрукувати?', 'Позначте лише етикетки, які справді надруковані. Решта залишиться в черзі. Після збереження PDF нічого не підтверджуйте.', 'Підтвердити · 3', 'primary', { items: ['☑ Стелажі А · A1', '☑ Стелажі Б · B1', '☑ Кузовщина · KZ', '☐ Двигуни · DV'], width: 'width:480px', cancel: false, sub: 'Надруковано всі · 4  ·  Нічого не надруковано' }) }),
    Q('Скасувати чергу?', [two([lTable([], true)], [queue], 420)], { o: dialog('Скасувати чергу друку?', 'Решта вибраних етикеток буде прибрана з черги.', 'Скасувати чергу', 'danger') }),
    Q('Є інша черга', [one([notice('warn', 'icon-triangle-alert', 'Є незавершена черга: Етикетки полиць. Продовжіть або скасуйте її перед створенням нової.', 'Продовжити чергу'), lTabs(0), lTable([0, 1])].map((c) => (c.cls ? card({ box: 'display:grid', form: { notes: [c], buttons: [sb('Продовжити чергу', 'icon-play')] } }) : c)))]),
    Q('Вікно друку заблоковано', [two([lTable([], true)], [{ ...queue, form: { ...queue.form, notes: [notice('danger', 'icon-circle-alert', 'Браузер заблокував вікно друку. Дозвольте спливаючі вікна для цього сайту.')] } }], 420)]),
    Q('Етикетки недоступні', [two([lTable([], true)], [{ ...queue, form: { ...queue.form, notes: [notice('warn', 'icon-triangle-alert', 'Деякі етикетки більше недоступні. Приберіть їх із черги перед друком.')] } }], 420)]),
    Q('Порожньо', [one([lTabs(2), stateCard('', 'icon-qr-code', 'Етикеток поки немає', '', null, '', 300)])]),
  ];

  const sections = [
    { num: '1', title: 'Список складів', route: '/app/:tenant/warehouses', source: 'WarehousesScreen.tsx · WarehouseBrowser.tsx', frames: s1 },
    { num: '2', title: 'Склад', route: '/app/:tenant/warehouses/:warehouseId', source: 'WarehousesScreen.tsx · WarehouseZoneBrowser.tsx', frames: s2 },
    { num: '3', title: 'Зона · секції · полиці', route: '/app/:tenant/warehouses/:warehouseId/zones/:zoneId', source: 'WarehousesScreen.tsx · LocationBrowser.tsx · LocationPartsList.tsx', frames: s3 },
    { num: '4', title: 'Без зони · масове розміщення', route: '/app/:tenant/warehouses/:warehouseId/unassigned', source: 'WarehousesScreen.tsx · BulkPlacementSheet.tsx', unverified: 'текст помилки в 4.10', frames: s4 },
    { num: '5', title: 'Розміщення запчастини', route: 'з картки запчастини', source: 'WarehousesScreen.tsx · placement-messages.ts', unverified: 'маршрут', frames: s5 },
    { num: '6', title: 'QR-етикетки місць', route: '/app/:tenant/warehouses/:warehouseId · друк', source: 'LocationLabelPrinter.tsx · location-label-queue.ts', frames: s6 },
  ];
  return { module: { num: '12', group: 'Склад', title: 'Склади', intro: 'Склади, зони, секції й полиці; запчастини без зони і масове розміщення; розміщення окремої запчастини до будь-якого рівня; черга друку QR-етикеток. Інвентаризація — модуль 13.', sources: 'overview-, warehouse-, location-browser-, location-contents-, location-label-, placement-messages.ts, warehouses/unassigned-messages.ts' }, nav: nav('Склади'), sections: finalize(sections) };
}
