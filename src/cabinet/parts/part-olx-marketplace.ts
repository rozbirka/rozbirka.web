import { useEffect, useState } from 'react'
import { olxApi, type OlxConnection } from '@/api/olx'
import {
  olxLiveApi,
  type OlxLivePublication,
  type OlxPrepareContent,
} from '@/api/olx-live'
import { tenantRequestScope } from '../tenant-request-scope'

export interface PartOlxDraft {
  accountId: string
  revision: string | null
  content: OlxPrepareContent
}

/** Read local integration metadata once per screen and retry explicitly. */
export function usePartOlxRead<T>(
  read: (key: string, signal: AbortSignal) => Promise<T>,
  key: string | undefined,
) {
  const scope = tenantRequestScope.signal
  const [attempt, setAttempt] = useState(0)
  const [entry, setEntry] = useState<{
    key: string
    attempt: number
    scope: AbortSignal
    result: T | null
  }>()
  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const signal = AbortSignal.any([scope, controller.signal])
    void read(key, signal).then(
      (result) => {
        if (!signal.aborted) setEntry({ key, attempt, scope, result })
      },
      () => {
        if (!signal.aborted) setEntry({ key, attempt, scope, result: null })
      },
    )
    return () => controller.abort()
  }, [key, attempt, read, scope])
  return {
    result:
      entry?.key === key && entry?.attempt === attempt && entry.scope === scope
        ? entry.result
        : undefined,
    retry: () => setAttempt((value) => value + 1),
  }
}

const readConnection = (_key: string, signal: AbortSignal) =>
  olxApi.connection({ signal })
const readPublication = (partId: string, signal: AbortSignal) =>
  olxLiveApi.publication(partId, { signal })

export function usePartOlxConnection(enabled = true) {
  const read = usePartOlxRead(
    readConnection,
    enabled ? 'connection' : undefined,
  )
  const accountId = eligibleAccount(read.result)
  return { ...read, accountId }
}

function eligibleAccount(connection: OlxConnection | null | undefined) {
  return connection?.connected &&
    connection.available &&
    connection.mode === 'oauth' &&
    !connection.reconnectRequired
    ? (connection.accountId ?? undefined)
    : undefined
}

export function usePartOlxPublication(partId: string | undefined) {
  return usePartOlxRead<OlxLivePublication>(readPublication, partId)
}

export async function savePartOlxDraft(
  partId: string,
  draft: PartOlxDraft | undefined,
  getSignal: () => AbortSignal,
) {
  if (!draft) return true
  try {
    await olxLiveApi.saveDraft(partId, draft.content, draft.revision, {
      signal: getSignal(),
      expectedAccountId: draft.accountId,
    })
    return true
  } catch {
    return false
  }
}
