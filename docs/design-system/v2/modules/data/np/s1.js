import { item, card, notice, fact, facts, sb, field, choice, one, two, toast, dialog, sheet, stateCard, checks, pill, table, frame, crumbs, head, btn, row, rows, pl, sbo, wiz, navBtns, npScreen, rightsCard, orderFrame, wbFrame, histCard, npNav, SND, SND2, KEY_MASK, TTN, TTN_OLD } from './base.js';

// ── 1. Підключення ──
const keyCard = (x) => { x = x || {}; return card({ title: 'API-ключ Нової пошти', hint: 'Ключ пов’язує Rozbirka з вашим бізнес-кабінетом Нової пошти.', form: {
  notes: [notice('info', 'icon-key-round', 'У бізнес-кабінеті Нової пошти відкрийте «Налаштування» → «Безпека» → «API-ключ» і скопіюйте ключ. Ключ створює власник кабінету.')],
  fields: [field('API-ключ', x.v == null ? '' : x.v, { req: true, mono: true, span: 4, ph: 'Вставте ключ з кабінету Нової пошти', lock: !!x.busy, error: x.err || '', hint: x.err ? '' : 'Після збереження ключ буде приховано.' })],
  buttons: navBtns(x.busy ? 'Перевіряємо…' : 'Перевірити й продовжити', { noBack: true, busy: x.busy, off: !x.v, icon: 'icon-shield-check' }),
  btnNote: x.busy ? 'Перевіряємо ключ у Новій пошті. Це займе кілька секунд.' : !x.v ? 'Вставте ключ, щоб перевірити його.' : '',
} }); };
const senderCard = (x) => { x = x || {}; const s = x.s || {};
  return card({ title: 'Відправник і контактна особа', hint: 'Від імені відправника йдуть усі нові накладні.', form: {
    fields: [
      field('Відправник', s.sender || '', { req: true, select: !s.load, span: 4, lock: !!s.load, ph: s.load ? 'Завантажуємо…' : s.empty ? 'Кабінет не повернув жодного відправника' : s.err ? 'Недоступно' : 'Не обрано', hint: 'Відправник із кабінету Нової пошти. Створити нового тут не можна — тільки в кабінеті перевізника.' }),
      field('Контактна особа', s.contact || '', { req: true, select: !!s.sender && !s.cload, span: 4, lock: !s.sender || !!s.cload, ph: !s.sender ? 'Очікує вибору відправника' : s.cload ? 'Завантажуємо…' : 'Оберіть особу', hint: !s.sender ? 'Спершу оберіть відправника.' : 'Ця особа буде вказана в накладній як контакт відправника.' }),
    ],
    notes: [...(s.empty ? [notice('warn', 'icon-user-x', 'Додайте відправника в бізнес-кабінеті Нової пошти, а потім оновіть список.')] : []), ...(s.err ? [notice('danger', 'icon-cloud-off', 'Не вдалося прочитати відправників із кабінету Нової пошти. Ключ збережено — спробуйте ще раз.')] : []), ...(s.reset ? [notice('info', 'icon-rotate-ccw', 'Відправника змінено, тому контактну особу скинуто. Оберіть контакт нового відправника.')] : [])],
    buttons: s.empty || s.err ? [sb('Оновити список', 'icon-refresh-cw'), ...navBtns('Продовжити', { off: true })] : navBtns('Продовжити', { off: !s.contact }),
  } }); };
