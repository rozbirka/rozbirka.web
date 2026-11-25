import { useCallback, useEffect, useState } from 'react'
import {
  olxLiveApi,
  type OlxAdvert,
  type OlxAdvertPage,
  type OlxLocalAdvert,
  type OlxLocalAdvertPage,
  type OlxLivePublication,
} from '@/api/olx-live'
import { tenantRequestScope } from '../tenant-request-scope'

interface ListingRequest {
  page: number
  all: boolean
}

interface Listing {
  adverts: OlxAdvert[]
  local: OlxLocalAdvert[]
  localFailed: boolean
  hasMore: boolean
  checkedAt: string
}

export async function readOlxAdvertCollection(
  request: ListingRequest,
  accountId: string | undefined,
  includeLocal: boolean,
  signal: AbortSignal,
): Promise<Listing> {
  const adverts = new Map<string, OlxAdvert>()
  const local = new Map<string, OlxLocalAdvert>()
  let hasRemote = true
  let hasLocal = includeLocal && Boolean(accountId)
  let localFailed = false
  let checkedAt = ''

  for (let page = request.page; hasRemote || hasLocal; page++) {
    signal.throwIfAborted()
    const remotePage: Promise<OlxAdvertPage | null> = hasRemote
      ? olxLiveApi.adverts(page, {
          signal,
          ...(accountId ? { expectedAccountId: accountId } : {}),
        })
      : Promise.resolve(null)
    const localPage: Promise<OlxLocalAdvertPage | null> =
      hasLocal && accountId
        ? olxLiveApi.localAdverts(page, accountId, { signal })
        : Promise.resolve(null)
    const [remoteResult, localResult]: [
      PromiseSettledResult<OlxAdvertPage | null>,
      PromiseSettledResult<OlxLocalAdvertPage | null>,
    ] = await Promise.allSettled([remotePage, localPage] as const)
    signal.throwIfAborted()
    if (remoteResult.status === 'rejected') throw remoteResult.reason
    const remote: OlxAdvertPage | null = remoteResult.value
    hasRemote = remote?.hasMore ?? false
    if (remote) {
      checkedAt = remote.checkedAt
      for (const item of remote.items) adverts.set(item.id, item)
    }
    if (localResult.status === 'rejected') {
      if (request.all) throw localResult.reason
      localFailed = true
      hasLocal = false
    } else {
      hasLocal = localResult.value?.hasMore ?? false
      for (const item of localResult.value?.items ?? [])
        local.set(item.partId, item)
    }
    if (!request.all) break
  }

  return {
    adverts: [...adverts.values()],
    local: [...local.values()],
    localFailed,
    hasMore: hasRemote || hasLocal,
    checkedAt,
  }
}

export function useOlxAdvertCollection(
  accountId: string | undefined,
  includeLocal: boolean,
) {
  const [request, setRequest] = useState<ListingRequest>({
    page: 1,
    all: false,
  })
  const [entry, setEntry] = useState<{
    request: ListingRequest
    value: Listing | null
  } | null>(null)
  const current = entry?.request === request ? entry.value : undefined

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    void readOlxAdvertCollection(request, accountId, includeLocal, signal).then(
      (value) => {
        if (!signal.aborted) setEntry({ request, value })
      },
      () => {
        if (!signal.aborted) setEntry({ request, value: null })
      },
    )
    return () => controller.abort()
  }, [request, accountId, includeLocal])

  const recordPublication = useCallback((publication: OlxLivePublication) => {
    const { advertId, checkedAt, observedStatus } = publication
    if (!advertId || !checkedAt) return
    setEntry((current) => {
      if (
        !current?.value ||
        !(Date.parse(checkedAt) >= Date.parse(current.value.checkedAt))
      )
        return current
      return {
        ...current,
        value: {
          ...current.value,
          adverts: current.value.adverts.map((item) => {
            if (item.id !== advertId) return item
            const linkedPart = item.linkedPart
            return {
              ...item,
              status: observedStatus ?? item.status,
              ...(linkedPart
                ? {
                    linkedPart: {
                      ...linkedPart,
                      publicationState: publication.state,
                      error: publication.error ?? null,
                      moderationReason: publication.moderationReason ?? null,
                      excluded:
                        publication.excluded ?? linkedPart.excluded ?? false,
                    },
                  }
                : {}),
            }
          }),
        },
      }
    })
  }, [])

  return {
    request,
    current,
    setRequest,
    recordPublication,
  }
}
