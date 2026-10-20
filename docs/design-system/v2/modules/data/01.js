import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["dashboard"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Головна', route: '/app/:tenant/dashboard', source: 'DashboardScreen.tsx', unverified: "", frames: recordFrames(S.dashboard, "Головна") }];
  return { module: { num: '01', group: 'Кабінет', title: 'Головна', intro: "Перший екран кабінету: KPI, окупність авто, каси, останні замовлення, стани завантаження й помилки.", sources: "dashboard/*messages.ts" }, nav: nav('Головна'), sections: finalize(sections) };
}
