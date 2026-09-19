# Rozbirka product design

Rozbirka serves Ukrainian vehicle dismantling teams. Authentication is a quiet,
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
registration are explicit business variants of the same flow. Ukrainian text
names the action; invitation context survives both variants. Billing preserves
the cabinet's cards, auto-fit plan grid, status tones and mutation gates.

Behavior and component ownership are recorded in `UX-CONTRACT.md`. Scope this
record to touched auth/billing flows; it is not a claim that older screens have
all been audited.
