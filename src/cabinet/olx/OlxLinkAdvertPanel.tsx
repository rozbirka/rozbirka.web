import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  olxLiveApi,
  type OlxAdvertPage,
  type OlxLivePublication,
} from '@/api/olx-live'
import { normalizeApiProblem } from '@/api/errors'
import {
  Amount,
  Button,
  EmptyState,
  ErrorState,
  Notice,
  RecordIdentity,
  SkeletonRows,
  StatusPill,
} from '@/components/app'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  olxAdvertStatuses,
  olxAdvertTone,
  olxLiveMessages,
} from './olx-live-messages'
import { olxPublicationMessages } from './olx-publication-messages'

export function OlxLinkAdvertPanel({
  partId,
  revision,
  available,
  actionsTarget,
  onLinked,
  onBusy,
}: {
  partId: string
  revision: string | null
  available: boolean
  actionsTarget: HTMLDivElement | null
  onLinked: (value: OlxLivePublication) => void
  onBusy: (busy: boolean) => void
}) {
  const t = useT(olxPublicationMessages)
  const tl = useT(olxLiveMessages)
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<OlxAdvertPage | null>()
  const [selected, setSelected] = useState('')
  const radioGroup = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<
    keyof typeof olxPublicationMessages.uk | null
  >(null)
  const mutating = useRef<AbortController | null>(null)
  const chosen = result?.items.find(
    (item) => item.id === selected && !item.linkedPart,
  )

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    void olxLiveApi.adverts(page, { signal }).then(
      (value) => {
        if (!signal.aborted) setResult(value)
      },
      () => {
        if (!signal.aborted) setResult(null)
      },
    )
    return () => controller.abort()
  }, [page, attempt])

  useEffect(() => () => mutating.current?.abort(), [])

  function changePage(next: number) {
    setSelected('')
    setResult(undefined)
    setError(null)
    if (next === page) setAttempt((value) => value + 1)
    else setPage(next)
  }

  async function link() {
    if (mutating.current || !chosen) return
    const controller = new AbortController()
    mutating.current = controller
    const { signal } = controller
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      const value = await olxLiveApi.link(partId, chosen.id, revision, {
        signal,
      })
      if (!signal.aborted) onLinked(value)
    } catch (problem) {
      if (signal.aborted) return
      const code = normalizeApiProblem(problem).code
      // An interrupted response may have committed the link.
      if (code !== 'OLX_ADVERT_ALREADY_LINKED') {
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
    <div className="grid min-w-0 gap-4" aria-busy={busy}>
      {result === undefined ? (
        <SkeletonRows rows={2} label={tl('loading')} />
      ) : result === null ? (
        <ErrorState
          title={tl('loadError')}
          description={tl('readError')}
          onRetry={() => changePage(page)}
        />
      ) : (
        <>
          {result.items.length === 0 ? (
            <EmptyState title={tl('empty')} description={tl('emptyHint')} />
          ) : (
            <fieldset className="m-0 min-w-0 border-0 p-0" disabled={busy}>
              <legend className="text-app-muted mb-2">{t('linkAdvert')}</legend>
              <div className="border-app-line bg-app-raised rounded-panel divide-app-line divide-y overflow-hidden border">
                {result.items.map((advert) => {
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
          {(page > 1 || result.hasMore) && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || page === 1}
                onClick={() => changePage(page - 1)}
              >
                {tl('previous')}
              </Button>
              <span className="rz-dim">{tl('page', { page })}</span>
              <Button
                disabled={busy || !result.hasMore}
                onClick={() => changePage(page + 1)}
              >
                {tl('next')}
              </Button>
            </div>
          )}
          {result.items.length > 0 && (
            <Notice tone={available ? 'info' : 'warn'}>
              {t('linkConsequence')}
              {!available && <> {t('linkUnavailable')}</>}
            </Notice>
          )}
          {error && <Notice tone="danger">{t(error)}</Notice>}
          {result.items.length > 0 &&
            actionsTarget &&
            createPortal(
              <Button
                variant="primary"
                disabled={!chosen || busy}
                onClick={() => void link()}
              >
                {t(busy ? 'pending' : 'linkConfirm')}
              </Button>,
              actionsTarget,
            )}
        </>
      )}
    </div>
  )
}
