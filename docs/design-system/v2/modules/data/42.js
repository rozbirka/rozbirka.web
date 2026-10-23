import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["integrations","novaposhta"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Інтеграції', route: '/app/:tenant/settings/integrations', source: 'IntegrationsScreen.tsx', unverified: "", frames: recordFrames(S.integrations, "Налаштування") },
    { num: '2', title: 'Нова пошта', route: '/settings/integrations/:id', source: 'NovaPoshtaScreen.tsx', unverified: "", frames: recordFrames(S.novaposhta, "Налаштування") },
    { num: '3', title: 'Точка відправлення', route: 'Нова пошта → «Додати точку»', source: 'dispatch-point-form.tsx', unverified: "", frames: drawerFrames(D, "np-point", () => recordFrame(S.novaposhta, "points", "Налаштування"), "Точка") }];
  return { module: { num: '42', group: 'Налаштування', title: 'Інтеграції · Нова пошта', intro: "Підключені сервіси, налаштування Нової пошти, точки відправлення, webhook.", sources: "integrations/*messages.ts, np-forms-messages.ts" }, nav: nav('Інтеграції'), sections: finalize(sections) };
}
