import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { needsOwnerName } from '@/auth/owner-name'
import { resolveAccountDestination } from '@/cabinet/cabinet-paths'
import { TenantOnboardingScreen } from '@/cabinet/screens/tenant-onboarding'

/** Compatibility entry for pre-cabinet account links. */
export function AccountScreen() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.tenants.length === 0) {
    if (needsOwnerName(auth.user)) {
      return (
        <Navigate
          to="/login"
          state={{ from: location.pathname + location.search }}
          replace
        />
      )
    }
    return <TenantOnboardingScreen />
  }

  const targetTenant = auth.tenant ?? auth.tenants[0]!

  return (
    <Navigate
      to={resolveAccountDestination(targetTenant, location.search)}
      replace
    />
  )
}
