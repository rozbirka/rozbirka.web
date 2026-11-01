import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  Eyebrow,
  PrimaryLink,
  SectionInner,
  SectionTitle,
  TelegramIcon,
} from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages, listOf, rowsOf } from './landing-messages'
import { compareMessages } from './compare-messages'
import { siteMessages } from './site-messages'

/**
 * Per row: does the generic ERP cover the need partly («~»)? Excel never does
 * («✕»), rozbirka always does («✓»). Same order as the `rows` message.
 */
const erpPartly = [false, true, true, true, true, true]

const cell =
  'relative z-[1] flex items-center gap-3 border-t border-white/[0.07] px-6 py-5'
const chip =
  'flex size-6 flex-none items-center justify-center rounded-full text-[12px] font-bold'

function Mark({ state }: { state: 'no' | 'partly' | 'yes' }) {
  return (
    <span
      aria-hidden
      className={cn(
        chip,
        state === 'no' && 'text-lp-dim bg-white/5',
        state === 'partly' && 'text-lp-soft bg-white/[0.08]',
        state === 'yes' && 'bg-lp-accent text-lp-bg',
      )}
    >
      {state === 'no' ? '✕' : state === 'partly' ? '~' : '✓'}
    </span>
  )
}

/** «Порівняння»: Excel and a generic ERP against rozbirka. */
export function Compare() {
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const c = useT(compareMessages)
  const supportHref = useSupportHref()
  const [excel, erp] = listOf(c('cols'))
  const rows = rowsOf(c('rows'))
  return (
    <section id="compare" data-reveal="" className="lp-surface lp-band">
      <SectionInner>
        <div className="flex max-w-[820px] flex-col gap-5">
          <Eyebrow>{c('eyebrow')}</Eyebrow>
          <SectionTitle>{c('title')}</SectionTitle>
        </div>
        <div
          role="region"
          aria-label={c('title')}
          tabIndex={0}
          className="focus-visible:outline-lp-accent overflow-x-auto rounded-sm px-1 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-4 max-sm:hidden"
        >
          <div
            role="table"
            aria-label={c('title')}
            className="relative grid min-w-[820px] grid-cols-[minmax(220px,1.4fr)_repeat(2,minmax(160px,1fr))_minmax(200px,1.15fr)] text-[16px]"
            style={{ gridTemplateRows: `repeat(${rows.length + 1}, auto)` }}
          >
            <div
              aria-hidden
              className="absolute col-start-4 row-[1/-1] -inset-y-3.5 inset-x-0 rounded-3xl border-[1.5px] border-[rgba(255,106,26,0.7)] bg-[linear-gradient(180deg,rgba(255,106,26,0.16),rgba(255,106,26,0.05))] shadow-[0_0_0_6px_rgba(255,106,26,0.05),0_30px_80px_rgba(255,106,26,0.12)]"
            />
            <div role="row" className="col-span-full grid grid-cols-subgrid">
              <span
                role="columnheader"
                className="text-lp-dim flex items-end px-6 py-5 text-[14px]"
              >
                {c('need')}
              </span>
              <span
                role="columnheader"
                className="text-lp-muted flex items-center gap-2.5 px-6 py-5 font-semibold"
              >
                <span
                  aria-hidden
                  className="bg-lp-excel font-unbounded flex size-7 flex-none items-center justify-center rounded-lg text-[13px] font-bold text-white"
                >
                  X
                </span>
                {excel}
              </span>
              <span
                role="columnheader"
                className="text-lp-muted flex items-center gap-2.5 px-6 py-5 font-semibold"
              >
                <span
                  aria-hidden
                  className="bg-lp-chip text-lp-muted font-unbounded flex size-7 flex-none items-center justify-center rounded-lg text-[8px] font-bold"
                >
                  ERP
                </span>
                {erp}
              </span>
              <span
                role="columnheader"
                className="text-lp-ink font-unbounded relative z-[1] flex items-center gap-2.5 px-6 py-5 text-[18px] font-bold"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="26"
                  height="26"
                  aria-hidden
                  className="block flex-none"
                >
                  <path
                    fill="#ff6a1a"
                    fillRule="evenodd"
                    d="M6.2 1.9h11.6L23.6 12l-5.8 10.1H6.2L.4 12zM12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2z"
                  />
                </svg>
                rozbirka
              </span>
            </div>
            {rows.map(([label, a, b, ours], index) => (
              <div
                key={label}
                role="row"
                className="col-span-full grid grid-cols-subgrid"
              >
                <span
                  role="rowheader"
                  className={cn(cell, 'text-lp-ink font-medium')}
                >
                  {label}
                </span>
                <span role="cell" className={cn(cell, 'text-lp-dim')}>
                  <Mark state="no" />
                  {a}
                </span>
                <span role="cell" className={cn(cell, 'text-lp-muted')}>
                  <Mark state={erpPartly[index] ? 'partly' : 'no'} />
                  {b}
                </span>
                <span
                  role="cell"
                  className={cn(
                    cell,
                    'text-lp-ink border-t-[rgba(255,106,26,0.18)] font-semibold',
                  )}
                >
                  <Mark state="yes" />
                  {ours}
                </span>
              </div>
            ))}
          </div>
        </div>
        <ul
          role="list"
          className="m-0 flex list-none flex-col gap-3 p-0 sm:hidden"
        >
          {rows.map(([label, a, b, ours]) => (
            <li
              key={label}
              className="bg-lp-surface flex flex-col gap-3 rounded-[20px] border border-white/[0.08] p-5"
            >
              <span className="text-lp-ink text-[17px] leading-[1.35] font-semibold">
                {label}
              </span>
              <dl className="m-0 flex flex-col gap-3 text-[15px]">
                {[
                  [excel, a],
                  [erp, b],
                ].map(([name, value]) => (
                  <div key={name} className="flex justify-between gap-3">
                    <dt className="text-lp-dim">{name}</dt>
                    <dd className="text-lp-muted m-0 text-right">{value}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 rounded-xl bg-[rgba(255,106,26,0.12)] px-3.5 py-3 font-semibold">
                  <dt className="text-lp-accent-hover">rozbirka</dt>
                  <dd className="text-lp-ink m-0 text-right">{ours}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <PrimaryLink to="/login">{t('heroCta')}</PrimaryLink>
          {supportHref && (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lp-ink hover:border-lp-accent-hover hover:text-lp-accent-hover flex h-14 items-center gap-2.5 rounded-full border border-white/20 pr-6 pl-4 text-[17px] font-semibold"
            >
              <TelegramIcon />
              {l('orderDemo')}
            </a>
          )}
        </div>
      </SectionInner>
    </section>
  )
}
