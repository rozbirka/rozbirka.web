import { useId } from 'react'
import { Link } from 'react-router'
import type { CarProfitability } from '@/api/cars'
import { useT } from '@/i18n'
import { carCardMessages } from './car-card-messages'

const share = (part: number, total: number) =>
  total <= 0 ? 0 : Math.round((part / total) * 100)

/**
 * How far the car has been taken apart and sold off. Core counts a part as
 * sold once its quantity reaches zero, so the two figures always add up to the
 * total and the split bar can be read as a whole.
 */
export function CarPartsCard({
  partsHref,
  profit,
}: {
  /** The warehouse, already filtered to this car. */
  partsHref: string | null
  profit: CarProfitability
}) {
  const t = useT(carCardMessages)
  const { partsSold, partsAvailable, partsTotal } = profit
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="rz-card min-w-0">
      <header className="rz-card__head py-2.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="rz-h-card" id={titleId}>
            {t('partsTitle')}
          </h2>
          {partsTotal === 0 ? null : (
            <span className="rz-caption">
              {t('partsFromCar', { count: partsTotal })}
            </span>
          )}
        </span>
        {partsHref === null ? null : (
          <Link className="text-caption whitespace-nowrap" to={partsHref}>
            {t('partsAll', { count: partsTotal })}
          </Link>
        )}
      </header>
      <div className="rz-card__body">
        {partsTotal === 0 ? (
          <p className="rz-muted m-0 text-pretty">{t('partsNone')}</p>
        ) : (
          <div className="grid gap-3">
            <span aria-hidden className="rz-meter">
              <span
                style={{ width: `${String(share(partsSold, partsTotal))}%` }}
              />
            </span>

            <dl className="m-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <dd className="m-0 flex items-baseline gap-2">
                  <span className="rz-mono rz-strong text-title">
                    {partsSold}
                  </span>
                  <span className="rz-mono rz-caption">
                    {t('share', { percent: share(partsSold, partsTotal) })}
                  </span>
                </dd>
                <dt className="rz-dot rz-dot--ok rz-muted mt-0.5">
                  {t('partsSold')}
                </dt>
              </div>
              <div className="min-w-0 text-right">
                <dd className="m-0 flex items-baseline justify-end gap-2">
                  <span className="rz-mono rz-caption">
                    {t('share', { percent: share(partsAvailable, partsTotal) })}
                  </span>
                  <span className="rz-mono rz-strong text-title">
                    {partsAvailable}
                  </span>
                </dd>
                <dt className="rz-dot rz-muted mt-0.5 justify-end">
                  {t('partsInStock')}
                </dt>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}