const listCard = (title, items, x) => card({ title, hint: (x && x.hint) || '', items: rows(items) });
const tillCard = (x) => { x = x || {}; return card({ title: 'Каса для післяплати', hint: 'Куди зараховувати післяплату, коли клієнт забере посилку.', form: {
  choices: [choice('Основна каса', 'UAH · післяплата зарахується автоматично', x.on === 0), choice('Каса магазину', 'UAH', x.on === 1), choice('Продовжити без каси', 'Вносити вручну', x.on === 2)],
  notes: x.on === 2 ? [notice('warn', 'icon-hand-coins', 'Без каси післяплату потрібно буде вносити вручну в замовлення.')] : [],
  caption: 'Показано лише активні каси з гривнею. Касу можна змінити пізніше в налаштуваннях інтеграції.',
  buttons: navBtns('Продовжити'),
} }); };
const pointCard = (x) => { x = x || {}; return card({ title: 'Точка відправлення', hint: 'Звідки ви відправляєте посилки. Підставляється у відправника накладної.', form: {
  fields: [
    field('Населений пункт', x.city || '', { req: true, icon: 'icon-search', span: 2, ph: 'Почніть вводити назву', hint: x.cityHint || (x.city ? 'Обрано з довідника Нової пошти.' : 'Почніть вводити назву — підкажемо з довідника Нової пошти.'), error: x.cityErr || '' }),
    field('Відділення відправлення', x.branch || '', { req: true, select: !!x.cityOk, span: 2, lock: !x.cityOk, ph: !x.cityOk ? 'Спершу оберіть населений пункт.' : x.bload ? 'Завантажуємо…' : 'Оберіть відділення', hint: x.cityOk ? 'Показані лише відділення, які приймають відправлення.' : '' }),
  ],
  notes: x.notes || [],
  buttons: x.btns || navBtns('Продовжити', { off: !x.branch }),
} }); };
const reviewCard = (x) => { x = x || {}; return card({ title: 'Перевірте дані підключення', hint: 'Натисніть «Змінити», щоб повернутися до кроку. Введене на інших кроках не зміниться.', items: rows([
  row('API-ключ', { meta: KEY_MASK + ' · перевірено', btn: 'Змінити', btnOff: x.busy }),
  row('Відправник', { meta: SND.name + ' · ' + SND.tin, btn: 'Змінити', btnOff: x.busy }),
  row('Контактна особа', { meta: SND.contact + ' · ' + SND.phone, btn: 'Змінити', btnOff: x.busy }),
  row('Каса для післяплати', { meta: x.manual ? 'Без каси · післяплату вносять вручну' : SND.till, btn: 'Змінити', btnOff: x.busy }),
  row('Точка відправлення', { meta: SND.city + ' · ' + SND.branch, btn: 'Змінити', btnOff: x.busy }),
]) }); };
const reviewAct = (x) => { x = x || {}; return card({ form: { notes: x.notes || [], caption: 'Після підключення доставку можна оформлювати з картки замовлення. Накладні створюються лише вручну.', buttons: navBtns(x.busy ? 'Підключаємо…' : 'Завершити підключення', { busy: x.busy, icon: 'icon-check' }) } }); };
const OV = (x) => { x = x || {}; return [
  card({ title: 'Стан підключення', pill: pl(x.stText || 'Підключення працює', x.stTone || 'ok'), hint: x.stHint || 'Ключ приймається сервісом. Довідники міст і відділень доступні.', facts: facts([fact('API-ключ', KEY_MASK, { mono: true, sub: x.keySub || 'перевірено 25.10.2026, 19:40' }), fact('Доступ', x.access || 'Працює')]) }),
  card({ title: 'Відправлення', pill: x.changed ? pl('Оновлено', 'ok') : null, facts: facts([fact('Відправник', (x.s || SND).name, { sub: (x.s || SND).tin }), fact('Контактна особа', (x.s || SND).contact, { sub: (x.s || SND).phone }), fact('Точка відправлення', SND.city + ' · ' + SND.branch), fact('Каса для післяплати', x.manual ? 'Без каси · вручну' : SND.till)]),
    form: x.ro ? { caption: 'Змінювати налаштування й відключати інтеграцію може власник або користувач із правом «Налаштування інтеграцій».' } : { buttons: x.btns || [sb('Змінити налаштування', 'icon-pencil'), sb('Відключити', 'icon-unplug', 'ghost')] } }),
]; };
const overview = (x) => { x = x || {}; return npScreen({ tab: 0, notices: x.notices || [], o: x.o || {}, blocks: [two(OV(x), [rightsCard(!x.ro)], 300)], ...(x.f || {}) }); };

