import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["login","invite","onboarding","privacy"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Вхід', route: '/login', source: 'screens/login-messages.ts', unverified: "", frames: recordFrames(S.login) },
    { num: '2', title: 'Запрошення', route: '/invite/:code', source: 'invite-messages.ts', unverified: "", frames: recordFrames(S.invite) },
    { num: '3', title: 'Онбординг', route: '/app (без розбірок)', source: 'OnboardingChecklist.tsx', unverified: "тексти онбордингу", frames: recordFrames(S.onboarding, "Нова розбірка") },
    { num: '4', title: 'Політика конфіденційності', route: '/privacy', source: 'privacy', unverified: "", frames: recordFrames(S.privacy) }];
  return { module: { num: '00', group: 'Вхід і старт', title: 'Вхід, запрошення, онбординг', intro: "Екрани поза кабінетом: вхід за телефоном і кодом з SMS, запрошення до розбірки, створення першої розбірки, політика конфіденційності.", sources: "login-messages.ts, invite-messages.ts, onboarding, privacy" }, nav: nav(''), sections: finalize(sections) };
}
