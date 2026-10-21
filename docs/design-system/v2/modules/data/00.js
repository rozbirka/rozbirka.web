import { toasts, sheet, field, pill, grid, nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
function notify() {
  const T = (rows) => table([['Ситуація'], ['Компонент', 'left', 200], ['Де', 'left', 260], ['Скільки', 'left', 120]], rows, { h: 48 });
  const rules = card({ title: 'Правило', hint: 'Одна дія — одне сповіщення. Не більше трьох тостів одночасно; новий зʼявляється знизу, найстаріший зникає.', table: T([
    [{ main: 'Дію виконано', sub: 'створено, збережено, видалено, скопійовано, надіслано' }, { pill: 'Тост ok', cls: 'ok' }, 'внизу праворуч; на мобільному — над нижнім меню', '6 с'],
    [{ main: 'Дію можна відкотити', sub: 'видалення позиції, архівування' }, { pill: 'Тост ok + «Скасувати»', cls: 'ok' }, 'там само', '10 с'],
    [{ main: 'Нічого не змінилося', sub: 'збережено без змін' }, { pill: 'Тост info', cls: 'info' }, 'там само', '6 с'],
    [{ main: 'Збій, дані не втрачено', sub: 'мережа, друк заблоковано' }, { pill: 'Тост danger + «Повторити»', cls: 'danger' }, 'там само; role="alert"', 'до закриття'],
    [{ main: 'Помилка у формі чи шторці', sub: 'сервер відмовив, поле невалідне' }, { pill: 'Notice danger', cls: 'danger' }, 'над полями; шторка лишається відкритою', 'до виправлення'],
    [{ main: 'Стан, що діє далі', sub: 'архів, інвентаризація, немає прав, підписка' }, { pill: 'Notice / банер', cls: 'warn' }, 'над вмістом сторінки або під шапкою', 'поки діє'],
  ]) });
  const text = card({ title: 'Текст', hint: 'Коротке речення з крапкою. Сутність і назва — на початку, дієслово в минулому часі в кінці: «Замовлення створено.», «Розміщення «Фара передня ліва» збережено.» Без «Успішно» і знаків оклику. Після створення спершу відкриваємо створений запис, потім показуємо тост — без дії «Відкрити».' });
  const cr = crumbs(['Продажі', 'Замовлення', '#1042']);
  const order = (x) => frame({ crumbs: cr, actions: [btn('Друк', 'icon-printer'), btn('', 'icon-ellipsis', 'icon', { aria: 'Інші дії із замовленням' })], head: head('Замовлення #1042', { sub: '● Створено  →  ○ Підтверджено  →  ○ Видано', chips: [pill('Очікує', 'warn')] }),
    blocks: [one([card({ title: 'Позиції', count: '2', table: table([['Запчастина'], ['Кількість', 'right', 100], ['Сума', 'right', 140]], [[{ main: 'Фара передня ліва', sub: '3G1941005' }, { num: 1 }, { num: '4 800 ₴' }], [{ main: 'Колісний диск R17', sub: '5G0601025' }, { num: 4 }, { num: '9 600 ₴' }]], { h: 44 }) })])], ...(x || {}) });
  return [
    frame({ label: 'Правило', crumbs: crumbs(['Дизайн-система', 'Сповіщення']), head: head('Сповіщення про результат операції', { sub: 'Тост — підтвердження того, що користувач щойно зробив. Усе, що вимагає дії або діє далі, — Notice на сторінці.' }), blocks: [one([rules, text])] }),
    order({ label: 'Дію виконано', note: 'тост ok · 6 с', o: toasts([['Замовлення створено.']]) }),
    order({ label: 'Можна відкотити', note: 'тост ok · «Скасувати» · 10 с', o: toasts([['Позицію «Колісний диск R17» видалено.', 'ok', 'Скасувати']]) }),
    order({ label: 'Нічого не змінилося', note: 'тост info', o: toasts([['Нічого не змінилося — набір зон уже такий.', 'info']]) }),
    order({ label: 'Збій', note: 'тост danger · «Повторити» · до закриття', o: toasts([['Браузер заблокував вікно друку.', 'danger', 'Повторити']]) }),
    order({ label: 'Кілька поспіль', note: 'не більше 3 · новий знизу', o: toasts([['Замовлення створено.'], ['Оплату записано.'], ['Переказ виконано.']]) }),
    order({ label: 'Помилка у шторці', note: 'Notice danger над полями · не тост', o: sheet('Новий клієнт', 'Клієнт зʼявиться у списку й буде доступний у замовленнях.', [{ notes: [notice('danger', 'icon-circle-alert', 'Не вдалося зберегти зміни. Перевірте звʼязок і спробуйте ще раз.')] }, { fields: [field('Імʼя', 'Ірина Коваль', { req: true, span: 2 }), field('Телефон', '+380 67 123 45 67', { span: 2, mono: true })] }], { submit: 'Створити клієнта' }) }),
    order({ label: 'Стан, що діє далі', note: 'Notice на сторінці · не тост', notices: [notice('warn', 'icon-lock', 'Замовлення в архіві. Зміни недоступні.')] }),
  ];
}
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["login","invite","onboarding","privacy"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Вхід', route: '/login', source: 'screens/login-messages.ts', unverified: "", frames: recordFrames(S.login) },
    { num: '2', title: 'Запрошення', route: '/invite/:code', source: 'invite-messages.ts', unverified: "", frames: recordFrames(S.invite) },
    { num: '3', title: 'Онбординг', route: '/app (без розбірок)', source: 'OnboardingChecklist.tsx', unverified: "тексти онбордингу", frames: recordFrames(S.onboarding, "Нова розбірка") },
    { num: '4', title: 'Політика конфіденційності', route: '/privacy', source: 'privacy', unverified: "", frames: recordFrames(S.privacy) },
    { num: '5', title: 'Сповіщення про результат операції', route: 'правило для всіх модулів', source: 'components/app/toast.tsx · toast-context.ts · Notice', unverified: 'тривалість 10 с для «Скасувати» і безстроковий danger — пропозиція', frames: notify() }];
  return { module: { num: '00', group: 'Вхід і старт', title: 'Вхід, запрошення, онбординг', intro: "Екрани поза кабінетом: вхід за телефоном і кодом з SMS, запрошення до розбірки, створення першої розбірки, політика конфіденційності.", sources: "login-messages.ts, invite-messages.ts, onboarding, privacy" }, nav: nav(''), sections: finalize(sections) };
}
