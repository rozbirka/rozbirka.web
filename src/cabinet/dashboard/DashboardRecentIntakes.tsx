import { Link } from 'react-router'
import type { IntakeListItem } from '@/api/intakes'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})
const numberFormatter = new Intl.NumberFormat('uk-UA')

export function DashboardRecentIntakes({
  intakes,
  intakesPath,
}: {
  intakes: IntakeListItem[]
  intakesPath: string
}) {
  return (
    <section
      aria-labelledby="dashboard-recent-intakes"
      className="dashboard-recent-card dashboard-recent-intakes"
    >
      <header>
        <h2 id="dashboard-recent-intakes">Приймання</h2>
        <Link to={intakesPath}>Усі</Link>
      </header>

      {intakes.length === 0 ? (
        <p className="dashboard-recent-empty">Приймань ще немає.</p>
      ) : (
        <div className="dashboard-intake-list">
          {intakes.map((intake) => (
            <IntakeRow
              intake={intake}
              intakesPath={intakesPath}
              key={intake.id}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function IntakeRow({
  intake,
  intakesPath,
}: {
  intake: IntakeListItem
  intakesPath: string
}) {
  const createdAt = new Date(intake.createdAt)
  let intakeName = 'Без назви'
  if (intake.name !== null && intake.name.trim().length > 0) {
    intakeName = intake.name.trim()
  }
  return (
    <article className="dashboard-intake-row">
      <div>
        <Link to={`${intakesPath}/${encodeURIComponent(intake.id)}`}>
          {intakeName}
        </Link>
        <p>
          <time dateTime={intake.createdAt}>
            {Number.isNaN(createdAt.valueOf())
              ? '—'
              : dateFormatter.format(createdAt)}
          </time>{' '}
          · {intake.createdBy.displayName}
        </p>
      </div>
      <strong>{numberFormatter.format(intake.partsCount)} шт</strong>
    </article>
  )
}
