# Контент: де живуть рядки й переліки

Рядки інтерфейсу не копіюються в пакет, бо інакше вони почнуть розходитися з кодом. Джерело — `rozbirka.web@main`. Тут записано, де їх шукати і як ними користуватися.

## Правила
- uk — мова-джерело. Також є en-GB (fallback) і pl. Ключ має бути в усіх трьох (`defineMessages`).
- Плюрали — CLDR (`one/few/many/other`). Приклад: «1 деталь / 2 деталі / 5 деталей».
- Числа, дати й гроші — за локаллю людини (`Intl`, uk-UA / en-GB / pl-PL). Час — за часовим поясом бізнесу.
- Назви мов пишуться мовою оригіналу з `lang`: Українська · English (UK) · Polski.

## Карта namespace
| Що | Файл |
|---|---|
| Спільні дієслова (Зберегти, Скасувати, Спробувати ще раз…) | `src/i18n/common-messages.ts` |
| Кіт (пагінація, вибір, помилки, фото) | `src/components/app/app-messages.ts` |
| Модулі й групи навігації | `src/cabinet/module-messages.ts` |
| Каркас, ⌘K, офлайн, перемикання розбірки | `src/cabinet/shell-messages.ts` |
| Доступ, тариф, ліміт, підписка, 404 | `src/cabinet/access-messages.ts` |
| Запчастини: список / картка / форма / словники | `src/cabinet/parts/parts-list-messages.ts`, `part-detail-messages.ts`, `part-form-messages.ts`, `part-labels-messages.ts` |
| Сканер | `src/cabinet/scanners/messages.ts` |
| Стікери | `src/cabinet/stickers/messages.ts` |
| Замовлення, оплата, доставка | `src/cabinet/orders/*messages.ts`, `orders/delivery/*messages.ts` |
| Автомобілі, клієнти, приймання, каси, команда, імпорт, інвентаризація | `src/cabinet/<module>/*messages.ts` |
| Вхід, запрошення, акаунт | `src/screens/*-messages.ts`, `src/components/account/account-messages.ts` |

## Переліки (enums)
- **Статус деталі:** available → «Доступна» (ok), reserved → «У резерві» (warn), sold → «Продана» (danger). Код: `part-labels.ts`.
- **Стан деталі:** new, used, good, fair, scrap, refurbished, damaged («Нова», «Вживана», «Хороший», «Задовільний», «На запчастини», «Відновлена», «Пошкоджена»).
- **Події історії:** created, updated, reserved, reservation_cancelled, added, released, sold, returned, moved, placed, unplaced, deleted.
- **Модулі (17):** `module-registry.ts`. Групи: overview, stock, sales, money, settings.
- **Стани підписки:** trial, active, pastDue, cancelled (+ blocked, none в access-messages).
- **Фіче-флаги:** `parts.bulk-import` (`src/api/feature-flags.ts`).
- **Локалі:** uk, en-GB, pl.
- **Категорії помилок API:** network, auth, permission, validation, timeout, unknown (`observability/redaction.ts`).
