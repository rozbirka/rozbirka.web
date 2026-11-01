import { useEffect, useRef } from 'react'
import { useT } from '@/i18n'
import { SectionInner, SectionTitle } from './landing-ui'
import { landingMessages, rowsOf } from './landing-messages'

const node =
  'font-unbounded text-lp-accent-hover border-lp-accent flex flex-none items-center justify-center rounded-full border-[1.5px] bg-[rgba(255,106,26,0.1)] font-semibold tabular-nums'
const fill = 'block bg-[linear-gradient(var(--fill-dir),#ff6a1a,#ffb070)]'

/**
 * Lights the step nodes and fills the lines between them as the steps scroll
 * through the viewport. The server HTML and reduced motion show every step
 * lit.
 */
function useStepProgress() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = root.current
    if (
      !element ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    )
      return
    const update = () => {
      element.querySelectorAll<HTMLElement>('[data-steps]').forEach((steps) => {
        if (!steps.offsetParent) return
        const vertical = steps.dataset['steps'] === 'vertical'
        const rect = steps.getBoundingClientRect()
        const progress = Math.min(
          1,
          Math.max(
            0,
            vertical
              ? (innerHeight * 0.72 - rect.top) / rect.height
              : (innerHeight * 0.85 - rect.top) / (innerHeight * 0.5),
          ),
        )
        const nodes = steps.querySelectorAll('[data-node]')
        const position = progress * nodes.length
        nodes.forEach((item, index) =>
          item.toggleAttribute('data-on', position >= index + 0.15),
        )
        steps
          .querySelectorAll<HTMLElement>('[data-fill]')
          .forEach((line, index) => {
            const value = Math.min(
              1,
              Math.max(0, (position - index - 0.15) / 0.85),
            )
            line.style.transform = `${vertical ? 'scaleY' : 'scaleX'}(${value.toFixed(3)})`
          })
      })
    }
    update()
    addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    return () => {
      removeEventListener('scroll', update)
      removeEventListener('resize', update)
    }
  }, [])
  return root
}

/** «Шлях однієї деталі»: four steps of one headlight, from VIN to profit. */
export function HowItWorks() {
  const l = useT(landingMessages)
  const steps = rowsOf(l('steps'))
  const root = useStepProgress()
  return (
    <section id="how" data-reveal="" className="lp-surface lp-island">
      <SectionInner>
        <div className="flex flex-col items-center gap-5 text-center">
          <SectionTitle className="w-full">{l('howTitle')}</SectionTitle>
          <p className="text-lp-muted m-0 max-w-[380px] text-[18px] leading-[1.5] text-pretty">
            {l('howIntro')}
          </p>
        </div>
        <div ref={root}>
          {/* Phones: a vertical timeline. */}
          <ol
            role="list"
            data-steps="vertical"
            className="m-0 flex list-none flex-col p-0 sm:hidden"
          >
            {steps.map(([tag, title, text], index) => (
              <li
                key={tag}
                className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-4"
              >
                <div className="flex flex-col items-center">
                  <span
                    data-node=""
                    data-on=""
                    className={`${node} size-12 text-[14px]`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {index < steps.length - 1 && (
                    <span
                      className="my-2 block min-h-6 w-0.5 flex-1 overflow-hidden rounded-[2px] bg-white/[0.08]"
                      aria-hidden
                    >
                      <span
                        data-fill=""
                        className={`${fill} size-full origin-top transition-transform duration-[350ms] ease-out [--fill-dir:180deg]`}
                      />
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 pt-1 pb-8">
                  <span className="text-lp-dim text-[12px] font-semibold tracking-[0.08em] uppercase">
                    {tag}
                  </span>
                  <h3 className="font-unbounded m-0 text-[20px] font-semibold tracking-[-0.02em]">
                    {title}
                  </h3>
                  <p className="text-lp-muted m-0 text-[16px] leading-[1.5] text-pretty">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <ol
            role="list"
            data-steps="horizontal"
            className="m-0 grid list-none grid-cols-4 gap-x-0 gap-y-12 p-0 max-[960px]:grid-cols-2 max-sm:hidden"
          >
            {steps.map(([tag, title, text], index) => (
              <li key={tag} data-reveal="" className="flex flex-col gap-6 pr-7">
                <div className="flex items-center gap-3.5">
                  <span
                    data-node=""
                    data-on=""
                    className={`${node} size-[60px] text-[16px]`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {index < steps.length - 1 && (
                    <span
                      className="h-0.5 flex-1 overflow-hidden rounded-[2px] bg-white/[0.08]"
                      aria-hidden
                    >
                      <span
                        data-fill=""
                        className={`${fill} h-full origin-left transition-transform duration-[350ms] ease-out [--fill-dir:90deg]`}
                      />
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  <span className="text-lp-dim text-[12px] font-semibold tracking-[0.08em] uppercase">
                    {tag}
                  </span>
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
        </div>
      </SectionInner>
    </section>
  )
}
