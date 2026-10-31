import type { ComponentProps, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router'
import { intlLocale, useLocale } from '@/i18n'
import { cn } from '@/lib/utils'

/** Hexagon nut mark + wordmark (header 24px, footer 26px in the mock-up). */
export function LandingLogo({
  className,
  markSize = 24,
}: {
  className?: string
  markSize?: number
}) {
  return (
    <span
      className={cn(
        'font-unbounded flex items-center gap-[9px] font-bold tracking-[-0.02em]',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={markSize}
        height={markSize}
        className="block flex-none"
        aria-hidden
      >
        <path
          fill="#ff6a1a"
          fillRule="evenodd"
          d="M6.2 1.9h11.6L23.6 12l-5.8 10.1H6.2L.4 12zM12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2z"
        />
        <circle
          cx="12"
          cy="12"
          r="6.6"
          fill="none"
          stroke="#0b0b0b"
          strokeOpacity=".28"
          strokeWidth="1"
        />
      </svg>
      rozbirka
    </span>
  )
}

export function Eyebrow({
  children,
  tone = 'dark',
}: {
  children: ReactNode
  tone?: 'dark' | 'paper'
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-2.5 self-start text-[13px] font-semibold tracking-[0.08em] uppercase',
        tone === 'dark' ? 'text-lp-accent-hover' : 'text-lp-accent-deep',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-[2px]',
          tone === 'dark' ? 'bg-lp-accent' : 'bg-lp-accent-deep',
        )}
        aria-hidden
      />
      {children}
    </span>
  )
}

export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn(
        'font-unbounded m-0 text-[clamp(30px,5.5vw,44px)] min-[1072px]:text-[clamp(30px,4vw,52px)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance',
        className,
      )}
      {...props}
    />
  )
}

/** Section frame: 1240px column, 112px vertical rhythm. */
export function SectionInner({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-[1240px] flex-col gap-14 px-6 py-28 max-sm:gap-10 max-sm:px-5 max-sm:py-16',
        className,
      )}
      {...props}
    />
  )
}

export function PrimaryLink({
  to,
  className,
  size = 'lg',
  children,
}: {
  to: string
  className?: string
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'bg-lp-accent hover:bg-lp-accent-hover text-lp-bg flex items-center justify-center rounded-full font-semibold transition-transform duration-150 ease-out active:scale-[0.97]',
        size === 'lg' ? 'h-14 px-7 text-[17px]' : 'h-11 px-5 text-[15px]',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function DashList({
  items,
  className,
}: {
  items: string[]
  className?: string
}) {
  return (
    <ul
      role="list"
      className={cn('m-0 flex list-none flex-col gap-3.5 p-0', className)}
    >
      {items.map((item) => (
        <li
          key={item}
          className="text-lp-soft flex gap-3.5 text-[17px] leading-[1.45]"
        >
          <span className="text-lp-accent" aria-hidden>
            —
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * A figure that counts up when its section scrolls into view. The final
 * text is rendered on the server; `useLandingMotion` animates from zero.
 */
export function Count({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
}) {
  const { locale } = useLocale()
  const text = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
  return (
    <span
      data-count={value}
      data-decimals={decimals}
      data-prefix={prefix}
      data-suffix={suffix}
    >
      {prefix}
      {text}
      {suffix}
    </span>
  )
}

export function TelegramIcon({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className="block flex-none"
      aria-hidden
      {...props}
    >
      <circle cx="120" cy="120" r="120" fill="#229ED9" />
      <path
        fill="#fff"
        d="M54 118c35-15 58-25 70-30 33-14 40-16 45-16 1 0 3 0 5 2 1 1 1 3 2 4 0 1 0 4 0 6-2 19-10 66-14 88-2 9-5 12-8 13-7 1-12-5-19-9-11-7-17-12-27-19-12-8-4-12 3-19 2-2 31-29 32-31 0-1 0-2-1-3s-2 0-3 0c-1 0-18 12-50 34-5 3-9 5-13 5-4 0-12-2-18-4-7-2-13-4-13-8 0-2 3-5 8-7z"
      />
    </svg>
  )
}

/** Deterministic 21×21 QR-like pattern with three finder squares. */
const qrCells: readonly boolean[] = (() => {
  let seed = 42
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const finder = (row: number, col: number): number => {
    for (const [fr, fc] of [
      [0, 0],
      [0, 14],
      [14, 0],
    ] as const) {
      const y = row - fr
      const x = col - fc
      if (y >= 0 && y < 7 && x >= 0 && x < 7) {
        return y === 0 ||
          y === 6 ||
          x === 0 ||
          x === 6 ||
          (y >= 2 && y <= 4 && x >= 2 && x <= 4)
          ? 1
          : 0
      }
      if (y >= -1 && y <= 7 && x >= -1 && x <= 7) return 0
    }
    return -1
  }
  const cells: boolean[] = []
  for (let row = 0; row < 21; row++) {
    for (let col = 0; col < 21; col++) {
      const f = finder(row, col)
      cells.push(f === -1 ? random() > 0.52 : f === 1)
    }
  }
  return cells
})()

export function QrPattern({ className }: { className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-[repeat(21,1fr)]', className)}
      aria-hidden
    >
      {qrCells.map((on, index) => (
        <span key={index} className={on ? 'bg-lp-bg' : undefined} />
      ))}
    </div>
  )
}