const s1 = () => ({ num: '1', title: 'Підключення Нової пошти', route: '/settings/integrations/:id/connect', source: 'Задача §1 · NovaPoshtaScreen, delivery-preferences-panel, dispatch-point-form', unverified: 'інструкція до ключа, назви кроків, «Очікує вибору відправника», тексти виходу з майстра',
  annot: ['Майстер із 5 кроків. Праворуч прогрес: завершені кроки показують вибране значення. «Назад» повертає на попередній крок без втрати введеного.', 'Помилки з’являються лише після дії: до «Перевірити й продовжити» не завантажуємо відправників і не показуємо їхніх помилок.', 'Залежні поля: зміна відправника скидає контакт (1.9), зміна міста скидає відділення. Без міста й відділення завершити не можна.', 'Вихід із незавершеного майстра → підтвердження (1.18). Ключ, уже збережений на кроці 1, лишається; решта вибору втрачається.', 'Фокус: після переходу кроку — на заголовок кроку; після помилки — на поле з помилкою або на повідомлення.'],
  frames: [
    { ...npScreen({ tabs: false, crumbs: crumbs(['Налаштування', 'Інтеграції']), head: head('Інтеграції'), blocks: [one([card({ title: 'Доступні до підключення', table: table([['Інтеграція'], ['Призначення'], ['Стан'], ['', 'right', 140]], [[{ main: 'Нова пошта' }, 'Доставка Україною між відділеннями', { pill: 'Не підключено' }, { btns: [['Підключити', '', 'primary']] }], [{ main: 'OLX' }, 'Публікація запчастин', { pill: 'Підключено', cls: 'ok' }, { act: 1 }]], { h: 48 }) })])] }), key: 'int', label: 'Точка входу', note: 'список інтеграцій' },
    { ...wiz(0, [keyCard()]), key: 'key', label: 'Крок 1 · ключ' },
    { ...wiz(0, [keyCard({ v: 'a7f3c2e9b41d8f06e5c3a2b17d9e4f80', busy: true })]), key: 'key-busy', label: 'Крок 1 · перевірка' },
    { ...wiz(0, [keyCard({ v: 'a7f3c2e9b41d8f06e5c3a2b17d9e4f8', err: 'Нова пошта не прийняла ключ. Перевірте, чи скопійовано його повністю, і спробуйте ще раз.' })]), key: 'key-err', label: 'Крок 1 · ключ відхилено', note: 'ключ лишається в полі, фокус на полі' },
    { ...wiz(1, [senderCard({ s: { load: true } })]), key: 'snd-load', label: 'Крок 2 · завантаження' },
    { ...wiz(1, [senderCard({ s: { sender: SND.name + ' · ' + SND.tin } }), listCard('Контакти відправника', [row(SND.contact, { meta: SND.phone, radio: false }), row('Марія Коваль', { meta: '+380 63 552 10 04', radio: false })], { hint: 'Список відкрито з поля «Контактна особа»' })]), key: 'snd-pick', label: 'Крок 2 · вибір контакту' },
    { ...wiz(1, [senderCard({ s: { sender: SND.name + ' · ' + SND.tin, contact: SND.contact + ' · ' + SND.phone } })]), key: 'snd', label: 'Крок 2 · заповнено' },
    { ...wiz(1, [senderCard({ s: { empty: true } })]), key: 'snd-empty', label: 'Крок 2 · немає відправників' },
    { ...wiz(1, [senderCard({ s: { err: true } })]), key: 'snd-err', label: 'Крок 2 · помилка' },
    { ...wiz(1, [senderCard({ s: { sender: SND2.name + ' · ' + SND2.tin, reset: true } })]), key: 'snd-reset', label: 'Крок 2 · відправника змінено', note: 'контакт скинуто' },
    { ...wiz(2, [tillCard({ on: 0 })]), key: 'till', label: 'Крок 3 · каса' },
    { ...wiz(2, [tillCard({ on: 2 })]), key: 'till-none', label: 'Крок 3 · без каси', note: 'не блокує наступний крок' },
    { ...wiz(3, [pointCard({ city: 'Киї', cityHint: ' ' }), listCard('Довідник Нової пошти · 3 збіг.', [row('Київ', { meta: 'м. Київ', on: true }), row('Київська Русанівка', { meta: 'Київська обл., Бориспільський р-н' }), row('Київець', { meta: 'Львівська обл.' })])]), key: 'pt-city', label: 'Крок 4 · пошук міста' },
    { ...wiz(3, [pointCard({ city: 'Кивї', cityErr: 'У довіднику немає населеного пункту з такою назвою. Перевірте написання або введіть коротший запит.' })]), key: 'pt-empty', label: 'Крок 4 · місто не знайдено' },
    { ...wiz(3, [pointCard({ city: 'Київ', cityOk: true, bload: true })]), key: 'pt-load', label: 'Крок 4 · відділення завантажуються' },
    { ...wiz(3, [pointCard({ city: 'Київ', cityOk: true, notes: [notice('danger', 'icon-cloud-off', 'Не вдалося завантажити відділення. Місто збережено — спробуйте ще раз.')], btns: [sb('Спробувати ще раз', 'icon-refresh-cw'), ...navBtns('Продовжити', { off: true })] })]), key: 'pt-err', label: 'Крок 4 · помилка відділень' },
    { ...wiz(3, [pointCard({ city: 'Київ', cityOk: true, branch: SND.branch })]), key: 'pt', label: 'Крок 4 · заповнено' },
    { ...wiz(1, [senderCard({ s: { sender: SND.name + ' · ' + SND.tin } })], { o: dialog('Вийти з підключення?', 'Нова пошта залишиться непідключеною.', 'Вийти', 'danger', { items: ['Перевірений ключ збережено — наступного разу почнете з кроку 2.', 'Вибраний відправник і контакт не збережуться.'], width: 'width:460px' }) }), key: 'exit', label: 'Вихід із майстра', note: 'фокус на «Скасувати»' },
    { ...wiz(4, [reviewCard(), reviewAct()]), key: 'rev', label: 'Крок 5 · перевірка' },
    { ...wiz(4, [reviewCard({ busy: true }), reviewAct({ busy: true })]), key: 'rev-busy', label: 'Збереження' },
    { ...wiz(4, [reviewCard(), reviewAct({ notes: [notice('danger', 'icon-circle-alert', 'Не вдалося завершити підключення. Усі введені дані збережено — спробуйте ще раз.')] })]), key: 'rev-err', label: 'Помилка збереження' },
    { ...overview({ o: toast('Нову пошту підключено. Доставку можна оформлювати із замовлень.', 'ok') }), key: 'ok', label: 'Активна інтеграція' },
    { ...wiz(0, [keyCard()], { narrow: true, h: 900, blocks: [one([keyCard()])] }), key: 'key-n', label: 'Крок 1 · вузький', note: 'прогрес — рядок «Крок 1 з 5» у шапці' },
  ] });

