# Components

## Вхід у продуктовий UI

Публічні exports — [src/components/app/index.ts](../../src/components/app/index.ts). Імпорт `@/components/app` уже використовується продуктовими екранами. Нижче карта відповідальностей, не дубль TypeScript API.

| Потреба                             | Реалізація                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Дія / link у вигляді кнопки         | [Button](../../src/components/app/button.tsx), [variants](../../src/components/app/button-variants.ts)                                                                                                                                            |
| Підпис, hint, помилка й контроль    | [Field](../../src/components/app/field.tsx), [inputs](../../src/components/app/input.tsx), [field context](../../src/components/app/field-context.ts)                                                                                             |
| Сторінка та секція                  | [PageHeader/PageBody](../../src/components/app/page-header.tsx), [SectionPanel/PanelFooter](../../src/components/app/section-panel.tsx), [Card](../../src/components/app/card.tsx)                                                                |
| Таблиця, пагінація, вибір           | [DataTable](../../src/components/app/data-table.tsx), [Pagination](../../src/components/app/pagination.tsx), [BulkBar](../../src/components/app/bulk-bar.tsx)\*                                                                                   |
| Пошук / фільтри / перемикачі        | [Toolbar, ActiveFilters\*](../../src/components/app/toolbar.tsx), [Segmented](../../src/components/app/segmented.tsx), [PillGroup](../../src/components/app/pill-group.tsx)                                                                       |
| Діалог, бічна панель, підтвердження | [FormDialog/Sheet](../../src/components/app/form-dialog.tsx), [ConfirmDialog](../../src/components/app/confirm-dialog.tsx)                                                                                                                        |
| Стан екрана / повідомлення          | [StateScreen/EmptyState/ErrorState/DeniedState](../../src/components/app/state-screen.tsx), [Notice](../../src/components/app/notice.tsx), [Skeleton](../../src/components/app/skeleton.tsx), [ToastProvider](../../src/components/app/toast.tsx) |
| Файли та фото                       | [PhotoFileField, FileField\*/UploadList\*](../../src/components/app/file-field.tsx), [Gallery, PhotoGrid\*](../../src/components/app/photo.tsx)                                                                                                   |
| Кроки та операція                   | [Stepper\*](../../src/components/app/stepper.tsx), [useSteps\*](../../src/components/app/use-steps.ts), [useOperation](../../src/components/app/use-operation.ts)                                                                                 |
| Смуга показників (redesign)         | [Kpi/KpiStrip](../../src/cabinet/redesign-kpi.tsx) — спільна смуга KPI кабінету, не частина `@/components/app`                                                                                                                                    |
| Значення / статус / властивості     | [Amount/Quantity/DateValue](../../src/components/app/value.tsx), [StatusPill](../../src/components/app/status-pill.tsx), [SpecGrid](../../src/components/app/spec-grid.tsx), [FactRows](../../src/components/app/fact-rows.tsx)                   |
| Редагування та меню                 | [InlineEdit](../../src/components/app/inline-edit.tsx), [QuantityStepper](../../src/components/app/quantity-stepper.tsx), [ActionMenu](../../src/components/app/action-menu.tsx)                                                                  |

\* Є в наборі й покриті тестами набору, але на екранах кабінету поки не використовуються. Перед першим застосуванням перевірити поведінку в реальному сценарії; [ImportScreen](../../src/cabinet/imports/ImportScreen.tsx), наприклад, має власний індикатор кроків, а не Stepper.

Card і SectionPanel: [Card](../../src/components/app/card.tsx) — картка redesign-екранів; SectionPanel — секція форми або старішого екрана, у шторці — `variant="plain"` (секції, розділені лінією). Обирати за сусідніми екранами.

## Важливі відмінності

App Button має variants primary/ghost/quiet/danger; default — ghost, не primary. Звичайна кнопка за замовчуванням `type="button"`; submit задається явно. `asChild` використовується для відповідної семантики дочірнього елемента.

[ui Button](../../src/components/ui/button.tsx) — кнопка dev-прототипів `/screens` (маршрут лише для розробки, у production його немає); вона на semantic-токені `primary`. На лендингу її не використовують: CTA — `Link` із brand-класами у [site components](../../src/components/site/), наприклад [hero](../../src/components/site/hero.tsx). Для кабінету — лише app Button.

Field передає id, describedBy та invalid через context. Його читають TextInput, TextArea, SelectInput, SearchInput, FileField і QuantityStepper; PillGroup, Segmented і сторонні контроли — ні. `required` у Field лише малює зірочку (`aria-hidden`): ні `required`, ні `aria-required` на контрол не потрапляють, перевірку обов’язковості робить форма. Error замінює hint і описує контрол через `aria-describedby`, але не оголошується як live region.

FormDialog, Sheet і ConfirmDialog використовують Radix Dialog, але гарантії різні — не переносити їх з одного на інший:

| Компонент     | Під час pending                                                                                        | Після успіху    |
| ------------- | ------------------------------------------------------------------------------------------------------ | --------------- |
| FormDialog    | сам блокує закриття: Escape, оверлей, хрестик і «Скасувати»                                            | закриває caller |
| Sheet         | нічого не блокує, pending не знає; caller перевіряє `onOpenChange` і вимикає свої кнопки               | закриває caller |
| ConfirmDialog | вимикає лише свої кнопки; Escape і оверлей закривають діалог, якщо caller не перевірить `onOpenChange` | закриває caller |

ConfirmDialog при відкритті ставить focus на «Скасувати».

[PartSearchPicker](../../src/components/parts/PartSearchPicker.tsx) — предметний вибір запчастини з API та власною поведінкою. Він не є універсальним EntityPicker або generic Combobox.

## Лендинг та різні покоління екранів

[SiteHeader](../../src/components/site/header.tsx), [FAQ](../../src/components/site/faq.tsx), [Pricing](../../src/components/site/pricing.tsx), [PageContainer](../../src/components/layout/page-container.tsx) і [Section](../../src/components/layout/section.tsx) належать маркетинговому шару.

У кабінеті є PageHeader/PageBody і окремий [RedesignShell](../../src/cabinet/redesign-shell.tsx). Обирати реалізацію за сусідніми екранами й прийнятим дизайном; сам факт наявності redesign не є дорученням мігрувати всі сторінки.
