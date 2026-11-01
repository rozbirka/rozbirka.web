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
import { useSupportHref } from './landing-hooks'
import { landingMessages, listOf } from './landing-messages'

const twoColumns =
  'mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-16 px-6 max-sm:gap-10 max-sm:px-5'

const stockCounts = [1412, 86, 41]

/** «Склад і стікери»: printed sticker and stock statuses. */
export function StockSpotlight() {
  const l = useT(landingMessages)
  const { locale } = useLocale()
  const count = new Intl.NumberFormat(intlLocale(locale))
  const statuses = listOf(l('statuses'))
  return (
    <section data-reveal="" className="lp-surface lp-warm">
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
    <section
      data-reveal=""
      className={cn(twoColumns, 'lp-sec lp-sec-gap pb-28 max-sm:pb-16')}
    >
      <div className="flex flex-col gap-6">
        <Eyebrow>{l('teamEyebrow')}</Eyebrow>
        <SectionTitle>{l('teamTitle')}</SectionTitle>
        <DashList items={listOf(l('teamPoints'))} />
      </div>
      <div className="lp-glass min-w-0 overflow-x-auto rounded-[28px] p-3 min-[961px]:order-first max-sm:rounded-[20px] max-sm:p-1.5">
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
      className="lp-sec lp-sec-gap mx-auto max-w-[1240px] px-6 pb-28 max-sm:px-5 max-sm:pb-16"
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
