import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react'
import { Link } from 'react-router'
import { useT } from '@/i18n'
import { loginPathForPlan } from '@/lib/plan-selection'
import { cn } from '@/lib/utils'
import { Count, PrimaryLink, TelegramIcon } from './landing-ui'
import { useMoney, useSupportHref } from './landing-hooks'
import { heroMessages } from './hero-messages'
import { landingMessages, listOf, rowsOf } from './landing-messages'
import { siteMessages } from './site-messages'
import { AppStoreBadge } from './store-badges'

/** One tab of the preview stays on screen this long before the next one. */
export const HERO_TAB_MS = 6500
/** A new sale lands in the «Авто» feed this often. */
export const HERO_SALE_MS = 3600

const TAB_COUNT = 4
/** Sidebar row lit for each tab: Авто, Склад, Замовлення, Звіти. */
const sideForTab = [0, 2, 4, 7]

const invested = 3200
const totalParts = 184
const startSold = 131
const startEarned = 5870
const startFeedPrices = [1450, 160, 180]
const poolPrices = [240, 95, 120, 210, 140, 85, 130, 175, 260]

const cars = [
  { name: 'BMW 320d E90 · 2008', invested: 3200, earned: 5870 },
  { name: 'VW Passat B7 · 2012', invested: 2400, earned: 3150 },
  { name: 'Toyota Camry 50 · 2014', invested: 5100, earned: 4300 },
]
const maxEarned = Math.max(...cars.map((car) => car.earned))

type PartStatus = 'statusFree' | 'statusReserved' | 'statusInOrder'
type OrderStatus = 'statusNew' | 'statusPaid' | 'statusSent'

const parts: {
  code: string
  car: string
  shelf: string
  status: PartStatus
  price: number
}[] = [
  {
    code: 'A-0142',
    car: 'BMW E90',
    shelf: 'B3',
    status: 'statusFree',
    price: 180,
  },
  {
    code: 'A-0143',
    car: 'BMW E90',
    shelf: 'B3',
    status: 'statusReserved',
    price: 175,
  },
  {
    code: 'A-0151',
    car: 'BMW E90',
    shelf: 'D2',
    status: 'statusFree',
    price: 160,
  },
  {
    code: 'A-0158',
    car: 'BMW E90',
    shelf: '',
    status: 'statusInOrder',
    price: 1450,
  },
  {
    code: 'B-0217',
    car: 'Passat B7',
    shelf: 'C1',
    status: 'statusFree',
    price: 95,
  },
  {
    code: 'C-0309',
    car: 'Camry 50',
    shelf: 'A4',
    status: 'statusInOrder',
    price: 240,
  },
]

const orders: { number: number; status: OrderStatus; sum: number }[] = [
  { number: 1049, status: 'statusNew', sum: 240 },
  { number: 1048, status: 'statusPaid', sum: 515 },
  { number: 1047, status: 'statusSent', sum: 1450 },
  { number: 1046, status: 'statusPaid', sum: 160 },
]
const openOrder = 1
const orderLinePrices = [180, 95, 240]

const monthSales = [1200, 1650, 1500, 2300, 2900, 3600]
const maxMonth = Math.max(...monthSales)

const statusTone: Record<PartStatus | OrderStatus, string> = {
  statusFree: 'bg-[rgba(62,207,110,0.12)] text-lp-ok-text',
  statusPaid: 'bg-[rgba(62,207,110,0.12)] text-lp-ok-text',
  statusReserved: 'bg-[rgba(255,176,112,0.12)] text-[#ffb070]',
  statusInOrder: 'bg-[rgba(255,106,26,0.15)] text-lp-accent-hover',
  statusNew: 'bg-[rgba(255,106,26,0.15)] text-lp-accent-hover',
  statusSent: 'bg-white/[0.08] text-lp-soft',
}

