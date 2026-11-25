import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { partsApi, type PartSearchPage } from '@/api/parts'
import {
  Button,
  ErrorState,
  Pagination,
  SectionPanel,
  SkeletonFields,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { tenantRequestScope } from '../tenant-request-scope'
import { OlxBatchSheet, type OlxBatchPart } from './OlxBatchSheet'
import type { OlxQueueNavigationState } from './OlxPublicationQueue'
import { olxCatalogMessages } from './olx-catalog-messages'

const pageSize = 25

export function OlxCatalogPanel({
  accountId,
  owner,
  queueHref,
  canPrepare,
  partsHref,
}: {
  accountId: string
  owner: string
  queueHref: string
  canPrepare: boolean
  partsHref: string
}) {
  const t = useT(olxCatalogMessages)
  const navigate = useNavigate()
  const tc = useT(commonMessages)
  const [request, setRequest] = useState({ page: 1 })
  const [response, setResponse] = useState<{
    request: { page: number }
    page: PartSearchPage | null
  } | null>(null)
  const [reviewParts, setReviewParts] = useState<OlxBatchPart[] | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const catalog = response?.request === request ? response.page : undefined

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    void partsApi.search({ page: request.page, pageSize }, { signal }).then(
      (page) => {
        if (!signal.aborted) setResponse({ request, page })
      },
      () => {
        if (!signal.aborted) setResponse({ request, page: null })
      },
    )
    return () => controller.abort()
  }, [request])

  function reload() {
    setRequest(({ page }) => ({ page }))
  }

  const closeOverlay = () => setReviewParts(null)
  const returnFocus = () => trigger.current?.focus()

  return (
    <>
      <SectionPanel
        title={t('title')}
        aside={
          <div className="rz-btn-row">
            {canPrepare && (
              <Button
                variant="primary"
                aria-haspopup="dialog"
                disabled={!catalog?.items.length}
                onClick={(event) => {
                  if (!catalog) return
                  trigger.current = event.currentTarget
                  setReviewParts(catalog.items)
                }}
              >
                {t('checkPage')}
              </Button>
            )}
          </div>
        }
      >
        {catalog === undefined ? (
          <SkeletonFields count={2} label={tc('loading')} />
        ) : catalog === null ? (
          <ErrorState onRetry={reload} />
        ) : catalog.items.length === 0 ? (
          <p className="rz-caption">{t('empty')}</p>
        ) : (
          <ul className="grid list-none gap-2 p-0">
            {catalog.items.map(({ id, name }) => (
              <li key={id}>{name}</li>
            ))}
          </ul>
        )}
        {catalog && (catalog.total > 0 || request.page > 1) && (
          <Pagination
            page={request.page}
            totalPages={Math.max(catalog.totalPages, request.page)}
            {...(catalog.items.length
              ? { total: catalog.total, pageSize }
              : {})}
            onPage={(page) => setRequest({ page })}
          />
        )}
      </SectionPanel>

      {canPrepare && reviewParts && (
        <OlxBatchSheet
          initialMode="publish"
          parts={reviewParts}
          partsHref={partsHref}
          reconciledAccountId={accountId}
          onChanged={reload}
          onJobStarted={(job, review) =>
            void navigate(`${queueHref}?job=${encodeURIComponent(job.id)}`, {
              state: {
                owner,
                jobId: job.id,
                review,
              } satisfies OlxQueueNavigationState,
            })
          }
          onClose={closeOverlay}
          returnFocus={returnFocus}
        />
      )}
    </>
  )
}
