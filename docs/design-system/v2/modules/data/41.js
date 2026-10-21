import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["subscription","plans","payments"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Підписка', route: '/app/:tenant/settings/billing', source: 'subscription-screen.tsx', unverified: "", frames: recordFrames(S.subscription, "Налаштування") },
    { num: '2', title: 'Тарифи', route: '/settings/billing/plans', source: 'plans-screen.tsx', unverified: "", frames: recordFrames(S.plans, "Налаштування") },
    { num: '3', title: 'Платежі', route: '/settings/billing/payments', source: 'payments-screen.tsx', unverified: "", frames: recordFrames(S.payments, "Налаштування") }];
  return { module: { num: '41', group: 'Налаштування', title: 'Підписка', intro: "Поточна підписка, тарифи, історія платежів, прострочена оплата й скасування.", sources: "billing/*messages.ts" }, nav: nav('Підписка'), sections: finalize(sections) };
}
