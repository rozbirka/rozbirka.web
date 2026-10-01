# Foundations

Джерело токенів і глобальної поведінки — [src/index.css](../../src/index.css); ключові значення й ідентичність продукту — [DESIGN.md](../../DESIGN.md). Використовується Tailwind CSS 4 із CSS `@theme`; не припускати наявність Tailwind config іншого проєкту. Область опису — [робочий snapshot](index.md).

## Стилістичні шари

| Шар                | Джерело / використання                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand              | `brand`, `brand-hover`, `brand-foreground`; спільні для лендингу й кабінету — змінювати класи конкретного елемента, а не токени; не замінювати стан помилки brand-кольором       |
| Лендинг            | `surface-1/2/3`, `page-width-*`, `radius-section/card/pill`; [Section](../../src/components/layout/section.tsx), [PageContainer](../../src/components/layout/page-container.tsx) |
| Кабінет            | `app-canvas/raised/input/overlay`, `app-line/line-2`, `app-ink/muted/dim`                                                                                                        |
| Стани              | `state-ok/warn/danger/info` і відповідні `*-soft`; [StatusPill](../../src/components/app/status-pill.tsx), [Notice](../../src/components/app/notice.tsx)                         |
| Геометрія кабінету | `rounded-control`, `rounded-panel`, `rounded-sheet`; числові значення залишаються в CSS                                                                                          |
| Semantic UI tokens | `background`, `foreground`, `primary`, `muted`, `border`, `ring` через `@theme inline`; `primary` не тотожний `brand`                                                            |

Це переважно темний інтерфейс. Наявність `dark` variant сама по собі не підтверджує реалізований перемикач світлої/темної теми.

## Типографіка

- Глобальний sans — system stack. `.font-visuelt` задає Visuelt Pro для маркетингових областей; [App](../../src/App.tsx) показує фактичні межі застосування.
- Hero використовує окремий Visuelt Hero: [hero](../../src/components/site/hero.tsx). Повний Visuelt stylesheet завантажується відкладено у [main](../../src/main.tsx), декларації — [visuelt.css](../../public/fonts/visuelt.css).
- `.type-redesign` локально задає Manrope та JetBrains Mono для екранів, які перейшли на цей стиль. Scope вмикає або [RedesignShell](../../src/cabinet/redesign-shell.tsx), або кореневий `div.type-redesign` самого екрана (так зроблено, наприклад, у [PartsScreen](../../src/cabinet/parts/PartsScreen.tsx)); повторювати спосіб сусідніх екранів і не переносити scope глобально лише через новий екран.
- `text-h*`/`text-p*` у CSS співіснують із локальними responsive utility-розмірами. Єдиної універсальної шкали для всіх екранів код не встановлює: повторювати стиль конкретного шару.

## Компонування класів і ресурси

[cn](../../src/lib/utils.ts) поєднує clsx і tailwind-merge. Для варіантів кнопок застосовується class-variance-authority. Не дублювати variant logic локально, коли потрібна поведінка вже є.

Іконки — `lucide-react` у наявних компонентах; декоративні іконки не повинні підміняти accessible name. Для зображень дивитися [assets optimizer](../../scripts/optimize-assets.mjs) і [asset budget](../../scripts/check-asset-budget.mjs), а не підключати великі вихідні файли напряму.

Глобальний focus-visible і reduced-motion визначені в index.css. Нові анімації перевіряти в обох режимах; нова тема або зміна дизайн-токенів потребує усвідомленого рішення, не випадкового hex у черговому екрані.
