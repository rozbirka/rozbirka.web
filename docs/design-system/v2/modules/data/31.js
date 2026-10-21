import { nav, frame, crumbs, one, card, stateCard, sb, notice, table, toast, finalize, head, field } from '../kit.js';
export default async function build() {
  const C = crumbs(['Гроші', 'Звіти']);
  const H = head('Звіти', { sub: 'Звіт про продажі за обраний період: PDF формується у фоні, а список нижче показує, на якому він етапі.' });
  const form = (x) => { x = x || {}; return card({ title: 'Новий звіт', hint: 'У звіт потраплять продажі за ці дні включно.', form: {
    fields: [field('Початок періоду', x.from || '15.10.2026', { req: true, icon: 'icon-calendar', mono: true, hint: 'Перший день у звіті' }), field('Кінець періоду', x.to || '21.10.2026', { req: true, icon: 'icon-calendar', mono: true, hint: x.err ? '' : 'Останній день у звіті', error: x.err || '' })],
    notes: [], caption: '', btnNote: '',
    buttons: [{ ...sb(x.busy ? 'Створюємо…' : 'Створити звіт', x.busy ? 'icon-loader-circle rz-spin' : '', 'primary'), off: x.err || x.busy ? 'true' : 'false', style: 'margin-left:auto' + (x.err ? ';opacity:0.5' : '') }] } }); };
  const COLS = [['Період', 'left', 200], ['Створено', 'left', 170], ['Стан'], ['', 'right']];
  const ready = (p, c, size, till) => [{ mono: p }, { mono: c, tone: 'muted' }, { pill: 'Готовий', cls: 'ok', sub: 'PDF · ' + size + ' · доступний до ' + till }, { btns: [['Завантажити PDF', 'icon-download'], ['Друкувати', 'icon-printer']] }];
  const expired = (p, c, gone) => [{ mono: p }, { mono: c, tone: 'muted' }, { pill: 'Прострочений', cls: 'warn', sub: 'Строк зберігання минув ' + gone + ', файл видалено. Створіть новий звіт — він візьме період із форми вгорі.' }, { btns: [['Створити новий звіт', 'icon-refresh-cw']] }];
  const pending = (p, c) => [{ mono: p }, { mono: c, tone: 'muted' }, { pill: 'Формується', cls: 'info', sub: 'PDF збирається у фоні. Можна піти зі сторінки — звіт з’явиться тут.' }, { btns: [['Завантажити PDF', 'icon-download', '', true]] }];
  const failed = (p, c) => [{ mono: p }, { mono: c, tone: 'muted' }, { pill: 'Помилка', cls: 'danger', sub: 'Не вдалося сформувати PDF. Спробуйте ще раз; якщо повториться — напишіть у підтримку.' }, { btns: [['Спробувати ще раз', 'icon-refresh-cw']] }];
  const OLD = [
    expired('01.08 – 07.08.2026', '08.08.2026, 14:22', '07.09.2026'),
    expired('20.07 – 26.07.2026', '26.07.2026, 15:12', '25.08.2026'),
    expired('01.07 – 23.07.2026', '23.07.2026, 22:36', '22.08.2026'),
    expired('01.07 – 12.07.2026', '12.07.2026, 15:05', '11.08.2026'),
    expired('01.06 – 30.06.2026', '02.07.2026, 14:51', '01.08.2026'),
    expired('01.06 – 30.06.2026', '02.07.2026, 14:34', '01.08.2026'),
  ];
  const list = (rows, x) => card({ table: table(COLS, rows, { h: 60, ...(x || {}) }) });
  const F = (label, note, blocks, x) => frame({ label, note, crumbs: C, head: H, blocks, ...(x || {}) });
  const READY = ready('15.10 – 21.10.2026', '21.10.2026, 16:25', '70.6 КБ', '20.11.2026');
  const sections = [
    { num: '1', title: 'Звіти', route: '/app/:tenant/reports', source: 'ReportsScreen.tsx', unverified: 'тексти станів «Формується», «Помилка», порожнього стану й тосту', frames: [
      F('Готовий і прострочені', 'типовий стан', [one([form(), list([READY, ...OLD])])]),
      F('Формується', 'щойно створений, PDF у фоні', [one([form(), list([pending('15.10 – 21.10.2026', '21.10.2026, 16:25'), ...OLD.slice(0, 5)])])]),
      F('Помилка формування', 'стан рядка, не тост', [one([form(), list([failed('15.10 – 21.10.2026', '21.10.2026, 16:25'), ...OLD.slice(0, 5)])])]),
      F('Порожньо', 'ще не створено жодного звіту', [one([form(), stateCard('', 'icon-file-text', 'Звітів ще немає', 'Оберіть період у формі вгорі й натисніть «Створити звіт». PDF сформується у фоні й з’явиться тут.', null, '', '220px')])]),
      F('Некоректний період', 'кінець раніше за початок', [one([form({ from: '21.10.2026', to: '15.10.2026', err: 'Кінець періоду не може бути раніше за початок' }), list([READY, ...OLD.slice(0, 4)])])]),
      F('Звіт створено', 'тост після «Створити звіт»', [one([form(), list([pending('15.10 – 21.10.2026', '21.10.2026, 16:25'), ...OLD.slice(0, 5)])])], { o: toast('Звіт поставлено у чергу. PDF з’явиться у списку.', 'ok') }),
      F('Недоступно на тарифі', 'Звіти закриті планом', [one([stateCard('', 'icon-lock', 'Звіти недоступні на вашому тарифі', 'Перейдіть на тариф зі звітами, щоб формувати PDF про продажі за період.', [sb('Змінити тариф', 'icon-arrow-up-right', 'primary')], '', '320px')])]),
    ] }];
  return { module: { num: '31', group: 'Гроші', title: 'Звіти', intro: 'Звіт про продажі за період: форма періоду, PDF формується у фоні, список показує стан кожного звіту — готовий, формується, прострочений або з помилкою.', sources: 'ReportsScreen.tsx (зі скріншота)' }, nav: nav('Звіти'), sections: finalize(sections) };
}
