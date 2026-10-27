import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { AlertTriangle, Gauge } from 'lucide-react'
import { Button, DeniedState, Notice, StateScreen } from '@/components/app'
import { useT } from '@/i18n'
import { accessMessages } from './access-messages'
import { cabinetPath } from './cabinet-paths'
import { useCabinet } from './CabinetContext'
import {
  cabinetModules,
  type CabinetModuleDefinition,
  type CabinetModuleKey,
  type RegisteredFeatureModule,
} from './module-registry'
import { evaluateModuleAccess, type ModuleAccessDecision } from './policy'
import {
  FeatureUnavailableScreen,
  SubscriptionStateScreen,
} from './screens/module-unavailable'
import type { TenantAccessState } from './access-types'
import { CabinetLoadingScreen } from './loading-screen'
import { loadingPreview } from './loading-layout'
import { loadingPreviewMessages } from './loading-preview-messages'

export interface CabinetModuleScreenProps {
  definition: CabinetModuleDefinition
}

export interface ModuleBoundaryProps {
  extension?: Pick<
    RegisteredFeatureModule,
    'viewPermission' | 'mutationPermission' | 'routeSegment'
  >
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
  extension,
  screen: Screen,
}: ModuleBoundaryProps) {
  const cabinet = useCabinet()
  const t = useT(accessMessages)
  const parent = cabinetModules[module]
  const definition = extension ? { ...parent, ...extension } : parent
  const access = cabinetAccessState(cabinet)
  const parentDecision = evaluateModuleAccess(parent, access, 'view')
  const decision =
    parentDecision.kind === 'allowed'
      ? evaluateModuleAccess(definition, access, 'view')
      : parentDecision

  if (decision.kind === 'allowed') {
    return (
      <AllowedModule
        definition={definition}
        screen={Screen}
        label={t('loadingModule')}
      />
    )
  }

  return <DecisionScreen decision={decision} definition={definition} />
}

function AllowedModule({
  definition,
  screen: Screen,
  label,
}: {
  definition: CabinetModuleDefinition
  screen: ComponentType<CabinetModuleScreenProps>
  label: string
}) {
  const location = useLocation()
  const preview = import.meta.env.DEV
    ? loadingPreview(location.search, true)
    : null
  const screen = (
    <Suspense
      fallback={<CabinetLoadingScreen module={definition.key} label={label} />}
    >
      <Screen definition={definition} />
    </Suspense>
  )
  if (preview !== null)
    return (
      <LoadingPreview
        key={`${location.pathname}:${preview}`}
        duration={preview}
        module={definition.key}
      >
        {screen}
      </LoadingPreview>
    )
  return screen
}

function LoadingPreview({
  duration,
  module,
  children,
}: {
  duration: number | 'hold'
  module: CabinetModuleKey
  children: ReactNode
}) {
  const t = useT(loadingPreviewMessages)
  const [, setSearchParams] = useSearchParams()
  const [released, setReleased] = useState(false)
  useEffect(() => {
    if (duration === 'hold') return
    const timer = window.setTimeout(() => setReleased(true), duration)
    return () => window.clearTimeout(timer)
  }, [duration])
  if (released) return children
  return (
    <>
      <div className="px-4 pt-3">
        <Notice
          action={
            <Button
              onClick={() => {
                setReleased(true)
                setSearchParams(
                  (current) => {
                    const next = new URLSearchParams(current)
                    next.delete('loadingPreview')
                    return next
                  },
                  { replace: true },
                )
              }}
            >
              {t('showScreen')}
            </Button>
          }
        >
          {t('preview')}
        </Notice>
      </div>
      <CabinetLoadingScreen module={module} />
    </>
  )
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
        <div className="rz-page">
          <DeniedState description={t('deniedBody')} title={t('deniedTitle')} />
        </div>
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
          icon={<Gauge aria-hidden />}
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
      return (
        <CabinetLoadingScreen
          module={definition.key}
          label={t('checkingAccess')}
        />
      )
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
  icon = <AlertTriangle aria-hidden />,
  role = 'status',
  tone = 'neutral',
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
  role?: 'alert' | 'status'
  tone?: 'neutral' | 'warn' | 'danger'
}) {
  return (
    <div className="rz-page">
      <StateScreen
        actions={action}
        className="min-h-[50dvh]"
        description={description}
        icon={icon}
        role={role}
        title={title}
        tone={tone}
      />
    </div>
  )
}
