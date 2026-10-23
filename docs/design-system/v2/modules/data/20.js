import { nav, crumbs, btn, card, one, two, stateCard, sb, notice, toast, fact, facts, field, table, pager, skelCard, dialog, frame, head, pill, toolbar, finalize, drawerFrames, loadDrawers, READONLY, RO } from '../kit.js';

const ORDERS = [
  ['#358', 'Без покупця', '2 позиції', 'платежів ще немає', 'Очікує', 'info', '8 400 ₴', '17.10'],
  ['#357', 'СТО «Мотор»', '5 позицій', 'оплачено 12 600 ₴', 'Підтверджено', 'ok', '12 600 ₴', '17.10'],
  ['#356', 'Ірина Коваль', '1 позиція', 'Нова пошта · ТТН 2045 1931 5540', 'Очікує', 'info', '4 200 ₴', '16.10'],
  ['#341', 'Олена Коваль', '3 позиції', 'оплачено 6 600 ₴', 'Оплачено', 'ok', '6 600 ₴', '10.10'],
  ['#339', 'Ігор Ткач', '1 позиція', '', 'Скасовано', '', '2 100 ₴', '09.10'],
  ['#322', 'Андрій Фастов', '1 позиція', 'кошти повернено', 'Повернено', 'danger', '4 800 ₴', '01.10'],
];
const COLS = [['Замовлення', 'left', 110], ['Покупець'], ['Позиції'], ['Статус'], ['Дата', 'right'], ['Сума', 'right']];
const rows = (list) => list.map((o) => [{ link: o[0] }, { text: o[1], tone: 'strong' }, { text: o[2], sub: o[3] }, { pill: o[4], cls: o[5] }, { mono: o[7], tone: 'muted' }, { num: o[6] }]);

function list(x) {
  x = x || {};
  const add = x.ro ? { disabled: true, title: RO, icon: 'icon-lock' } : {};
  let blocks;
  if (x.denied) blocks = [one([stateCard('', 'icon-lock', 'Недостатньо прав', 'Доступ до цього розділу відкриває власник розбірки в «Команді».', [sb('До головної', 'icon-house')], '', 540)])];
  else if (x.state) blocks = [one([x.state])];
  else if (x.loading) blocks = [one([skelCard(12)])];
  else blocks = [one([card({ title: '', table: table(COLS, rows(x.rows || ORDERS), { h: 48 }), pager: pager(x.range || '1–6 з 358', x.page || 'Сторінка 1 з 60') })])];
  return frame({ crumbs: crumbs(['Продажі', 'Замовлення']), actions: x.denied ? [] : [btn('Нове замовлення', add.icon || 'icon-plus', 'primary', add)], banner: x.ro ? READONLY : null,
    head: x.denied ? null : head('Замовлення', { totals: x.noTotals ? [] : [{ v: '358', k: 'усього' }, { v: '24', k: 'очікують' }, { v: '61 200 ₴', k: 'до сплати' }] }),
    toolbar: x.denied || x.state && x.empty ? null : toolbar('Номер замовлення або покупець', ['Усі', 'Очікує', 'Підтверджено', 'Оплачено'], x.filter ? [['Статус:', 'Очікує']] : ['Статус замовлення'], { tab: x.tab || 0, query: x.query || '', reset: !!x.filter }),
    blocks, o: x.o || {} });
}

