import { Button } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type {
  ImportMapping,
  ImportStatus,
  ImportValidation,
} from '@/api/part-imports'
import { fieldLabels, valueLabels } from './import-model'

const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/ /g, ' ')

const label = (id: string) => fieldLabels[id] ?? id

/** How one rule reads to a person: a column name, a value, or nothing. */
function saidAs(
  mapping: ImportMapping | null,
  target: string,
  columns: ImportStatus['source'],
) {
  const rule = mapping?.rules.find((one) => one.target === target)
  if (rule === undefined) return 'не зіставлено'
  if (rule.sources.length > 0) {
    const column = columns?.fields.find((one) => one.id === rule.sources[0])
    return `з колонки «${column?.header ?? rule.sources[0] ?? '—'}»`
  }
  const constant = rule.constant ?? ''
  if (constant === '') return 'не зіставлено'
  // An unknown constant is shown as the raw value in quotes rather than
  // dressed up as a label we do not actually have.
  return valueLabels[constant] ?? `значення «${constant}»`
}

/**
 * The confirmation someone is looking at was computed against a revision the
 * server has since moved past. Rather than a bare error, this screen shows
 * what the difference actually is — the mapping they confirmed against, beside
 * the mapping that exists now — so the re-check is an informed decision and
 * not a shrug.
 */
export function ImportConflict({
  mine,
  theirs,
  status,
  lastValidation,
  onRecheck,
  onSettings,
  busy,
}: {
  /** The mapping this confirmation was computed against. */
  mine: ImportMapping | null
  /** What the server has now. */
  theirs: ImportMapping | null
  status: ImportStatus
  lastValidation: ImportValidation | null
  onRecheck: () => void
  onSettings: () => void
  busy: boolean
}) {
  const targets = [
    ...new Set([
      ...(mine?.rules ?? []).map((rule) => rule.target),
      ...(theirs?.rules ?? []).map((rule) => rule.target),
    ]),
  ]
  const diffs = targets
    .map((target) => ({
      target,
      was: saidAs(mine, target, status.source),
      now: saidAs(theirs, target, status.source),
    }))
    .filter((diff) => diff.was !== diff.now)

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div
        className="border-state-warn/26 bg-state-warn-soft flex flex-wrap items-center gap-4.5 rounded-[18px] border px-5.5 py-5"
        role="alert"
      >
        <span
          aria-hidden
          className="bg-state-warn/12 text-state-warn inline-flex size-10.5 flex-none items-center justify-center rounded-[11px] text-[18px] font-bold"
        >
          !
        </span>
        <div className="min-w-0 flex-[1_1_320px]">
          <p className="text-state-warn text-[15px] font-bold">
            Дані імпорту змінилися — перевірте їх ще раз перед запуском
          </p>
          <p className="text-app-muted mt-1.5 text-[14px] leading-6 text-pretty">
            Поки ви були на цій сторінці, налаштування імпорту змінилися.
            Підтвердження, яке ви бачите, розраховане за старими налаштуваннями,
            тому запуск заблокований. Хто саме змінив — невідомо.
          </p>
        </div>
      </div>

      <section
        aria-label="Що змінилося"
        className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
      >
        <h2 className="text-app-ink border-app-line border-b px-5.5 py-4 text-[15px] font-bold">
          Що змінилося
        </h2>
        {diffs.length === 0 ? (
          <p className="text-app-muted px-5.5 py-4 text-[14px] leading-6 text-pretty">
            Зіставлення колонок не змінилося — розійшлася ревізія імпорту. Це
            буває, коли файл прочитали заново або хтось відкрив цей імпорт
            паралельно.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">
                Різниця між вашим переглядом і поточними налаштуваннями
              </caption>
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">Налаштування</th>
                  <th className="px-3 py-2.5 text-left">Ваш перегляд</th>
                  <th className="px-3 py-2.5 text-left">Поточне значення</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((diff) => (
                  <tr className="border-app-line border-b" key={diff.target}>
                    <td className="text-app-ink px-5.5 py-3.5 text-[14.5px] font-bold">
                      {label(diff.target)}
                    </td>
                    <td className="text-app-dim px-3 py-3.5 line-through">
                      {diff.was}
                    </td>
                    <td className="text-app-ink px-3 py-3.5 font-medium">
                      {diff.now}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-app-dim border-app-line border-t px-5.5 py-3.5 text-[13px] leading-5 text-pretty">
          Нічого не створено. Налаштування збережені — повторна перевірка займе
          кілька секунд і поверне вас на це саме місце.
        </p>
      </section>

      <div className="border-app-line bg-app-raised flex flex-wrap items-center justify-between gap-4 rounded-[18px] border px-5.5 py-5">
        <div className="min-w-0 flex-[1_1_320px]">
          <p
            className={cn(
              'text-[14.5px] font-bold',
              lastValidation === null ? 'text-app-dim' : 'text-app-ink',
            )}
          >
            {lastValidation === null
              ? 'Попереднього розрахунку немає'
              : `Попередній розрахунок: ${count(lastValidation.plannedParts)} ${plural(lastValidation.plannedParts, ['запчастина', 'запчастини', 'запчастин'])}`}
          </p>
          <p className="text-app-muted mt-1 text-[13.5px] leading-5 text-pretty">
            Після повторної перевірки кількість може змінитися.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button disabled={busy} onClick={onSettings}>
            До налаштувань
          </Button>
          <Button disabled={busy} onClick={onRecheck} variant="primary">
            Перевірити повторно
          </Button>
        </div>
      </div>
    </div>
  )
}
