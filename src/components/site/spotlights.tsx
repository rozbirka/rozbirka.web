import { intlLocale, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  Count,
  DashList,
  Eyebrow,
  PrimaryLink,
  QrPattern,
  SectionTitle,
  TelegramIcon,
} from './landing-ui'
import { useMoney, useSupportHref } from './landing-hooks'
import { landingMessages, listOf } from './landing-messages'

const twoColumns =
  'mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-16 px-6 max-sm:gap-10 max-sm:px-5'

const cars = [
  {
    name: 'BMW 320d E90 · 2008',
    invested: 3200,
    earned: 5870,
    sold: 131,
    total: 184,
  },
  {
    name: 'VW Passat B7 · 2012',
    invested: 2400,
    earned: 3150,
    sold: 98,
    total: 162,
  },
  {
    name: 'Toyota Camry 50 · 2014',
    invested: 5100,
    earned: 4300,
    sold: 74,
    total: 210,
  },
]

/** «Авто та партії»: profit chart and the cars being stripped. */
export function CarsSpotlight() {
  const l = useT(landingMessages)
  const money = useMoney()
  const maxEarned = Math.max(...cars.map((car) => car.earned))
  const area =
    'M0 152 C60 140 80 128 120 126 C170 124 200 140 240 136 C290 130 320 98 360 92 C410 86 440 82 480 76 C530 68 560 44 600 32'
  return (
    <section data-reveal="" className={cn(twoColumns, 'pb-28 max-sm:pb-16')}>
      <div className="flex flex-col gap-6">
        <Eyebrow>{l('carsEyebrow')}</Eyebrow>
        <SectionTitle>{l('carsTitle')}</SectionTitle>
        <DashList items={listOf(l('carsPoints'))} />
      </div>
      <div className="bg-lp-surface flex min-w-0 flex-col gap-2 rounded-[28px] border border-white/[0.08] p-7">
        <div className="mb-3 flex flex-col gap-4 border-b border-white/[0.07] pb-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-lp-muted text-[14px]">
                {l('chartLabel')}
              </span>
              <span className="font-unbounded text-[30px] font-semibold tracking-[-0.03em] tabular-nums">
                <Count value={14650} prefix="$" />
              </span>
            </div>
            <span className="text-lp-ok-text rounded-full bg-[rgba(62,207,110,0.12)] px-3 py-1.5 text-[14px] font-semibold">
              ↑ 250%
            </span>
          </div>
          <svg
            viewBox="0 0 600 200"
            preserveAspectRatio="none"
            className="block h-40 w-full overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id="lp-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ff6a1a" stopOpacity=".35" />
                <stop offset="1" stopColor="#ff6a1a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 50H600M0 100H600M0 150H600"
              stroke="rgba(255,255,255,.06)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-fade=""
              d={`${area} L600 200 L0 200 Z`}
              fill="url(#lp-area)"
            />
            <path
              data-draw=""
              d={area}
              fill="none"
              stroke="#ff6a1a"
              strokeWidth="3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div
            className="text-lp-dim flex justify-between text-[13px]"
            aria-hidden
          >
            {listOf(l('months')).map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pb-3">
          <span className="text-[17px] font-semibold">{l('carsList')}</span>
          <span className="text-lp-muted text-[14px]">
            {l('currencyLabel', { code: 'USD' })}
          </span>
        </div>
        <ul role="list" className="flex flex-col gap-2">
          {cars.map((car) => {
            const roi = Math.round(
              ((car.earned - car.invested) / car.invested) * 100,
            )
            const positive = roi >= 0
            return (
              <li
                key={car.name}
                className="bg-lp-inset flex flex-col gap-3.5 rounded-[18px] p-[18px]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-semibold">{car.name}</span>
                  <span
                    className={cn(
                      'text-[16px] font-semibold tabular-nums',
                      positive ? 'text-lp-accent-hover' : 'text-lp-muted',
                    )}
                  >
                    {positive ? '+' : '−'}
                    {Math.abs(roi)}%
                  </span>
                </div>
                <div className="bg-lp-track h-1.5 overflow-hidden rounded-full">
                  <div
                    data-bar=""
                    className={cn(
                      'h-full rounded-full',
                      positive ? 'bg-lp-accent' : 'bg-lp-off',
                    )}
                    style={{
                      width: `${Math.round((car.earned / maxEarned) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-lp-muted flex flex-wrap justify-between gap-3 text-[14px] tabular-nums">
                  <span>
                    {l('carInvested', { amount: money(car.invested) })}
                  </span>
                  <span>{l('carEarned', { amount: money(car.earned) })}</span>
                  <span>
                    {l('carParts', { sold: car.sold, total: car.total })}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

const stockCounts = [1412, 86, 41]

/** «Склад і стікери»: printed sticker and stock statuses. */
export function StockSpotlight() {
  const l = useT(landingMessages)
  const { locale } = useLocale()
  const count = new Intl.NumberFormat(intlLocale(locale))
  const statuses = listOf(l('statuses'))
  return (
    <section
      data-reveal=""
      className="bg-lp-surface border-y border-white/[0.07]"
    >
      <div className={cn(twoColumns, 'py-28 max-sm:py-16')}>
        <div
          className="flex flex-wrap justify-center gap-5 max-sm:order-last max-sm:gap-3"
          aria-hidden
        >
          <div className="bg-lp-ink text-lp-bg flex w-[260px] flex-col gap-[18px] rounded-3xl p-[22px] max-sm:w-[min(100%,240px)] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="relative aspect-square">
              <span className="lp-scan bg-lp-accent absolute -right-[6%] -left-[6%] z-[1] h-0.5 rounded-[2px] shadow-[0_0_12px_2px_rgba(255,106,26,0.7)]" />
              <QrPattern className="size-full" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-unbounded text-[18px] font-semibold">
                {l('stickerPart')}
              </span>
              <span className="text-lp-paper-muted text-[14px]">
                {l('stickerCar')}
              </span>
              <span className="font-mono text-[13px]">#A-0142</span>
            </div>
          </div>
          <div className="bg-lp-bg flex w-[220px] flex-col gap-3 self-end rounded-3xl border border-white/10 p-5 max-sm:w-full max-sm:self-stretch">
            <span className="text-lp-muted text-[13px]">
              {l('statusTitle')}
            </span>
            <div className="flex flex-col gap-2 text-[15px]">
              {statuses.map((status, index) => (
                <div key={status} className="flex justify-between">
                  <span>{status}</span>
                  <span className="text-lp-muted tabular-nums">
                    {count.format(stockCounts[index] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 border-t border-white/[0.08] pt-3">
              <span className="text-lp-muted text-[13px]">
                {l('stockValue')}
              </span>
              <span className="text-[22px] font-semibold tabular-nums">
                <Count value={48920} prefix="$" />
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <Eyebrow>{l('stockEyebrow')}</Eyebrow>
          <SectionTitle>{l('stockTitle')}</SectionTitle>
          <DashList items={listOf(l('stockPoints'))} />
        </div>
      </div>
    </section>
  )
}

const orderPrices = [180, 95, 240]
const cashBalances = [
  { amount: '₴86 240', currency: 'UAH' },
  { amount: '₴214 900', currency: 'UAH' },
  { amount: '$12 480', currency: 'USD' },
]

/** «Замовлення і каси»: an order, the tills and what they give you. */
export function OrdersSpotlight() {
  const l = useT(landingMessages)
  const money = useMoney()
  const cashRows = listOf(l('cashRows'))
  const lines = listOf(l('orderLines'))
  return (
    <section
      data-reveal=""
      className="mx-auto flex max-w-[1240px] flex-col gap-14 px-6 py-28 max-sm:gap-10 max-sm:px-5 max-sm:py-16"
    >
      <div className="flex max-w-[760px] flex-col gap-5">
        <Eyebrow>{l('ordersEyebrow')}</Eyebrow>
        <SectionTitle>{l('ordersTitle')}</SectionTitle>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
        <div className="bg-lp-surface flex flex-col gap-5 rounded-[28px] border border-white/[0.08] p-7">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-unbounded text-[20px] font-semibold">
              {l('orderTitle')}
            </span>
            <span className="text-lp-muted text-[14px]">
              {l('orderCustomer')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[13px]">
            <span className="bg-lp-chip text-lp-soft rounded-full px-3 py-1.5">
              {l('orderReserved')}
            </span>
            <span className="bg-lp-accent text-lp-bg rounded-full px-3 py-1.5 font-semibold">
              {l('orderPaid')}
            </span>
            <span className="text-lp-muted rounded-full border border-dashed border-white/20 px-3 py-1.5">
              {l('orderShipping')}
            </span>
          </div>
          <div className="flex flex-col">
            {lines.map((name, index) => (
              <div
                key={name}
                className="flex justify-between gap-3 border-t border-white/[0.07] py-3 text-[15px]"
              >
                <span className="text-lp-soft">{name}</span>
                <span className="tabular-nums">
                  {money(orderPrices[index] ?? 0)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-white/12 pt-3.5 text-[17px] font-semibold">
              <span>{l('orderTotal')}</span>
              <span className="tabular-nums">
                {money(orderPrices.reduce((sum, price) => sum + price, 0))}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-lp-surface flex flex-col gap-5 rounded-[28px] border border-white/[0.08] p-7">
          <span className="font-unbounded text-[20px] font-semibold">
            {l('cashTitle')}
          </span>
          <div className="flex flex-col gap-2.5">
            {cashBalances.map((cash, index) => (
              <div
                key={cash.amount}
                className="bg-lp-inset flex items-center justify-between gap-3 rounded-[18px] px-[18px] py-4"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px]">{cashRows[index]}</span>
                  <span className="text-lp-muted text-[13px]">
                    {cash.currency}
                  </span>
                </div>
                <span className="text-[20px] font-semibold tabular-nums">
                  {cash.amount}
                </span>
              </div>
            ))}
          </div>
          <span className="text-lp-muted text-[14px]">{l('cashNote')}</span>
        </div>
        <DashList
          items={listOf(l('orderPoints'))}
          className="gap-3.5 px-1 py-2 [&>li]:py-2.5"
        />
      </div>
    </section>
  )
}

const permissions = [
  [true, true, false],
  [true, true, true],
  [true, true, false],
  [true, true, false],
  [true, false, false],
]

/** «Команда»: who sees what. */
export function TeamSpotlight() {
  const l = useT(landingMessages)
  const roles = listOf(l('permRoles'))
  const rows = listOf(l('permRows'))
  return (
    <section data-reveal="" className={cn(twoColumns, 'pb-28 max-sm:pb-16')}>
      <div className="flex flex-col gap-6">
        <Eyebrow>{l('teamEyebrow')}</Eyebrow>
        <SectionTitle>{l('teamTitle')}</SectionTitle>
        <DashList items={listOf(l('teamPoints'))} />
      </div>
      <div className="bg-lp-surface min-w-0 overflow-x-auto rounded-[28px] border border-white/[0.08] p-3 max-sm:rounded-[20px] max-sm:p-1.5">
        <table className="w-full min-w-[440px] border-collapse text-[15px] max-sm:min-w-0 max-sm:table-fixed max-sm:text-[12.5px] [&_td]:max-sm:px-1 [&_td]:max-sm:py-3 [&_th]:max-sm:px-1 [&_th]:max-sm:py-3 [&_th:first-child]:max-sm:w-[29%] [&_th:first-child]:max-sm:pl-3 [&_th]:max-sm:[overflow-wrap:anywhere]">
          <thead>
            <tr>
              <th
                scope="col"
                className="text-lp-muted p-4 text-left font-normal"
              >
                {l('permAccess')}
              </th>
              {roles.map((role, index) => (
                <th
                  key={role}
                  scope="col"
                  className={cn(
                    'p-4 text-center font-semibold',
                    index === 2 && 'text-lp-accent-hover',
                  )}
                >
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((label, rowIndex) => (
              <tr key={label} className="border-t border-white/[0.07]">
                <th
                  scope="row"
                  className="text-lp-soft p-4 text-left font-normal"
                >
                  {label}
                </th>
                {permissions[rowIndex]?.map((allowed, index) => (
                  <td
                    key={roles[index]}
                    className={cn(
                      'p-4 text-center',
                      allowed ? 'text-lp-ink' : 'text-lp-dim',
                    )}
                  >
                    {allowed ? l('permYes') : l('permNo')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Light «try it at your yard» band between the spotlights and modules. */
export function TrialBand() {
  const l = useT(landingMessages)
  const supportHref = useSupportHref()
  return (
    <section
      data-reveal=""
      className="mx-auto max-w-[1240px] px-6 pb-28 max-sm:px-5 max-sm:pb-16"
    >
      <div className="bg-lp-ink text-lp-bg flex flex-wrap items-center justify-between gap-8 rounded-[32px] p-12 max-lg:p-10 max-sm:gap-6 max-sm:rounded-3xl max-sm:px-[22px] max-sm:py-7">
        <div className="flex max-w-[640px] flex-col gap-3">
          <h2 className="font-unbounded m-0 text-[clamp(26px,3vw,38px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
            {l('midTitle')}
          </h2>
          <p className="text-lp-paper-muted m-0 text-[17px]">{l('midBody')}</p>
        </div>
        <div className="flex flex-wrap gap-3 max-sm:w-full max-sm:flex-col max-sm:[&>*]:w-full max-sm:[&>*]:justify-center">
          <PrimaryLink to="/login">{l('startFree')}</PrimaryLink>
          {supportHref && (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="border-lp-bg text-lp-bg hover:bg-lp-bg hover:text-lp-ink flex h-14 items-center gap-2.5 rounded-full border-[1.5px] pr-6 pl-4 text-[17px] font-semibold"
            >
              <TelegramIcon />
              {l('orderDemo')}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
