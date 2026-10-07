import type { Locale } from '@/i18n/locales'
import { defineMessages, translate } from '@/i18n/messages'

/**
 * Landing FAQ. The same entries feed the visible accordion and the FAQPage
 * structured data of each language version, so they must stay identical.
 */
export const faqMessages = defineMessages({
  uk: {
    q1: 'Чи бачу я прибуток окремо по кожному авто?',
    a1: 'Так. Кожне авто має свій профіль з усіма витратами й продажами. Бачиш ROI у відсотках і у валюті обліку в реальному часі.',
    q2: 'Як швидко я можу почати працювати після реєстрації?',
    a2: 'За 10 хвилин. Створюєш перше авто, додаєш запчастини — і вже працюєш. Без довгих налаштувань і навчання.',
    q3: 'Як працює безкоштовний період?',
    a3: 'Після створення робочого простору автоматично активуються 14 днів Pro-рівня — без введення картки. Після завершення нічого не списується автоматично.',
    q4: 'Скільки людей з команди можуть працювати одночасно?',
    a4: 'Ліміт залежить від тарифу: Pro — 5 користувачів, Enterprise — без обмежень. Для кожного можна налаштувати окрему роль і права доступу.',
    q5: 'У якій валюті вести облік і приймати оплату?',
    a5: 'Валюту обліку обираєш для своєї розбірки сам — гривня, долар, євро, злотий, фунт та інші. У ній ведуться ціни й витрати. Оплату приймаєш у будь-якій валюті, на різні рахунки й каси, і кожна валюта рахується окремо.',
    q6: 'Чи легко користуватися застосунком?',
    a6: 'Так. Будь-яка дія — максимум 3 кліки. UI зроблений під роботу однією рукою з телефону: без захованих вкладок, без зайвих кроків. Працює інтуїтивно з першого запуску.',
  },
  'en-GB': {
    q1: 'Can I see the profit for each car separately?',
    a1: 'Yes. Every car has its own profile with all its costs and sales. You see ROI as a percentage and in your accounting currency in real time.',
    q2: 'How quickly can I get started after signing up?',
    a2: 'In 10 minutes. Create your first car, add parts and you’re up and running. No lengthy setup or training.',
    q3: 'How does the free trial work?',
    a3: 'When you create a workspace, 14 days of Pro start automatically — no card needed. Nothing is charged automatically when the trial ends.',
    q4: 'How many people on my team can work at the same time?',
    a4: 'It depends on your plan: Pro — 5 users, Enterprise — unlimited. Each person can have their own role and access rights.',
    q5: 'Which currency do I keep my books and take payments in?',
    a5: 'You choose the accounting currency for your business — hryvnia, US dollar, euro, złoty, pound sterling and others. Prices and costs are kept in it. Payments can be taken in any currency, into different accounts and tills, and each currency is counted separately.',
    q6: 'Is the app easy to use?',
    a6: 'Yes. Any action takes 3 clicks at most. The interface is built for one-handed use on a phone: no hidden tabs, no extra steps. It feels intuitive from the first launch.',
  },
  pl: {
    q1: 'Czy widzę zysk osobno dla każdego auta?',
    a1: 'Tak. Każde auto ma własny profil ze wszystkimi kosztami i sprzedażą. Widzisz ROI w procentach i w walucie rozliczeniowej na bieżąco.',
    q2: 'Jak szybko mogę zacząć pracę po rejestracji?',
    a2: 'W 10 minut. Tworzysz pierwsze auto, dodajesz części — i już działasz. Bez długiej konfiguracji i szkoleń.',
    q3: 'Jak działa okres próbny?',
    a3: 'Po utworzeniu przestrzeni roboczej automatycznie włącza się 14 dni planu Pro — bez podawania karty. Po jego zakończeniu nic nie jest pobierane automatycznie.',
    q4: 'Ile osób z zespołu może pracować jednocześnie?',
    a4: 'Limit zależy od planu: Pro — 5 użytkowników, Enterprise — bez ograniczeń. Każdej osobie można ustawić osobną rolę i uprawnienia.',
    q5: 'W jakiej walucie prowadzić ewidencję i przyjmować płatności?',
    a5: 'Walutę rozliczeniową wybierasz dla swojej firmy — hrywna, dolar, euro, złoty, funt i inne. W niej prowadzone są ceny i koszty. Płatności przyjmujesz w dowolnej walucie, na różne konta i kasy, a każda waluta liczona jest osobno.',
    q6: 'Czy aplikacja jest łatwa w obsłudze?',
    a6: 'Tak. Każda czynność to maksymalnie 3 kliknięcia. Interfejs jest stworzony do obsługi jedną ręką na telefonie: bez ukrytych zakładek i zbędnych kroków. Działa intuicyjnie od pierwszego uruchomienia.',
  },
})

export interface FaqEntry {
  question: string
  answer: string
}

const faqKeys = [
  ['q1', 'a1'],
  ['q2', 'a2'],
  ['q3', 'a3'],
  ['q4', 'a4'],
  ['q5', 'a5'],
  ['q6', 'a6'],
] as const

/** FAQ entries of the landing in `locale`, in display order. */
export function landingFaqEntries(locale: Locale): readonly FaqEntry[] {
  return faqKeys.map(([question, answer]) => ({
    question: translate(faqMessages, locale, question),
    answer: translate(faqMessages, locale, answer),
  }))
}
