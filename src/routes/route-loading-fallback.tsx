import { useDesignSystemRoot } from '@/components/app/use-design-system-root'

export function RouteLoadingFallback() {
  useDesignSystemRoot()
  return <div className="min-h-dvh bg-app-canvas" aria-busy="true" />
}
