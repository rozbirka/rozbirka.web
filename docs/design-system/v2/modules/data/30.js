import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["cash"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Каси', route: '/app/:tenant/cash', source: 'CashScreen.tsx', unverified: "", frames: listFrames(S.cash) },
    { num: '2', title: 'Нова операція', route: 'каса → «Нова операція»', source: 'CashMovementDrawer.tsx', unverified: "", frames: drawerFrames(D, "cash-movement", () => listFrames(S.cash)[0], "Операція") },
    { num: '3', title: 'Переказ між касами', route: 'каси → «Переказ між касами»', source: 'CashTransferDrawer.tsx', unverified: "", frames: drawerFrames(D, "cash-transfer", () => listFrames(S.cash)[0], "Переказ") },
    { num: '4', title: 'Нова й редагування каси', route: 'каси → «Нова каса» · каса → «Редагувати касу»', source: 'CashScreen.tsx', unverified: "", frames: [...drawerFrames(D, "cash-new", () => listFrames(S.cash)[0], "Нова каса"), ...drawerFrames(D, "cash-edit", () => listFrames(S.cash)[0], "Редагування")] },
    { num: '5', title: 'Сповіщення', route: 'після дій', source: 'cash-messages.ts', unverified: "", frames: [{ ...listFrames(S.cash)[0], label: "Переказ виконано", o: toast("Переказ виконано.") }, { ...listFrames(S.cash)[0], label: "Операцію записано", o: toast("Операцію записано.") }] }];
  return { module: { num: '30', group: 'Гроші', title: 'Фінанси · каси', intro: "Каси: список із залишками, операції, перекази між касами, створення й редагування каси. Валюти зберігаються окремо, без конвертації.", sources: "cash/cash-messages.ts" }, nav: nav('Фінанси'), sections: finalize(sections) };
}