/** The «Авто» feed: the three starting sales, then items from the pool. */
interface Sale {
  id: number
  /** Index into `heroSales` (start) or `feedPool` (live). */
  pool: boolean
  index: number
  price: number
  fresh: boolean
}

interface LiveFigures {
  sold: number
  earned: number
  feed: Sale[]
}

const startFigures: LiveFigures = {
  sold: startSold,
  earned: startEarned,
  feed: startFeedPrices.map((price, index) => ({
    id: index,
    pool: false,
    index,
    price,
    fresh: false,
  })),
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribeMotion(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Motion allowed: false on the server and while hydrating, then live. */
function useMotionAllowed() {
  return useSyncExternalStore(
    subscribeMotion,
    () =>
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

const roiOf = (earned: number, cost: number) =>
  Math.round(((earned - cost) / cost) * 100)

const insetCell = 'bg-lp-inset'
const smallCaps =
  'text-lp-dim text-[13px] font-semibold tracking-[0.06em] uppercase'

function HexMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden
      className="block flex-none"
    >
      <path
        fill="#ff6a1a"
        fillRule="evenodd"
        d="M6.2 1.9h11.6L23.6 12l-5.8 10.1H6.2L.4 12zM12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2z"
      />
    </svg>
  )
}

function StatusChip({ status }: { status: PartStatus | OrderStatus }) {
  const h = useT(heroMessages)
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap',
        statusTone[status],
      )}
    >
      {h(status)}
    </span>
  )
}

