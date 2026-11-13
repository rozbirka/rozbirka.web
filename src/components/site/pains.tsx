import { useEffect, useRef } from 'react'
import { useT } from '@/i18n'
import { Eyebrow, PrimaryLink } from './landing-ui'
import { landingMessages, rowsOf } from './landing-messages'
import { siteMessages } from './site-messages'

/**
 * Fades each pain's fix in once the row scrolls into the upper part of the
 * viewport. Without the effect (server HTML, reduced motion) the rows simply
 * show both lines.
 */
function useFixOnScroll() {
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const element = list.current
    if (
      !element ||
      !('IntersectionObserver' in window) ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    )
      return
    element.setAttribute('data-arm', '')
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.setAttribute('data-go', '')
          observer.unobserve(entry.target)
        }),
      { rootMargin: '0px 0px -30% 0px' },
    )
    element
      .querySelectorAll('[data-pain]')
      .forEach((row) => observer.observe(row))
    return () => {
      observer.disconnect()
      element.removeAttribute('data-arm')
    }
  }, [])
  return list
}

/** «Знайомо?»: today's pains, each answered by the same job in rozbirka. */
export function Pains() {
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const pains = rowsOf(l('pains'))
  const list = useFixOnScroll()
  return (
    <section id="pain" data-reveal="">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-6 pt-28 pb-24 max-sm:gap-10 max-sm:px-5 max-sm:py-16">
        <div className="flex max-w-[820px] flex-col gap-6">
          <Eyebrow>{l('painEyebrow')}</Eyebrow>
          <h2 className="font-unbounded m-0 text-[clamp(30px,3.6vw,48px)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
            {l('painTitle')}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <PrimaryLink to="/login?purpose=registration">
              {t('heroCta')}
            </PrimaryLink>
            <span className="text-lp-muted text-[15px]">{l('trialNote')}</span>
          </div>
        </div>
        <ol
          ref={list}
          data-pains=""
          role="list"
          className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-12 p-0"
        >
          {pains.map(([before, after], index) => (
            <li
              key={before}
              data-pain=""
              className="grid grid-cols-[52px_minmax(0,1fr)] gap-5 border-t border-white/[0.08] py-7"
            >
              <span
                className="font-unbounded text-lp-accent pt-1 text-[15px] font-semibold"
                aria-hidden
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-col gap-3.5">
                <p className="text-lp-bullet m-0 text-[clamp(18px,1.8vw,22px)] leading-[1.45] text-pretty italic">
                  «{before}»
                </p>
                <p data-sol="" className="m-0 flex items-start gap-3">
                  <span
                    className="bg-lp-accent text-lp-bg flex size-[26px] flex-none items-center justify-center rounded-full text-[13px] font-bold"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="text-lp-ink pt-0.5 text-[17px] leading-[1.45] font-semibold">
                    {after}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
