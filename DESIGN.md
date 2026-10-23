# Rozbirka product design

Rozbirka serves vehicle dismantling teams in Ukraine, the United Kingdom and
Poland. The interface ships in Ukrainian (source), British English and Polish;
copy lives in per-feature message namespaces (`src/i18n`), never as literals in
JSX, and numbers, dates and money follow the person's locale while times follow
the business time zone. Authentication is a quiet,
focused product flow; billing belongs to the existing cabinet. Preserve this
identity when extending login or registration, rather than introducing a second
visual system.

The cabinet and auth follow the Rozbirka Design System v2 in
`docs/design-system/` one to one; read its `CLAUDE.md` before any UI change.
Its tokens and kit are generated into `src/styles/` (`npm run ds:sync`) and the
Tailwind names in `src/index.css` only point at them: orange brand `#f77425`,
canvas `#0b0b0b`, surface `#121212`, input `#191919`, text `#f6f4f2`, muted
`#a29b93`, Manrope + JetBrains Mono, a 4-step radius scale and a 7-step type
scale. Marketing retains Visuelt Hero. Do not duplicate or replace these values
in screen-local CSS.

Authentication reuses the v2 brand mark, step headers and shared app Button,
Field, TextInput and Notice components. Login uses a responsive 560px column
with 44px fields and primary actions. Login and
registration are explicit business variants of the same flow. Localized text
names the action; invitation context survives both variants. Language names are
always written in their own language with a matching `lang` attribute. Billing preserves
the cabinet's cards, auto-fit plan grid, status tones and mutation gates.

Behavior and component ownership are recorded in `UX-CONTRACT.md`. Scope this
record to the flows it names (auth, billing, part source and import); it is not
a claim that older screens have all been audited.

Legal pages retain existing type/colors and readable long-form layout, with plain
text branding and mailto contacts only; the privacy policy adds a row of
page-language buttons (translations pending legal review, see
`UX-CONTRACT.md`). Personal account controls use app Button
and Notice primitives and remain accessible outside company entitlement gates.

Public support links reuse the landing brand pill and Visuelt typography. The floating
link observes device safe areas; the footer offers the same destination. Labels and
new-window accessible names follow the landing locale. An unconfigured bot hides
the links rather than exposing a placeholder Telegram account.
