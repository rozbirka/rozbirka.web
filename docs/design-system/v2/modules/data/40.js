import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["team"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Учасники', route: '/app/:tenant/team', source: 'TeamScreen.tsx', unverified: "", frames: listFrames(S.team) },
    { num: '2', title: 'Нове запрошення', route: 'команда → «Запросити»', source: 'TeamScreen.tsx:891', unverified: "", frames: drawerFrames(D, "team-invite", () => listFrames(S.team)[0], "Запрошення") },
    { num: '3', title: 'Права учасника', route: 'учасник → «Права»', source: 'TeamScreen.tsx:958', unverified: "", frames: drawerFrames(D, "team-permissions", () => listFrames(S.team)[0], "Права") },
    { num: '4', title: 'Діалоги', route: 'рядок учасника · запрошення', source: 'TeamScreen.tsx · team/messages.ts', unverified: "", frames: [{ ...listFrames(S.team)[0], label: "Вимкнути учасника", o: dialog("Вимкнути учасника", "Марта Ткач втратить доступ до кабінету. Ви зможете активувати цей обліковий запис пізніше.", "Вимкнути", "danger") }, { ...listFrames(S.team)[0], label: "Активувати учасника", o: dialog("Активувати учасника", "Марта Ткач знову отримає доступ до кабінету з роллю «Менеджер».", "Активувати", "primary") }, { ...listFrames(S.team)[0], label: "Видалити учасника", o: dialog("Видалити учасника", "Марта Ткач втратить доступ назавжди. Щоб повернути людину в команду, доведеться створити нове запрошення.", "Видалити", "danger") }, { ...listFrames(S.team)[0], label: "Відкликати запрошення", o: dialog("Відкликати запрошення", "Код RZ-7K2M-4QX перестане працювати. Створіть нове запрошення, якщо доступ ще потрібен.", "Відкликати", "danger") }, { ...listFrames(S.team)[0], label: "Запрошення створено", o: toast("Запрошення створено.") }, { ...listFrames(S.team)[0], label: "Права оновлено", o: toast("Права учасника оновлено.") }] }];
  return { module: { num: '40', group: 'Налаштування', title: 'Команда', intro: "Учасники, ролі, запрошення-коди, індивідуальні права. Вимкнення, видалення й відкликання — через діалоги з наслідками.", sources: "team/messages.ts" }, nav: nav('Команда'), sections: finalize(sections) };
}
