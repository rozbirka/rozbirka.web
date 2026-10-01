import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import {
  CardBadge,
  CardEmpty,
  CardLink,
  CardRow,
  DashboardCard,
} from './dashboard-card'
import type { DashboardTask } from './dashboard-tasks'

const DOT: Record<DashboardTask['tone'], string> = {
  warn: 'bg-state-warn',
  info: 'bg-state-info',
}

/**
 * The first card of the board: what is worth doing before anything else. The
 * top row is tinted so the day has a first line rather than five equal ones.
 */
export function TodayTasks({
  tasks,
  allPath,
}: {
  tasks: readonly DashboardTask[]
  /** Where the whole queue lives, when there is a screen for it. */
  allPath: string | null
}) {
  return (
    <DashboardCard
      aside={
        allPath === null ? null : <CardLink to={allPath}>Усі справи</CardLink>
      }
      badge={tasks.length === 0 ? null : <CardBadge>{tasks.length}</CardBadge>}
      title="Зробити сьогодні"
    >
      {tasks.length === 0 ? (
        <CardEmpty>
          Нічого не вимагає уваги: жодного авто без обороту, незаповненого
          приймання чи позиції з нульовим залишком.
        </CardEmpty>
      ) : (
        tasks.map((task, index) => (
          <CardRow key={task.id} tint={index === 0 && task.tone === 'warn'}>
            <div className="grid grid-cols-[6px_minmax(0,1fr)_auto] items-center gap-3.5">
              <span
                aria-hidden
                className={cn('size-1.5 rounded-full', DOT[task.tone])}
              />
              <div className="min-w-0">
                <p className="text-[15px] leading-[1.35] font-bold tracking-[-0.01em] text-pretty text-white">
                  {task.title}
                </p>
                <p className="text-app-muted mt-[3px] text-[13px] text-pretty">
                  {task.meta}
                </p>
              </div>
              <Link
                className="border-app-line-2 text-app-ink relative inline-flex h-8 items-center rounded-[8px] border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors hover:bg-white/[0.06] after:absolute after:-inset-1.5 after:content-['']"
                to={task.to}
              >
                {task.action}
              </Link>
            </div>
          </CardRow>
        ))
      )}
    </DashboardCard>
  )
}
