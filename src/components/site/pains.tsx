import { useT } from '@/i18n'
import { Eyebrow, PrimaryLink, SectionInner, SectionTitle } from './landing-ui'
import { landingMessages, rowsOf } from './landing-messages'
import { siteMessages } from './site-messages'

/** «Знайомо?»: today's pains against the same job in rozbirka. */
export function Pains() {
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const pains = rowsOf(l('pains'))
  return (
    <section id="pain" data-reveal="" className="border-t border-white/[0.07]">
      <SectionInner>
        <div className="flex max-w-[820px] flex-col gap-5">
          <Eyebrow>{l('painEyebrow')}</Eyebrow>
          <SectionTitle>{l('painTitle')}</SectionTitle>
        </div>
        <table className="bg-lp-surface w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-[28px] border border-white/[0.08] max-sm:block max-sm:overflow-visible max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent">
          <thead className="max-sm:hidden">
            <tr className="text-lp-muted text-left text-[14px]">
              <th scope="col" className="px-7 py-[18px] font-normal">
                {l('painNow')}
              </th>
              <th
                scope="col"
                className="text-lp-accent-hover bg-[rgba(255,106,26,0.1)] px-7 py-[18px] font-semibold"
              >
                {l('painWith')}
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:flex max-sm:flex-col max-sm:gap-2.5">
            {pains.map(([before, after]) => (
              <tr
                key={before}
                data-reveal=""
                className="max-sm:bg-lp-surface max-sm:block max-sm:overflow-hidden max-sm:rounded-[18px] max-sm:border max-sm:border-white/[0.08]"
              >
                <td className="text-lp-muted border-t border-white/[0.07] px-7 py-[22px] align-top text-[17px] leading-[1.45] italic max-sm:block max-sm:border-t-0 max-sm:px-5 max-sm:pt-3.5 max-sm:pb-2.5 max-sm:text-[15px]">
                  <span className="flex gap-3">
                    <span className="flex-none not-italic" aria-hidden>
                      ✕
                    </span>
                    «{before}»
                  </span>
                </td>
                <td className="text-lp-ink border-t border-white/[0.07] bg-[rgba(255,106,26,0.06)] px-7 py-[22px] align-top text-[17px] leading-[1.45] max-sm:block max-sm:border-t-0 max-sm:px-5 max-sm:pt-3 max-sm:pb-3.5 max-sm:text-[16px]">
                  <span className="flex gap-3">
                    <span className="text-lp-accent flex-none" aria-hidden>
                      ✓
                    </span>
                    {after}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-4">
          <PrimaryLink to="/login" className="max-sm:w-full">
            {t('heroCta')}
          </PrimaryLink>
          <span className="text-lp-muted text-[15px]">{l('trialNote')}</span>
        </div>
      </SectionInner>
    </section>
  )
}