// ── 2. Підключена інтеграція: зміна налаштувань ──
const editCards = (x) => { x = x || {}; const s = x.s || SND2; return [
  card({ form: { notes: [notice('info', 'icon-info', 'Зміни застосовуватимуться лише до нових накладних. Уже створені накладні залишаться без змін.')] } }),
  card({ title: 'Відправлення', form: { fields: [
    field('Відправник', s.name + ' · ' + s.tin, { select: true, span: 4, lock: x.busy, hint: x.changedS ? 'Змінено · було ' + SND.name : 'Відправник із кабінету Нової пошти.' }),
    field('Контактна особа', s.contact + ' · ' + s.phone, { select: true, span: 4, lock: x.busy }),
    field('Точка відправлення', SND.city + ' · ' + SND.branch, { select: true, span: 4, lock: x.busy }),
    field('Каса для післяплати', SND.till, { select: true, span: 4, lock: x.busy, hint: 'Нова каса не переносить уже зареєстровані оплати.' }),
  ], notes: x.notes || [] } }),
]; };
const editFrame = (x, o) => npScreen({ tab: 3, actions: [btn('Скасувати', '', '', { disabled: !!(x && x.busy) }), btn(x && x.busy ? 'Зберігаємо…' : 'Перевірити зміни', x && x.busy ? 'icon-loader-circle' : 'icon-shield-check', 'primary', { disabled: !!(x && x.busy) })], blocks: [two(editCards(x), [rightsCard(true)], 300)], ...(o || {}) });
const CH = ['Відправник: ' + SND.name + ' → ' + SND2.name, 'Контактна особа: ' + SND.contact + ' → ' + SND2.contact, 'Точка відправлення й каса не змінюються.', 'Чернетки доставки в 2 відкритих замовленнях треба буде перевірити перед створенням ТТН.'];
const deliv = (x) => card({ title: 'Доставка · Нова пошта', pill: pl(x.pill || 'Чернетка', x.tone || ''), facts: facts([fact('Отримувач', 'Ірина Коваль · +380 67 214 55 08'), fact('Куди', 'Львів · Відділення №5'), fact('Відправник', x.sender || SND.name, { tone: x.senderTone || '' }), fact('Вартість доставки', x.price || '128 ₴', { mono: true, tone: x.priceTone || '' , sub: x.priceSub || '' })]), form: { notes: x.notes || [], buttons: x.btns || null } });
const DISC_KEEP = ['Створені ТТН, історія, прив’язки до замовлень і налаштування збережуться й лишаться доступними для перегляду.', 'Нові ТТН і всі операції через Нову пошту стануть недоступні: друк, редагування, скасування, оновлення статусу.', 'Фонове відстеження зупиниться — статуси накладних більше не оновлюватимуться.', 'Відправлення в Новій пошті не скасовуються.'];
const discDlg = (active) => dialog('Відключити Нову пошту?', active ? 'Є відправлення, які ще в дорозі.' : 'Інтеграцію можна підключити знову пізніше.', 'Відключити', 'danger', { items: active ? ['3 ТТН у дорозі, 2 з них із післяплатою 8 400 ₴. Після відключення їхні статуси не оновлюватимуться — стежте за ними в кабінеті Нової пошти, а післяплату вносьте в замовлення вручну.', ...DISC_KEEP] : DISC_KEEP, width: 'width:540px' });
const OFF_NOTE = notice('info', 'icon-unplug', 'Нові ТТН і операції через Нову пошту недоступні, статуси не оновлюються. Створені накладні, історія й прив’язки до замовлень доступні для перегляду. Відправлення в Новій пошті не скасовано.', '', { title: 'Інтеграцію відключено' });
const offOverview = (o) => overview({ stText: 'Відключено', stTone: '', stHint: 'Відключив Олег К. · 28.10.2026, 10:14. Ключ і налаштування збережено.', access: 'Зупинено', keySub: 'збережено', btns: [sb('Підключити знову', 'icon-plug', 'primary')], notices: [OFF_NOTE], f: { head: head('Нова пошта', { sub: 'Доставка Україною між відділеннями.', chips: [pill('Відключена', '')] }) }, ...(o || {}) });
const OFF_ORD = notice('info', 'icon-unplug', 'Інтеграцію з Новою поштою відключено 28.10.2026. Статус ТТН не оновлюється — останній відомий показано нижче. Дії з накладною недоступні.', '');
const offWbCards = () => [
  card({ title: 'Доставка', pill: pl('Відправлено', 'info'), hint: 'Останній відомий статус · 28.10.2026, 09:50', facts: facts([fact('Статус НП', 'Прямує до міста одержувача'), fact('Отримувач', 'Ірина Коваль · +380 67 214 55 08'), fact('Маршрут', 'Київ №12 → Львів №5'), fact('Посилка', '1 місце · 4,2 кг · 60×40×30 см', { mono: true })]), form: { buttons: [sbo('Друк етикетки', 'icon-printer', '', true), sbo('Оновити статус', 'icon-refresh-cw', '', true), sbo('Скасувати ТТН', 'icon-ban', 'ghost', true)] } }),
  histCard([{ icon: 'icon-unplug', event: 'Інтеграцію відключено', detail: 'Олег К. · статуси не оновлюються', date: '28.10.2026, 10:14' }, { icon: 'icon-truck', event: 'Передано перевізнику', detail: 'Київ №12', date: '26.10.2026' }, { icon: 'icon-file-plus', event: 'ТТН створено', detail: 'Олег К.', date: '25.10.2026' }]),
];
const s2 = () => ({ num: '2', title: 'Підключена інтеграція, зміна налаштувань і відключення', route: '/settings/integrations/:id', source: 'Задача §2 · NovaPoshtaScreen, delivery-preferences-panel', unverified: 'підсумок змін, конфлікт паралельних змін, повідомлення в чернетці, «Підключити знову» (чи потрібна повторна перевірка ключа), друк етикетки після відключення',
  annot: ['Ключ ніколи не показується відкритим текстом — лише маска й дата перевірки.', '«Змінити налаштування» → вкладка «Налаштування» → «Перевірити зміни» → підсумок (2.3) → збереження → оновлений огляд. Скасування або невдала перевірка лишають чинні налаштування.', 'Після зміни відправника, точки чи маршруту стара сума доставки й депозиту не показується як актуальна (2.9).', 'Відключення (2.12–2.18): «Відключити» → підтвердження з наслідками; якщо є ТТН у дорозі чи з очікуваною післяплатою — окремо називаємо їх. Зберігаються ТТН, історія, прив’язки й налаштування; блокуються нові ТТН і всі операції через API; фонове відстеження й push-підписка вимикаються. Відправлення в НП не скасовуються.', 'Запити, розпочаті до відключення, можуть завершитися — їхній результат записується в історію як звичайно.', 'Після відключення збережені дані лишаються для перегляду; дії, що йдуть у Нову пошту, вимкнені з поясненням (2.16–2.17).'],
  frames: [
    { ...overview(), key: 'ov', label: 'Огляд' },
    { ...editFrame({ changedS: true }), key: 'ed', label: 'Редагування' },
    { ...editFrame({ changedS: true }, { o: dialog('Зберегти зміни підключення?', 'Перевірено в Новій пошті. Зміни діятимуть для нових накладних.', 'Зберегти зміни', 'primary', { items: CH, width: 'width:520px' }) }), key: 'ed-sum', label: 'Підсумок змін' },
    { ...editFrame({ changedS: true, busy: true }), key: 'ed-busy', label: 'Збереження' },
    { ...overview({ s: SND2, changed: true, o: toast('Налаштування збережено. Вони діятимуть для нових накладних.', 'ok') }), key: 'ed-ok', label: 'Оновлений огляд' },
    { ...editFrame({ changedS: true, notes: [notice('danger', 'icon-user-x', 'Нова пошта не підтвердила відправника «' + SND2.name + '» для цього ключа. Чинні налаштування не змінено.')] }), key: 'ed-bad', label: 'Перевірка не пройшла' },
    { ...editFrame({ changedS: true }, { notices: [notice('danger', 'icon-circle-alert', 'Не вдалося зберегти зміни. Введене збережено — спробуйте ще раз.', 'Зберегти ще раз')] }), key: 'ed-err', label: 'Помилка збереження' },
    { ...editFrame({ changedS: true }, { notices: [notice('warn', 'icon-users', 'Поки ви редагували, налаштування змінив Олег К. (19:42). Оновіть дані, перевірте зміни ще раз і збережіть.', 'Оновити дані', { title: 'Налаштування вже змінено' })] }), key: 'ed-conf', label: 'Конфлікт паралельних змін' },
    { ...orderFrame({ blocks: [two([deliv({ sender: SND2.name, senderTone: 'warn', price: '—', priceSub: 'було 128 ₴, розрахунок застарів', priceTone: 'dim', notes: [notice('warn', 'icon-refresh-cw', 'Відправника в налаштуваннях Нової пошти змінено. Перевірте дані відправника й розрахуйте доставку заново, щоб створити ТТН.', '', { title: 'Перевірте відправника' })], btns: [sb('Перевірити й розрахувати', 'icon-calculator', 'primary'), sbo('Створити накладну', 'icon-file-plus', '', true)] })], [card({ title: 'Оплата', facts: facts([fact('До сплати', '9 600 ₴', { mono: true }), fact('Депозит', '—', { mono: true, sub: 'буде перераховано' })]) })], 340)] }), key: 'draft', label: 'Чернетка після зміни', note: 'замовлення #361' },
    { ...overview({ ro: true }), key: 'ov-ro', label: 'Без права змін' },
    { ...npScreen({ narrow: true, h: 1000, blocks: [one(OV())] }), key: 'ov-n', label: 'Огляд · вузький' },
    { ...overview({ o: discDlg(false) }), key: 'disc', label: 'Відключення · підтвердження', note: 'фокус на «Скасувати»' },
    { ...overview({ o: discDlg(true) }), key: 'disc-act', label: 'Відключення · є ТТН у дорозі' },
    { ...offOverview({ o: toast('Нову пошту відключено. Дані збережено.', 'info') }), key: 'disc-done', label: 'Інтеграцію відключено' },
    { ...npScreen({ tabs: false, crumbs: crumbs(['Налаштування', 'Інтеграції']), head: head('Інтеграції'), blocks: [one([card({ title: 'Інтеграції', table: table([['Інтеграція'], ['Призначення'], ['Стан'], ['', 'right', 160]], [[{ main: 'Нова пошта' }, 'Доставка Україною між відділеннями', { pill: 'Відключено' }, { btns: [['Підключити знову', '', '']] }], [{ main: 'OLX' }, 'Публікація запчастин', { pill: 'Підключено', cls: 'ok' }, { act: 1 }]], { h: 48 }) })])] }), key: 'disc-int', label: 'Список інтеграцій · відключено' },
    { ...orderFrame({ blocks: [two([deliv({ pill: 'Відправлено', tone: 'info', notes: [OFF_ORD], btns: [sbo('Друк етикетки', 'icon-printer', '', true), sbo('Оновити статус', 'icon-refresh-cw', '', true), sb('Відкрити ТТН', 'icon-external-link', 'ghost')] })], [payCard()], 340)] }), key: 'disc-ord', label: 'Замовлення з ТТН · після відключення' },
    { ...orderFrame({ blocks: [two([card({ title: 'Доставка · Нова пошта', hint: 'Замовлення поки не їде поштою.', form: { notes: [notice('info', 'icon-unplug', 'Інтеграцію з Новою поштою відключено. Щоб оформити доставку, підключіть її знову в налаштуваннях.')], buttons: [sbo('Оформити доставку', 'icon-truck', 'primary', true), sb('Відкрити інтеграцію', 'icon-settings', 'ghost')] } })], [card({ title: 'Оплата', facts: facts([fact('До сплати', '9 600 ₴', { mono: true }), fact('Сплачено', '5 400 ₴', { mono: true })]) })], 340)] }), key: 'disc-new', label: 'Замовлення без ТТН · після відключення' },
    { ...wbFrame({ chips: [pill('Відправлено', 'info'), pill('Не оновлюється', '')], actions: [], notices: [OFF_ORD], blocks: [two(offWbCards(), [payCard()], 320)] }), key: 'disc-wb', label: 'Картка ТТН · лише перегляд' },
  ] });

