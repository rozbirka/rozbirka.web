# Етап 1 — Аудит `rozbirka/rozbirka.web@main` (5d46b1f)

Джерело правди — код. Репо не змінюється. Підключена до проєкту дизайн-система порожня, тому пакет будується лише з коду.

## Де що живе

| Що | Де в коді | Примітка |
|---|---|---|
| Кольори | `src/index.css` → `@theme` (`--color-brand*`, `surface-1..3`, `app-*`, `state-*`) + `:root` shadcn oklch-токени | Два паралельні набори: `app-*` (кабінет) і shadcn (`background/primary/...`). `primary` ≠ `brand` |
| Типографіка | `src/index.css`: `--font-sans` (system), `.type-redesign` (Manrope + JetBrains Mono), `.font-visuelt` + `public/fonts/visuelt.css`, `.text-h1..h4/.text-p1..p3` | Три шари шрифтів; єдиної шкали для кабінету немає — розміри arbitrary (`text-[14.5px]`, `text-[46px]`…) |
| Відступи / ширини | Tailwind 4 дефолт (4px) + `--page-width-xl/lg/md`, `RedesignShell` max-w 1240px | Власної spacing-шкали немає |
| Радіуси | `--radius-control 10`, `--radius-panel 12`, `--radius-sheet 16`, `--radius-card 32`, `--radius-section 48`, shadcn `--radius*` | Плюс захардкоджені `rounded-[14px]`, `rounded-[18px]`, `rounded-3xl` |
| Тіні | Токенів немає. `shadow-lg/2xl`, inset `shadow-[inset_2px_0_0_var(--color-brand)]`, `.cabinet-rail-tooltip` | Тіні тільки для оверлеїв |
| Іконки | `lucide-react` (`components.json: iconLibrary lucide`), мапа модуль→іконка в `src/cabinet/module-registry.ts` | |
| Компоненти | `src/components/app/*` (43 файли, експорти `index.ts`), `src/cabinet/redesign-shell.tsx`, `redesign-kpi.tsx`, `src/components/site/*` (лендинг), `src/components/ui/button.tsx` (лише dev `/screens`) | Варіанти — CVA (`button-variants.ts`) |
| Екрани | `src/routes/routes.tsx`; кабінет `/app/:tenant/*` → `src/cabinet/<module>/*Screen.tsx`; публічні `src/screens/*` (login, invite, privacy, account) | 17 модулів |
| Навігація | `module-registry.ts` (групи overview/stock/sales/money/settings, `mobilePriority`), `CabinetNavigation.tsx`, `CommandPalette.tsx`, `TenantSwitcher.tsx`, `site/header.tsx` | |
| Рядки | `defineMessages({uk, 'en-GB', pl})` у `*-messages.ts` поруч з фічею; `src/i18n/*` (плюрали, формати, валюти) | uk — джерело, en-GB — fallback |
| Фіче-флаги | `src/api/feature-flags.ts` (`FEATURE_FLAGS = { partsBulkImport }`), `src/cabinet/FeatureFlags.tsx` (`FeatureGate`, `useFeatureFlag`, poll 60 с) | Окремо: permissions, `requiredFeature` (тарифні фічі), subscription states |
| Аналітика | Продуктової аналітики (GA/PostHog/Sentry) не знайдено. Є `src/observability/redaction.ts` + `worker/observability.ts` (безпечна телеметрія помилок API) і dashboard-аналітика як бізнес-дані | Пошук обмежений — див. питання |
| Стан / рух | `state-screen.tsx`, `skeleton.tsx`, `toast.tsx`, `notice.tsx`; keyframes `fade-up`, `float-slow`, `tw-animate-css` для Radix; reduced-motion в `index.css` | |
| Існуюча документація | `DESIGN.md`, `UX-CONTRACT.md`, `docs/ui/*.md`, `docs/reports/design-gaps.md` (197 КБ), `docs/parity/*` | `docs/ui` описує гілку `feat/remove-free-parts`, не `main` |
| Еталони | `e2e/landing.spec.ts-snapshots/*.png` (лендинг 320–1440) | Для кабінету скріншотів у репо немає |

## План пакета `Rozbirka Design System/`

```
00-AUDIT.md                 цей файл
OPEN-QUESTIONS.md           відкриті питання (наповнюється на кожному етапі)
tokens/tokens.json          W3C-формат, семантичні назви + посилання на рядок у коді
tokens/tokens.css           :root custom properties
tokens/DRIFT.md             захардкоджені значення поза темою
fonts/                      копії woff2 з public/fonts
components/CATALOG.md       компонент → файл, props, variants, states
components/kit.css          класи .rz-btn, .rz-field, .rz-card … поверх tokens.css
components/Kit Preview.dc.html  жива галерея кіта
screens/reference/          еталонні скріншоти
screens/*.dc.html           відтворення екранів з кіта + порівняння
content/strings.uk.json     реальні рядки (uk + en-GB + pl) по namespace
content/enums.md            переліки опцій (статуси, модулі, ролі, валюти…)
behavior/STATES.md          loading/empty/error/denied, pending, toast
behavior/NAVIGATION.md      маршрути, шелл, мобільний таб-бар, гейти
behavior/MOTION.md          тривалості, easing, reduced-motion
check/visual_check.py       рендер (Playwright) + лінт токенів + pixel-diff з еталоном
CLAUDE.md                   порядок читання, жорсткі правила, self-check
skill/SKILL.md              скіл, що підключає пакет
evals/                      5 задач + еталонні відповіді + критерії
```

## Обмеження, про які варто знати зараз

- **Симулятор / запуск застосунку.** Я не можу зібрати і запустити репо (немає Node-середовища та сесії BFF). Еталони: e2e-скріншоти лендингу з репо + скріншоти, які дасте ви. Кабінет без ваших скріншотів можу відтворити лише з коду, без піксельного порівняння.
- `visual_check.py` напишу, але запускати його доведеться у вас (Python + Playwright).

## Відкриті питання (етап 1)

1. **Назва застосунку.** У запиті `[назва застосунку]`. Беру «Rozbirka» і папку `Rozbirka Design System` — підтвердіть.
2. **Обсяг.** Кабінет (`app-*`, redesign) + auth + лендинг — усі три шари, чи лише кабінет?
3. **Redesign vs старі екрани.** У кабінеті два покоління (`PageHeader/SectionPanel` і `RedesignShell/Card` + Manrope). Що вважати еталоном для нових прототипів?
4. **Гілка.** `docs/ui` описує `feat/remove-free-parts`, а я читаю `main`. Працюю з `main`?
5. **Мобільний застосунок.** «Симулятор» — йдеться про `rozbirka.mobile`? Він у скоупі, чи лише web?
6. **Аналітика.** У коді не видно продуктових подій. Підтвердіть, що її немає (чи вона в іншому репо / GTM в `index.html`).
7. **Скріншоти кабінету.** Можете дати скріншоти 4–6 ключових екранів (Dashboard, Parts, Orders, Order detail, Login)? Інакше еталон — тільки код.
