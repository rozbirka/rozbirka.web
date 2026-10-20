import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const base = (label, blocks, o) => ({ ...frame({ label, crumbs: crumbs(['Склад', 'Стікери']), actions: [btn('Друк', 'icon-printer', 'primary')], head: head('Стікери'), blocks }), o: o || {} });
  const q = table([['☐', 'left', 36], ['Деталь'], ['QR', 'left'], ['Формат'], ['Копій', 'right']], [[{ check: true }, { main: 'Фара передня ліва', sub: '3G1941005' }, { mono: 'RZ-000604' }, '40×58 мм', { num: 1 }], [{ check: true }, { main: 'Генератор', sub: '03L903023F' }, { mono: 'RZ-000605' }, '40×58 мм', { num: 2 }], [{ check: false }, { main: 'Колісний диск R17', sub: '5G0601025' }, { mono: 'RZ-000611' }, '40×58 мм', { num: 4 }]], { sel: [0, 1] });
  const sections = [{ num: '1', title: 'Друк стікерів', route: '/app/:tenant/stickers', source: 'stickers/messages.ts · components/Print', unverified: 'тексти черги друку', frames: [
    base('Черга друку', [two([card({ title: 'Черга', count: '3', table: q })], [card({ title: 'Попередній перегляд', text: 'Стікер 40×58 мм, чорне на білому. Еталон — components/Print.dc.html.', textStyle: 'margin:0;padding:16px;color:var(--rz-text-muted)' })], 340)]),
    base('Порожньо', [one([stateCard('brand', 'icon-sticker', 'Черга друку порожня', 'Оберіть деталі у списку запчастин і натисніть «Друк стікера».', [sb('До запчастин', 'icon-package')], '', 480, true)])]),
    base('Друк не вдався', [one([card({ title: 'Черга', count: '3', table: q })])], toast('Не вдалося надіслати на друк.', 'danger')),
  ] }];
  return { module: { num: '14', group: 'Склад', title: 'Стікери', intro: 'Друк стікерів деталей і етикеток зон. Друковані форми — чорне на білому (components/Print).', sources: 'stickers/messages.ts, inventory/zone-label-output.ts' }, nav: nav('Стікери'), sections: finalize(sections) };
}
