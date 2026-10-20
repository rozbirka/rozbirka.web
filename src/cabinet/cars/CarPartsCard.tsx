import { Link } from 'react-router'
import { Card } from '@/components/app'
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

  return (
    <Card
      aside={
        partsHref === null ? null : (
          <Link className="whitespace-nowrap" to={partsHref}>
            {t('partsAll', { count: partsTotal })}
          </Link>
        )
      }
      title={t('partsTitle')}
    >
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

          <p className="sr-only">{t('partsFromCar', { count: partsTotal })}</p>
        </div>
      )}
    </Card>
  )
}
