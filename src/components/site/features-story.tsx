import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { featuresMessages } from './features-messages'
import { featuresStoryMessages } from './features-story-messages'
import { listOf, rowsOf } from './landing-messages'
import { pad, storyModules, type Tone } from './features-story-data'

/** Modules available on the phone as well. */
const onPhone: ReadonlySet<string> = new Set(['parts', 'stickers'])

const pill: Record<Tone, string> = {
  g: 'bg-[#e6f4ea] text-[#1a6b3a]',
  y: 'bg-[#fbf0dc] text-[#9a5b05]',
  r: 'bg-[#fde8e8] text-[#c62828]',
  b: 'bg-[#e7eefc] text-[#2a5bd7]',
}

const ease = 'cubic-bezier(.2,.8,.2,1)'
const mono = '[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'

/**
 * Every 2.6 s the newest event of the window moves on, while the window is on
 * screen and the tab visible. Reduced motion keeps the first frame.
 */
function useLiveTick(ref: React.RefObject<HTMLElement | null>) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (
      !element ||
      !('IntersectionObserver' in window) ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    )
      return
    let visible = false
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
    })
    observer.observe(element)
    const timer = window.setInterval(() => {
      if (visible && !document.hidden) setTick((value) => value + 1)
    }, 2600)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [ref])
  return tick
}

/**
 * Decorative white CRM window next to the module steps: address bar, module
 * header, KPI with bar, live events and two more benefits of the module.
 * `animate` is false until the visitor first moves to another module, so the
 * server HTML and the first paint show the final frame.
 */
export function FeaturesStoryWindow({
  active,
  animate,
}: {
  active: number
  animate: boolean
}) {
  const t = useT(featuresMessages)
  const s = useT(featuresStoryMessages)
  const ref = useRef<HTMLDivElement>(null)
  const tick = useLiveTick(ref)
  const module = storyModules[active] ?? storyModules[0]
  const [kLabel, kValue] = s(`${module.id}Kpi`).split('=')
  const events = rowsOf(s(`${module.id}Events`)).map((row, index) => ({
    row,
    tone: module.tones[index] ?? 'g',
  }))
  const times = listOf(s('times'))
  const moving = animate || tick > 0
  const n = pad(active)
  return (
    <div
      ref={ref}
      data-story-window=""
      aria-hidden="true"
      className="sticky top-[max(88px,calc(50vh-295px))] max-[900px]:top-16 max-[900px]:z-[3] max-[900px]:order-first"
    >
      <div className="flex h-[600px] flex-col overflow-hidden rounded-[18px] border border-[rgba(255,255,255,.14)] bg-white text-[#151413] shadow-[0_40px_90px_-30px_rgba(0,0,0,.7),0_0_0_6px_rgba(255,255,255,.03)] max-[900px]:h-[min(400px,52vh)]">
        <div className="flex h-[42px] flex-none items-center gap-3 border-b border-[#e7e4de] bg-[#f3f1ed] px-3.5">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-2.5 rounded-full bg-[#e2ded7]" />
            ))}
          </span>
          <span
            className={cn(
              'mx-auto flex h-[26px] max-w-[260px] flex-1 items-center justify-center gap-1.5 rounded-[7px] border border-[#e7e4de] bg-white text-[12px] text-[#67635d]',
              mono,
            )}
          >
            <span className="size-2 rounded-[2px] bg-[#ff6a1a]" />
            {`rozbirka.pro/${module.slug}`}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-[9px] py-1 text-[11px] font-bold tracking-[0.06em] text-[#1a6b3a]">
            <span
              className="size-1.5 rounded-full bg-[#1e9e55]"
              style={{ animation: 'lp-pulse 1.2s ease-in-out infinite' }}
            />
            LIVE
          </span>
        </div>
        <div
          key={active}
          className="flex min-h-0 flex-1 flex-col"
          style={
            animate ? { animation: `lp-story-in .5s ${ease} both` } : undefined
          }
        >
          <div className="flex flex-none items-center gap-3.5 px-5 pt-[18px] pb-3.5">
            <span
              className={cn(
                'flex size-11 flex-none items-center justify-center rounded-[12px] bg-[#151413] text-[14px] font-bold text-[#ff6a1a]',
                mono,
              )}
            >
              {n}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-unbounded text-[22px] leading-[1.1] font-semibold tracking-[-0.03em]">
                {t(`${module.id}Title`)}
              </span>
              <span className="text-[12px] text-[#67635d]">
                {s(onPhone.has(module.id) ? 'whereWebPhone' : 'whereWeb')}
              </span>
            </span>
            <span className={cn('flex-none text-[12px] text-[#6f6b64]', mono)}>
              {`${n} / ${storyModules.length}`}
            </span>
          </div>
          <div className="mx-5 flex flex-none flex-col gap-2.5 rounded-[12px] border border-[#eeebe6] bg-[#f6f5f2] px-4 py-3.5">
            <span className="text-[12px] text-[#67635d]">{kLabel}</span>
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'text-[24px] font-semibold tracking-[-0.03em] whitespace-nowrap',
                  mono,
                )}
              >
                {kValue}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#e6e2db]">
                <div
                  className="h-full origin-left rounded-[3px] bg-[linear-gradient(90deg,#1e9e55,#1a6b3a)]"
                  style={{
                    width: `${module.pct}%`,
                    animation: animate
                      ? `lp-tab-prog 1.1s ${ease} .15s both`
                      : undefined,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-none items-center justify-between px-5 pt-[18px] pb-2 text-[11px] font-semibold tracking-[0.08em] text-[#6f6b64] uppercase">
            <span>{s('events')}</span>
            <span className="font-medium tracking-normal normal-case">
              {s('live')}
            </span>
          </div>
          <div className="flex flex-none flex-col px-3">
            {[0, 1, 2, 3].map((place) => {
              const index = (((tick - place) % 4) + 4) % 4
              const event = events[index]
              if (!event) return null
              const [title, meta, status] = event.row
              const first = place === 0
              return (
                <div
                  key={`${active}-${tick}-${place}`}
                  className={cn(
                    'grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] px-2 py-2.5 text-[13px]',
                    first && 'bg-[rgba(255,106,26,.05)]',
                    place === 3 && 'opacity-55',
                  )}
                  style={
                    moving
                      ? {
                          animation: first
                            ? `lp-feed-in 1.6s ${ease} both`
                            : `lp-feed-slide .45s ${ease} both`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      'text-[11px]',
                      mono,
                      first ? 'text-[#b03a0a]' : 'text-[#6f6b64]',
                    )}
                  >
                    {times[place]}
                  </span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="truncate font-medium">{title}</span>
                    <span className="truncate text-[11px] text-[#67635d]">
                      {meta}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] whitespace-nowrap',
                      pill[event.tone],
                    )}
                  >
                    <span className="size-[5px] rounded-full bg-current" />
                    {status}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex-1" />
          <div className="flex flex-none flex-wrap gap-1.5 border-t border-[#f1eee9] px-5 pt-3.5 pb-[18px]">
            {([2, 3] as const).map((bullet) => (
              <span
                key={bullet}
                className="flex items-center gap-1.5 rounded-[8px] bg-[#f6f5f2] px-2.5 py-1.5 text-[12px] leading-[1.3] text-[#2b2926]"
              >
                <span className="font-bold text-[#1a6b3a]">✓</span>
                {t(`${module.id}${bullet}`)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
