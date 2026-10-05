import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  featureFlagsApi,
  type FeatureFlagName,
  type FeatureFlagValues,
} from '@/api/feature-flags'

const FeatureFlagsContext = createContext<FeatureFlagValues>({})
const REFRESH_MS = 60_000

/** Mount inside the authenticated tenant boundary and remount when that boundary changes. */
export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlagValues>({})
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      try {
        const values = await featureFlagsApi.get({ signal: controller.signal })
        if (!controller.signal.aborted) setFlags(values)
      } catch {
        // Keep this tenant's last successful snapshot. The server enforces admission.
      } finally {
        if (!controller.signal.aborted)
          timer = setTimeout(() => void refresh(), REFRESH_MS)
      }
    }
    void refresh()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [])
  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with the provider.
export function useFeatureFlag(name: FeatureFlagName): boolean {
  return useContext(FeatureFlagsContext)[name] === true
}

export function FeatureGate({
  name,
  children,
}: {
  name: FeatureFlagName
  children: ReactNode
}) {
  return useFeatureFlag(name) ? children : null
}
