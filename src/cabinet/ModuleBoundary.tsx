import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import {
  Button,
  DeniedState,
  SkeletonRows,
  StateScreen,
} from '@/components/app'
import { useT } from '@/i18n'
import { accessMessages } from './access-messages'
import { cabinetPath } from './cabinet-paths'
import { useCabinet } from './CabinetContext'
import {
  cabinetModules,
  type CabinetModuleDefinition,
  type CabinetModuleKey,
} from './module-registry'
import { evaluateModuleAccess, type ModuleAccessDecision } from './policy'
import {
  FeatureUnavailableScreen,
  SubscriptionStateScreen,
} from './screens/module-unavailable'
import type { TenantAccessState } from './access-types'

export interface CabinetModuleScreenProps {
  definition: CabinetModuleDefinition
}

export interface ModuleBoundaryProps {
  module: CabinetModuleKey
  screen: ComponentType<CabinetModuleScreenProps>
}

const LazyCabinetModuleScreen = lazy(async () => {
  const { CabinetModuleScreen } = await import('./screens/cabinet-state')
  return { default: CabinetModuleScreen }
})

export function CabinetModuleRoute({ module }: { module: CabinetModuleKey }) {
  return <ModuleBoundary module={module} screen={LazyCabinetModuleScreen} />
}

export function ModuleBoundary({
  module,
  screen: Screen,
}: ModuleBoundaryProps) {
  const cabinet = useCabinet()
  const t = useT(accessMessages)
  const definition = cabinetModules[module]
  const access = cabinetAccessState(cabinet)
  const decision = evaluateModuleAccess(definition, access, 'view')

  if (decision.kind === 'allowed') {
    return (
      <Suspense fallback={<SkeletonRows label={t('loadingModule')} />}>
        <Screen definition={definition} />
      </Suspense>
    )
  }

  return <DecisionScreen decision={decision} definition={definition} />
}

function cabinetAccessState(
  cabinet: ReturnType<typeof useCabinet>,
): TenantAccessState {
  if (cabinet.status === 'ready' && cabinet.snapshot !== null) {
    return { status: 'ready', snapshot: cabinet.snapshot, error: null }
  }
  if (cabinet.status === 'error') {
    return { status: 'error', snapshot: null, error: cabinet.error }
  }
  return { status: 'loading', snapshot: null, error: null }
}

function DecisionScreen({
  definition,
  decision,
}: {
  definition: CabinetModuleDefinition
  decision: Exclude<ModuleAccessDecision, { kind: 'allowed' }>
}) {
  const t = useT(accessMessages)
  switch (decision.kind) {
    case 'feature-unavailable':
      return <FeatureUnavailableScreen definition={definition} />
    case 'permission-denied':
      return (
        <DeniedState description={t('deniedBody')} title={t('deniedTitle')} />
      )
    case 'subscription-blocked':
      return (
        <SubscriptionStateScreen
          definition={definition}
          state={decision.state}
        />
      )
    case 'quota-exhausted':
      return (
        <BoundaryStateScreen
          action={<BillingLink label={t('comparePlans')} module="plans" />}
          description={t('quotaBody', {
            used: decision.used,
            max: decision.max,
          })}
          title={t('quotaTitle')}
          tone="warn"
        />
      )
    case 'access-error':
      return (
        <BoundaryStateScreen
          description={t('accessErrorBody')}
          role="alert"
          title={t('accessErrorTitle')}
          tone="danger"
        />
      )
    case 'access-loading':
      return <SkeletonRows label={t('checkingAccess')} />
  }
}

function BillingLink({
  label,
  module,
}: {
  label: string
  module: 'billing' | 'plans'
}) {
  const { targetTenant } = useCabinet()
  if (targetTenant === null) return null

  return (
    <Button asChild variant="primary">
      <Link to={cabinetPath(targetTenant.slug, module)}>{label}</Link>
    </Button>
  )
}

function BoundaryStateScreen({
  title,
  description,
  action,
  role = 'status',
  tone = 'neutral',
}: {
  title: string
  description: string
  action?: ReactNode
  role?: 'alert' | 'status'
  tone?: 'neutral' | 'warn' | 'danger'
}) {
  return (
    <StateScreen
      actions={action}
      className="min-h-[50dvh] content-center"
      description={description}
      icon={<AlertTriangle aria-hidden />}
      role={role}
      title={title}
      tone={tone}
    />
  )
}
