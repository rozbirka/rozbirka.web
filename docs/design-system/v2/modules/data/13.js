import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["intakes","intake"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Список', route: '/app/:tenant/intakes', source: 'IntakesScreen.tsx', unverified: "", frames: listFrames(S.intakes) },
    { num: '2', title: 'Картка партії', route: '/app/:tenant/intakes/:intakeId', source: 'IntakesScreen.tsx', unverified: "", frames: recordFrames(S.intake, "Склад") }];
  return { module: { num: '13', group: 'Склад', title: 'Приймання', intro: "Партії від постачальників: список, картка партії, додавання деталей партією.", sources: "intakes/messages.ts" }, nav: nav('Приймання'), sections: finalize(sections) };
}
