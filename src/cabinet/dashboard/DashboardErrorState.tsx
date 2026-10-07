import { Link } from 'react-router'
import { Button, Panel } from '@/components/app'
import type { ApiProblem } from '@/api/contracts'
import { commonMessages, useT, type MessageKey } from '@/i18n'
import { dashboardMessages } from './dashboard-messages'

type DashboardKey = MessageKey<typeof dashboardMessages>

interface ErrorGuidance {
  title: DashboardKey
  message: DashboardKey
}

const BILLING_GUIDANCE: ErrorGuidance = {
  title: 'billingErrorTitle',
  message: 'billingErrorMessage',
}
const QUOTA_GUIDANCE: ErrorGuidance = {
  title: 'quotaErrorTitle',
  message: 'quotaErrorMessage',
}
const FEATURE_GUIDANCE: ErrorGuidance = {
  title: 'featureErrorTitle',
  message: 'featureErrorMessage',
}

export function DashboardErrorState({
  ariaLabel,
  billingPath,
  genericMessage,
  problem,
  retry,
}: {
  ariaLabel: string
  billingPath: string | null
  genericMessage: string
  problem: ApiProblem
  retry: () => Promise<void>
}) {
  const t = useT(dashboardMessages)
  const tc = useT(commonMessages)
  const guidance = dashboardErrorGuidance(problem)

  return (
    <Panel aria-label={ariaLabel} role="alert">
      {guidance === null ? (
        <p className="text-app-muted text-sm">{genericMessage}</p>
      ) : (
        <>
          <h2 className="text-sm font-medium text-white">
            {t(guidance.title)}
          </h2>
          <p className="text-app-muted mt-1 text-sm">{t(guidance.message)}</p>
          {billingPath === null ? null : (
            <Button asChild className="mt-3" variant="primary">
              <Link to={billingPath}>{t('goToSubscription')}</Link>
            </Button>
          )}
        </>
      )}
      <div className="mt-3">
        <Button onClick={() => void retry()}>{tc('retry')}</Button>
      </div>
    </Panel>
  )
}

function dashboardErrorGuidance(problem: ApiProblem): ErrorGuidance | null {
  const code = problem.code
  if (code === 'QUOTA_EXCEEDED') return QUOTA_GUIDANCE
  if (code === 'FEATURE_NOT_AVAILABLE') return FEATURE_GUIDANCE
  if (problem.status === 402) return BILLING_GUIDANCE
  return null
}