const ITEMS = [[{ main: 'Фара передня ліва', sub: '3G1941005' }, { num: 1 }, { num: '4 800' }, { num: '4 800 ₴' }], [{ main: 'Колісний диск R17', sub: '5G0601025' }, { num: 2 }, { num: '1 800' }, { num: '3 600 ₴' }]];
const HIST = [{ icon: 'icon-plus', event: 'Замовлення створено', detail: 'Ірина М.', date: '17.10 14:02' }, { icon: 'icon-list', event: 'Позиції оновлено', detail: '', date: '17.10 14:03' }];
function detail(x) {
  x = x || {};
  const ro = !!x.ro;
  if (x.loading || x.error) return frame({ crumbs: crumbs(['Продажі', 'Замовлення', 'Замовлення']), blocks: [one([x.loading ? skelCard(10, 36) : stateCard('danger', 'icon-triangle-alert', 'Не вдалося завантажити замовлення', 'Спробуйте ще раз.', [sb('До замовлень', 'icon-arrow-left'), sb('Спробувати ще раз', 'icon-refresh-cw')], '', 560, true)])] });
  const paid = !!x.paid;
  const kpis = x.noItems ? null : [
    { label: 'Сума', value: '8 400', unit: '₴', meta: '2 позиції', style: 'font-size:var(--rz-fs-display);color:var(--rz-text-strong)' },
    { label: 'До сплати', value: paid ? '0' : '8 400', unit: '₴', meta: paid ? 'Замовлення оплачене, тож накладна піде без післяплати.' : 'передоплати немає', style: 'font-size:var(--rz-fs-display);color:' + (paid ? 'var(--rz-text-dim)' : 'var(--rz-warn)') },
    { label: 'Доставка', value: '—', unit: '', meta: 'зʼявиться після розрахунку', style: 'font-size:var(--rz-fs-display);color:var(--rz-text-strong)' },
  ];
  const left = [
    ...(kpis ? [card({ kpis })] : []),
    x.noItems ? card({ title: 'Позиції', action: 'Додати позицію', actionIcon: 'icon-plus', actionOff: ro, text: 'Позицій немає. Додайте запчастину, щоб замовлення можна було підтвердити.', textStyle: 'margin:0;padding:16px;color:var(--rz-text-dim)' })
      : card({ title: 'Позиції', count: '2', action: 'Додати позицію', actionIcon: 'icon-plus', actionOff: ro, table: table([['Деталь'], ['Кількість', 'right'], ['Ціна', 'right'], ['Сума', 'right']], ITEMS), foot: { k: 'Разом за позиціями', v: '8 400 ₴' } }),
    card({ title: 'Платежі', action: paid ? '' : 'Додати платіж', actionIcon: 'icon-banknote', actionOff: ro, ...(paid ? { table: table([['Платіж'], ['Каса'], ['Дата', 'right'], ['Сума', 'right']], [[{ text: 'Платіж', tone: 'strong' }, 'Готівка · магазин', { mono: '17.10 15:20', tone: 'muted' }, { num: '8 400 ₴' }]]) } : { text: 'Платежів ще немає.', textStyle: 'margin:0;padding:16px;color:var(--rz-text-dim)' }) }),
    card({ title: 'Історія', timeline: HIST }),
  ];
  const right = [
    card({ title: 'Клієнт', action: 'Додати клієнта', actionOff: ro, text: 'Клієнта не вказано', textStyle: 'margin:0;padding:14px 16px;color:var(--rz-text-dim)' }),
    card({ title: 'Доставка', action: 'Оформити', actionOff: ro, facts: facts([fact('Спосіб', 'Нова пошта'), fact('Номер накладної', '—', { mono: true }), fact('Післяплата в накладній', paid ? '0,00 ₴' : '8 400,00 ₴', { mono: true })]) }),
    card({ title: 'Нотатки', action: 'Додати', actionOff: ro, text: 'Нотаток немає', textStyle: 'margin:0;padding:14px 16px;color:var(--rz-text-dim)' }),
  ];
  const notices = [
    ...(x.reserve ? [notice('info', 'icon-info', 'Резерву розбірка не обмежує строком: позиція тримається, доки стоїть у замовленні. Щоб звільнити деталь, приберіть її із замовлення.')] : []),
    ...(x.conflict ? [notice('danger', 'icon-triangle-alert', 'Замовлення змінилося. Оновіть сторінку та спробуйте ще раз.', 'Оновити')] : []),
    ...(x.printoff ? [notice('warn', 'icon-printer', 'Друку замовлення поки немає: сервіс не формує документ.')] : []),
    ...(x.stale ? [notice('warn', 'icon-clock', 'Минуло більше 24 годин. Тарифи могли змінитися, тому передоплату потрібно підтвердити новим розрахунком.', 'Повторити розрахунок')] : []),
  ];
  return frame({ crumbs: crumbs(['Продажі', 'Замовлення', '#358']), banner: ro ? READONLY : null,
    actions: [btn('Друк', 'icon-printer', '', { disabled: !!x.printoff || ro }), btn('', 'icon-ellipsis', 'icon', { aria: 'Інші дії із замовленням' }), btn(paid ? 'Оформити повернення' : 'Підтвердити замовлення', paid ? 'icon-undo-2' : 'icon-check', paid ? '' : 'primary', { disabled: ro || !!x.noItems, title: ro ? RO : '' })],
    head: head('Замовлення #358', { sub: '● Створено  →  ' + (paid ? '● Оплачено' : '○ Підтверджено') + '  →  ○ Видано', chips: [pill(paid ? 'Оплачено' : 'Очікує', paid ? 'ok' : 'info'), { text: 'створено 17.10.2026 · Ірина М.', cls: 'rz-caption', copy: false }] }),
    notices, blocks: [two(left, right, 340)], o: x.o || {} });
}