function CarsScreen({ figures }: { figures: LiveFigures }) {
  const l = useT(landingMessages)
  const h = useT(heroMessages)
  const money = useMoney()
  const startNames = listOf(l('heroSales'))
  const poolNames = listOf(h('feedPool'))
  const roi = roiOf(figures.earned, invested)

  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5 max-[960px]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-[22px]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-lp-muted flex items-center gap-2 text-[13px]">
              <span
                className="bg-lp-ok lp-pulse size-[7px] rounded-full"
                aria-hidden
              />
              {l('cardStatus')}
            </span>
            <span className="font-unbounded text-[22px] font-semibold tracking-[-0.02em]">
              BMW 320d E90 · 2008
            </span>
            <span className="text-lp-dim font-[ui-monospace,Menlo,monospace] text-[12px]">
              VIN WBAPN71060A•••482
            </span>
          </div>
          <span className="text-lp-accent-hover rounded-full bg-[rgba(255,106,26,0.14)] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap">
            {l('cardPaidOff')}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: l('invested'), value: invested, prefix: '$', suffix: '' },
            {
              label: l('earned'),
              value: figures.earned,
              prefix: '$',
              suffix: '',
            },
            { label: 'ROI', value: roi, prefix: '+', suffix: '%' },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                'flex flex-col gap-1.5 rounded-2xl p-3.5 max-sm:rounded-xl max-sm:p-2.5',
                index === 2 ? 'bg-lp-accent text-lp-bg' : insetCell,
              )}
            >
              <span
                className={cn('text-[13px]', index !== 2 && 'text-lp-muted')}
              >
                {stat.label}
              </span>
              <span className="text-[20px] font-semibold tabular-nums max-sm:text-[15px]">
                {/* Keyed by value: the count-up writes the final text into
                    the element, so a new figure gets a fresh element. */}
                <Count
                  key={stat.value}
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                />
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="text-lp-muted flex justify-between text-[14px]">
            <span>{l('soldParts')}</span>
            <span className="text-lp-ink tabular-nums">
              {l('soldOf', { sold: figures.sold, total: totalParts })}
            </span>
          </div>
          <div className={cn(insetCell, 'h-2 overflow-hidden rounded-full')}>
            <div
              data-bar=""
              className="bg-lp-accent h-full rounded-full"
              style={{
                width: `${((figures.sold / totalParts) * 100).toFixed(1)}%`,
              }}
            />
          </div>
        </div>
        <ul role="list" className="m-0 flex min-h-[132px] flex-col gap-0.5 p-0">
          {figures.feed.map((sale) => (
            <li
              key={sale.id}
              className={cn(
                '-mx-2.5 flex items-center justify-between gap-3 overflow-hidden rounded-[10px] p-2.5 text-[15px]',
                sale.fresh &&
                  'animate-[lp-row-in_.9s_cubic-bezier(.2,.8,.2,1)_both]',
              )}
            >
              <span className="text-lp-soft flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 rounded-full transition-colors duration-[600ms]',
                    sale.fresh ? 'bg-lp-ok' : 'bg-lp-off',
                  )}
                />
                {(sale.pool ? poolNames : startNames)[sale.index]}
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  sale.fresh
                    ? 'text-lp-accent-hover font-semibold'
                    : 'text-lp-ink',
                )}
              >
                {sale.fresh ? '+' : ''}
                {money(sale.price)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <span className={smallCaps}>{h('allCars')}</span>
        {cars.map((car, index) => {
          const earned = index === 0 ? figures.earned : car.earned
          const carRoi = roiOf(earned, car.invested)
          const positive = carRoi >= 0
          return (
            <div
              key={car.name}
              className={cn(
                insetCell,
                'flex flex-col gap-2.5 rounded-[14px] p-3.5',
              )}
            >
              <div className="flex justify-between gap-2.5 text-[14px]">
                <span className="font-semibold">{car.name}</span>
                <span
                  className={cn(
                    'font-semibold',
                    positive ? 'text-lp-accent-hover' : 'text-lp-muted',
                  )}
                >
                  {positive ? '+' : '−'}
                  {Math.abs(carRoi)}%
                </span>
              </div>
              <div className="bg-lp-track h-[5px] overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full',
                    positive ? 'bg-lp-accent' : 'bg-lp-off',
                  )}
                  style={{
                    width: `${Math.min(100, Math.round((earned / maxEarned) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StockScreen() {
  const h = useT(heroMessages)
  const money = useMoney()
  const columns = listOf(h('stockColumns'))
  const names = listOf(h('stockParts'))
  const head =
    'text-lp-dim border-b border-white/[0.08] px-3.5 py-2.5 text-[12px] font-semibold tracking-[0.06em] uppercase'
  const cell =
    'flex min-w-0 items-center border-b border-white/[0.05] px-3.5 py-[13px]'
  // Car and shelf columns drop out on phones (mock-up `data-dcol`).
  const optional = 'max-sm:hidden'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="bg-lp-bg text-lp-soft flex h-[42px] min-w-[200px] flex-1 items-center gap-2.5 rounded-xl border border-white/10 px-3.5 text-[15px]">
          <span className="text-lp-dim" aria-hidden>
            ⌕
          </span>
          {h('search')}
          <span
            aria-hidden
            className="bg-lp-accent h-[18px] w-[1.5px] animate-[lp-blink_1s_steps(1)_infinite]"
          />
        </span>
        <span className="bg-lp-accent text-lp-bg flex h-[42px] items-center rounded-xl px-4 text-[14px] font-semibold">
          {h('scanQr')}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1fr)_minmax(0,.7fr)] text-[14px] max-sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,.8fr)]">
        {columns.map((column, index) => (
          <span
            key={column}
            className={cn(
              head,
              (index === 1 || index === 2) && optional,
              index === 4 && 'flex justify-end',
            )}
          >
            {column}
          </span>
        ))}
        {parts.map((part, index) => (
          <div key={part.code} className="contents">
            <span className={cn(cell, 'gap-2.5 font-semibold')}>
              <span className="text-lp-dim flex-none font-[ui-monospace,Menlo,monospace] text-[11px]">
                {part.code}
              </span>
              {names[index]}
            </span>
            <span className={cn(cell, optional, 'text-lp-muted')}>
              {part.car}
            </span>
            <span
              className={cn(
                cell,
                optional,
                'text-lp-soft font-[ui-monospace,Menlo,monospace]',
              )}
            >
              {part.shelf || h('workshop')}
            </span>
            <span className={cell}>
              <StatusChip status={part.status} />
            </span>
            <span className={cn(cell, 'justify-end tabular-nums')}>
              {money(part.price)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersScreen() {
  const h = useT(heroMessages)
  const money = useMoney()
  const rows = rowsOf(h('orders'))
  const lines = listOf(h('orderLines'))
  const open = orders[openOrder]
  const chip = 'rounded-full px-2.5 py-[5px] text-[12px]'

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 max-[960px]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-2">
        <span className={smallCaps}>{h('ordersToday')}</span>
        {orders.map((order, index) => {
          const [client, item] = rows[index] ?? []
          return (
            <div
              key={order.number}
              className={cn(
                'flex items-center gap-3.5 rounded-[14px] border p-3.5',
                index === openOrder
                  ? 'border-[rgba(255,106,26,0.35)] bg-[rgba(255,106,26,0.07)]'
                  : 'bg-lp-inset border-transparent',
              )}
            >
              <span className="text-lp-dim flex-none font-[ui-monospace,Menlo,monospace] text-[13px]">
                #{order.number}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{client}</span>
                <span className="text-lp-muted truncate text-[13px]">
                  {item}
                </span>
              </span>
              <StatusChip status={order.status} />
              <span className="min-w-16 flex-none text-right font-semibold tabular-nums">
                {money(order.sum)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="bg-lp-inset flex min-w-0 flex-col gap-4 rounded-[18px] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-unbounded text-[18px] font-semibold">
            {h('orderTitle', { number: String(open?.number ?? '') })}
          </span>
          <span className="text-lp-muted text-[13px]">
            {rows[openOrder]?.[0]}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={cn(chip, 'bg-lp-chip text-lp-soft')}>
            {h('orderReserved')}
          </span>
          <span className={cn(chip, 'bg-lp-accent text-lp-bg font-semibold')}>
            {h('statusPaid')}
          </span>
          <span
            className={cn(
              chip,
              'text-lp-muted border border-dashed border-white/20',
            )}
          >
            {h('orderShipping')}
          </span>
        </div>
        <div className="flex flex-col">
          {lines.map((line, index) => (
            <div
              key={line}
              className="flex justify-between gap-3 border-t border-white/[0.07] py-[11px] text-[14px]"
            >
              <span className="text-lp-soft">{line}</span>
              <span className="tabular-nums">
                {money(orderLinePrices[index] ?? 0)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/[0.12] pt-3 text-[16px] font-semibold">
            <span>{h('orderTotal')}</span>
            <span className="tabular-nums">
              {money(orderLinePrices.reduce((sum, price) => sum + price, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportsScreen({ roi }: { roi: number }) {
  const h = useT(heroMessages)
  const money = useMoney()
  const months = listOf(h('months'))
  const kpi = 'flex flex-col gap-1.5 rounded-2xl p-4'
  const kpiValue = 'font-unbounded text-[24px] font-semibold tabular-nums'

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <div className={cn(kpi, insetCell)}>
          <span className="text-lp-muted text-[13px]">{h('kpiProfit')}</span>
          <span className={kpiValue}>{money(14650)}</span>
        </div>
        <div className={cn(kpi, insetCell)}>
          <span className="text-lp-muted text-[13px]">{h('kpiStock')}</span>
          <span className={kpiValue}>{money(48920)}</span>
        </div>
        <div className={cn(kpi, 'bg-lp-accent text-lp-bg')}>
          <span className="text-[13px]">{h('kpiBest')}</span>
          <span className="font-unbounded text-[20px] font-semibold">
            BMW E90 · +{roi}%
          </span>
        </div>
      </div>
      <div className="bg-lp-inset flex flex-col gap-3.5 rounded-2xl p-5">
        <span className={smallCaps}>{h('salesByMonth')}</span>
        <div className="grid h-[180px] grid-cols-6 items-end gap-3.5">
          {monthSales.map((value, index) => (
            <div
              key={months[index] ?? index}
              className="flex h-full flex-col items-center justify-end gap-2"
            >
              <span className="text-lp-muted text-[12px] tabular-nums">
                {money(value)}
              </span>
              <span
                aria-hidden
                className={cn(
                  'w-full max-w-14 origin-bottom animate-[lp-grow_.8s_cubic-bezier(.2,.8,.2,1)_both] rounded-[8px_8px_3px_3px]',
                  index === monthSales.length - 1
                    ? 'bg-lp-accent'
                    : 'bg-[rgba(255,106,26,0.35)]',
                )}
                style={{ height: `${Math.round((value / maxMonth) * 100)}%` }}
              />
              <span className="text-lp-dim text-[12px]">{months[index]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Browser-window preview of the app under the hero copy. The server renders
 * the «Авто» tab; after mount (and not under reduced motion) the tabs rotate
 * every 6.5 s and sales keep landing in the feed, both paused while the
 * preview is off screen or the page is hidden. Choosing a tab stops the
 * rotation for good.
 */
function AppPreview() {
  const h = useT(heroMessages)
  const baseId = useId()
  const tabs = listOf(h('tabs'))
  const side = listOf(h('side'))

  const [tab, setTab] = useState(0)
  const [figures, setFigures] = useState(startFigures)
  /** After hydration, when motion is allowed. */
  const autoplay = useMotionAllowed()
  /** The visitor picked a tab: no more rotation. */
  const [stopped, setStopped] = useState(false)
  /** Keyboard focus is on the tabs: hold the rotation meanwhile. */
  const [focused, setFocused] = useState(false)
  /** On screen and the document is visible. */
  const [visible, setVisible] = useState(true)

  const rootRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  /** Time the current tab has been on screen while rotating. */
  const elapsed = useRef(0)
  /** Next pool item and next feed row id; kept across pauses. */
  const feedCursor = useRef({ next: 0, id: startFigures.feed.length })

  useEffect(() => {
    if (!autoplay) return
    let inView = true
    const update = () => setVisible(inView && !document.hidden)
    document.addEventListener('visibilitychange', update)
    let observer: IntersectionObserver | undefined
    if (rootRef.current && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting)
        update()
      })
      observer.observe(rootRef.current)
    }
    return () => {
      document.removeEventListener('visibilitychange', update)
      observer?.disconnect()
    }
  }, [autoplay])

  const rotating = autoplay && !stopped
  const running = rotating && visible && !focused

  // Tab rotation: elapsed time only grows while running, so the progress
  // fill (paused with it) and the switch stay in step.
  useEffect(() => {
    if (!running) return
    const step = 100
    const timer = window.setInterval(() => {
      elapsed.current += step
      if (elapsed.current < HERO_TAB_MS) return
      elapsed.current = 0
      setTab((current) => (current + 1) % TAB_COUNT)
    }, step)
    return () => window.clearInterval(timer)
  }, [running])

  // New sales in the «Авто» feed, up to every part of the car.
  useEffect(() => {
    if (!autoplay || !visible) return
    const cursor = feedCursor.current
    const timer = window.setInterval(() => {
      const index = cursor.next++ % poolPrices.length
      const id = cursor.id++
      const price = poolPrices[index] ?? 0
      setFigures((current) => {
        if (current.sold >= totalParts) return current
        return {
          sold: current.sold + 1,
          earned: current.earned + price,
          feed: [
            { id, pool: true, index, price, fresh: true },
            ...current.feed.map((sale) => ({ ...sale, fresh: false })),
          ].slice(0, 3),
        }
      })
    }, HERO_SALE_MS)
    return () => window.clearInterval(timer)
  }, [autoplay, visible])

  const select = (index: number) => {
    setTab(index)
    setStopped(true)
    elapsed.current = 0
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: tab + 1,
      ArrowLeft: tab - 1,
      Home: 0,
      End: TAB_COUNT - 1,
    }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    const index = (target + TAB_COUNT) % TAB_COUNT
    select(index)
    tabRefs.current[index]?.focus()
  }

  const tabId = (index: number) => `${baseId}-tab-${index}`
  const panelId = `${baseId}-panel`
  const activeSide = sideForTab[tab]

  return (
    <figure ref={rootRef} className="relative m-0 flex w-full flex-col gap-4">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[10%] right-[8%] -bottom-[6%] left-[8%] bg-[radial-gradient(closest-side,rgba(255,106,26,0.2),transparent)] blur-[40px]"
      />
      <div
        role="tablist"
        aria-label={h('tabsLabel')}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false)
        }}
        className="relative flex max-w-full gap-1 self-center overflow-x-auto rounded-full border border-white/10 bg-white/5 p-[5px] max-sm:self-stretch"
      >
        {tabs.map((label, index) => {
          const active = index === tab
          return (
            <button
              key={label}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={tabId(index)}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => select(index)}
              className={cn(
                'focus-visible:outline-lp-accent relative flex h-[42px] flex-none cursor-pointer items-center overflow-hidden rounded-full px-5 text-[15px] font-semibold whitespace-nowrap transition-[background-color,color] duration-[250ms] focus-visible:outline-2 focus-visible:outline-offset-2',
                active
                  ? 'bg-lp-accent text-lp-bg'
                  : 'text-lp-soft hover:text-lp-accent-hover bg-transparent',
              )}
            >
              {label}
              {active && rotating && (
                <span
                  aria-hidden
                  className="absolute right-3.5 bottom-[5px] left-3.5 h-0.5 overflow-hidden rounded-[2px] bg-[rgba(11,11,11,0.25)]"
                >
                  <span
                    data-progress=""
                    className="bg-lp-bg block h-full origin-left animate-[lp-tab-prog_6.5s_linear_both]"
                    style={{
                      animationPlayState: running ? 'running' : 'paused',
                    }}
                  />
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="lp-glass relative overflow-hidden rounded-[24px]">
        <div
          aria-hidden
          className="bg-lp-inset flex items-center gap-3.5 border-b border-white/[0.07] px-4 py-3"
        >
          <div className="flex gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-[11px] rounded-full bg-[#3a3a3a]"
              />
            ))}
          </div>
          <span className="text-lp-dim mx-auto flex h-7 max-w-[340px] flex-1 items-center justify-center rounded-lg bg-[#1a1a1a] text-[13px]">
            rozbirka.pro
          </span>
          <span className="w-[45px]" />
        </div>
        <div className="grid min-h-[460px] grid-cols-[auto_minmax(0,1fr)] max-[960px]:grid-cols-[minmax(0,1fr)]">
          <div
            aria-hidden
            className="flex w-[200px] flex-col gap-0.5 border-r border-white/[0.07] bg-[#101010] px-3 py-[18px] max-[960px]:hidden"
          >
            <span className="font-unbounded flex items-center gap-2 px-2.5 pt-1 pb-4 text-[16px] font-bold">
              <HexMark />
              rozbirka
            </span>
            {side.map((label, index) => (
              <span
                key={label}
                className={cn(
                  'rounded-[10px] px-3 py-[9px] text-[14px]',
                  index === activeSide
                    ? 'text-lp-accent-hover bg-[rgba(255,106,26,0.14)] font-semibold'
                    : 'text-lp-muted',
                )}
              >
                {label}
              </span>
            ))}
          </div>
          <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId(tab)}
            className="min-w-0 p-6"
          >
            {tab === 0 && <CarsScreen figures={figures} />}
            {tab === 1 && <StockScreen />}
            {tab === 2 && <OrdersScreen />}
            {tab === 3 && (
              <ReportsScreen roi={roiOf(figures.earned, invested)} />
            )}
          </div>
        </div>
      </div>
      <figcaption className="text-lp-dim relative self-center text-[13px]">
        {h('caption')}
      </figcaption>
    </figure>
  )
}

export function Hero() {
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const h = useT(heroMessages)
  const supportHref = useSupportHref()

  return (
    <div className="relative">
      <div
        className="lp-grid-bg pointer-events-none absolute inset-0"
        aria-hidden
      />
      <section
        id="top"
        aria-label={t('heroLabel')}
        className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-14 px-6 pt-[72px] pb-[88px] max-sm:gap-6 max-sm:px-5 max-sm:pt-10 max-sm:pb-12"
      >
        <div className="flex flex-col items-center gap-[26px] text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              aria-hidden
              className="text-lp-ink flex items-center gap-2 rounded-full border border-white/[0.22] bg-white/5 py-[9px] pr-4 pl-3 text-[15px] font-medium whitespace-nowrap"
            >
              <HexMark />
              {h('pillProduct')}
            </span>
            <Link
              to={loginPathForPlan('pro_monthly')}
              className="bg-lp-accent text-lp-bg hover:bg-lp-accent-hover hover:text-lp-bg focus-visible:outline-lp-accent relative flex animate-[lp-badge_3s_ease-in-out_infinite] items-center gap-2 overflow-hidden rounded-full px-4 py-[9px] text-[15px] font-bold whitespace-nowrap shadow-[0_6px_18px_rgba(255,106,26,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span
                aria-hidden
                className="bg-lp-bg size-2 animate-[lp-pulse_1.4s_ease-in-out_infinite] rounded-full"
              />
              {h('pillTrial')}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[40%] translate-x-[-120%] animate-[lp-shine_4.5s_ease-in-out_1s_infinite] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.3),transparent)]"
              />
            </Link>
          </div>
          <h1 className="font-unbounded m-0 max-w-[980px] text-center text-[clamp(42px,6vw,88px)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance max-sm:text-[36px]">
            {/* The product pill above says the same; search engines and
                screen readers get the CRM/ERP wording as part of the H1. */}
            <span className="sr-only">{l('heroBadge')}</span>{' '}
            {t('heroTitleStart')}{' '}
            <span className="text-lp-accent">{t('heroTitleAccent')}</span>
          </h1>
          <p className="text-lp-muted m-0 max-w-[560px] text-center text-[20px] leading-[1.5] text-pretty max-sm:text-[17px]">
            {h('lead')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PrimaryLink to="/login" className="max-sm:w-full">
              {t('heroCta')}
            </PrimaryLink>
            <AppStoreBadge />
          </div>
          {supportHref && (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lp-soft hover:text-lp-accent-hover flex min-h-11 items-center gap-2.5 self-center text-[15px]"
            >
              <TelegramIcon size={28} />
              <span className="underline underline-offset-4">
                {l('heroDemo')}
              </span>
            </a>
          )}
        </div>
        <AppPreview />
      </section>
    </div>
  )
}

/** Endless strip of integrations under the hero. */
export function IntegrationsTicker() {
  const l = useT(landingMessages)
  const items = rowsOf(l('ticker'))
  return (
    <div className="lp-fade-x overflow-hidden border-t border-white/[0.07]">
      <ul role="list" className="lp-marquee flex w-max">
        {[0, 1].map((copy) =>
          items.map(([name, description]) => (
            <li
              key={`${copy}-${name}`}
              aria-hidden={copy === 1 ? true : undefined}
              className="text-lp-muted flex items-center gap-3 px-7 py-[18px] text-[15px] whitespace-nowrap"
            >
              <span className="bg-lp-ok size-1.5 rounded-full" aria-hidden />
              <span className="text-lp-ink font-semibold">{name}</span>
              <span>{description}</span>
            </li>
          )),
        )}
      </ul>
    </div>
  )
}
