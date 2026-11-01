import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { Eyebrow, SectionInner, SectionTitle } from './landing-ui'
import { featuresMessages } from './features-messages'
import { FeaturesStoryWindow } from './features-story'
import { pad, storyModules } from './features-story-data'

/** Index of the first module of each group (`group<n>Title`). */
const groupStarts = new Map<
  number,
  'group1Title' | 'group2Title' | 'group3Title'
>([
  [0, 'group1Title'],
  [6, 'group2Title'],
  [11, 'group3Title'],
] as const)

/**
 * The step whose middle is closest to the reading line (half the viewport,
 * 72 % on narrow screens below the sticky window) lights up. Scroll is only
 * listened to while the section is on screen.
 */
function useActiveStep(
  sectionRef: React.RefObject<HTMLElement | null>,
  listRef: React.RefObject<HTMLOListElement | null>,
) {
  const [active, setActive] = useState(0)
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    const section = sectionRef.current
    const list = listRef.current
    if (!section || !list) return
    let frame = 0
    let current = 0
    const measure = () => {
      frame = 0
      const line = innerHeight * (innerWidth < 900 ? 0.72 : 0.5)
      let best = 0
      let distance = Infinity
      Array.from(list.children).forEach((step, index) => {
        const rect = step.getBoundingClientRect()
        const d = Math.abs(rect.top + rect.height / 2 - line)
        if (d < distance) {
          distance = d
          best = index
        }
      })
      if (best !== current) {
        current = best
        setActive(best)
        setMoved(true)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    let listening = false
    const listen = (on: boolean) => {
      if (on === listening) return
      listening = on
      if (on) {
        addEventListener('scroll', onScroll, { passive: true })
        addEventListener('resize', onScroll)
        onScroll()
      } else {
        removeEventListener('scroll', onScroll)
        removeEventListener('resize', onScroll)
      }
    }
    let observer: IntersectionObserver | undefined
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) =>
        listen(Boolean(entry?.isIntersecting)),
      )
      observer.observe(section)
    } else listen(true)
    return () => {
      observer?.disconnect()
      listen(false)
      cancelAnimationFrame(frame)
    }
  }, [sectionRef, listRef])
  return { active, moved }
}

/**
 * «Можливості»: a scroll story. Thirteen module steps (the real content, all
 * in the DOM) light up one by one while a sticky, decorative CRM window shows
 * the active module.
 */
export function Features() {
  const t = useT(featuresMessages)
  const sectionRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const { active, moved } = useActiveStep(sectionRef, listRef)
  return (
    <section id="features" ref={sectionRef} className="overflow-x-clip">
      <SectionInner>
        <div
          data-reveal=""
          className="flex flex-col items-center gap-5 text-center"
        >
          <div className="flex justify-center">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
          </div>
          <SectionTitle className="w-full">{t('title')}</SectionTitle>
          <p className="text-lp-muted m-0 max-w-[440px] text-[18px] leading-[1.5] text-pretty">
            {t('intro')}
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,.9fr)_minmax(0,1.2fr)] items-start gap-14 max-[900px]:grid-cols-1 max-[900px]:gap-0">
          <ol
            ref={listRef}
            role="list"
            className="m-0 flex list-none flex-col p-0 max-[900px]:relative max-[900px]:z-[1]"
          >
            {storyModules.map(({ id }, index) => {
              const on = index === active
              const group = groupStarts.get(index)
              return (
                <li
                  key={id}
                  data-active={on || undefined}
                  className="flex min-h-[44vh] flex-col justify-center gap-2.5 max-[900px]:min-h-[38vh] max-[900px]:justify-start max-[900px]:pt-5"
                >
                  {group && (
                    <h3
                      className={cn(
                        'm-0 pb-1.5 [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[12px] font-normal tracking-[0.06em] uppercase transition-colors duration-350 ease-out',
                        on ? 'text-lp-accent-hover' : 'text-[#7e7c77]',
                      )}
                    >
                      {t(group)}
                    </h3>
                  )}
                  <div className="flex items-baseline gap-3.5">
                    <span
                      className={cn(
                        '[font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[14px] transition-colors duration-350 ease-out',
                        on ? 'text-[#8a8780]' : 'text-[#7e7c77]',
                      )}
                      aria-hidden
                    >
                      {pad(index)}
                    </span>
                    <h4
                      className={cn(
                        'font-unbounded m-0 text-[clamp(26px,2.8vw,40px)] leading-[1.05] font-semibold tracking-[-0.03em] transition-colors duration-350 ease-out',
                        on ? 'text-lp-ink' : 'text-[#6b6965]',
                      )}
                    >
                      {t(`${id}Title`)}
                    </h4>
                  </div>
                  <p
                    className={cn(
                      'm-0 ml-[38px] max-w-[380px] text-[17px] leading-[1.5] text-pretty transition-colors duration-350 ease-out max-[900px]:ml-0',
                      on ? 'text-lp-muted' : 'text-[#7e7c77]',
                    )}
                  >
                    {t(`${id}1`)}
                  </p>
                </li>
              )
            })}
          </ol>
          <FeaturesStoryWindow active={active} animate={moved} />
        </div>
      </SectionInner>
    </section>
  )
}
