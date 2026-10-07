# Rozbirka product design

Rozbirka serves vehicle dismantling teams in Ukraine, the United Kingdom and
Poland. The interface ships in Ukrainian (source), British English and Polish;
copy lives in per-feature message namespaces (`src/i18n`), never as literals in
JSX, and numbers, dates and money follow the person's locale while times follow
the business time zone. Authentication is a quiet,
focused product flow; billing belongs to the existing cabinet. Preserve this
identity when extending login or registration, rather than introducing a second
visual system.

Runtime tokens are canonical in `src/index.css`: orange brand `#f77425`, canvas
`#0b0b0b`, raised surface `#121212`, input `#191919`, ink `#f6f4f2`, muted text
`#a29b93`. Existing typography uses the app's system sans with Manrope and
JetBrains Mono in its redesigned cabinet scope; marketing retains Visuelt Hero.
Do not duplicate or replace these values in screen-local CSS.

Authentication reuses `src/screens/login.tsx`'s 420px column, BrandLogo, step
headers and shared app Button, Field, TextInput and Notice components. Login and
registration are explicit business variants of the same flow. Localized text
names the action; invitation context survives both variants. Language names are
always written in their own language with a matching `lang` attribute. Billing preserves
the cabinet's cards, auto-fit plan grid, status tones and mutation gates.

Behavior and component ownership are recorded in `UX-CONTRACT.md`. Scope this
record to the flows it names (auth, billing, part source and import); it is not
a claim that older screens have all been audited.

Legal pages retain existing type/colors and readable long-form layout, with plain
text branding and mailto contacts only. Personal account controls use app Button
and Notice primitives and remain accessible outside company entitlement gates.
