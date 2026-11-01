import { defineMessages } from '@/i18n/messages'

/** Landing «Порівняння»: Excel and a generic ERP against rozbirka. */
export const compareMessages = defineMessages({
  uk: {
    eyebrow: 'Порівняння',
    title: 'Чому не Excel і не універсальна програма для автомагазину',
    cols: 'Excel / зошит|Універсальна ERP',
    rows: 'Прибуток і ROI по кожному авто=Рахуєш вручну=Немає=Автоматично|Партії й собівартість деталі=Формули ламаються=Частково=З коробки|QR-стікер на кожну деталь=Немає=Штрих-коди товарів=QR + полиця + авто|Робота з телефону=Незручно=Складський додаток=Весь бізнес у телефоні|Приховати собівартість від продавця=Неможливо=Залежить від тарифу=Ролі й права|Створено саме для розбірки=Ні=Один із сегментів=Так',
    need: 'Що потрібно розбірці',
  },
  'en-GB': {
    eyebrow: 'Comparison',
    title: 'Why not Excel or a generic auto parts shop system',
    cols: 'Excel / notebook|Generic ERP',
    rows: 'Profit and ROI per car=Worked out by hand=No=Automatic|Batches and cost per part=Formulas break=Partly=Out of the box|QR sticker on every part=No=Product barcodes=QR + shelf + car|Working from a phone=Awkward=Warehouse app=Your whole business on your phone|Hide cost price from salespeople=Impossible=Depends on the plan=Roles and permissions|Built for car breakers=No=One of many segments=Yes',
    need: 'What a breaker’s yard needs',
  },
  pl: {
    eyebrow: 'Porównanie',
    title:
      'Dlaczego nie Excel i nie uniwersalny program dla sklepu motoryzacyjnego',
    cols: 'Excel / zeszyt|Uniwersalny ERP',
    rows: 'Zysk i ROI z każdego auta=Liczysz ręcznie=Brak=Automatycznie|Partie i koszt części=Formuły się psują=Częściowo=Od razu|Naklejka QR na każdą część=Brak=Kody kreskowe towarów=QR + półka + auto|Praca z telefonu=Niewygodnie=Aplikacja magazynowa=Cały biznes w telefonie|Ukrycie kosztu zakupu przed sprzedawcą=Niemożliwe=Zależy od planu=Role i uprawnienia|Stworzony dla demontażu aut=Nie=Jeden z segmentów=Tak',
    need: 'Czego potrzebuje demontaż aut',
  },
})
