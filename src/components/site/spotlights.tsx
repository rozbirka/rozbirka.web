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
import { landingMessages, listOf, rowsOf } from './landing-messages'

/** Two columns of a light chapter; the chapter itself supplies the padding. */
const twoColumns =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-16 max-sm:gap-10'

const stockCounts = [1412, 86, 41]

/** «Склад і стікери»: printed sticker and stock statuses (light chapter). */
export function StockSpotlight() {
  const l = useT(landingMessages)
  const { locale } = useLocale()
  const count = new Intl.NumberFormat(intlLocale(locale))
  const statuses = listOf(l('statuses'))
  return (
    <section
      data-reveal=""
      data-tone="light"
      className={cn('lp-light lp-chap', twoColumns)}
    >
      <div
        className="flex flex-wrap justify-center gap-5 max-sm:order-last max-sm:gap-3"
        aria-hidden
      >
        {/* The paper sticker keeps its dark print in the light chapter. */}
        <div className="flex w-[260px] flex-col gap-[18px] rounded-3xl bg-[#f2f0ea] p-[22px] text-[#0b0b0b] shadow-[0_24px_60px_rgba(0,0,0,0.45)] [--color-lp-bg:#0b0b0b] max-sm:w-[min(100%,240px)]">
          <div className="relative aspect-square">
            <span className="lp-scan bg-lp-accent absolute -right-[6%] -left-[6%] z-[1] h-0.5 rounded-[2px] shadow-[0_0_12px_2px_rgba(255,106,26,0.7)]" />
            <QrPattern className="size-full" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-unbounded text-[18px] font-semibold">
              {l('stickerPart')}
            </span>
            <span className="text-[14px] text-[#5c5954]">
              {l('stickerCar')}
            </span>
            <span className="font-mono text-[13px]">#A-0142</span>
          </div>
        </div>
        <div className="bg-lp-bg flex w-[220px] flex-col gap-3 self-end rounded-3xl border border-white/10 p-5 max-sm:w-full max-sm:self-stretch">
          <span className="text-lp-muted text-[13px]">{l('statusTitle')}</span>
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
            <span className="text-lp-muted text-[13px]">{l('stockValue')}</span>
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
    </section>
  )
}

/** Today's activity log of the team card (amounts in US dollars). */
function TeamLog() {
  const l = useT(landingMessages)
  const { locale } = useLocale()
  const number = new Intl.NumberFormat(intlLocale(locale))
  const usd = (value: number) => `${number.format(value)} USD`
  const rows = rowsOf(
    l('teamLog', { paid: usd(515), from: number.format(160), to: usd(180) }),
  )
  return (
    <div className="lp-glass flex min-w-0 flex-col overflow-hidden rounded-3xl min-[961px]:order-first max-sm:rounded-[20px] max-sm:p-1.5">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-[22px] py-[18px]">
        <h3 className="m-0 text-[16px] font-semibold">{l('teamLogTitle')}</h3>
        <span className="text-lp-muted flex items-center gap-1.5 text-[13px]">
          <span
            className="size-1.5 rounded-full bg-[#1e9e55] motion-safe:animate-[lp-pulse_1.4s_ease-in-out_infinite]"
            aria-hidden
          />
          {l('teamOnline')}
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {rows.map(([time = '', action = '', person = '']) => (
          <li
            key={time}
            data-reveal=""
            className="grid grid-cols-[52px_36px_minmax(0,1fr)] items-center gap-3 border-t border-white/[0.06] px-[22px] py-3.5 first:border-t-0"
          >
            <span className="text-lp-dim [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[13px]">
              {time}
            </span>
            <span
              className="bg-lp-inset flex size-9 items-center justify-center rounded-full text-[14px] font-semibold"
              aria-hidden
            >
              {person.charAt(0)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-lp-ink text-[15px] leading-[1.35]">
                {action}
              </span>
              <span className="text-lp-dim text-[13px]">{person}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="bg-lp-inset flex flex-wrap items-center justify-between gap-3 px-[22px] py-4 text-[14px]">
        <span className="text-lp-muted">{l('teamSales')}</span>
        <span className="[font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[16px] font-semibold">
          {usd(1240)}
        </span>
      </div>
    </div>
  )
}

/** «Команда»: the yard keeps running, the activity log shows who did what. */
export function TeamSpotlight() {
  const l = useT(landingMessages)
  return (
    <section
      data-reveal=""
      data-tone="light"
      className={cn('lp-light lp-chap', twoColumns)}
    >
      <div className="flex flex-col gap-6">
        <Eyebrow>{l('teamEyebrow')}</Eyebrow>
        <SectionTitle>{l('teamTitle')}</SectionTitle>
        <p className="text-lp-muted m-0 max-w-[520px] text-[19px] leading-normal text-pretty">
          {l('teamLead')}
        </p>
        <DashList items={listOf(l('teamPoints'))} />
      </div>
      <TeamLog />
    </section>
  )
}

/** «Перевір на своїй розбірці»: centred call to action, last light chapter. */
export function TrialBand() {
  const l = useT(landingMessages)
  const supportHref = useSupportHref()
  return (
    <section
      data-reveal=""
      data-tone="light"
      className="lp-light lp-chap lp-chap-last pt-[72px]! pb-[88px]!"
    >
      <div className="mx-auto flex max-w-[880px] flex-col items-center gap-5 text-center">
        <h2 className="font-unbounded m-0 text-[clamp(28px,3.4vw,44px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
          {l('trialTitle')}{' '}
          <span className="text-lp-accent-hover whitespace-nowrap">
            {l('trialAccent')}
          </span>
        </h2>
        <p className="text-lp-muted m-0 text-[18px] leading-normal">
          {l('midBody')}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <PrimaryLink to="/login" className="whitespace-nowrap text-[#0b0b0b]">
            {l('startFree')}
          </PrimaryLink>
          {supportHref && (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lp-ink focus-visible:outline-lp-accent flex h-14 flex-none items-center gap-2.5 rounded-full border border-black/[0.18] pr-6 pl-4 text-[17px] font-semibold whitespace-nowrap transition-[background] duration-200 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
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
