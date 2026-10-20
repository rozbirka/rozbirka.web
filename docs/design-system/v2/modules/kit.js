// Shared builders for module pages (v2/modules/NN *.dc.html). Data only — markup lives in each page.
export const RO = 'Поточна підписка не дозволяє цю дію.';
export const READONLY = { chip: 'Кабінет у режимі перегляду', title: 'Підписка неактивна — дані лише для читання.', body: 'Склад, замовлення й історія грошей збереглися повністю, але створювати й змінювати записи не можна, доки підписка не відновиться.', link: 'Перейти до підписки' };
const NAV = [
  ['', [['Головна', 'icon-layout-dashboard']]],
  ['Склад', [['Автомобілі', 'icon-car'], ['Запчастини', 'icon-package'], ['Інвентаризація', 'icon-clipboard-check'], ['Приймання', 'icon-scan-line'], ['Стікери', 'icon-sticker']]],
  ['Продажі', [['Замовлення', 'icon-clipboard-list'], ['Клієнти', 'icon-users']]],
  ['Гроші', [['Фінанси', 'icon-wallet-cards'], ['Звіти', 'icon-chart-column']]],
  ['Налаштування', [['Команда', 'icon-user-round-cog'], ['Підписка', 'icon-credit-card'], ['Інтеграції', 'icon-plug'], ['Бізнес', 'icon-building-2'], ['Профіль', 'icon-circle-user']]],
];
export const nav = (active) => NAV.map(([title, items]) => ({ title, items: items.map(([label, icon]) => ({ label, icon, current: label === active ? 'page' : 'false' })) }));
const P = 'padding:0 12px;';
const TONE = { ok: 'var(--rz-ok)', warn: 'var(--rz-warn)', danger: 'var(--rz-danger)', info: 'var(--rz-info)', muted: 'var(--rz-text-muted)', dim: 'var(--rz-text-dim)', strong: 'var(--rz-text-strong)', brand: 'var(--rz-brand-text)' };
export const crumbs = (arr) => arr.map((label, i) => ({ label, sep: i < arr.length - 1, style: i === arr.length - 1 ? 'color:var(--rz-text-strong);font-weight:600' : 'color:var(--rz-text-muted)' }));
export const btn = (label, icon, kind, x) => ({ label, icon: icon || '', cls: 'rz-btn' + (kind ? ' rz-btn--' + kind.split(' ').join(' rz-btn--') : ''), disabled: false, title: '', aria: '', ...(x || {}) });
export const seg = (labels, on, x) => labels.map((l, i) => { const lab = Array.isArray(l) ? l[0] : l; const sel = Array.isArray(on) ? on.includes(i) : i === on; return { label: lab, dot: Array.isArray(l) ? l[1] : '', pressed: sel ? 'true' : 'false', style: 'display:inline-flex;align-items:center;justify-content:center;gap:6px;height:' + ((x && x.h) || 24) + 'px;padding:0 9px;border:' + (x && x.brand && sel ? '1px solid var(--rz-brand)' : '0') + ';border-radius:var(--rz-r-xs);cursor:pointer;white-space:nowrap;font-size:' + ((x && x.small) ? 'var(--rz-fs-caption)' : 'inherit') + ';font-weight:' + (sel ? 600 : 500) + ';background:' + (sel ? 'var(--rz-fill-selected)' : 'transparent') + ';color:' + (sel ? 'var(--rz-text-strong)' : 'var(--rz-text-muted)') + (x && x.mono ? ';font-family:var(--rz-font-mono)' : '') }; });
export const box = (on, off, round) => 'display:inline-grid;place-items:center;flex:none;width:14px;height:14px;vertical-align:middle;border-radius:' + (round ? 'var(--rz-r-full)' : 'var(--rz-r-xs)') + ';border:1px solid ' + (on ? 'var(--rz-brand)' : 'var(--rz-border-strong)') + ';background:' + (on && !round ? 'var(--rz-brand)' : 'transparent') + ';color:var(--rz-on-brand)' + (off ? ';opacity:0.45' : '');
export const card = (o) => ({ box: 'border:1px solid var(--rz-border);border-radius:var(--rz-r-md);background:var(--rz-surface);overflow:hidden', ...o });
export const one = (cards) => ({ wrap: 'display:grid;gap:14px', cols: [{ style: 'display:grid;gap:14px;align-content:start', cards }] });
export const two = (left, right, w) => ({ wrap: 'display:grid;grid-template-columns:minmax(0,1fr) ' + (w || 340) + 'px;gap:16px;align-items:start', cols: [{ style: 'display:grid;gap:14px;min-width:0', cards: left }, { style: 'display:grid;gap:14px', cards: right }] });
export const grid = (cards, n) => ({ wrap: 'display:grid;gap:14px', cols: [{ style: 'display:grid;grid-template-columns:repeat(' + n + ',minmax(0,1fr));gap:14px;align-items:start', cards }] });
export const stateCard = (cls, icon, title, body, btns, meta, h, unverified) => card({ state: { cls: 'rz-state' + (cls ? ' rz-state--' + cls : ''), role: cls === 'danger' ? 'alert' : 'status', icon, title, body: body || '', btns: btns || null, meta: meta || '', h: (h || 420) + 'px', unverified: !!unverified } });
export const sb = (label, icon, kind) => ({ cls: 'rz-btn' + (kind ? ' rz-btn--' + kind : ''), icon: icon || '', label, off: 'false', style: '' });
export const notice = (tone, icon, text, action, x) => ({ cls: 'rz-notice rz-notice--' + tone, icon, text, action: action || '', title: '', unverified: false, ...(x || {}) });
export const toast = (text, tone, action) => ({ toast: { text, action: action || '', icon: tone === 'danger' ? 'icon-circle-alert' : 'icon-circle-check', iconStyle: 'font-size:var(--rz-icon-md);color:' + (tone === 'danger' ? 'var(--rz-danger)' : 'var(--rz-ok)') } });
export const fact = (k, v, x) => { x = x || {}; return { k, v, sub: x.sub || '', style: 'display:grid;grid-template-columns:' + (x.w || 140) + 'px minmax(0,1fr);gap:12px;padding:8px 0;border-top:1px solid var(--rz-border)', vStyle: 'margin:0;color:' + (TONE[x.tone] || 'var(--rz-text)') + ';' + (x.mono ? 'font-family:var(--rz-font-mono);' : '') + (x.strong ? 'font-weight:600;' : '') }; };
export const facts = (arr) => arr.map((f, i) => (i === 0 ? { ...f, style: f.style.replace(';border-top:1px solid var(--rz-border)', '') } : f));
export const field = (label, value, x) => {
  x = x || {};
  return { label, value: value == null ? '' : String(value), ph: x.ph || '', req: !!x.req, hint: x.hint || '', error: x.error || '', suffix: x.suffix || '', prefix: x.icon || '', select: !!x.select, lock: !!x.lock, area: !!x.area, invalid: x.error ? 'true' : 'false', hideLabel: x.hideLabel ? 'rz-sr' : 'rz-label',
    cell: 'min-width:0;grid-column:span ' + (x.span || 1), group: (x.error ? 'border-color:var(--rz-danger);' : '') + (x.lock ? 'opacity:0.6;' : '') + (x.big ? 'height:48px;' : '') + (x.area ? 'height:72px;align-items:flex-start;padding-top:8px;' : ''),
    input: 'flex:1;width:100%;min-width:0;color:var(--rz-text-strong);' + (x.big ? 'font-size:var(--rz-fs-page);' : 'font-size:var(--rz-fs-input);') + (x.mono || x.big ? 'font-family:var(--rz-font-mono);' : '') + (x.right ? 'text-align:right;' : '') };
};
export const choice = (label, hint, on, off) => ({ label, hint: hint || '', on: on ? 'true' : 'false', style: 'display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid ' + (on ? 'var(--rz-brand)' : 'var(--rz-border-strong)') + ';border-radius:var(--rz-r-md);background:' + (on ? 'var(--rz-row-selected)' : 'transparent') + (off ? ';opacity:0.55' : ''), dot: box(on, false, true) + ';margin-top:2px', dotIn: on ? 'width:6px;height:6px;border-radius:var(--rz-r-full);background:var(--rz-brand)' : 'display:none' });
// rows of selectable list items (search results, tills, receipts)
export const item = (title, meta, x) => { x = x || {}; return { title, meta: meta || '', right: x.right || '', sub: x.sub || '', avatar: x.avatar || '', radio: !!x.radio, radioStyle: box(!!x.on, false, true), radioIn: x.on ? 'width:6px;height:6px;border-radius:var(--rz-r-full);background:var(--rz-brand)' : 'display:none', tag: x.tag || '', style: 'display:flex;align-items:center;gap:12px;min-height:44px;padding:8px 12px;border-top:1px solid var(--rz-border);' + (x.on ? 'background:var(--rz-row-selected);box-shadow:inset 2px 0 0 var(--rz-brand);' : '') + (x.off ? 'opacity:0.5;' : ''), subStyle: 'font-size:var(--rz-fs-micro);font-weight:600;white-space:nowrap;color:' + (TONE[x.subTone] || 'var(--rz-text-muted)'), tagStyle: 'font-size:var(--rz-fs-caption);font-weight:600;white-space:nowrap;color:' + (TONE[x.tagTone] || 'var(--rz-text-muted)') }; };
export const dl = (rows, total, foot) => ({ rows: rows.map(([k, v, tone], i) => ({ k, v, style: 'display:flex;justify-content:space-between;gap:16px;padding:7px 0' + (i ? ';border-top:1px solid var(--rz-border)' : ''), vStyle: 'margin:0;font-family:var(--rz-font-mono);color:' + (TONE[tone] || 'var(--rz-text)') })), total: total ? { k: total[0], v: total[1], style: 'margin:0;font-family:var(--rz-font-mono);font-weight:700;color:' + (TONE[total[2]] || 'var(--rz-text-strong)') } : null, foot: foot ? { title: foot[0], text: foot[1], style: 'font-size:var(--rz-fs-caption);font-weight:600;color:' + (TONE[foot[2]] || 'var(--rz-text-muted)') } : null });
export const checks = (rows) => rows.map(([label, state, s]) => ({ label, state, icon: s === 'ok' ? 'icon-check' : s === 'fail' ? 'icon-x' : s === 'pending' ? 'icon-dot' : '', iconStyle: 'display:grid;place-items:center;width:18px;height:18px;flex:none;border-radius:var(--rz-r-full);border:1px solid ' + (s === 'ok' ? 'transparent' : s === 'fail' ? 'var(--rz-danger)' : 'var(--rz-border-strong)') + ';background:' + (s === 'ok' ? 'var(--rz-ok)' : 'transparent') + ';color:' + (s === 'ok' ? 'var(--rz-on-brand)' : s === 'fail' ? 'var(--rz-danger)' : 'var(--rz-text-dim)'), stateStyle: 'margin-left:auto;font-family:var(--rz-font-mono);font-size:var(--rz-fs-caption);color:' + (s === 'ok' ? 'var(--rz-ok)' : s === 'fail' ? 'var(--rz-danger)' : 'var(--rz-text-muted)') }));
// Generic table. cols: [label, 'right'|'left', width?]. Cells: string | {main,sub} | {pill,cls} | {dot,cls} | {num, tone} | {link} | {mono} | {check:on} | {sub,text} | {meter:pct,label}
export const table = (cols, rows, x) => {
  x = x || {};
  return {
    cols: cols.map(([label, align, w]) => ({ label, check: label === '☐', box: box(false), icon: '', style: P + 'text-align:' + (align || 'left') + (w ? ';width:' + w + 'px' : '') })).map((c) => (c.check ? { ...c, label: '' } : c)),
    rows: rows.map((r, ri) => {
      const on = (x.active === ri), sel = (x.sel || []).includes(ri);
      return { style: 'height:' + (x.h || 40) + 'px;border-top:1px solid var(--rz-border)' + (sel ? ';background:var(--rz-row-selected)' : '') + (on ? ';background:var(--rz-fill-selected);box-shadow:inset 2px 0 0 var(--rz-brand)' : '') + (x.dim && x.dim.includes(ri) ? ';opacity:0.6' : ''),
        cells: r.map((c, ci) => {
          const align = cols[ci] && cols[ci][1] === 'right' ? 'text-align:right;' : '';
          if (c == null || typeof c !== 'object') return { isText: true, text: c == null ? '' : String(c), sub: '', style: P + align + 'color:var(--rz-text-muted)' };
          if ('check' in c) return { isCheck: true, on: c.check ? 'true' : 'false', off: c.off ? 'true' : 'false', title: c.title || '', box: box(c.check, c.off), icon: c.check ? 'icon-check' : '', style: P + 'width:36px' };
          if ('main' in c) return { isMain: true, text: c.main, sub: c.sub || '', style: P };
          if ('pill' in c) return { isPill: true, text: c.pill, pill: 'rz-pill' + (c.cls ? ' rz-pill--' + c.cls : ''), style: P + align };
          if ('dot' in c) return { isPill: true, text: c.dot, pill: 'rz-dot' + (c.cls ? ' rz-dot--' + c.cls : ''), style: P + align };
          if ('num' in c) return { isNum: true, text: String(c.num), lock: !!c.lock, style: P + 'text-align:right;color:' + (TONE[c.tone] || 'var(--rz-text-strong)') };
          if ('link' in c) return { isLink: true, text: c.link, style: P + align };
          if ('mono' in c) return { isText: true, text: c.mono, sub: c.sub || '', style: P + align + 'font-family:var(--rz-font-mono);color:' + (TONE[c.tone] || 'var(--rz-text-strong)') };
          if ('meter' in c) return { isMeter: true, text: c.label, meter: 'rz-meter' + (c.cls ? ' rz-meter--' + c.cls : ''), meterW: 'width:' + Math.min(c.meter, 100) + '%', style: P + 'width:150px' };
          if ('act' in c) return { isAct: true, text: '', style: 'padding:0 6px;width:40px' };
          return { isText: true, text: c.text || '', sub: c.sub || '', style: P + align + 'color:' + (TONE[c.tone] || 'var(--rz-text)') };
        }) };
    }),
  };
};
export const pager = (range, page) => ({ range, page });
export const skelCard = (n, h) => card({ skel: Array.from({ length: n || 10 }, (_, i) => 'height:' + (h || 28) + 'px;width:' + [92, 84, 96, 78, 90, 88, 94, 80, 86, 92, 82, 90][i % 12] + '%') });
export const dialog = (title, text, confirm, kind, x) => ({ scrim: true, dialog: { title, text: text || '', confirm, cls: 'rz-btn rz-btn--' + (kind || 'primary'), busy: false, error: '', sub: '', fields: null, items: null, cancel: true, width: 'width:440px', ...(x || {}) } });
// Sheet groups: {n,title,choices,fields,rows,dl,seg,checks,notes,caption,cols}
export const group = (g) => ({ n: '', title: '', choices: null, fields: null, rows: null, rowsLabel: '', rowsAdd: '', rowsAddOn: false, rowsEmpty: '', rowsSkel: false, dl: null, seg: null, segLabel: '', checks: null, notes: [], caption: '', cols: 2, ...g, colStyle: 'display:grid;grid-template-columns:repeat(' + ((g && g.cols) || 2) + ',minmax(0,1fr));gap:12px' });
export const sheet = (title, desc, groups, x) => ({ scrim: true, sheet: { box: 'position:absolute;top:0;right:0;bottom:0;width:' + ((x && x.w) || 480) + 'px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border-left:1px solid var(--rz-border-strong);background:var(--rz-sheet-body);box-shadow:var(--rz-shadow-dialog)', title, desc: desc || '', busy: false, note: '', noteStyle: 'color:var(--rz-text-muted)', cancel: 'Скасувати', submit: 'Зберегти', submitCls: 'rz-btn rz-btn--primary', submitOff: false, submitTitle: '', secondary: '', top: [], groups: groups.map(group), ...(x || {}) } });
export const menu = (items) => ({ menu: items.map((m, i) => ({ off: 'false', title: '', sep: false, ...m, style: (i === 0 ? 'background:var(--rz-fill-active);' : '') + (m.danger ? 'color:var(--rz-danger);' : '') + (m.off ? 'opacity:0.55' : ''), iconStyle: m.danger ? 'color:var(--rz-danger)' : '' })) });
// Frame: one state of one screen.
export const frame = (o) => ({ label: '', note: '', crumbs: [], actions: [], banner: null, head: null, notices: [], toolbar: null, bulk: null, blocks: [], o: {}, bare: false, ...o, shell: !o.bare });
export const head = (title, x) => ({ title, totals: [], sub: '', chips: null, ...(x || {}) });
export const chip = (text, cls, copy) => ({ text, cls: cls || 'rz-code', copy: !!copy });
export const pill = (text, tone) => chip(text, 'rz-pill' + (tone ? ' rz-pill--' + tone : ''));
export const toolbar = (ph, tabs, filters, x) => ({ query: '', ph, tabs: tabs ? seg(tabs, (x && x.tab) || 0) : null, filters: (filters || []).map((f) => (typeof f === 'string' ? { cls: 'rz-filter', key: '', label: f } : { cls: 'rz-filter rz-filter--set', key: f[0], label: f[1] })), reset: false, end: null, ...(x || {}) });
// Converts a drawer spec (archive/features/drawers.json) + state id into a sheet overlay.
const TONES = { ok: 'ok', warn: 'warn', danger: 'danger', info: 'info' };
const ICON = { ok: 'icon-circle-check', warn: 'icon-triangle-alert', danger: 'icon-circle-alert', info: 'icon-info' };
const SLOT = { seg: ['pair', 'seg', 'chips'], rows: ['radios', 'list', 'skel', 'perm', 'pdf'], dl: ['dl', 'events', 'amount', 'plain'], checks: ['checks'], choices: ['cards'] };
const blockToGroup = (b) => {
  let g = {};
  const out = [g];
  const add = (x) => {
    const slot = Object.keys(SLOT).find((k) => SLOT[k].includes(x.t));
    if ((slot && g[slot] != null) || (slot === 'seg' && g.rows != null) || ((x.t === 'title' || x.t === 'h') && g.title && Object.keys(g).length > 1)) { g = {}; out.push(g); }
    switch (x.t) {
      case 'title': case 'h': g.title = g.title || x.text; break;
      case 'eyebrow': if (g.title) g.n = g.n || x.text; else g.title = x.text; break;
      case 'text': if (x.text) g.caption = (g.caption ? g.caption + ' ' : '') + x.text; break;
      case 'field': (g.fields = g.fields || []).push(field(x.label, x.value, { ph: x.ph, hint: x.hint, error: x.error, mono: x.mono, big: x.big, suffix: x.suffix, select: x.select, req: x.req, icon: x.icon ? 'icon-search' : '', hideLabel: x.hideLabel, span: 2, lock: x.disabled, area: x.textarea })); break;
      case 'row': g.cols = Math.max(2, Math.min(4, x.items.length)); x.items.forEach((it) => (g.fields = g.fields || []).push(it.kind === 'stat' ? field(it.label, it.value, { mono: true, right: true, lock: true }) : it.kind === 'stepper' ? field(it.label, '−  ' + it.value + '  +', { mono: true }) : it.kind === 'seg' ? field(it.label, it.options[it.on], { select: true, mono: true }) : field(it.label, it.value, { ph: it.ph, hint: it.hint, mono: it.mono || it.big, suffix: it.suffix, select: it.select }))); break;
      case 'notice': g.notes = [...(g.notes || []), notice(TONES[x.tone] || 'info', ICON[x.tone] || 'icon-info', [x.text, ...(x.items || [])].filter(Boolean).join(' · '), '', { title: x.title || '', unverified: !!x.unverified })]; break;
      case 'radios': g.rowsLabel = x.legend; g.rows = x.options.map((o) => item(o.label, '', { radio: true, on: o.on, right: o.meta })); break;
      case 'cards': g.title = g.title || x.label; g.choices = x.options.map((o) => choice(o.label, o.hint, o.on)); break;
      case 'pair': g.segLabel = x.label; g.seg = seg(x.options.map((o) => o.label), x.on, { h: 40 }); break;
      case 'seg': g.segLabel = x.hideLabel ? '' : x.label; g.seg = seg(x.options, x.on, { h: 32, mono: x.mono }); break;
      case 'chips': g.segLabel = x.label; g.seg = seg(x.options, x.on || [], { h: 28, mono: true }); break;
      case 'list': g.rowsLabel = x.label || ''; g.rows = (x.rows || []).map((r) => item(r.title, r.meta, { right: r.right, sub: r.sub, subTone: r.subTone, on: r.on, off: r.off, avatar: r.avatar, tag: r.tag, tagTone: r.tagTone })); g.rowsAdd = x.add || ''; g.rowsEmpty = x.empty || (x.prompt ? x.prompt + '. ' + (x.promptText || '') : ''); g.rowsSkel = !!x.skel; if (x.caption) g.caption = x.caption; break;
      case 'dl': g.dl = dl((x.rows || []).map((r) => [r.k, r.v, r.tone]), x.total ? [x.total.k, x.total.v, x.total.tone] : null, x.foot ? [x.foot.title, x.foot.text, x.foot.tone] : null); if (x.label) g.title = g.title || x.label; break;
      case 'events': g.dl = dl(x.rows.map((r) => [r.k, r.v])); g.title = x.label; break;
      case 'amount': g.dl = dl([[x.label, x.value, x.tone]], null, x.note ? [x.note, '', 'muted'] : null); break;
      case 'plain': g.dl = dl([[x.label, x.value]]); break;
      case 'checks': g.checks = checks(x.rows.map((r) => [r.label, r.state, r.s])); break;
      case 'skel': g.rowsSkel = true; g.rows = []; g.rowsLabel = x.label; break;
      case 'switch': (g.fields = g.fields || []).push(field(x.label, x.on ? 'Увімкнено' : 'Вимкнено', { hint: x.hint, lock: x.disabled, span: 2 })); break;
      case 'check': g.caption = (x.on ? '☑ ' : '☐ ') + x.label; break;
      case 'perm': g.title = x.legend + ' · ' + x.count.split('—').pop().trim(); g.rows = x.items.map((i) => item(i.label, '', { radio: false, tag: i.on ? '✓' : '', tagTone: 'brand' })); break;
      case 'presets': g.caption = x.options.join(' · '); break;
      case 'pdf': g.rowsEmpty = x.text; g.rows = []; break;
      case 'btn': g.caption = (g.caption ? g.caption + ' · ' : '') + '[' + x.label + ']'; break;
      case 'arrow': g.caption = '↓'; break;
      case 'panel': x.blocks.forEach(add); break;
    }
  };
  add(b);
  return out.filter((o) => Object.keys(o).length);
};
export const fromDrawer = (d, stateId) => {
  const st = d.states.find((s) => s.id === stateId) || d.states[0];
  let blocks = st.blocks ? st.blocks.slice() : d.blocks.slice();
  if (st.replace) Object.entries(st.replace).forEach(([i, b]) => { blocks[+i] = b; });
  blocks = [...(st.top || []), ...blocks.filter((b) => b && !(b.t === 'text' && !b.text)), ...(st.after || [])];
  const f = { ...d.footer, ...(st.footer || {}) };
  const busy = !!st.busy;
  return sheet(st.title || d.title, st.description !== undefined ? st.description : d.description || d.eyebrow, blocks.flatMap(blockToGroup), {
    w: d.size === 'lg' ? 600 : 480, busy,
    note: f.note || '', noteStyle: 'color:' + (f.noteTone === 'warn' ? 'var(--rz-warn)' : f.noteTone === 'dim' ? 'var(--rz-text-dim)' : 'var(--rz-text-muted)') + (f.noteMono ? ';font-family:var(--rz-font-mono)' : ''),
    cancel: f.cancel || '', submit: busy && f.busyLabel ? f.busyLabel : f.primary || '', submitCls: 'rz-btn ' + (f.danger ? 'rz-btn--danger' : 'rz-btn--primary'),
    submitOff: !!f.disabled || busy, submitTitle: f.disabled ? f.disabledReason || '' : '', secondary: f.secondary || '',
  });
};
export const drawerFrames = (drawers, id, base, label) => { const d = drawers[id]; return d.states.map((s) => ({ ...base(), label: (label || d.name) + ' · ' + s.label, note: s.id === d.states[0].id ? d.source.split(' · ')[0] : '', o: fromDrawer(d, s.id) })); };
export const loadDrawers = () => fetch(new URL('./data/drawers.json', import.meta.url)).then((r) => r.json()).then((j) => j.drawers);
// Screen configs (data/screens/*.json) → frames.
export const loadScreen = (id) => fetch(new URL('./data/screens/' + id + '.json', import.meta.url)).then((r) => r.json());
const toneOf = (cls) => ((cls || '').match(/--(ok|warn|danger|info|dim)/) || [])[1] || '';
const secCard = (s, ro) => {
  const base = { title: s.title || '', count: s.count || '', action: s.action || '', actionOff: !!ro };
  switch (s.type) {
    case 'table': return card({ ...base, table: table(s.columns.map((c) => [c.label, c.align === 'end' ? 'right' : 'left']), s.rows.map((r) => r.map((v, i) => { const c = s.columns[i] || {}; if (c.pill && c.pill[v]) return { pill: v, cls: toneOf(c.pill[v]) }; if (c.mono) return { mono: v }; if (c.align === 'end') return { num: v }; return i === 0 ? { text: v, tone: 'strong' } : v; }))), foot: s.total ? { k: s.total.label, v: s.total.value } : null });
    case 'facts': return card({ ...base, facts: facts(s.rows.map(([k, v, m]) => fact(k || '', v, { mono: m }))) });
    case 'text': return card({ ...base, text: s.text, textStyle: 'margin:0;padding:14px 16px;color:var(--rz-text-muted);text-wrap:pretty' });
    case 'notice': return card({ box: 'display:grid', form: { notes: [notice(s.tone || 'info', s.icon || 'icon-info', s.text)], buttons: s.action ? [sb(s.action)] : null } });
    case 'form': return card({ ...base, form: { fields: s.fields.map((f) => field(f.label, f.value, { ph: f.placeholder, hint: f.hint, mono: /num/.test(f.cls || ''), span: s.fields.length === 1 ? 4 : 2, area: /textarea/.test(f.cls || '') })) } });
    case 'timeline': return card({ ...base, timeline: s.items });
    case 'bars': { const max = Math.max(...s.bars.map((b) => b[1])); return card({ ...base, bars: s.bars.map(([l, v]) => ({ label: l, value: v.toLocaleString('uk-UA'), style: 'height:' + Math.round((v / max) * 140) + 'px;width:100%;border-radius:var(--rz-r-xs) var(--rz-r-xs) 0 0;background:var(--rz-brand-soft);border-top:2px solid var(--rz-brand)' })) }); }
  }
  return card({ ...base });
};
const kpiCard = (kpis) => card({ kpis: kpis.map((k) => ({ label: k.label, value: k.value, unit: k.unit || '', meta: k.meta || '', style: 'font-size:var(--rz-fs-display);color:' + (/warn/.test(k.cls) ? 'var(--rz-warn)' : /dim/.test(k.cls) ? 'var(--rz-text-dim)' : 'var(--rz-text-strong)') })) });
export const recordFrame = (cfg, stateId, navCrumb) => {
  const ov = (cfg.overrides && cfg.overrides[stateId]) || {};
  const c = { ...cfg, ...ov };
  const banner = cfg.stateBanners && cfg.stateBanners[stateId] ? { ...READONLY, ...cfg.stateBanners[stateId] } : stateId === 'readonly' ? READONLY : null;
  const ro = !!banner && stateId === 'readonly';
  const label = (cfg.states || []).find((s) => s[0] === stateId);
  if (cfg.layout === 'auth') {
    const sn = cfg.stateNotices && cfg.stateNotices[stateId];
    const busy = stateId === 'pending';
    return frame({ bare: true, label: label ? label[1] : stateId, head: head(c.title, { eyebrow: c.eyebrow || '', sub: c.subtitle || '' }), notices: sn ? [notice(sn.tone || 'danger', sn.icon || 'icon-circle-alert', sn.text)] : [],
      blocks: (c.fields || c.main) ? [one([c.fields ? card({ box: 'display:grid', form: { fields: c.fields.map((f) => field(f.label, f.value, { ph: f.placeholder, hint: f.hint, mono: f.mode === 'tel' || f.mode === 'otp', span: 4, big: f.mode === 'otp' })), buttons: [{ cls: 'rz-btn rz-btn--primary rz-btn--lg', icon: busy ? 'icon-loader-circle' : '', label: busy ? c.pendingLabel || c.submit : c.submit, off: busy ? 'true' : 'false', style: 'width:100%' }, ...(c.links || []).map((l) => ({ cls: 'rz-btn rz-btn--ghost', icon: '', label: l, off: 'false', style: 'width:100%' }))] } }) : null, ...((c.main || []).map((s) => secCard(s)))].filter(Boolean))] : [] });
  }
  const crumbsArr = [...(c.crumbs || [cfg.eyebrow || navCrumb]), c.title];
  if (stateId === 'loading' && !ov.main) return frame({ label: 'Завантаження', crumbs: crumbs(crumbsArr), blocks: [two([skelCard(6, 36), skelCard(6, 28)], [skelCard(4, 28)], 340)] });
  if (stateId === 'error' && !ov.main) return frame({ label: 'Помилка', crumbs: crumbs(crumbsArr), blocks: [one([stateCard('danger', 'icon-triangle-alert', 'Не вдалося завантажити дані', 'Перевірте зв’язок і спробуйте ще раз.', [sb('Спробувати ще раз', 'icon-refresh-cw')], '', 560, true)])] });
  const main = (c.main || []).map((s) => secCard(s, ro));
  const aside = (c.aside || []).map((s) => secCard(s, ro));
  const left = [...(c.kpis && c.kpis.length ? [kpiCard(c.kpis)] : []), ...main];
  return frame({ label: label ? label[1] : stateId, crumbs: crumbs(crumbsArr), banner,
    actions: (c.actions || []).map((a) => btn(a.label, a.icon, a.variant === 'primary' ? 'primary' : '', { disabled: ro, title: ro ? RO : '' })),
    head: head(c.heading || c.title, { sub: c.subtitle || '', chips: c.chips ? c.chips.map((x) => ({ text: x.text, cls: x.cls, copy: false })) : null }),
    blocks: [aside.length ? two(left, aside, 340) : one(left)] });
};
export const recordFrames = (cfg, nc) => (cfg.states || [['data', 'Дані']]).map(([id]) => recordFrame(cfg, id, nc));
export const listFrames = (cfg, x) => {
  x = x || {};
  const cols = cfg.columns.map((c) => [c.label, c.align === 'end' ? 'right' : 'left']);
  const rowsOf = (rs) => rs.map((r) => cfg.columns.map((c, i) => { const v = r[c.key]; if (c.pill && c.pill[v]) return { pill: v, cls: toneOf(c.pill[v]) }; if (i === 0 && c.mono) return { mono: v, sub: c.sub ? r[c.sub] : '' }; if (i === 0) return { text: v, tone: 'strong', sub: c.sub ? r[c.sub] : '' }; if (c.align === 'end') return { num: v }; if (c.mono) return { mono: v, tone: 'muted' }; return { text: v, sub: c.sub ? r[c.sub] : '' }; }));
  const actions = (ro) => (cfg.actions || []).map((a, i) => btn(a.label, ro ? 'icon-lock' : a.icon, i === (cfg.actions.length - 1) ? 'primary' : '', { disabled: ro, title: ro ? RO : '' }));
  const tb = (q, extra) => toolbar(cfg.searchPlaceholder || cfg.searchLabel, cfg.tabs ? cfg.tabs.map((t) => t.label) : null, cfg.filters || [], { query: q || '', ...(extra || {}) });
  const cr = crumbs([cfg.eyebrow || '', cfg.title].filter(Boolean));
  const tableCard = (rs) => card({ table: table(cols, rowsOf(rs), { h: 44 }), pager: pager('1–' + rs.length + ' з ' + rs.length, 'Сторінка 1 з 1') });
  const st = (cls, icon, title, body, btns, h, unv) => one([stateCard(cls, icon, title, body, btns, '', h || 420, unv)]);
  return [
    frame({ label: 'Дані', crumbs: cr, actions: actions(), head: head(cfg.title), toolbar: tb(), blocks: [one([tableCard(cfg.rows)])] }),
    frame({ label: 'Завантаження', crumbs: cr, actions: actions(), head: head(cfg.title), toolbar: tb(), blocks: [one([skelCard(10)])] }),
    frame({ label: 'Порожньо', crumbs: cr, actions: actions(), head: head(cfg.title), blocks: [st('brand', cfg.icon || 'icon-inbox', cfg.emptyTitle, cfg.emptyBody, cfg.actions && cfg.actions.length ? [sb(cfg.actions[cfg.actions.length - 1].label, cfg.actions[cfg.actions.length - 1].icon, 'primary')] : null, 480)] }),
    frame({ label: 'Нічого не знайдено', crumbs: cr, actions: actions(), head: head(cfg.title), toolbar: tb('zzz', { reset: true }), blocks: [st('', 'icon-search-x', cfg.filteredTitle || 'Нічого не знайдено', cfg.filteredBody || 'Спробуйте змінити пошук або фільтри.', [sb(cfg.resetLabel || 'Скинути фільтри', 'icon-x')], 380, !cfg.filteredTitle)] }),
    frame({ label: 'Помилка', crumbs: cr, actions: actions(), head: head(cfg.title), blocks: [st('danger', 'icon-triangle-alert', 'Не вдалося завантажити дані', 'Перевірте зв’язок і спробуйте ще раз.', [sb('Спробувати ще раз', 'icon-refresh-cw')], 420, true)] }),
    frame({ label: 'Немає прав', crumbs: cr, blocks: [st('', 'icon-lock', 'Недостатньо прав', 'Доступ до цього розділу відкриває власник розбірки в «Команді».', [sb('До головної', 'icon-house')], 540)] }),
    frame({ label: 'Лише перегляд', crumbs: cr, actions: actions(true), banner: READONLY, head: head(cfg.title), toolbar: tb(), blocks: [one([tableCard(cfg.rows)])] }),
  ];
};
export const finalize = (sections) => sections.map((s) => ({ unverified: '', source: '', ...s, anchor: 's' + s.num, href: '#s' + s.num, frames: s.frames.map((f, i) => ({ ...f, num: s.num + '.' + (i + 1), anchor: 'f' + s.num + '-' + (i + 1), href: '#f' + s.num + '-' + (i + 1) })) }));
