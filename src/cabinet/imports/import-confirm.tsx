import { Button } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type {
  ImportMapping,
  ImportRow,
  ImportValidation,
} from '@/api/part-imports'
import { issueText, valueLabels } from './import-model'

const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/ /g, ' ')

const NOTES = [
  'Схожі позиції не обʼєднуються: для рядка з можливим дублікатом буде створена окрема запчастина.',
  'Зупинка імпорту не видаляє вже створені дані.',
  'Після запуску сторінку можна закрити й повернутися до результату через історію.',
] as const

function Entity({
  value,
  label,
  meta,
}: {
  value: number
  label: string
  meta: string
}) {
  return (
    <div className="bg-app-raised px-5 pt-4.5 pb-5">
      <p
        className={cn(
          'text-[26px] leading-none font-extrabold tracking-[-0.03em]',
          value === 0 ? 'text-app-dim' : 'text-app-ink',
        )}
      >
        {count(value)}
      </p>
      <p
        className={cn(
          'mt-2 text-[14px] font-bold',
          value === 0 ? 'text-app-dim' : 'text-app-muted',
        )}
      >
        {label}
      </p>
      <p className="text-app-dim mt-1 text-[13px] leading-5 text-pretty">
        {meta}
      </p>
    </div>
  )
}

/**
 * Крок 4 — the last screen before anything exists. Everything on it comes
 * from the server's own validation of this exact selection, because that is
 * the number the commit will act on.
 */
