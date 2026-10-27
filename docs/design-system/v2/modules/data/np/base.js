import { nav, frame, crumbs, card, notice, fact, facts, head, btn, sb, checks, pill, two, one, field, choice, item, toast, dialog, sheet, stateCard } from '../../kit.js';
export * from '../../kit.js';
// Nav with the new «Накладні НП» item under «Продажі».
const npNav = (active) => nav(active).map((g) => (g.title === 'Продажі' ? { ...g, items: [...g.items, { label: 'Накладні НП', icon: 'icon-truck', current: active === 'Накладні НП' ? 'page' : 'false' }] } : g));
const U = '[unverified]';
const KEY_MASK = '••••••••••••••••';
const SND = { name: 'ФОП Коваль Олег Петрович', tin: '3104512877', contact: 'Олег Коваль', phone: '+380 67 214 77 30', city: 'Київ', branch: 'Відділення №12 (до 30 кг): вул. Богатирська, 6', till: 'Основна каса' };
const SND2 = { name: 'ТОВ «Розбірка Плюс»', tin: '44871203', contact: 'Ірина Мельник', phone: '+380 50 118 42 70' };
// Wizard
const STEPS = ['API-ключ', 'Відправник і контакт', 'Каса для післяплати', 'Точка відправлення', 'Перевірка'];
const VALS = ['Ключ перевірено', SND.contact + ' · ФОП', SND.till, SND.city + ' · №12', ''];
const progress = (cur, vals) => card({ title: 'Кроки підключення', hint: 'Введене зберігається між кроками й після «Назад».', checks: checks(STEPS.map((s, i) => [(i + 1) + '. ' + s, i < cur ? (vals || VALS)[i] : i === cur ? 'зараз' : '', i < cur ? 'ok' : i === cur ? 'pending' : 'none'])) });
const wiz = (cur, cards, x) => { x = x || {}; return { ...frame({ crumbs: crumbs(['Налаштування', 'Інтеграції', 'Нова пошта']), actions: [btn('Вийти з підключення', 'icon-x', 'ghost')], head: head('Підключення Нової пошти', { eyebrow: 'Крок ' + (cur + 1) + ' з 5 · ' + STEPS[cur] }), blocks: [two(cards, [progress(cur, x.vals)], 300)], ...x }), nav: npNav('Інтеграції') }; };
const navBtns = (next, x) => { x = x || {}; return [...(x.noBack ? [] : [{ ...sb('Назад', 'icon-arrow-left'), off: x.busy ? 'true' : 'false', style: x.busy ? 'opacity:0.5' : '' }]), { ...sb(next, x.busy ? 'icon-loader-circle' : x.icon || 'icon-arrow-right', 'primary'), off: x.off || x.busy ? 'true' : 'false', style: x.off ? 'opacity:0.5' : '' }]; };
// Connected integration screen
const NP_TABS = (on) => ['Огляд', 'Точки відправлення', 'Статуси', 'Налаштування'].map((label, i) => ({ label, current: i === on ? 'page' : 'false', count: i === 1 ? '2' : '' }));
const npScreen = (o) => ({ ...frame({ crumbs: crumbs(o.narrow ? ['Нова пошта'] : ['Налаштування', 'Інтеграції', 'Нова пошта']), actions: o.narrow ? [] : [btn('Інтеграції', 'icon-arrow-left')], head: head('Нова пошта', { sub: 'Доставка Україною між відділеннями.', chips: [pill(o.statusText || 'Увімкнена', o.statusTone || 'ok')] }), tabs: o.tabs === false ? null : NP_TABS(o.tab || 0), ...o }), nav: npNav('Інтеграції') });
const rightsCard = (int, x) => card({ title: 'Ваші права', hint: 'Права надає власник у розділі «Команда».', checks: checks([['Налаштування інтеграцій', int ? 'є' : 'немає', int ? 'ok' : 'none'], ['Керування замовленнями', 'є', 'ok'], ['Фінанси', (x && x.fin === false) ? 'немає' : 'є', (x && x.fin === false) ? 'none' : 'ok']]) });
// Order + waybill frames used across sections
const orderFrame = (o) => ({ ...frame({ crumbs: crumbs(o.narrow ? ['Замовлення #361'] : ['Продажі', 'Замовлення', '#361']), head: head('Замовлення #361', { sub: 'Ірина Коваль · 3 позиції · 9 600 ₴', chips: [pill(o.orderState || 'Відкрите', o.orderTone || 'info')] }), ...o }), nav: npNav('Замовлення') });
const TTN = '20 4512 0098 7731';
const TTN_OLD = '20 4500 1187 2209';
const wbFrame = (o) => ({ ...frame({ crumbs: crumbs(o.narrow ? ['ТТН'] : ['Продажі', 'Накладні НП', o.num || TTN]), actions: o.narrow ? [] : [btn('До списку', 'icon-arrow-left')], head: head('ТТН ' + (o.num || TTN), { sub: o.sub || 'Замовлення #361 · створена 14.10.2026', chips: o.chips || [] }), ...o }), nav: npNav('Накладні НП') });
const histCard = (items) => card({ title: 'Історія', timeline: items });
export { row, rows, pl, sbo } from '../olx/base.js';
export { npNav, U, KEY_MASK, SND, SND2, STEPS, progress, wiz, navBtns, NP_TABS, npScreen, rightsCard, orderFrame, TTN, TTN_OLD, wbFrame, histCard };
