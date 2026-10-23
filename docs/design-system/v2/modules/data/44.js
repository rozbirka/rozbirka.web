import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["profile","account"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Профіль', route: '/app/:tenant/settings/profile', source: 'profile', unverified: "", frames: recordFrames(S.profile, "Налаштування") },
    { num: '2', title: 'Акаунт', route: '/account · /account/security', source: 'account', unverified: "", frames: recordFrames(S.account, "Акаунт") }];
  return { module: { num: '44', group: 'Налаштування', title: 'Профіль і акаунт', intro: "Профіль у розбірці, особистий акаунт, безпека й видалення акаунта.", sources: "profile/profile-messages.ts, account" }, nav: nav('Профіль'), sections: finalize(sections) };
}
