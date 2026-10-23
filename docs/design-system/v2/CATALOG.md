# CATALOG — компоненти Rozbirka v2

Як читати таблиці:
- **Клас** — з `v2/kit.css`;
- **Еталон** — файл у `v2/components/`;
- **As-is** — компонент у `rozbirka.web@main`;
- **Статус**: `=` збережено як у коді, `~` змінено візуально чи поведінково, `+` нове у v2 (у коді немає).

Підключення для HTML-прототипу:
```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="kit.css">
<link rel="stylesheet" href="https://unpkg.com/lucide-static@0.460.0/font/lucide.css">
<body class="rz" data-theme="dark" data-density="compact">
```
Іконки: `<i class="icon-package" aria-hidden="true"></i>` (lucide). Іконкова кнопка без тексту обовʼязково має `aria-label`.

## Каркас
| Компонент | Клас | Еталон | As-is | Статус |
|---|---|---|---|---|
| App shell | `.rz-app` › `.rz-sidebar` + `.rz-main` | Navigation | `CabinetShell.tsx` | ~ |
| Sidebar | `.rz-sidebar`, `.rz-nav-group`, `.rz-nav-item[aria-current=page]`, `.rz-sidebar__tenant` | Navigation | `CabinetNavigation.tsx` (280px) | ~ 232px, перемикач розбірки нагорі |
| Rail (768–1023) | `.rz-rail` | Navigation | `TabletNavigation` (72px) | ~ 56px |
| Mobile tab bar | `.rz-tabbar` | Navigation | `MobileNavigation` | = 4 вкладки + «Ще» |
| Topbar + breadcrumb | `.rz-topbar`, `.rz-crumbs`, `.rz-topbar__actions` | Navigation | `RedesignShell` crumb bar | ~ 44px, sans |
| Банер модуля | `.rz-banner--warn/danger/info` | Feedback, States | `ConnectionNotice.tsx`, access chips | + |
| Сторінка | `.rz-page`, `.rz-page-head`, `.rz-h-page`, `.rz-totals` | Parts List | `RedesignTitle` (46px) | ~ 20px |
| Master-detail | `.rz-split` › `.rz-page` + `.rz-peek` (≥1200 — колонка, нижче — шторка праворуч) | Containers | — | + |
| Список карток | `.rz-stack` (grid-auto-rows: max-content) | Parts List mobile | — | + |

## Контроли
| Компонент | Клас | Еталон | As-is | Статус |
|---|---|---|---|---|
| Button | `.rz-btn` (secondary) `--primary --ghost --danger`, `--sm --lg --touch --glove --icon --block` | Button | `app/button.tsx`, `button-variants.ts` | ~ ghost→secondary, quiet→ghost, висота 28/32 |
| Field | `.rz-field`, `.rz-label`, `.rz-req`, `.rz-hint`, `.rz-error` | Field | `field.tsx` | = поведінка, ~ розміри |
| TextInput / Number | `.rz-input`, `.rz-input--num`, `.rz-input-group` + `__addon` | Field | `input.tsx` | ~ |
| Select | `.rz-select-wrap` › `.rz-select` | Field | `SelectInput` | ~ |
| TextArea | `.rz-textarea` | Field | `TextArea` | ~ |
| SearchInput | `.rz-search` | Field | `SearchInput` | ~ |
| Inline-форма | `.rz-form-inline` › `.rz-row` | Field | — | + |
| Checkbox | `input.rz-check` | Selection | native у `data-table.tsx` | + |
| Radio / RadioCard | `input.rz-radio`, `.rz-choice`, `.rz-choice-card` | Selection | — | + |
| Switch | `input.rz-switch` | Selection | — | + (питання ?4) |
| CodeChip | `.rz-code`, `.rz-code--sm` | CodeChip | `code-chip.tsx` | ~ 24px |
| Kbd | `.rz-kbd` | CodeChip | локально в CommandPalette | + |
| QuantityStepper | `.rz-stepper`, `--glove` | Records | `quantity-stepper.tsx` | ~ |

## Статуси та зворотний звʼязок
| Компонент | Клас | Еталон | As-is | Статус |
|---|---|---|---|---|
| StatusPill | `.rz-pill--ok/warn/danger/info` (neutral за замовчуванням) | Status | `status-pill.tsx` | ~ без рамки, 20px |
| Status dot | `.rz-dot--*` | Status | `partStatusDot` | = |
| Counter | `.rz-count`, `--danger` | Status | — | + |
| Meter | `.rz-meter` › span, `--warn --danger --brand` | Status | `meter.tsx` | = поведінка понад 100% |
| Notice | `.rz-notice--info/ok/warn/danger` › `i` + `.rz-notice__body` | Feedback | `notice.tsx` | ~ |
| Toast | `.rz-toasts` › `.rz-toast` + `__msg __action` | Feedback | `toast.tsx` | = 6 с, ≤3, ≤1 дія |
| Skeleton | `.rz-skel` | Feedback | `skeleton.tsx` | ~ затримка 300 мс (+) |
| Spinner | `i.icon-loader-circle.rz-spin` | Button | `aria-busy` | + |

