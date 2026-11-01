import type { CSSProperties, ReactNode, Ref } from 'react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { demoMessages } from './demo-messages'
import { CHAPTER_SECONDS, type DemoPlayer } from './use-demo-player'
import './demo-player.css'

function fill(player: DemoPlayer, index: number) {
  if (index < player.step) return '100%'
  if (index === player.step) return `${(player.t * 100).toFixed(1)}%`
  return '0%'
}

function clock(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** Numbered chapter buttons with a progress line under each title. */
export function DemoChapters({
  player,
  titles,
}: {
  player: DemoPlayer
  titles: string[]
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
      {titles.map((title, index) => {
        const active = index === player.step
        return (
          <li key={title}>
            <button
              type="button"
              onClick={() => player.select(index)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'focus-visible:outline-lp-accent grid w-full cursor-pointer grid-cols-[36px_minmax(0,1fr)] gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-[background] duration-[250ms] focus-visible:outline-2',
                active
                  ? 'bg-[rgba(255,106,26,0.08)]'
                  : 'bg-transparent hover:bg-white/[0.04]',
              )}
            >
              <span
                className={cn(
                  'font-unbounded pt-0.5 text-[14px] font-semibold',
                  active ? 'text-lp-accent' : 'text-lp-dim',
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex min-w-0 flex-col gap-2">
                <span
                  className={cn(
                    'text-[17px] font-semibold',
                    active ? 'text-lp-ink' : 'text-lp-muted',
                  )}
                >
                  {title}
                </span>
                <span
                  className="h-0.5 overflow-hidden rounded-[2px] bg-white/[0.08]"
                  aria-hidden
                >
                  <span
                    className="bg-lp-accent block h-full transition-[width] duration-100 ease-linear"
                    style={{ width: fill(player, index) }}
                  />
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Card of a «LIVE ДЕМО» (white inside a light chapter): title bar, the animated fake screen (hidden
 * from assistive technology, the chapter buttons carry the story) and the
 * play/pause controls with chapter progress and the clock.
 */
export function DemoPlayerCard({
  player,
  cardRef,
  title,
  className,
  screenClassName,
  screenRef,
  children,
}: {
  player: DemoPlayer
  /** Usually the state setter whose value goes to `useDemoPlayer`. */
  cardRef: Ref<HTMLDivElement>
  title: string
  className?: string
  screenClassName?: string
  screenRef?: Ref<HTMLDivElement>
  children: ReactNode
}) {
  const d = useT(demoMessages)
  const total = player.chapters * CHAPTER_SECONDS
  const elapsed = (player.step + player.t) * CHAPTER_SECONDS
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={d('demoLabel', { title })}
      className={cn('lp-glass min-w-0 overflow-hidden rounded-3xl', className)}
    >
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3 text-[13px]">
        <span className="text-lp-accent flex items-center gap-1.5 font-bold tracking-[0.06em] whitespace-nowrap">
          <span
            className="lp-demo-live size-[7px] rounded-full bg-[#ff3b30]"
            aria-hidden
          />
          {d('live')}
        </span>
        <span className="text-lp-dim" aria-hidden>
          ·
        </span>
        <span className="text-lp-soft truncate">{title}</span>
      </div>
      <div
        ref={screenRef}
        aria-hidden
        className={cn(
          'relative overflow-hidden bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,106,26,0.06),transparent),var(--color-lp-surface)]',
          screenClassName,
        )}
      >
        {children}
      </div>
      <div className="flex items-center gap-3.5 border-t border-white/[0.07] px-4 py-3">
        <button
          type="button"
          onClick={player.toggle}
          aria-label={player.playing ? d('pause') : d('play')}
          className="bg-lp-accent hover:bg-lp-accent-hover focus-visible:outline-lp-accent flex size-9 flex-none cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            {player.playing ? (
              <>
                <rect
                  x="3"
                  y="2"
                  width="3.5"
                  height="12"
                  rx="1"
                  fill="#0b0b0b"
                />
                <rect
                  x="9.5"
                  y="2"
                  width="3.5"
                  height="12"
                  rx="1"
                  fill="#0b0b0b"
                />
              </>
            ) : (
              <path d="M4 2.5v11l9.5-5.5z" fill="#0b0b0b" />
            )}
          </svg>
        </button>
        <div
          className="grid flex-1 gap-1"
          style={{
            gridTemplateColumns: `repeat(${player.chapters},minmax(0,1fr))`,
          }}
          aria-hidden
        >
          {Array.from({ length: player.chapters }, (_, index) => (
            <span
              key={index}
              className="h-1 overflow-hidden rounded-[2px] bg-white/10"
            >
              <span
                className="bg-lp-accent block h-full transition-[width] duration-100 ease-linear"
                style={{ width: fill(player, index) }}
              />
            </span>
          ))}
        </div>
        <span
          className="text-lp-dim flex-none text-[13px] tabular-nums"
          aria-hidden
        >
          {`${clock(elapsed)} / ${clock(total)}`}
        </span>
      </div>
    </div>
  )
}

/** Caption chip at the bottom of the screen; a new text animates in. */
export function DemoCaption({ step, text }: { step: number; text: string }) {
  return (
    <div key={`${step}:${text}`} className="lp-demo-cap" aria-live="off">
      {text}
    </div>
  )
}

/**
 * Fake mouse pointer (`data-cursor`); `click` shows the orange impact ring.
 */
export function DemoCursor({
  click,
  style,
  className,
}: {
  click: boolean
  style?: CSSProperties
  className?: string
}) {
  return (
    <span
      data-cursor=""
      className={cn(
        'pointer-events-none absolute z-[5] size-[22px] drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]',
        className,
      )}
      style={style}
    >
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          d="M3 2l17 9-7.5 1.8L9 20z"
          fill="#fff"
          stroke="#0b0b0b"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {click && (
        <span className="lp-demo-impact border-lp-accent absolute -top-3 -left-3 size-7 rounded-full border-2" />
      )}
    </span>
  )
}
