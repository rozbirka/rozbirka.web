import { cn } from '@/lib/utils'

export type SparkTone = 'ok' | 'info' | 'warn' | 'brand'

const stroke: Record<SparkTone, string> = {
  ok: 'var(--color-state-ok)',
  info: 'var(--color-state-info)',
  warn: 'var(--color-state-warn)',
  brand: 'var(--color-brand)',
}

const fill: Record<SparkTone, string> = {
  ok: 'var(--color-state-ok-soft)',
  info: 'var(--color-state-info-soft)',
  warn: 'var(--color-state-warn-soft)',
  brand: 'rgb(247 116 37 / 0.13)',
}

/**
 * The shape of a period, drawn beside the figure it belongs to. It carries no
 * readable value — the total and the change above it do — so it is hidden from
 * assistive technology rather than described badly.
 */
export function Sparkline({
  series,
  tone = 'brand',
  className,
}: {
  series: readonly number[]
  tone?: SparkTone
  className?: string
}) {
  const points = shape(series)
  return (
    <svg
      aria-hidden="true"
      aria-label="Декоративна діаграма"
      className={cn('block h-11 w-full overflow-visible', className)}
      preserveAspectRatio="none"
      viewBox="0 0 100 34"
    >
      {points === null ? null : (
        <>
          <polyline fill={fill[tone]} points={`0,34 ${points} 100,34`} />
          <polyline
            fill="none"
            points={points}
            stroke={stroke[tone]}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  )
}

/**
 * Values scaled into the box. A flat series — every day the same, or all zero —
 * has no span to divide by, so it is drawn along the middle rather than
 * collapsed onto the floor.
 */
function shape(series: readonly number[]): string | null {
  if (series.length < 2) return null
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min
  return series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * 100
      const y = span === 0 ? 17 : 31 - ((value - min) / span) * 28
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
