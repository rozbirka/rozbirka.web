import type { LastActivity } from '@/api/dashboard-contract'
import { CardEmpty, CardRow, DashboardCard } from './dashboard-card'
import { activityLabel } from './dashboard-labels'

const time = new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})

const day = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Kyiv',
})

interface Entry {
  key: string
  activity: LastActivity
  /** What this entry is: the yard's last move, or this person's own. */
  scope: string
}

/**
 * The yard's activity feed. `/dashboard` reports two events — the last thing
 * anyone did and the last thing you did — and there is no activity log
 * endpoint behind them, so the card is two rows deep rather than the design's
 * running journal. Nothing in either event carries a sum, so the signed money
 * column of the design is absent too.
 */
export function ActivityCard({
  lastActivity,
  lastMyActivity,
}: {
  lastActivity: LastActivity | null
  lastMyActivity: LastActivity | null
}) {
  const entries: Entry[] = []
  if (lastActivity !== null)
    entries.push({ key: 'yard', activity: lastActivity, scope: 'у розбірці' })
  if (lastMyActivity !== null)
    entries.push({ key: 'mine', activity: lastMyActivity, scope: 'моя' })

  return (
    <DashboardCard title="Активність">
      {entries.length === 0 ? (
        <CardEmpty>Поки нічого не відбувалося.</CardEmpty>
      ) : (
        entries.map((entry) => (
          <CardRow key={entry.key}>
            <div className="grid grid-cols-[44px_minmax(0,1fr)] items-baseline gap-3">
              <p className="text-app-dim font-mono text-[12px] tabular-nums">
                {stamp(entry.activity.timestamp)}
              </p>
              <div className="min-w-0">
                <p className="text-app-ink text-[14px] leading-[1.4] text-pretty">
                  {activityLabel(entry.activity.type)}
                </p>
                <p className="text-app-dim mt-[3px] text-[12px]">
                  {entry.activity.userName} · {entry.scope}
                </p>
              </div>
            </div>
          </CardRow>
        ))
      )}
    </DashboardCard>
  )
}

/**
 * Today's events are read by the clock; anything older needs its date, or
 * «14:02» silently means last week.
 */
function stamp(timestamp: string): string {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) return '—'
  return day.format(at) === day.format(new Date())
    ? time.format(at)
    : day.format(at)
}
