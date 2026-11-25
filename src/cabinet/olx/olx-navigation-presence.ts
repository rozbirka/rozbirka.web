import { useEffect, useSyncExternalStore } from 'react'
import { olxApi, type OlxConnection } from '@/api/olx'
import type { TenantAccessSnapshot } from '../access-types'
import { tenantRequestScope } from '../tenant-request-scope'

interface Presence {
  visible: boolean
}

// A snapshot belongs to one user, business and access generation. Sharing its
// result keeps the sidebar and command palette on the same connection read.
const presence = new WeakMap<TenantAccessSnapshot, Presence>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function canShowOlx(snapshot: TenantAccessSnapshot) {
  return snapshot.permissions.has('olx.publications.manage')
}

export function updateOlxNavigation(
  snapshot: TenantAccessSnapshot,
  connection: OlxConnection,
) {
  if (!canShowOlx(snapshot)) return
  presence.set(snapshot, {
    visible: connection.available && connection.connected,
  })
  for (const listener of listeners) listener()
}

function loadOlxPresence(snapshot: TenantAccessSnapshot) {
  if (presence.has(snapshot)) return
  const pending = { visible: false }
  const signal = tenantRequestScope.signal
  presence.set(snapshot, pending)
  void olxApi.connection({ signal }).then(
    (connection) => {
      if (presence.get(snapshot) === pending && !signal.aborted)
        updateOlxNavigation(snapshot, connection)
    },
    () => {
      // Visibility stays hidden until a connection has been confirmed.
    },
  )
}

export function useOlxNavigationVisible(snapshot: TenantAccessSnapshot) {
  const allowed = canShowOlx(snapshot)
  const visible = useSyncExternalStore(
    subscribe,
    () => allowed && presence.get(snapshot)?.visible === true,
    () => false,
  )
  useEffect(() => {
    if (allowed) loadOlxPresence(snapshot)
  }, [allowed, snapshot])
  return visible
}
