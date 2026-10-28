# Foundations

Кабінет і auth слідують [Rozbirka Design System v2](../design-system/CLAUDE.md) 1:1. Його `v2/tokens.css` і `v2/kit.css` генеруються в [src/styles](../../src/styles/) командою `npm run ds:sync` (`npm run ds:check` у `check:static` ловить розбіжність); руками ці копії не редагувати. Tailwind-імена кабінету (`app-*`, `state-*`, `rounded-control/panel/sheet`, `text-micro…display`, `h-control…`) у [src/index.css](../../src/index.css) лише посилаються на `--rz-*`. Ідентичність продукту — [DESIGN.md](../../DESIGN.md). Використовується Tailwind CSS 4 із CSS `@theme`; не припускати наявність Tailwind config іншого проєкту. Область опису — [робочий snapshot](index.md).

## Стилістичні шари

| Шар                | Джерело / використання                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand              | `brand`, `brand-hover`, `brand-foreground`; спільні для лендингу й кабінету — змінювати класи конкретного елемента, а не токени; не замінювати стан помилки brand-кольором       |
| Лендинг            | `surface-1/2/3`, `page-width-*`, `radius-section/card/pill`; [Section](../../src/components/layout/section.tsx), [PageContainer](../../src/components/layout/page-container.tsx) |
| Кабінет            | Класи kit `.rz-*` або Tailwind-імена над `--rz-*`: `app-canvas/sidebar/raised/input/overlay`, `app-line/line-2`, `app-strong/ink/muted/dim`, `app-hover/active/selected`         |
| Стани              | `state-ok/warn/danger/info` і відповідні `*-soft`; [StatusPill](../../src/components/app/status-pill.tsx), [Notice](../../src/components/app/notice.tsx)                         |
| Геометрія кабінету | `rounded-rz-xs` 4, `rounded-control` 6, `rounded-panel` 8, `rounded-sheet` 12; висоти `h-control` 28/32, `h-touch` 44, `h-glove` 56                                              |
| Semantic UI tokens | `background`, `foreground`, `primary`, `muted`, `border`, `ring` через `@theme inline`; `primary` не тотожний `brand`                                                            |

Темна тема за замовчуванням. Світла тема використовує `data-theme="light"`; щільність — `data-density`. Перемикач теми є біля профілю внизу бокового меню, у згорнутому меню та в мобільному «Ще». Вибір зберігається в браузері й синхронізується між вкладками через [useTheme](../../src/components/app/theme-preference.ts). [useDesignSystemRoot](../../src/components/app/use-design-system-root.ts) застосовує тему також до діалогів і меню в порталах та відновлює попередній стан після виходу з продуктової оболонки. Корінь кабінету використовує `bg-app-canvas`, щоб фон змінювався разом із токенами теми.

## Типографіка

- Глобальний sans — system stack. `.font-visuelt` задає Visuelt Pro для маркетингових областей; [App](../../src/App.tsx) показує фактичні межі застосування.
- Hero використовує окремий Visuelt Hero: [hero](../../src/components/site/hero.tsx). Повний Visuelt stylesheet завантажується відкладено у [main](../../src/main.tsx), декларації — [visuelt.css](../../public/fonts/visuelt.css).
- Кабінет і auth: Manrope + JetBrains Mono через корінь `.rz` (оболонка кабінету й auth-екрани вмикають його також на `<body>` через `useDesignSystemRoot`, щоб діалоги в порталах мали ті самі шрифти). Шкала — лише `text-micro/caption/body/input/title/page/display` (11–28).
- `text-h*`/`text-p*` належать лендингу.

## Компонування класів і ресурси

[cn](../../src/lib/utils.ts) поєднує clsx і tailwind-merge. Для варіантів кнопок застосовується class-variance-authority. Не дублювати variant logic локально, коли потрібна поведінка вже є.

Іконки — `lucide-react` у наявних компонентах; декоративні іконки не повинні підміняти accessible name. Для зображень дивитися [assets optimizer](../../scripts/optimize-assets.mjs) і [asset budget](../../scripts/check-asset-budget.mjs), а не підключати великі вихідні файли напряму.

Focus у кабінеті — одне кільце `--rz-focus` із kit; reduced-motion — у токенах та index.css. Нові анімації перевіряти в обох режимах; нова тема або зміна дизайн-токенів потребує усвідомленого рішення, не випадкового hex у черговому екрані.
