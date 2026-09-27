import type { CarListItem } from '@/api/cars'
import type { IntakeListItem } from '@/api/intakes'
import { plural } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import type { CabinetModuleKey } from '../module-registry'

/**
 * «Зробити сьогодні» is not a list the server keeps — there is no task
 * endpoint anywhere in Core. It is derived here from what the yard's own data
 * already says: a car that has stood too long without earning back, an intake
 * nobody finished, parts sold off the shelf but never taken out of the
 * catalogue.
 *
 * Only facts the API actually carries become tasks. A reserve about to expire
 * and an unreconciled till — both in the design — have no field behind them,
 * so they are absent rather than guessed.
 */
export type TaskTone = 'warn' | 'info'

export interface DashboardTask {
  id: string
  tone: TaskTone
  title: string
  meta: string
  /** What the button says. */
  action: string
  to: string
}

/** A car that has stood this long without paying for itself is a question. */
export const STALE_CAR_DAYS = 60

/** At most this many cars become tasks, so one bad month cannot fill the card. */
const STALE_CAR_LIMIT = 2

const MS_PER_DAY = 86_400_000

export const daysSince = (iso: string, now: Date): number | null => {
  const since = new Date(iso)
  if (Number.isNaN(since.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / MS_PER_DAY))
}

export interface TaskInputs {
  slug: string
  /** Modules this account may open — a task nobody can act on is not shown. */
  allowed: ReadonlySet<CabinetModuleKey>
  cars: readonly CarListItem[] | null
  intakes: readonly IntakeListItem[] | null
  outOfStockPartsCount: number | null
  now: Date
}

export function dashboardTasks({
  slug,
  allowed,
  cars,
  intakes,
  outOfStockPartsCount,
  now,
}: TaskInputs): DashboardTask[] {
  return [
    ...draftIntakeTasks(slug, allowed, intakes),
    ...staleCarTasks(slug, allowed, cars, now),
    ...outOfStockTask(slug, allowed, outOfStockPartsCount),
  ]
}

/**
 * An intake that was created and then left with nothing in it. The list gives
 * the count directly, so this is the one draft the API can actually name.
 */
function draftIntakeTasks(
  slug: string,
  allowed: ReadonlySet<CabinetModuleKey>,
  intakes: readonly IntakeListItem[] | null,
): DashboardTask[] {
  if (intakes === null || !allowed.has('intakes')) return []
  return intakes
    .filter((intake) => intake.partsCount === 0)
    .slice(0, 2)
    .map((intake) => ({
      id: `intake:${intake.id}`,
      tone: 'warn' as const,
      title: `Приймання ${intake.name ?? 'без назви'} без позицій`,
      meta:
        intake.supplier === null
          ? 'Створене, але жодної деталі не внесено'
          : `${intake.supplier} · жодної деталі не внесено`,
      action: 'Продовжити',
      to: cabinetPath(slug, 'intakes', intake.id),
    }))
}

function staleCarTasks(
  slug: string,
  allowed: ReadonlySet<CabinetModuleKey>,
  cars: readonly CarListItem[] | null,
  now: Date,
): DashboardTask[] {
  if (cars === null || !allowed.has('cars')) return []
  const stale: { car: CarListItem; days: number; percent: number }[] = []
  for (const car of cars) {
    const days = daysSince(car.acquiredAt, now)
    if (days === null || days < STALE_CAR_DAYS) continue
    const percent = Math.round(car.profitability?.recoupedPercent ?? 0)
    if (percent >= 100) continue
    stale.push({ car, days, percent })
  }
  return stale
    .sort((left, right) => right.days - left.days)
    .slice(0, STALE_CAR_LIMIT)
    .map(({ car, days, percent }) => ({
      id: `car:${car.id}`,
      tone: 'info' as const,
      title: `${car.brand} ${car.model} стоїть ${String(days)} ${plural(days, ['день', 'дні', 'днів'])}`,
      meta: `Відбито ${String(percent)}% · ${String(car.partsCount - car.soldPartsCount)} ${plural(car.partsCount - car.soldPartsCount, ['позиція', 'позиції', 'позицій'])} без продажу`,
      action: 'Переглянути',
      to: cabinetPath(slug, 'cars', car.id),
    }))
}

/**
 * Parts the yard sold out of but never took off the catalogue. The design's
 * action is «Списати»; there is no write-off endpoint, so the task opens the
 * filtered list instead of promising an operation.
 */
function outOfStockTask(
  slug: string,
  allowed: ReadonlySet<CabinetModuleKey>,
  count: number | null,
): DashboardTask[] {
  if (count === null || count <= 0 || !allowed.has('parts')) return []
  return [
    {
      id: 'parts:out-of-stock',
      tone: 'info',
      title: `${String(count)} ${plural(count, ['позиція', 'позиції', 'позицій'])} з нульовим залишком`,
      meta: 'Продані, але лишилися в каталозі',
      action: 'Переглянути',
      to: `${cabinetPath(slug, 'parts')}?status=sold`,
    },
  ]
}
