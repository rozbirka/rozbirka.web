import type { ReactNode } from 'react'
import { formatDate, formatMoney, formatNumber } from '@/i18n/format'
import { useLocale } from '@/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

/**
 * Legacy suffixes kept for existing screens. Currency-aware screens pass
 * `currencyDisplay="code"`: ISO code and per-currency precision (CAD and USD
 * share `$`, so symbols cannot carry the new currencies).
 */
const currencyLabel: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
}

/**
 * Money. Grouped digits, tabular figures so columns line up, and the currency
 * kept next to the number rather than in a separate column.
 */
export function Amount({
  value,
  currency,
  currencyDisplay = 'symbol',
  className,
  fallback = '—',
}: {
  value: number | string | null | undefined
  /**
   * Required on purpose: a figure whose currency is guessed is worse than one
   * with no symbol at all. Pass `null` when the context already states it.
   */
  currency: string | null
  /**
   * `code` renders `formatMoney`: ISO code and currency precision (JPY has no
   * decimals). `symbol` keeps the legacy ₴/$/€ suffix and free precision.
   */
  currencyDisplay?: 'symbol' | 'code'
  className?: string
  fallback?: string
}) {
  const { locale } = useLocale()
  const text =
    currencyDisplay === 'code'
      ? formatMoney(value, currency, locale)
      : formatNumber(value, locale)
  if (text === null) {
    return <span className={cn('tabular-nums', className)}>{fallback}</span>
  }

  const suffix =
    currencyDisplay === 'symbol' && currency
      ? (currencyLabel[currency] ?? currency)
      : ''
  return (
    <span className={cn('tabular-nums whitespace-nowrap', className)}>
      {text}
      {suffix ? ` ${suffix}` : ''}
    </span>
  )
}

/** A count with its unit, so "3" never floats without saying 3 of what. */
export function Quantity({
  value,
  unit,
  className,
  fallback = '—',
}: {
  value: number | null | undefined
  unit?: string | null
  className?: string
  fallback?: string
}) {
  const { locale } = useLocale()
  const text = formatNumber(value, locale)
  if (text === null) {
    return <span className={cn('tabular-nums', className)}>{fallback}</span>
  }

  return (
    <span className={cn('tabular-nums whitespace-nowrap', className)}>
      {text}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}

/**
 * A moment in time inside a real `<time>` element so the machine-readable
 * value survives alongside the readable one. Rendered in the current locale
 * and the business time zone (tenant `timeZoneId`, Kyiv when unknown).
 */
export function DateValue({
  value,
  withTime = true,
  timeZone,
  className,
  fallback = '—',
}: {
  value: string | null | undefined
  withTime?: boolean
  /** Override the business time zone from context. */
  timeZone?: string
  className?: string
  fallback?: string
}) {
  const context = useLocale()
  const text = value
    ? formatDate(value, context.locale, {
        timeZone: timeZone ?? context.timeZone,
        withTime,
      })
    : null
  if (!value || text === null) {
    return <span className={className}>{fallback}</span>
  }

  return (
    <time
      className={cn('tabular-nums whitespace-nowrap', className)}
      dateTime={value}
    >
      {text}
    </time>
  )
}

/** Label and value as a definition pair — the shape every detail screen needs. */
export function Fact({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 gap-1', className)}>
      <dt className="text-app-dim text-[13.5px]">{label}</dt>
      <dd className="text-sm break-words text-white">{children}</dd>
    </div>
  )
}

/** The definition list that holds `Fact`s. Three columns on a desktop. */
export function FactList({
  children,
  columns = 3,
  className,
}: {
  children: ReactNode
  columns?: 2 | 3
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid gap-3 sm:grid-cols-2',
        columns === 3 && 'lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </dl>
  )
}
