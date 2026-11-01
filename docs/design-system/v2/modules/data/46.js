import { finalize } from '../kit.js';
import { npNav } from './np/base.js';
import { s1, s2, s3 } from './np/s1.js';
import { s4, s5, s6 } from './np/s2.js';
import { s7, s8, s9, s10 } from './np/s3.js';
import { s11 } from './np/s4.js';
const FLOWS = [
  ['Підключення', ['int', 'key', 'key-busy', 'snd-load', 'snd', 'till', 'pt-city', 'pt', 'rev', 'rev-busy', 'ok']],
  ['Підключення · відмова й повтор', ['key-err', 'key-busy', 'snd-err', 'snd', 'pt-err', 'pt', 'rev-err', 'ok']],
  ['Зміна налаштувань', ['ov', 'ed', 'ed-sum', 'ed-busy', 'ed-ok', 'draft']],
  ['Відключення інтеграції', ['ov', 'disc-act', 'disc-done', 'disc-int', 'disc-ord']],
  ['Відновлення старого доступу', ['lost', 'rec', 'rec-busy', 'rec-ok', 'rec-done']],
  ['Створення ТТН', ['o-none', 'o-form', 'o-draft', 'o-ready', 'o-confirm', 'o-busy', 'o-created']],
  ['Прив’язування зовнішньої ТТН', ['a-entry', 'a-busy', 'a-prev', 'a-done']],
  ['Перевірка невідомого результату', ['o-unknown', 'e-check', 'e-cand', 'o-created']],
  ['Повернення товару й коштів', ['r-start0', 'r-confirm', 'r-wait', 'r-accept', 'r-await', 'r-refund', 'r-final', 'r-done']],
  ['Список → картка → замовлення', ['l-list', 'l-filter', 'c-created', 'o-created']],
  ['Отримано → післяплата → завершено', ['p-wait', 'p-manual', 'p-sheet', 'p-saved']],
  ['Зміна відділення через нову ТТН', ['e-card', 'e-new', 'e-new-1', 'o-form']],
];
async function build() {
  const sections = finalize([s1(), s2(), s3(), s4(), s5(), s6(), s7(), s8(), s9(), s10(), s11()]);
  const byKey = {};
  sections.forEach((s) => s.frames.forEach((f) => { if (f.key) byKey[f.key] = f; }));
  const flows = FLOWS.map(([title, keys]) => ({ title, steps: keys.map((k, i) => { const f = byKey[k] || { num: '?', label: k, href: '#' }; return { num: f.num, label: f.label, href: f.href, arrow: i < keys.length - 1 }; }) }));
  return { module: { num: '46', group: 'Налаштування · Продажі', title: 'Інтеграція «Нова пошта»', intro: 'Повний шлях Нової пошти в Web: підключення, налаштування й відключення (1–3), ТТН у замовленні (4–6), список і картка накладних (7–8), доставка, оплата, повернення й скасування в замовленні (9–10), передача розробникам (11).', sources: 'Задача UI/UX «Нова пошта» · rozbirka.web/src/cabinet/integrations', flows }, nav: npNav('Інтеграції'), sections };
}

 export default build;
