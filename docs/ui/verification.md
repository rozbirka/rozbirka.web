# UI verification

## Локальний запуск

Читати [LOCAL-DEVELOPMENT](../../LOCAL-DEVELOPMENT.md) перед запуском кабінету. Поточна гілка має `npm run dev:local`: Vite і session BFF; origin для ручної роботи — `http://localhost:5173`. Plain `npm run dev` не запускає BFF. Не перемикати браузер між localhost та 127.0.0.1 для тієї самої cookie session.

Runbook містить workstation-specific шляхи й історичні дані; перевіряти вибраний checkout, процеси та конфігурацію. Не копіювати їх як універсальні параметри. Зберігати cookies/volumes/local configuration; QA API не є fallback для локального запуску.

## Команди поточної гілки

Канонічний список — [package.json](../../package.json). Нижче призначення, не твердження про виконані перевірки.

| Команда                       | Що перевіряє                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`               | Static gate плюс unit, contract та integration suites                                |
| `npm run check:static`        | Dependency health, TypeScript, ESLint, formatting, parity                            |
| `npm run test:unit`           | Unit suite із визначеними в scripts exclusions                                       |
| `npm run test:contracts`      | API/contract/parity suites                                                           |
| `npm run test:integration`    | Session/client/auth integration suites                                               |
| `npm run test:e2e`            | Playwright, крім `@cabinet-smoke`                                                    |
| `npm run test:smoke`          | Chromium cabinet smoke                                                               |
| `npm run build`               | TypeScript + client/SSR build + prerender                                            |
| `npm run verify:quality`      | Non-browser gate + e2e + smoke                                                       |
| `npm run verify:release:prod` | Production artifact, budgets, Lighthouse і Wrangler dry-run; не фактичний deployment |

`verify:prod` відсутній у поточному package.json; використовувати наявні quality/release scripts за обсягом задачі. `deploy:qa` має реальний deployment і не є UI-перевіркою.

## Приклади перевірок

- [App kit tests](../../src/components/app/app-kit.test.tsx): базові shared controls та композиції.
- [Operations kit tests](../../src/components/app/operations-kit.test.tsx): операції, dialog та багатокрокова взаємодія.
- [Picker tests](../../src/components/parts/PartSearchPicker.test.tsx): предметний пошук.
- [Login tests](../../src/screens/login.test.tsx): auth form behavior.
- [Cabinet browser tests](../../e2e/cabinet-shell.spec.ts): кабінет і smoke scenarios; файл має локальні зміни.
- [Landing browser tests](../../e2e/landing.spec.ts): responsive, navigation, reduced motion, accessibility та snapshots. Тест шукає CTA за текстом посилання, а скриншоти мають окремі еталони для macOS і Linux (`e2e/landing.spec.ts-snapshots/landing-*-chromium.png` і `*-linux-chromium.png`): зміна тексту чи вигляду CTA потребує оновлення тесту та обох наборів еталонів. CI перевіряє лише Linux-еталони й під час перевірки їх не переписує (при падінні — артефакт `playwright-failure-<project>` із `test-results`). Нові Linux-еталони знімає ручний workflow [Update Visual Baselines](../../.github/workflows/update-visual-baselines.yml): він віддає артефакт `landing-linux-baselines`, який треба переглянути й закомітити. macOS-еталони оновлюються локально на Mac (`npx playwright test e2e/landing.spec.ts --project=chromium --update-snapshots`).

[Playwright config](../../playwright.config.ts) запускає локальний upstream fixture і локальний Wrangler на окремих портах, із QA-mode build. Це тестове оточення, а не доказ інтеграції з реальним Core або QA deployment. Воно відрізняється від dev:local. Профілі desktop browser і mobile browser не означають тестування native app.

## Доказ завершення

Фіксувати source SHA та локальні зміни, сценарії/AC, фактичні команди й результати, viewport, реальний backend або mock, failures та unverified checks. Build не доводить UI acceptance; screenshot не доводить submit/retry; axe не доводить повну accessibility.

Для зміненого сценарію перевірити main path і релевантні loading/empty/error/partial states, keyboard/focus, narrow layout та console/network. Якщо auth чи browser недоступні — позначити конкретні перевірки unverified. Не надсилати OTP і не змінювати реальні бізнес-дані лише для перевірки документації.
