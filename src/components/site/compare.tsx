import { useT } from '@/i18n'
import {
  Eyebrow,
  PrimaryLink,
  SectionInner,
  SectionTitle,
  TelegramIcon,
} from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages, listOf, rowsOf } from './landing-messages'
import { siteMessages } from './site-messages'

const cell = 'border-t border-white/[0.07] px-6 py-[18px] text-left align-top'

/** «Порівняння»: Excel and a generic ERP against rozbirka. */
export function Compare() {
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const supportHref = useSupportHref()
  const [excel, erp] = listOf(l('compareCols'))
  const rows = rowsOf(l('compare'))
  return (
    <section
      id="compare"
      data-reveal=""
      className="border-t border-white/[0.07]"
    >
      <SectionInner>
        <div className="flex max-w-[820px] flex-col gap-5">
          <Eyebrow>{l('compareEyebrow')}</Eyebrow>
          <SectionTitle>{l('compareTitle')}</SectionTitle>
        </div>
        <div className="bg-lp-surface overflow-x-auto rounded-[28px] border border-white/[0.08]">
          <table className="w-full min-w-[720px] border-collapse text-[16px]">
            <colgroup>
              <col className="w-[33%]" />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <td className="px-6 py-5" />
                <th
                  scope="col"
                  className="text-lp-soft px-6 py-5 text-left font-semibold"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="bg-lp-excel font-unbounded flex size-7 flex-none items-center justify-center rounded-lg text-[13px] font-bold tracking-[-0.02em] text-white"
                      aria-hidden
                    >
                      X
                    </span>
                    {excel}
                  </span>
                </th>
                <th
                  scope="col"
                  className="text-lp-soft px-6 py-5 text-left font-semibold"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="bg-lp-chip text-lp-muted font-unbounded flex size-7 flex-none items-center justify-center rounded-lg text-[8px] font-bold tracking-[-0.02em]"
                      aria-hidden
                    >
                      ERP
                    </span>
                    {erp}
                  </span>
                </th>
                <th
                  scope="col"
                  className="text-lp-accent-hover bg-[rgba(255,106,26,0.12)] px-6 py-5 text-left font-semibold"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="bg-lp-accent flex size-7 flex-none items-center justify-center rounded-lg"
                      aria-hidden
                    >
                      <span className="bg-lp-bg size-2.5 rounded-[2px]" />
                    </span>
                    <span className="font-unbounded">rozbirka</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b, c]) => (
                <tr key={label}>
                  <th scope="row" className={`${cell} text-lp-ink font-normal`}>
                    {label}
                  </th>
                  <td className={`${cell} text-lp-dim`}>{a}</td>
                  <td className={`${cell} text-lp-dim`}>{b}</td>
                  <td
                    className={`${cell} text-lp-ink bg-[rgba(255,106,26,0.06)] font-medium`}
                  >
                    {c}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
