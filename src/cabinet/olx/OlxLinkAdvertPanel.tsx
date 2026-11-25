import { useEffect, useId, useRef, useState } from 'react'
import { olxLiveApi, type OlxLivePublication } from '@/api/olx-live'
import { normalizeApiProblem } from '@/api/errors'
import {
  Amount,
  Button,
  EmptyState,
  ErrorState,
  Notice,
  RecordIdentity,
  SearchInput,
  Sheet,
  SkeletonRows,
  StatusPill,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { tenantRequestScope } from '../tenant-request-scope'
import { filterOlxAdverts } from './olx-advert-search'
import {
  olxAdvertStatuses,
  olxAdvertTone,
  olxLiveMessages,
} from './olx-live-messages'
import { olxPublicationMessages } from './olx-publication-messages'
import { olxReconciliationMessages } from './olx-reconciliation-messages'
import { useOlxAdvertCollection } from './use-olx-advert-collection'

export function OlxLinkAdvertPanel({
  partId,
  partLabel,
  accountId,
  revision,
  available,
  onClose,
  onCloseAutoFocus,
  onLinked,
  onBusy,
}: {
  partId: string
  partLabel: string
  accountId: string | undefined
  revision: string | null
  available: boolean
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
  onLinked: (value: OlxLivePublication) => void
  onBusy: (busy: boolean) => void
}) {
  const t = useT(olxPublicationMessages)
  const tl = useT(olxLiveMessages)
  const tr = useT(olxReconciliationMessages)
  const tc = useT(commonMessages)
  const {
    request,
    current: result,
    setRequest,
  } = useOlxAdvertCollection(accountId, false)
  const { page, all } = request
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const radioGroup = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<
    keyof typeof olxPublicationMessages.uk | null
  >(null)
  const mutating = useRef<AbortController | null>(null)
  const visible = filterOlxAdverts(result?.adverts ?? [], search)
  const chosen = visible.find(
    (item) => item.id === selected && !item.linkedPart,
  )

  useEffect(() => () => mutating.current?.abort(), [])

  function changePage(next: number, all = false) {
    setSelected('')
    setError(null)
    setRequest({ page: next, all })
  }

  async function link() {
    if (mutating.current || !chosen) return
    const controller = new AbortController()
    mutating.current = controller
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      const value = await olxLiveApi.link(partId, chosen.id, revision, {
        signal,
        ...(accountId ? { expectedAccountId: accountId } : {}),
      })
      if (!signal.aborted) onLinked(value)
    } catch (problem) {
      if (signal.aborted) return
      const { code, kind } = normalizeApiProblem(problem)
      // An interrupted response may have committed the link.
      if (kind === 'network' || kind === 'timeout') {
        try {
          const recovered = await olxLiveApi.publication(partId, { signal })
          if (signal.aborted) return
          if (recovered.advertId === chosen.id) {
            onLinked(recovered)
            return
          }
        } catch {
          if (signal.aborted) return
        }
      }
      setError(
        code === 'OLX_ADVERT_ALREADY_LINKED'
          ? 'linkAlreadyUsed'
          : code === 'OLX_CONNECTION_CHANGED' ||
              code === 'OLX_RECONNECT_REQUIRED'
            ? 'reconnectRequired'
            : code === 'OLX_ALREADY_CREATED' || code === 'OLX_DRAFT_CHANGED'
              ? 'linkPartChanged'
              : 'linkError',
      )
    } finally {
      mutating.current = null
      if (!signal.aborted) {
        setBusy(false)
        onBusy(false)
      }
    }
  }

  return (
    <Sheet
      open
      title={t('linkExisting')}
      description={partLabel}
      pending={busy}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      footer={
        <>
          <Button variant="quiet" disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!chosen || busy}
            onClick={() => void link()}
          >
            {t(busy ? 'pending' : 'linkConfirm')}
          </Button>
        </>
      }
    >
      <SearchInput
        aria-label={tr('search')}
        placeholder={tr('search')}
        value={search}
        disabled={busy}
        onChange={(event) => {
          setSearch(event.currentTarget.value)
          setSelected('')
          setError(null)
        }}
      />
      {result === undefined ? (
        <SkeletonRows rows={2} label={tl('loading')} />
      ) : result === null ? (
        <ErrorState
          title={tl('loadError')}
          description={tl('readError')}
          onRetry={() => changePage(page, all)}
          actions={
            page > 1 || all ? (
              <>
                <Button onClick={() => changePage(page, all)}>
                  {tc('retry')}
                </Button>
                <Button onClick={() => changePage(1)}>{tc('back')}</Button>
              </>
            ) : undefined
          }
        />
      ) : (
        <>
          {visible.length === 0 ? (
            result.adverts.length === 0 &&
            !search.trim() &&
            !result.hasMore &&
            page === 1 ? (
              <EmptyState title={tl('empty')} description={tl('emptyHint')} />
            ) : (
              <EmptyState
                title={tr(
                  result.hasMore || page > 1 ? 'noMatches' : 'noMatchesAll',
                )}
              />
            )
          ) : (
            <fieldset className="m-0 min-w-0 border-0 p-0" disabled={busy}>
              <legend className="text-app-muted mb-2">{t('linkAdvert')}</legend>
              <div className="border-app-line bg-app-raised rounded-panel divide-app-line divide-y overflow-hidden border">
                {visible.map((advert) => {
                  const status = olxAdvertStatuses.find(
                    (value) => value === advert.status,
                  )
                  return (
                    <label
                      key={advert.id}
                      className={cn(
                        'grid min-h-row grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2',
                        !advert.linkedPart &&
                          'hover:bg-app-hover has-checked:bg-app-selected cursor-pointer',
                      )}
                    >
                      <input
                        type="radio"
                        className="rz-radio"
                        name={radioGroup}
                        checked={selected === advert.id}
                        disabled={Boolean(advert.linkedPart)}
                        onChange={() => {
                          setSelected(advert.id)
                          setError(null)
                        }}
                      />
                      <RecordIdentity
                        title={<span title={advert.title}>{advert.title}</span>}
                        subtitle={
                          <span className="text-app-muted">
                            <span className="font-mono">№ {advert.id}</span>
                            {advert.price != null && (
                              <>
                                {' · '}
                                <Amount
                                  value={advert.price}
                                  currency={advert.currency ?? null}
                                  currencyDisplay="code"
                                />
                              </>
                            )}
                            {advert.linkedPart?.partName &&
                              ` · ${advert.linkedPart.partName}`}
                          </span>
                        }
                      />
                      <StatusPill
                        tone={
                          advert.linkedPart
                            ? 'neutral'
                            : olxAdvertTone(advert.status)
                        }
                        className="h-auto min-h-5 max-w-28 whitespace-normal"
                      >
                        {advert.linkedPart
                          ? t('advertAlreadyLinked')
                          : status
                            ? tl(status)
                            : tl('unknown', { status: advert.status })}
                      </StatusPill>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}
          {!all && (page > 1 || result.hasMore) && (
            <div className="grid gap-2">
              <p className="rz-caption m-0">{tr('searchScope')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy || page === 1}
                  onClick={() => changePage(page - 1)}
                >
                  {tl('previous')}
                </Button>
                <span className="rz-dim">{tl('page', { page })}</span>
                <Button
                  size="sm"
                  disabled={busy || !result.hasMore}
                  onClick={() => changePage(page + 1)}
                >
                  {tl('next')}
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => changePage(1, true)}
                >
                  {tl('advertLoadAll')}
                </Button>
              </div>
            </div>
          )}
          {visible.length > 0 && (
            <Notice tone={available ? 'info' : 'warn'}>
              {t('linkConsequence')}
              {!available && <> {t('linkUnavailable')}</>}
            </Notice>
          )}
          {error && <Notice tone="danger">{t(error)}</Notice>}
        </>
      )}
    </Sheet>
  )
}
