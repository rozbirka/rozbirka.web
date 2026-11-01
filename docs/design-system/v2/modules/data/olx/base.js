import { nav, frame, crumbs, card, notice, fact, facts, head, btn, box, sb, checks } from '../../kit.js';
export * from '../../kit.js';
const TONE = { ok: 'var(--rz-ok)', warn: 'var(--rz-warn)', danger: 'var(--rz-danger)', info: 'var(--rz-info)', muted: 'var(--rz-text-muted)', dim: 'var(--rz-text-dim)', brand: 'var(--rz-brand-text)' };
const pl = (text, tone) => ({ text, cls: 'rz-pill' + (tone ? ' rz-pill--' + tone : '') });
const sbo = (label, icon, kind, off) => ({ ...sb(label, icon, kind), off: off ? 'true' : 'false', style: off ? 'opacity:0.5' : '' });
// list row for cards (narrow lists, reconciliation, results)
const row = (title, x) => { x = x || {}; return { title, meta: x.meta || '', pills: x.pills || null, note: x.note || '', noteStyle: 'text-wrap:pretty;color:' + (TONE[x.noteTone] || 'var(--rz-text-muted)'), right: x.right || '', sub: x.sub || '', subStyle: 'color:' + (TONE[x.subTone] || 'var(--rz-text-muted)'), check: 'check' in x, box: box(!!x.check, !!x.off), boxIcon: x.check ? 'icon-check' : '', radio: 'radio' in x, radioStyle: box(!!x.radio, !!x.off, true), radioIn: x.radio ? 'width:6px;height:6px;border-radius:var(--rz-r-full);background:var(--rz-brand)' : 'display:none', thumb: !!x.thumb, logo: x.logo || '', rpill: x.rpill || null, rsub: x.rsub || '', chev: !!x.chev, btn: x.btn || '', btnOff: x.btnOff ? 'true' : 'false', btnStyle: x.btnOff ? 'opacity:0.5' : '', style: 'display:flex;align-items:center;gap:12px;min-height:48px;padding:10px 16px;border-top:1px solid var(--rz-border);' + (x.on ? 'background:var(--rz-fill-selected);box-shadow:inset 2px 0 0 var(--rz-brand);' : '') + (x.dim ? 'opacity:0.55;' : '') }; };
const rows = (arr) => arr.map((r, i) => (i === 0 ? { ...r, style: r.style.replace('border-top:1px solid var(--rz-border);', '') } : r));
const ff = (arr) => facts(arr);
const ACC = 'demo.razborka@gmail.com';
const ACC_ID = 'ID 48 211 907';
const OLX_TABS = (on, n) => ['Огляд', 'Налаштування оголошень', 'Наявні оголошення'].map((label, i) => ({ label, current: i === on ? 'page' : 'false', count: i === 2 && n ? n : '' }));
// OLX settings screen frame
const olx = (o) => frame({ crumbs: crumbs(o.narrow ? ['OLX'] : ['Налаштування', 'Інтеграції', 'OLX']), head: o.noHead ? null : head('OLX', { sub: o.sub || '' }), tabs: o.tabs === false ? null : OLX_TABS(o.tab || 0, o.tabCount), ...o });
const partsNav = () => nav('Запчастини');
const intNav = () => nav('Інтеграції');
// status → pill tone
const CONN = { none: ['Не підключено', ''], ok: ['Працює', 'ok'], temp: ['Тимчасова помилка', 'warn'], reauth: ['Потрібне підключення', 'danger'], off: ['Відключено', ''] };
const connCard = (st, x) => {
  x = x || {};
  const [t, tone] = CONN[st];
  const canInt = x.canInt !== false;
  const f = [fact('Акаунт', ACC, { sub: ACC_ID }), fact('Остання синхронізація', x.last || '22.10.2026, 14:32', { mono: true, sub: x.lastSub || '' }), fact('Підключив', 'Олег К. · 03.10.2026')];
  const btns = !canInt ? null : st === 'off' ? [sb('Підключити через OLX', 'icon-external-link', 'primary')] : st === 'reauth' ? [sb('Підключити повторно', 'icon-external-link', 'primary'), sb('Відключити', 'icon-unplug', 'ghost')] : [sb('Підключити повторно', 'icon-refresh-cw'), sb('Відключити', 'icon-unplug', 'ghost')];
  return card({ title: 'Акаунт OLX', pill: { text: t, cls: 'rz-pill' + (tone ? ' rz-pill--' + tone : '') }, hint: x.hint || '', facts: facts(f), form: btns || x.caption ? { buttons: btns, caption: x.caption || '', notes: x.notes || [] } : null });
};
const rightsCard = (int, pub) => card({ title: 'Ваші права', hint: 'Права на OLX надає власник у розділі «Команда».', checks: checks([['Керувати інтеграцією OLX', int ? 'є' : 'немає', int ? 'ok' : 'none'], ['Керувати публікаціями OLX', pub ? 'є' : 'немає', pub ? 'ok' : 'none']]), form: { caption: int ? 'Підключення, налаштування оголошень, режим «Усі».' : 'Ви бачите стан підключення без деталей помилок.' } });
const statsCard = (x) => card({ kpis: [
  { label: 'Пов’язано з OLX', value: (x && x.linked) || '214', unit: 'запч.', meta: 'Відкрити у списку', style: 'font-size:var(--rz-fs-display);color:var(--rz-text-strong)' },
  { label: 'Потребують уваги', value: (x && x.attn) || '7', unit: 'запч.', meta: 'Відкрити у списку', style: 'font-size:var(--rz-fs-display);color:var(--rz-warn)' },
  { label: 'Виключено', value: '12', unit: 'запч.', meta: 'Не публікуються автоматично', style: 'font-size:var(--rz-fs-display);color:var(--rz-text-dim)' },
] });
const chk = checks;
export { notice, btn, sb, pl, sbo, row, rows, ff, ACC, ACC_ID, OLX_TABS, olx, partsNav, intNav, CONN, connCard, rightsCard, statsCard, chk };
