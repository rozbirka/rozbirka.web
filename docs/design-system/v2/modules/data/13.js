import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["inventory","session"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Список сесій', route: '/app/:tenant/inventory', source: 'InventoryScreen.tsx', unverified: "", frames: listFrames(S.inventory) },
    { num: '2', title: 'Сесія', route: '/app/:tenant/inventory/sessions/:sessionId', source: 'InventoryScreen.tsx', unverified: "", frames: recordFrames(S.session, "Інвентаризація") }];
  return { module: { num: '13', group: 'Склад', title: 'Інвентаризація', intro: "Сесії інвентаризації, журнал сканувань, результати й аудит. Склади, зони й розміщення — модуль 12 Склади. Сканер — окремий компонент components/Scanner.", sources: "inventory/*messages.ts, scanners/messages.ts" }, nav: nav('Інвентаризація'), sections: finalize(sections) };
}