## Навігація в межах сторінки
| Компонент | Клас | Еталон | As-is | Статус |
|---|---|---|---|---|
| Tabs (маршрути) | `.rz-tabs` › `a[aria-current=page]` | Tabs | ручні вкладки білінгу, НП | + уніфікація |
| Segmented | `.rz-seg` › `button[role=radio][aria-checked]`, `--brand` | Tabs | `segmented.tsx`, `pill-group.tsx`, 7 ручних груп | ~ один компонент |
| CommandPalette | `.rz-dialog` + `.rz-menu__item` | Tabs | `CommandPalette.tsx` | ~ |

## Дані
| Компонент | Клас | Еталон | As-is | Статус |
|---|---|---|---|---|
| Toolbar | `.rz-toolbar`, `.rz-toolbar__end` | DataTable | `toolbar.tsx` | ~ без рамки |
| Filter button | `.rz-filter`, `--set` | DataTable | `PartsScreen` filters | + |
| ActiveFilters | `.rz-chip` | DataTable | `ActiveFilters` | ~ нейтральні, не brand |
| BulkBar | `.rz-bulk`, `__count __actions` | DataTable | `bulk-bar.tsx` | = замінює тулбар |
| DataTable | `.rz-table-wrap` › `.rz-table-scroll` › `table.rz-table`; `tr[aria-selected]`, `tr[data-active]`; `td.rz-num`; `.rz-cell-main` | DataTable | `data-table.tsx` | ~ + сортування |
| Mobile cards | автоматично `<768px`, `td[data-label]` | DataTable | `.data-table` CSS | = |
| Pagination | `.rz-pager`, `__nav` | DataTable | `pagination.tsx` | ~ |
| Inline edit | `.rz-input--num` у клітинці | DataTable | `inline-edit.tsx` | = Enter/Esc |
| StateScreen | `.rz-state`, `--brand/warn/danger`, `__icon __title __body __meta` | States | `state-screen.tsx`, `module-unavailable.tsx`, `not-found.tsx` | ~ суцільна рамка |

## Контейнери та оверлеї
| Компонент | Клас | Еталон | As-is | Статус |
|---|---|---|---|---|
| Card | `.rz-card` › `__head __body __foot` | Containers | `card.tsx` (20px), `section-panel.tsx`, `panel.tsx` | ~ 8px, одна картка |
| Inset | `.rz-inset` | Containers | ручні `rounded-[14px]` | ~ |
| FactList | `dl.rz-facts` | Containers | `fact-rows.tsx`, `spec-grid.tsx`, `value.tsx` | ~ sans-підписи |
| KpiStrip | `.rz-kpis` › `.rz-kpi` (`--warn --dim`) | Containers | `redesign-kpi.tsx`, `StatStrip` | ~ |
| Peek | `.rz-peek` › `__head __section` | Containers | — | + |
| Dialog | `.rz-scrim` › `.rz-dialog` (`--lg`) › `__head __body __foot` | Overlays | `FormDialog` | = блокує закриття під час pending |
| ConfirmDialog | `.rz-confirm` | Overlays | `confirm-dialog.tsx` | = фокус на «Скасувати» |
| Sheet | `.rz-sheet` › … `.rz-sheet__foot` | Overlays | `Sheet` | ~ 20px заголовок |
| ActionMenu | `.rz-menu` › `.rz-menu__item` (`--danger`), `.rz-menu__sep` | Overlays | `action-menu.tsx` | ~ 30px пункти |
| FilterPopover | `.rz-popover` | Overlays | — | + |

## ERP-блоки
| Компонент | Клас | Еталон | As-is | Статус |
|---|---|---|---|---|
| PhotoGrid | `.rz-photos` › `.rz-photo` (`__badge`, `--add`) | Records | `photo.tsx` | ~ |
| Stepper (кроки) | `ol.rz-steps` › `li[data-state][aria-current=step]` › `.rz-steps__n` | Records | `stepper.tsx` (не використовується) | ~ |
| Timeline | `ol.rz-timeline`, `.rz-change` | Records | історія в `PartsScreen`, `part-labels.ts` | ~ |
| PermissionGate | приховати / `disabled` + причина / `.rz-state` | Records | `policy.ts`, `FeatureGate` | = |
| Scanner | `.rz-scan`, `__cam __frame[data-state] __dock` | Scanner | `ScannerScreen.tsx` | ~ |
| Друк | `.rz-paper`, `.rz-sticker` | Print | stickers, `zone-label-output.ts` | ~; документ A4 + |
