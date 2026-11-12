import { Outlet, useNavigate } from 'react-router'
import { ToastProvider } from '@/components/app'
import { useAuth } from '../auth/AuthContext'
import { useCabinet, type CabinetContextValue } from './CabinetContext'
import { CabinetNavigation } from './CabinetNavigation'
import { CommandPalette } from './CommandPalette'
import { ConnectionNotice } from './ConnectionNotice'
import { useDesignSystemRoot } from '@/components/app/use-design-system-root'
import { useCabinetActivity } from './use-cabinet-activity'

export function CabinetShell() {
  const auth = useAuth()
  const cabinet = useCabinet()
  const navigate = useNavigate()
  useDesignSystemRoot()
  useCabinetActivity(
    cabinet.status === 'ready' && cabinet.snapshot
      ? `${cabinet.snapshot.userId}:${cabinet.snapshot.tenantId}:${cabinet.snapshot.generation}`
      : null,
  )

  if (!isReady(cabinet)) return null

  const handleLogout = async () => {
    void navigate('/', { replace: true, flushSync: true })
    await auth.signOut()
  }

  return (
    <div className="cabinet-shell bg-app-canvas flex min-h-dvh w-full max-w-full text-app-strong">
      <CabinetNavigation
        userName={auth.user?.displayName ?? null}
        tenant={cabinet.targetTenant}
        tenants={auth.tenants}
        snapshot={cabinet.snapshot}
        onSwitchTenant={(tenantId) => cabinet.switchTenant(tenantId)}
        onLogout={handleLogout}
      />
      <main className="rz-main cabinet-shell__content">
        <ToastProvider>
          <ConnectionNotice />
          <CommandPalette
            snapshot={cabinet.snapshot}
            tenant={cabinet.targetTenant}
          />
          <Outlet />
        </ToastProvider>
      </main>
    </div>
  )
}

function isReady(
  cabinet: CabinetContextValue,
): cabinet is CabinetContextValue & {
  status: 'ready'
  targetTenant: NonNullable<CabinetContextValue['targetTenant']>
  snapshot: NonNullable<CabinetContextValue['snapshot']>
} {
  return (
    cabinet.status === 'ready' &&
    cabinet.targetTenant !== null &&
    cabinet.snapshot !== null
  )
}
