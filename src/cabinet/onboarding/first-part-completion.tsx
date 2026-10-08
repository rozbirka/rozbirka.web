import { Link } from 'react-router'
import { Button, Notice } from '@/components/app'
import { useT } from '@/i18n'
import { onboardingMessages } from './messages'

/**
 * Shown where the first part was saved: the parts list stays, and the owner
 * decides when to go back to the dashboard.
 */
export function OnboardingCompletedNotice({
  dashboardPath,
}: {
  dashboardPath: string
}) {
  const t = useT(onboardingMessages)
  return (
    <Notice
      action={
        <Button asChild variant="primary">
          <Link to={dashboardPath}>{t('toDashboard')}</Link>
        </Button>
      }
      tone="ok"
    >
      <span className="font-semibold">{t('doneTitle')}</span>{' '}
      {t('doneSubtitle')}
    </Notice>
  )
}
