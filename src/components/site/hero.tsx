import { useT } from '@/i18n'
import { Count, PrimaryLink, QrPattern, TelegramIcon } from './landing-ui'
import { useMoney, useSupportHref } from './landing-hooks'
import { landingMessages, listOf, rowsOf } from './landing-messages'
import { siteMessages } from './site-messages'
import { AppStoreBadge } from './store-badges'

const heroSalePrices = [1450, 160, 180]

/** «BMW 320d» profile card with the sticker that lands on it. */
function CarCard() {
  const l = useT(landingMessages)
  const money = useMoney()
  const sales = listOf(l('heroSales'))
  return (
    <div className="relative min-w-0 pt-10 pb-[70px] pl-6">
      <div className="bg-lp-card relative ml-auto flex max-w-[520px] flex-col gap-6 rounded-[28px] border border-white/[0.09] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
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
            <span className="text-lp-dim font-mono text-[12px]">
              VIN WBAPN71060A•••482
            </span>
          </div>
          <span className="text-lp-accent-hover rounded-full bg-[rgba(255,106,26,0.14)] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap">
            {l('cardPaidOff')}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-lp-inset flex flex-col gap-1.5 rounded-2xl p-3.5">
            <span className="text-lp-muted text-[13px]">{l('invested')}</span>
            <span className="text-[20px] font-semibold tabular-nums">
              <Count value={3200} prefix="$" />
            </span>
          </div>
          <div className="bg-lp-inset flex flex-col gap-1.5 rounded-2xl p-3.5">
            <span className="text-lp-muted text-[13px]">{l('earned')}</span>
            <span className="text-[20px] font-semibold tabular-nums">
              <Count value={5870} prefix="$" />
            </span>
          </div>
          <div className="bg-lp-accent text-lp-bg flex flex-col gap-1.5 rounded-2xl p-3.5">
            <span className="text-[13px]">ROI</span>
            <span className="text-[20px] font-semibold tabular-nums">
              <Count value={83} prefix="+" suffix="%" />
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="text-lp-muted flex justify-between text-[14px]">
            <span>{l('soldParts')}</span>
            <span className="text-lp-ink tabular-nums">
              {l('soldOf', { sold: 131, total: 184 })}
            </span>
          </div>
          <div className="bg-lp-inset h-2 overflow-hidden rounded-full">
            <div
              data-bar=""
              className="bg-lp-accent h-full rounded-full"
              style={{ width: '71%' }}
            />
          </div>
        </div>
        <ul role="list" className="flex flex-col gap-0.5">
          {sales.map((name, index) => (
            <li
              key={name}
              className="flex justify-between gap-3 py-2.5 text-[15px]"
            >
              <span className="text-lp-soft">{name}</span>
              <span className="tabular-nums">
                {money(heroSalePrices[index] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div
        aria-hidden
        className="lp-sticker text-lp-bg absolute bottom-0 left-0 flex w-[230px] origin-[30%_60%] items-center gap-3.5 rounded-[20px] bg-lp-ink p-4 shadow-[0_14px_30px_rgba(0,0,0,0.45)]"
      >
        <span className="lp-sticker-press pointer-events-none absolute -inset-2.5 rounded-[26px] border-2 border-[rgba(255,106,26,0.7)]" />
        <span className="lp-sticker-curl absolute top-0 right-0 size-[34px] origin-top-right rounded-[0_20px_0_12px] bg-[linear-gradient(225deg,#0b0b0b_0_49%,#d9d5cc_51%,#bdb8ae_100%)] shadow-[-3px_3px_6px_rgba(0,0,0,0.25)]" />
        <QrPattern className="size-16 flex-none" />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="text-[15px] font-semibold">{l('stickerPart')}</span>
          <span className="font-mono text-[12px]">#A-0142</span>
          <span className="text-lp-paper-muted text-[12px]">
            {l('stickerShelf')}
          </span>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const supportHref = useSupportHref()
  const stats = rowsOf(l('heroStats'))

  return (
    <div className="relative">
      <div
        className="lp-grid-bg pointer-events-none absolute inset-0"
        aria-hidden
      />
      <section
        id="top"
        aria-label={t('heroLabel')}
        className="relative mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] items-center gap-16 px-6 pt-20 pb-24"
      >
        <div className="flex flex-col gap-7">
          <span className="text-lp-muted self-start rounded-full border border-white/14 px-3.5 py-[7px] text-[14px]">
            {l('heroBadge')}
          </span>
          <h1 className="font-unbounded m-0 text-[clamp(40px,5.8vw,84px)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
            {t('heroTitleStart')}{' '}
            <span className="text-lp-accent">{t('heroTitleAccent')}</span>{' '}
            {t('heroTitleEnd')}
          </h1>
          <p className="text-lp-muted m-0 max-w-[520px] text-[20px] leading-[1.5] text-pretty">
            {t('heroSub')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryLink to="/login">{t('heroCta')}</PrimaryLink>
            <AppStoreBadge />
          </div>
          {supportHref && (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lp-soft hover:text-lp-accent-hover flex min-h-11 items-center gap-2.5 self-start text-[15px]"
            >
              <TelegramIcon size={28} />
              <span className="underline underline-offset-4">
                {l('heroDemo')}
              </span>
            </a>
          )}
          <dl className="text-lp-muted m-0 flex flex-wrap gap-7 pt-3 text-[15px]">
            {stats.map(([value, label]) => (
              <div key={value} className="flex flex-col-reverse gap-1">
                <dd className="m-0">{label}</dd>
                <dt className="font-unbounded text-lp-ink text-[22px] tabular-nums">
                  {value}
                </dt>
              </div>
            ))}
          </dl>
        </div>
        <CarCard />
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
