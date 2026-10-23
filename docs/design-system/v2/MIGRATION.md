# v2 — уніфікація під CRM/ERP

Цільова система (to-be). Репо не змінюється. As-is задокументовано в `tokens/` (етап 2). Тут описано, як кожне поточне значення лягає у v2.

## Рішення
- **Референс — Linear.** Щільний, тихий інтерфейс: дрібні радіуси, текст 13px, бічна панель 232px, peek-панель запису праворуч (master-detail) замість переходу на окрему сторінку.
- **Бренд** `#f77425` лишається, але вживається лише для primary-дії, фокусу, поточного вибору (ребро активного рядка, іконка активного пункту меню) і чекбоксів. Великих помаранчевих площ немає.
- **Теми:** темна (за замовчуванням, значення з поточного коду) і світла (нова). Перемикач — `data-theme` на корені.
- **Щільність:** `compact` (за замовчуванням) і `comfortable`, перемикач `data-density`. На `pointer: coarse` контроли автоматично 44px, для складу є `--rz-target-glove 56px`.
- **Шрифти:** Manrope + JetBrains Mono скрізь. System sans прибрано, `.type-redesign` більше не потрібен.
- **Фокус:** одне правило `--rz-focus` (кільце brand 2px) усюди. `ring-white/40` прибрано.

## Мапа as-is → v2

| As-is (код) | v2 |
|---|---|
| `app-canvas / raised / input / overlay` | `--rz-bg / --rz-surface / --rz-surface-2 / --rz-overlay` (значення ті самі) |
| `surface-1/2/3` (лендинг) у кабінеті (`.cabinet-rail-tooltip`) | `--rz-overlay` |
| `text-white` / `app-ink` / `app-muted` / `app-dim` / `text-neutral-*` | `--rz-text-strong / --rz-text / --rz-text-muted / --rz-text-dim`. `neutral-*` → muted/dim |
| `bg-white/[0.025 0.03 0.04 0.05 0.06]` | `--rz-fill-hover` |
| `bg-white/[0.07]` | `--rz-fill-active` |
| `bg-white/[0.09]` | `--rz-fill-selected` |
| `state-*-soft 0.13` + ad-hoc `/[0.07] /10 /12` | `--rz-*-soft` (одне значення 0.14) |
| `bg-brand-soft`, `bg-app-inset` (не визначені) | `--rz-brand-soft`, `--rz-surface-2` |
| Радіуси 4, 5, 6, 7 | `--rz-r-xs 4` |
| 8, 9, 10, 11 (`rounded-control`) | `--rz-r-sm 6` |
| 12, 14, 15, 16, 18, 20 (`panel`, Card) | `--rz-r-md 8` |
| `sheet 16`, `rounded-t-[24px]`, dialogs | `--rz-r-lg 12` |
| Шрифти 10–11.5 | 11 (`micro`) |
| 12–12.5 | 12 (`caption`) |
| 13–14.5 | 13 (`body`); поля вводу — 14 |
| 15–19 | 16 (`title`) |
| 22–26 | 20 (`page`) |
| 34–46 (`RedesignTitle`) | 20 (`page`). Display 28 лише для KPI |
| Висота кнопок `min-h-11` (44) | `--rz-control-h` 28/32; 44 на touch |
| `shadow-lg`, `shadow-2xl` | `--rz-shadow-popover`, `--rz-shadow-dialog` |
| `transition-colors` 150ms, 200, 300, 500, 700 | `--rz-dur-fast 120 / --rz-dur 180 / --rz-dur-slow 240` |
| Ручні групи вкладок (7 місць) | один компонент Segmented (див. Parts List: фільтр статусу) |
| `RedesignShell` 1240px + `PageHeader` | sidebar + topbar 44px (breadcrumb + дії) + h1 20px |

## Наступні кроки (за вашим «далі»)
1. Каталог компонентів v2 і `kit.css` на цих токенах.
2. Ще 2–3 еталонні екрани (картка замовлення, форма, документ на друк).
3. Контент, стани, навігація, перевірка, правила для агентів, eval — як у початковому плані, але для v2.
