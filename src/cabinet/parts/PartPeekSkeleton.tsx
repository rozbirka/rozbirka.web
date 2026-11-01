import { Skeleton } from '@/components/app'
import { useT } from '@/i18n/hooks'
import { partDetailMessages } from './part-detail-messages'
import { partsListMessages } from './parts-list-messages'

export function PartPeekHeaderSkeleton() {
  return (
    <div aria-hidden className="grid gap-2.5">
      <div className="rz-btn-row items-center">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="w-20" />
      </div>
      <div className="rz-btn-row">
        <Skeleton className="h-control w-32" />
      </div>
    </div>
  )
}

/** Keep the side card's stock tiles, facts and timeline in their real places. */
export function PartPeekSkeleton() {
  const t = useT(partDetailMessages)
  const tl = useT(partsListMessages)
  return (
    <div data-part-peek-skeleton>
      <p className="sr-only" role="status">
        {t('loading')}
      </p>
      <section aria-hidden className="rz-peek__section">
        <h3 className="rz-label m-0">{t('stock')}</h3>
        <dl className="rz-kpis m-0 grid-cols-3">
          {(['tileAvailable', 'tileReserved', 'tileSold'] as const).map(
            (key) => (
              <div className="rz-kpi p-3" key={key}>
                <dt className="rz-kpi__label">{t(key)}</dt>
                <dd className="m-0 grid gap-3">
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-3 w-4/5" />
                </dd>
              </div>
            ),
          )}
        </dl>
      </section>
      <dl aria-hidden className="rz-facts m-0 border-app-line border-b">
        <div>
          <dt>{t('salePrice')}</dt>
          <dd>
            <Skeleton className="w-24 max-w-full" />
          </dd>
        </div>
        <div>
          <dt>{t('placement')}</dt>
          <dd className="grid gap-2 py-1">
            <Skeleton className="w-full" />
            <Skeleton className="w-3/5" />
          </dd>
        </div>
        <div>
          <dt>{tl('colCar')}</dt>
          <dd>
            <Skeleton className="w-3/4" />
          </dd>
        </div>
      </dl>
      <section aria-hidden className="rz-peek__section">
        <h3 className="rz-label m-0">{t('history')}</h3>
        <ol className="rz-timeline -mx-3">
          {[0, 1].map((index) => (
            <li key={index}>
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <Skeleton className="w-4/5" />
              <Skeleton className="h-3 w-16" />
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
