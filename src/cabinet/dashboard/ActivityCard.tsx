import type { LastActivity } from '@/api/dashboard-contract'
import { useFormat, useLocale, useT, type Formatters } from '@/i18n'
import { CardEmpty, CardRow, DashboardCard } from './dashboard-card'
import { activityLabel } from './dashboard-labels'
import { dashboardMessages } from './dashboard-messages'

const DAY: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }

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
  const { locale } = useLocale()
  const t = useT(dashboardMessages)
  const format = useFormat()
  const entries: Entry[] = []
  if (lastActivity !== null)
    entries.push({ key: 'yard', activity: lastActivity, scope: t('scopeYard') })
  if (lastMyActivity !== null)
    entries.push({
      key: 'mine',
      activity: lastMyActivity,
      scope: t('scopeMine'),
    })

  return (
    <DashboardCard title={t('activityTitle')}>
      {entries.length === 0 ? (
        <CardEmpty>{t('activityEmpty')}</CardEmpty>
      ) : (
        entries.map((entry) => (
          <CardRow key={entry.key}>
            <div className="grid grid-cols-[44px_minmax(0,1fr)] items-baseline gap-3">
              <p className="text-app-dim font-mono text-[12px] tabular-nums">
                {stamp(entry.activity.timestamp, format)}
              </p>
              <div className="min-w-0">
                <p className="text-app-ink text-[14px] leading-[1.4] text-pretty">
                  {activityLabel(entry.activity.type, locale)}
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
 * «14:02» silently means last week. "Today" is the business's day.
 */
function stamp(timestamp: string, format: Formatters): string {
  const day = format.dateWith(timestamp, DAY)
  if (day === null) return '—'
  return day === format.dateWith(new Date(), DAY)
    ? (format.time(timestamp) ?? '—')
    : day
}
