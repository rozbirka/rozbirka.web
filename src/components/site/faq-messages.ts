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
    a2: 'Одразу після реєстрації: обираєш валюту обліку, додаєш перше авто або партію — і працюєш.',
    q3: 'Як працює безкоштовний період?',
    a3: 'Тариф Pro доступний 14 днів безкоштовно. Після цього підписка продовжується за $59 на місяць.',
    q4: 'Скільки людей з команди можуть працювати одночасно?',
    a4: 'Уся команда працює в одній системі. Кожному співробітнику можна налаштувати роль і доступ.',
    q5: 'У якій валюті вести облік і приймати оплату?',
    a5: 'Облік ведеться у валюті, яку ти обираєш для розбірки. Оплату можна приймати кількома платежами, у різних валютах і на різні рахунки.',
    q6: 'Де працює rozbirka?',
    a6: 'У веб-версії та в застосунку для iPhone з App Store. Дані спільні, а QR-стікер відкриває картку деталі одним скануванням.',
  },
  'en-GB': {
    q1: 'Can I see the profit for each car separately?',
    a1: 'Yes. Every car has its own profile with all its costs and sales. You see ROI as a percentage and in your accounting currency in real time.',
    q2: 'How quickly can I get started after signing up?',
    a2: 'Right after signing up: choose your accounting currency, add your first car or batch and you’re working.',
    q3: 'How does the free trial work?',
    a3: 'The Pro plan is free for 14 days. After that the subscription continues at $59 a month.',
    q4: 'How many people on my team can work at the same time?',
    a4: 'Your whole team works in one system. Each member of staff can have their own role and access.',
    q5: 'Which currency do I keep my books and take payments in?',
    a5: 'You choose the accounting currency for your business and keep your books in it. Payments can be taken in several instalments, in different currencies and into different accounts.',
    q6: 'Where does rozbirka work?',
    a6: 'In the web app and in the iPhone app from the App Store. The data is shared, and a QR sticker opens the part card with a single scan.',
  },
  pl: {
    q1: 'Czy widzę zysk osobno dla każdego auta?',
    a1: 'Tak. Każde auto ma własny profil ze wszystkimi kosztami i sprzedażą. Widzisz ROI w procentach i w walucie rozliczeniowej na bieżąco.',
    q2: 'Jak szybko mogę zacząć pracę po rejestracji?',
    a2: 'Od razu po rejestracji: wybierasz walutę rozliczeniową, dodajesz pierwsze auto lub partię — i pracujesz.',
    q3: 'Jak działa okres próbny?',
    a3: 'Plan Pro jest dostępny za darmo przez 14 dni. Potem subskrypcja trwa dalej za $59 miesięcznie.',
    q4: 'Ile osób z zespołu może pracować jednocześnie?',
    a4: 'Cały zespół pracuje w jednym systemie. Każdemu pracownikowi można ustawić rolę i dostęp.',
    q5: 'W jakiej walucie prowadzić ewidencję i przyjmować płatności?',
    a5: 'Ewidencję prowadzisz w walucie, którą wybierasz dla swojej firmy. Płatności można przyjmować w kilku wpłatach, w różnych walutach i na różne konta.',
    q6: 'Gdzie działa rozbirka?',
    a6: 'W wersji przeglądarkowej i w aplikacji na iPhone’a z App Store. Dane są wspólne, a naklejka QR otwiera kartę części jednym skanem.',
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
