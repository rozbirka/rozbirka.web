import type { CarProfitability } from '@/api/cars'
import { useT } from '@/i18n'
import { PartsStockCard } from '../parts/PartsStockCard'
import { carCardMessages } from './car-card-messages'

export function CarPartsCard({
  partsHref,
  profit,
}: {
  /** The warehouse, already filtered to this car. */
  partsHref: string | null
  profit: CarProfitability
}) {
  const t = useT(carCardMessages)
  return (
    <PartsStockCard
      title={t('partsTitle')}
      description={t('partsFromCar', { count: profit.partsTotal })}
      emptyMessage={t('partsNone')}
      partsHref={partsHref}
      partsTotal={profit.partsTotal}
      partsSold={profit.partsSold}
      partsAvailable={profit.partsAvailable}
    />
  )
}
