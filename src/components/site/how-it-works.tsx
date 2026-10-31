import { useT } from '@/i18n'
import { SectionInner, SectionTitle } from './landing-ui'
import { landingMessages, rowsOf } from './landing-messages'

/** Four steps from a bought batch to a sold part. */
export function HowItWorks() {
  const l = useT(landingMessages)
  const steps = rowsOf(l('steps'))
  return (
    <section id="how" data-reveal="" className="border-t border-white/[0.07]">
      <SectionInner>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionTitle className="max-w-[720px]">{l('howTitle')}</SectionTitle>
          <p className="text-lp-muted m-0 max-w-[380px] text-[18px] leading-[1.5] text-pretty">
            {l('howIntro')}
          </p>
        </div>
        <div
          className="-mb-10 h-0.5 overflow-hidden rounded-[2px] bg-white/[0.08]"
          aria-hidden
        >
          <div
            data-bar=""
            className="bg-lp-accent h-full"
            style={{ width: '100%' }}
          />
        </div>
        <ol
          role="list"
          className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4 p-0"
        >
          {steps.map(([tag, title, text], index) => (
            <li
              key={tag}
              className="bg-lp-surface flex min-h-[240px] flex-col gap-10 rounded-3xl border border-white/[0.07] p-7"
            >
              <div className="flex items-center justify-between">
                <span className="font-unbounded text-lp-accent text-[15px] font-semibold tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-lp-muted text-[14px]">{tag}</span>
              </div>
              <div className="mt-auto flex flex-col gap-2.5">
                <h3 className="font-unbounded m-0 text-[22px] font-semibold tracking-[-0.02em]">
                  {title}
                </h3>
                <p className="text-lp-muted m-0 text-[16px] leading-[1.5] text-pretty">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </SectionInner>
    </section>
  )
}