// ── 3. Відновлення доступу до старих накладних ──
const lostNote = (ro) => notice('danger', 'icon-key-round', ro ? 'Ця накладна створена через попередній кабінет Нової пошти, і доступу до нього більше немає. Статус не оновлюється. Відновити доступ може власник або користувач із правом «Налаштування інтеграцій».' : 'Ця накладна створена через попередній кабінет Нової пошти, і його ключ більше не діє. Статус не оновлюється з 02.10.2026. Дані й історія нижче збережені.', ro ? '' : 'Відновити доступ', { title: 'Доступ до накладної втрачено' });
const wbCards = () => [
  card({ title: 'Доставка', pill: pl('Відправлено', 'info'), hint: 'Останній відомий статус · 02.10.2026, 11:20', facts: facts([fact('Статус НП', 'Прибула у відділення'), fact('Отримувач', 'Петро Сидоренко · +380 93 760 11 25'), fact('Маршрут', 'Київ №12 → Одеса №44'), fact('Посилка', '1 місце · 4,2 кг · 60×40×30 см', { mono: true })]) }),
  histCard([{ icon: 'icon-file-plus', event: 'ТТН створено', detail: 'Олег К.', date: '29.09.2026' }, { icon: 'icon-truck', event: 'Передано перевізнику', detail: 'Київ №12', date: '30.09.2026' }, { icon: 'icon-key-round', event: 'Доступ втрачено', detail: 'ключ кабінету замінено', date: '02.10.2026' }]),
];
const payCard = () => card({ title: 'Оплата', pill: pl('Очікуємо післяплату', 'warn'), facts: facts([fact('Післяплата', '4 200 ₴', { mono: true }), fact('Зареєстровано', '0 ₴', { mono: true })]) });
const lostWb = (o) => wbFrame({ num: TTN_OLD, sub: 'Замовлення #342 · створена 29.09.2026', chips: [pill('Відправлено', 'info'), pill('Немає доступу', 'danger')], notices: [lostNote(o && o.ro)], blocks: [two(wbCards(), [payCard()], 320)], ...(o || {}) });
const recSheet = (x) => { x = x || {}; return sheet('Відновити доступ до старих накладних', 'Ключ попереднього кабінету Нової пошти потрібен лише для накладних, створених через нього.', [
  { title: 'Накладні без доступу · 14', rows: [['20 4500 1187 2209', '#342 · Відправлено'], ['20 4500 1093 8811', '#337 · Отримано'], ['20 4500 0988 1402', '#331 · Отримано']].map(([t, m]) => ({ ...rowItem(t, m) })), rowsAdd: '', caption: 'І ще 11 накладних за 08–09.2026.' },
  { notes: [notice('info', 'icon-info', 'Поточне підключення для нових ТТН не зміниться. Старий ключ використовується лише для читання цих накладних.')] },
  { fields: [field('Ключ попереднього кабінету', x.v || '', { req: true, mono: true, span: 2, ph: 'Вставте ключ', lock: !!x.busy || !!x.ok, error: x.err || '' })], cols: 2 },
  ...(x.ok ? [{ title: 'Результат перевірки', checks: checks([['Ключ прийнято Новою поштою', 'так', 'ok'], ['Кабінет збігається з накладними', '14 з 14', 'ok']]) }] : []),
  ...(x.partial ? [{ title: 'Результат перевірки', checks: checks([['Ключ прийнято Новою поштою', 'так', 'ok'], ['Кабінет збігається з накладними', '0 з 14', 'fail']]) }] : []),
], { w: 520, busy: !!x.busy, top: x.top || [], submit: x.ok ? 'Застосувати' : x.busy ? 'Перевіряємо…' : 'Перевірити доступ', submitOff: !x.v || !!x.busy || !!x.partial, note: x.ok ? 'Доступ підтверджено' : '', noteStyle: 'color:var(--rz-ok)' }); };
const rowItem = (t, m) => item(t, m);
const s3 = () => ({ num: '3', title: 'Відновлення доступу до старих накладних', route: 'ТТН / замовлення → «Відновити доступ»', source: 'Задача §3', unverified: 'усі тексти розділу',
  annot: ['Вхід: картка старої ТТН (3.1) або блок доставки в замовленні (3.2). Після застосування — повернення до тієї ж картки (3.9).', 'Успіх показується лише після підтвердженої перевірки. Ключ іншого кабінету, непідтверджений доступ і помилка НП — без «успіху», з повтором.', 'Локальні дані й історія накладної видимі завжди. Без права «Налаштування інтеграцій» — пояснення замість форми.', 'Фокус: при відкритті шторки — на поле ключа; після помилки — на повідомлення під полем.'],
  frames: [
    { ...lostWb(), key: 'lost', label: 'Картка ТТН · доступ втрачено' },
    { ...orderFrame({ orderTone: 'info', blocks: [two([deliv({ pill: 'Немає доступу', tone: 'danger', sender: SND.name + ' (старий кабінет)', price: '86 ₴', notes: [notice('danger', 'icon-key-round', 'Статус ТТН ' + TTN_OLD + ' не оновлюється: ключ попереднього кабінету більше не діє.', '')], btns: [sb('Відновити доступ', 'icon-key-round', 'primary'), sb('Відкрити ТТН', 'icon-external-link', 'ghost')] })], [payCard()], 340)] }), key: 'lost-ord', label: 'Замовлення · доступ втрачено' },
    { ...lostWb({ o: recSheet() }), key: 'rec', label: 'Шторка · ключ' },
    { ...lostWb({ o: recSheet({ v: 'f81c0e4ab27d93c6e5b1a0d4c3f29e71', busy: true }) }), key: 'rec-busy', label: 'Перевірка' },
    { ...lostWb({ o: recSheet({ v: 'f81c0e4ab27d93c6e5b1a0d4c3f29e71', ok: true }) }), key: 'rec-ok', label: 'Доступ підтверджено' },
    { ...lostWb({ o: recSheet({ v: 'a7f3c2e9b41d8f06e5c3a2b17d9e4f80', err: 'Це ключ поточного кабінету. Накладні створено через інший кабінет — вставте його ключ.' }) }), key: 'rec-other', label: 'Ключ іншого кабінету' },
    { ...lostWb({ o: recSheet({ v: '0d2e19b7c4a83f6e1b5d9c0a7e24f3b8', partial: true, top: [notice('warn', 'icon-shield-alert', 'Ключ дійсний, але жодна з 14 накладних не належить цьому кабінету. Доступ не відновлено.')] }) }), key: 'rec-part', label: 'Доступ не підтверджено' },
    { ...lostWb({ o: recSheet({ v: 'f81c0e4ab27d93c6e5b1a0d4c3f29e71', top: [notice('danger', 'icon-cloud-off', 'Нова пошта не відповіла. Ключ не перевірено — спробуйте ще раз за кілька хвилин.')] }) }), key: 'rec-np', label: 'Помилка Нової пошти' },
    { ...wbFrame({ num: TTN_OLD, sub: 'Замовлення #342 · створена 29.09.2026', chips: [pill('Відправлено', 'info')], blocks: [two(wbCards(), [payCard()], 320)], o: toast('Доступ відновлено для 14 накладних. Статуси оновлюються.', 'ok') }), key: 'rec-done', label: 'Повернення до картки' },
    { ...lostWb({ ro: true }), key: 'rec-ro', label: 'Без права інтеграцій' },
  ] });
export { overview, s1, s2, s3 };