export default async function build() {
  const D = await loadDrawers();
  const sections = [
    { num: '1', title: 'Список', route: '/app/:tenant/orders', source: 'OrdersScreen.tsx · orders/messages.ts', frames: [
      { ...list(), label: 'Дані', note: '' },
      { ...list({ tab: 1, filter: true, rows: ORDERS.filter((o) => o[4] === 'Очікує'), range: '1–2 з 24', page: 'Сторінка 1 з 1' }), label: 'Фільтр «Очікує»', note: '' },
      { ...list({ query: '#35', rows: ORDERS.slice(0, 3), range: '1–3 з 3', page: 'Сторінка 1 з 1' }), label: 'Пошук', note: '' },
      { ...list({ loading: true }), label: 'Завантаження', note: '' },
      { ...list({ noTotals: true, empty: true, state: stateCard('brand', 'icon-clipboard-list', 'Замовлень поки немає', 'Замовлення зʼявляться тут, щойно ви створите перше.', [sb('Нове замовлення', 'icon-plus', 'primary')], '', 480) }), label: 'Порожньо', note: '' },
      { ...list({ query: '#9999', state: stateCard('', 'icon-search-x', 'Нічого не знайдено', 'Спробуйте змінити пошук або статус.', [sb('Скинути фільтри', 'icon-x')], '', 380) }), label: 'Нічого не знайдено', note: '' },
      { ...list({ noTotals: true, state: stateCard('danger', 'icon-triangle-alert', 'Не вдалося завантажити замовлення', 'Перевірте зв’язок і спробуйте ще раз.', [sb('Спробувати ще раз', 'icon-refresh-cw')], '', 380, true) }), label: 'Помилка', note: '' },
      { ...list({ denied: true }), label: 'Немає прав', note: '' },
      { ...list({ ro: true }), label: 'Лише перегляд', note: '' },
    ] },
    { num: '2', title: 'Картка замовлення', route: '/app/:tenant/orders/:orderId', source: 'OrderDetailCards.tsx · order-cards-messages.ts · orders/messages.ts', unverified: 'KPI «Сума / До сплати / Доставка» і кроки стану', frames: [
      { ...detail({ reserve: true }), label: 'Очікує', note: '' },
      { ...detail({ paid: true }), label: 'Оплачено', note: '' },
      { ...detail({ noItems: true }), label: 'Без позицій', note: 'підтвердити не можна' },
      { ...detail({ conflict: true }), label: 'Конфлікт', note: 'замовлення змінив інший користувач' },
      { ...detail({ printoff: true }), label: 'Друк недоступний', note: '' },
      { ...detail({ stale: true }), label: 'Розрахунок застарів', note: '' },
      { ...detail({ ro: true }), label: 'Лише перегляд', note: '' },
      { ...detail({ loading: true }), label: 'Завантаження', note: '' },
      { ...detail({ error: true }), label: 'Помилка', note: '' },
    ] },
    { num: '3', title: 'Нове замовлення', route: 'список → «Нове замовлення»', source: 'OrdersScreen.tsx:1243 · order-form-messages.ts', frames: [...drawerFrames(D, 'order-new', () => list(), 'Нове замовлення'), { ...detail({ o: toast('Замовлення створено.') }), label: 'Замовлення створено', note: 'тост ok · після переходу в картку' }] },
    { num: '4', title: 'Позиції, клієнт, оплата', route: 'картка замовлення', source: 'OrderItemDrawer · OrderCustomerDrawer · OrderPaymentDrawer', frames: [
      ...drawerFrames(D, 'order-item', () => detail(), 'Позиція'),
      ...drawerFrames(D, 'order-customer', () => detail(), 'Клієнт'),
      ...drawerFrames(D, 'order-payment', () => detail(), 'Платіж'),
      { ...detail({ o: toast('Оплату записано.') }), label: 'Оплату записано', note: 'тост' },
    ] },
    { num: '5', title: 'Доставка · Нова пошта', route: 'картка замовлення → Доставка', source: 'orders/delivery/* · drawer-messages.ts', frames: [
      ...['np-readiness', 'np-booking', 'np-payment', 'np-attach', 'np-waybill', 'np-label', 'np-step'].flatMap((id) => drawerFrames(D, id, () => detail(), D[id].name)),
    ] },
    { num: '6', title: 'Діалоги', route: 'картка замовлення', source: 'OrdersScreen.tsx:2071 · payment-messages.ts', unverified: 'заголовок і поле причини повернення', frames: [
      { ...detail({ paid: true, o: dialog('Оформити повернення?', 'Дію не можна скасувати. Причина потрапить в історію замовлення.', 'Повернути 8 400 ₴', 'danger', { items: ['8 400 ₴ повернеться клієнту з каси: Готівка · магазин', '2 позиції повернуться на склад', 'Статус замовлення зміниться на «Кошти повернено»'], fields: [field('Причина', '', { ph: 'Наприклад: не підійшла за кріпленням', span: 2 })] }) }), label: 'Повернення', note: '' },
      { ...detail({ o: dialog('Оформити повернення?', 'Платежів за замовленням немає — з каси нічого не списується', 'Оформити повернення', 'danger', { items: ['2 позиції повернуться на склад', 'Статус замовлення зміниться на «Замовлення скасовано»'] }) }), label: 'Повернення без платежів', note: '' },
      { ...detail({ o: dialog('Підтвердити замовлення?', 'Підтверджуючи замовлення, ви визнаєте його повністю оплаченим.', 'Підтвердити замовлення', 'primary') }), label: 'Підтвердження', note: '' },
      { ...detail({ paid: true, o: dialog('Оформити повернення?', 'Дію не можна скасувати. Причина потрапить в історію замовлення.', 'Повертаємо…', 'danger', { busy: true, items: ['8 400 ₴ повернеться клієнту з каси: Готівка · магазин', '2 позиції повернуться на склад'] }) }), label: 'Повернення · pending', note: '' },
      { ...detail({ paid: true, o: toast('Кошти повернено') }), label: 'Кошти повернено', note: 'тост' },
    ] },
  ];
  return {
    module: { num: '20', group: 'Продажі', title: 'Замовлення', intro: 'Усі екрани модуля по порядку: список → картка → нове замовлення → позиції, клієнт і оплата → доставка Новою поштою → діалоги. Кожен кадр — 1280×800, один стан.', sources: 'orders/messages.ts, order-form-messages.ts, order-cards-messages.ts, order-customer-messages.ts, payment-messages.ts, delivery/drawer-messages.ts' },
    nav: nav('Замовлення'),
    sections: finalize(sections),
  };
}
