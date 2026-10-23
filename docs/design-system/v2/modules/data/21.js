import { nav, frame, crumbs, one, two, card, stateCard, sb, notice, table, dialog, toast, fact, facts, finalize, loadScreen, loadDrawers, listFrames, recordFrames, recordFrame, drawerFrames, head, btn } from '../kit.js';
export default async function build() {
  const D = await loadDrawers();
  const S = {};
  for (const id of ["customers","customer","customerform"]) S[id] = await loadScreen(id);
  const sections = [
    { num: '1', title: 'Список', route: '/app/:tenant/customers', source: 'CustomersScreen.tsx', unverified: "", frames: listFrames(S.customers) },
    { num: '2', title: 'Картка клієнта', route: '/app/:tenant/customers/:customerId', source: 'CustomersScreen.tsx', unverified: "", frames: recordFrames(S.customer, "Продажі") },
    { num: '3', title: 'Форма', route: '/app/:tenant/customers/new · /:id/edit', source: 'customer-form-messages.ts', unverified: "", frames: recordFrames(S.customerform, "Продажі") },
    { num: '4', title: 'Шторка «Клієнт»', route: 'список → «Новий клієнт»', source: 'CustomersScreen.tsx:1475', unverified: "", frames: drawerFrames(D, "customer-form", () => listFrames(S.customers)[0], "Клієнт") },
    { num: '5', title: 'Діалоги й сповіщення', route: 'картка клієнта', source: 'CustomersScreen.tsx:1118', unverified: "текст діалогу видалення", frames: [{ ...recordFrame(S.customer, "data", "Продажі"), label: "Видалити клієнта?", o: dialog("Видалити клієнта?", "Клієнта буде видалено. Його замовлення лишаться в історії.", "Видалити клієнта", "danger") }, { ...recordFrame(S.customer, "data", "Продажі"), label: "Зміни збережено", note: 'тост ok', o: toast("Зміни збережено") }, { ...recordFrame(S.customer, "data", "Продажі"), label: "Клієнта створено", note: 'тост ok · після переходу в картку', o: toast("Клієнта створено") }] }];
  return { module: { num: '21', group: 'Продажі', title: 'Клієнти', intro: "Клієнти: список, картка, повна форма й шторка створення без виходу зі списку.", sources: "customers/*messages.ts, customer-form-messages.ts" }, nav: nav('Клієнти'), sections: finalize(sections) };
}
