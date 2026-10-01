import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { partImportsApi } from '@/api/part-imports'
import { Button } from '@/components/app'
import { useCabinet } from '../CabinetContext'

export function ImportEntryButton({ to }: { to: string }) {
  const { status, snapshot, targetTenant } = useCabinet()
  if (
    status !== 'ready' ||
    !snapshot ||
    targetTenant?.id !== snapshot.tenantId ||
    !snapshot.permissions.has('parts.manage')
  )
    return null

  return (
    <AvailableImportButton
      key={`${snapshot.userId}:${snapshot.tenantId}:${snapshot.generation}`}
      to={to}
    />
  )
}

function AvailableImportButton({ to }: { to: string }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void partImportsApi.capabilities({ signal: controller.signal }).then(
      (capabilities) => {
        if (!controller.signal.aborted)
          setEnabled(capabilities.enabled === true)
      },
      () => {
        // An unavailable capability check must not advertise a disabled action.
      },
    )
    return () => controller.abort()
  }, [])

  if (!enabled) return null

  return (
    <Button asChild>
      <Link to={to}>Імпорт запчастин</Link>
    </Button>
  )
}
