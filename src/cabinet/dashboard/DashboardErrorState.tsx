import { Link } from 'react-router'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, StateScreen } from '@/components/app'
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

  // `.rz-state` in a card, as the design system draws a failed block: danger
  // for a plain failure, warn when the plan or a limit is what stopped it.
  return (
    <StateScreen
      actions={
        <>
          {guidance === null || billingPath === null ? null : (
            <Button asChild variant="primary">
              <Link to={billingPath}>{t('goToSubscription')}</Link>
            </Button>
          )}
          <Button onClick={() => void retry()}>
            <RefreshCw aria-hidden />
            {tc('retry')}
          </Button>
        </>
      }
      className="min-h-0"
      icon={<AlertTriangle aria-hidden />}
      label={ariaLabel}
      role="alert"
      title={guidance === null ? genericMessage : t(guidance.title)}
      tone={guidance === null ? 'danger' : 'warn'}
      {...(guidance === null ? {} : { description: t(guidance.message) })}
    />
  )
}

function dashboardErrorGuidance(problem: ApiProblem): ErrorGuidance | null {
  const code = problem.code
  if (code === 'QUOTA_EXCEEDED') return QUOTA_GUIDANCE
  if (code === 'FEATURE_NOT_AVAILABLE') return FEATURE_GUIDANCE
  if (problem.status === 402) return BILLING_GUIDANCE
  return null
}
