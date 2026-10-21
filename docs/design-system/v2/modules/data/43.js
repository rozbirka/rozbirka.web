import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["business"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Бізнес', route: '/app/:tenant/settings/business', source: 'business-settings-screen.tsx', unverified: "", frames: recordFrames(S.business, "Налаштування") }];
  return { module: { num: '43', group: 'Налаштування', title: 'Бізнес', intro: "Реквізити розбірки, склади, регіон і валюта обліку.", sources: "business/business-messages.ts" }, nav: nav('Бізнес'), sections: finalize(sections) };
}
