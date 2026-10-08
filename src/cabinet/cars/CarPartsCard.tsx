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
          <Link
            className="text-brand text-[13px] font-bold whitespace-nowrap underline-offset-4 hover:underline"
            to={partsHref}
          >
            {t('partsAll', { count: partsTotal })}
          </Link>
        )
      }
      title={t('partsTitle')}
    >
      {partsTotal === 0 ? (
        <p className="text-app-muted text-[13px] leading-5 text-pretty">
          {t('partsNone')}
        </p>
      ) : (
        <>
          <div
            aria-hidden
            className="mt-1 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/[0.06]"
          >
            <span
              className="bg-app-ink"
              style={{ flex: `${String(Math.max(partsSold, 0.001))} 1 0` }}
            />
            <span
              className="bg-white/10"
              style={{ flex: `${String(Math.max(partsAvailable, 0.001))} 1 0` }}
            />
          </div>

          <dl className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <dd className="flex items-baseline gap-2">
                <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
                  {partsSold}
                </span>
                <span className="text-app-muted font-mono text-[12px]">
                  {t('share', { percent: share(partsSold, partsTotal) })}
                </span>
              </dd>
              <dt className="text-app-muted mt-0.5 flex items-center gap-[7px] text-[13px] font-semibold">
                <span
                  aria-hidden
                  className="bg-app-ink size-1.5 rounded-full"
                />
                {t('partsSold')}
              </dt>
            </div>
            <div className="min-w-0 text-right">
              <dd className="flex items-baseline justify-end gap-2">
                <span className="text-app-muted font-mono text-[12px]">
                  {t('share', { percent: share(partsAvailable, partsTotal) })}
                </span>
                <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
                  {partsAvailable}
                </span>
              </dd>
              <dt className="text-app-muted mt-0.5 flex items-center justify-end gap-[7px] text-[13px] font-semibold">
                {t('partsInStock')}
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-white/25"
                />
              </dt>
            </div>
          </dl>

          <p className="sr-only">{t('partsFromCar', { count: partsTotal })}</p>
        </>
      )}
    </Card>
  )
}