export function ImportConfirmStep({
  validation,
  mapping,
  rows,
  selected,
  onBack,
  onCommit,
  busy,
}: {
  validation: ImportValidation
  mapping: ImportMapping | null
  rows: readonly ImportRow[]
  selected: readonly string[]
  onBack: () => void
  onCommit: () => void
  busy: boolean
}) {
  const picked = new Set(selected)
  const units = rows
    .filter((row) => picked.has(row.rowId))
    .reduce((sum, row) => {
      const quantity = Number(row.draft?.values['Quantity'] ?? '')
      return sum + (Number.isFinite(quantity) ? quantity : 0)
    }, 0)

  const constant = (target: string) =>
    mapping?.rules.find((rule) => rule.target === target)?.constant ?? null
  const fromColumn = (target: string) =>
    (mapping?.rules.find((rule) => rule.target === target)?.sources.length ??
      0) > 0
  const said = (target: string, whenColumn: string) =>
    fromColumn(target)
      ? whenColumn
      : constant(target) === null
        ? null
        : (valueLabels[constant(target)!] ?? constant(target)!)

  // What was left behind, grouped by the reason it was left behind.
  const excluded = new Map<string, number>()
  for (const row of rows) {
    if (picked.has(row.rowId)) continue
    const first = row.draft?.issues[0]
    const reason = first === undefined ? 'Знято вручну' : issueText(first.code)
    excluded.set(reason, (excluded.get(reason) ?? 0) + 1)
  }

  const facts = [
    {
      label: 'Походження',
      value: said('SourceType', 'З колонки файлу'),
    },
    {
      label: 'Складська зона',
      value: said('InventoryZoneId', 'З колонки файлу'),
    },
    {
      label: 'Стан',
      value: said('Condition', 'З колонки файлу'),
    },
    {
      label: 'Сценарій',
      value:
        constant('Strategy') === 'Reserved'
          ? `Резерв із замовленням${validation.orderGrouping === 'one-order-per-reserved-row' ? ' · одне замовлення на рядок' : ''}`
          : 'В наявності, доступні для продажу',
    },
    {
      label: 'Фото',
      value:
        validation.plannedPhotos === 0
          ? 'Не додаються'
          : `${count(validation.plannedPhotos)} ${plural(validation.plannedPhotos, ['фото', 'фото', 'фото'])} за посиланням`,
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <section
        aria-label="Буде створено"
        className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
      >
        <div className="px-6 pt-6 pb-5 sm:px-8">
          <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
            Буде створено
          </p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[44px] leading-none font-extrabold tracking-[-0.03em] text-white">
              {count(validation.plannedParts)}
            </span>
            <span className="text-app-muted text-[17px] font-bold">
              {plural(validation.plannedParts, [
                'запчастина',
                'запчастини',
                'запчастин',
              ])}
            </span>
            <span className="text-app-dim text-[14px]">
              {count(units)}{' '}
              {plural(units, [
                'одиниця товару',
                'одиниці товару',
                'одиниць товару',
              ])}
            </span>
          </p>
        </div>

        <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-px border-y">
          <Entity
            label="Надходжень"
            meta={
              validation.plannedIntakes === 0
                ? 'нове надходження не створюється'
                : 'нове надходження для цієї партії'
            }
            value={validation.plannedIntakes}
          />
          <Entity
            label="Складських зон"
            meta={
              validation.plannedZones === 0
                ? 'усі зони вже існують'
                : 'зони з файлу, яких ще немає'
            }
            value={validation.plannedZones}
          />
          <Entity
            label="Замовлень"
            meta={
              constant('Strategy') === 'Reserved'
                ? validation.maxOrderGroupSize === undefined
                  ? 'сценарій «Резерв із замовленням»'
                  : `до ${count(validation.maxOrderGroupSize)} позицій у кожному`
                : 'сценарій «Доступні запчастини»'
            }
            value={validation.plannedOrders}
          />
          <Entity
            label="Клієнтів"
            meta={
              validation.plannedCustomers === 0
                ? 'нових клієнтів немає'
                : 'клієнти з файлу, яких ще немає'
            }
            value={validation.plannedCustomers}
          />
        </div>

        <dl className="divide-app-line divide-y">
          {facts.map((fact) => (
            <div
              className="flex flex-wrap items-baseline justify-between gap-4 px-6 py-3.5 sm:px-8"
              key={fact.label}
            >
              <dt className="text-app-muted text-[14px]">{fact.label}</dt>
              <dd
                className={cn(
                  'text-[14.5px] font-medium',
                  fact.value === null ? 'text-app-dim' : 'text-app-ink',
                )}
              >
                {fact.value ?? 'не задано'}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-start gap-3.5">
        <section
          aria-label="Виключено з імпорту"
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[18px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">
            Виключено з імпорту
          </h2>
          {excluded.size === 0 ? (
            <p className="text-app-muted mt-3 text-[14px]">
              Нічого не виключено — усі рядки сторінки йдуть в імпорт.
            </p>
          ) : (
            <dl className="mt-3.5 grid gap-2.5">
              {[...excluded].map(([reason, howMany]) => (
                <div
                  className="flex flex-wrap items-baseline justify-between gap-3"
                  key={reason}
                >
                  <dt className="text-app-muted min-w-0 flex-1 text-[13.5px]">
                    {reason}
                  </dt>
                  <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                    {count(howMany)}{' '}
                    {plural(howMany, ['рядок', 'рядки', 'рядків'])}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-app-dim mt-4 text-[13px] leading-5 text-pretty">
            Виключені рядки залишаються у файлі — їх можна імпортувати окремо
            після виправлення.
          </p>
        </section>

        <section
          aria-label="Що варто знати"
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[18px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">Що варто знати</h2>
          <ul className="mt-3.5 grid gap-2.5">
            {NOTES.map((note) => (
              <li
                className="text-app-muted text-[13.5px] leading-6 text-pretty"
                key={note}
              >
                {note}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <Button disabled={busy} onClick={onBack}>
          Назад до перевірки
        </Button>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-app-dim text-[13px]">
            Робота піде у фоні — сторінку можна закрити
          </p>
          <Button
            className="h-11.5 px-6 text-[15px] font-bold"
            disabled={busy}
            onClick={onCommit}
            variant="primary"
          >
            Почати імпорт
          </Button>
        </div>
      </div>
    </div>
  )
}
