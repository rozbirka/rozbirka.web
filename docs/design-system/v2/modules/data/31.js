import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["reports"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Звіти', route: '/app/:tenant/reports', source: 'ReportsScreen.tsx', unverified: "", frames: recordFrames(S.reports, "Гроші") }];
  return { module: { num: '31', group: 'Гроші', title: 'Звіти', intro: "Звіти по продажах і грошах, обмеження тарифу.", sources: "reports/messages.ts" }, nav: nav('Звіти'), sections: finalize(sections) };
}
