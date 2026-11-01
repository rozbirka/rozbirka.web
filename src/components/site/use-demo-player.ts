import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

/** Every chapter of a demo lasts this long; the clock ticks every 100 ms. */
export const CHAPTER_SECONDS = 7
const TICK_MS = 100
const STEP = TICK_MS / 1000 / CHAPTER_SECONDS

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const reducedMotionSnapshot = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION).matches

/** `prefers-reduced-motion`, `false` on the server and during hydration. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false,
  )
}

interface PlayerState {
  step: number
  /** Progress inside the current chapter, 0…1. */
  t: number
  /**
   * `false` while the server frame (chapter 0 finished, `t = 1`) is shown;
   * the first visible tick rewinds it to the start.
   */
  started: boolean
  /** Explicit play/pause of the visitor; `null` follows reduced motion. */
  choice: boolean | null
}

export interface DemoPlayer {
  step: number
  t: number
  playing: boolean
  chapters: number
  toggle: () => void
  select: (step: number) => void
}

/**
 * Clock of a chaptered demo. The first render (server, hydration, reduced
 * motion) shows the finished first chapter; after mount it plays chapter by
 * chapter while `card` is on screen and the tab is not hidden (keep the
 * card element in state: `const [card, setCard] = useState(null)` and pass
 * `setCard` as its ref).
 */
export function useDemoPlayer(
  chapters: number,
  card: HTMLElement | null,
): DemoPlayer {
  const visible = useRef(false)
  const reducedMotion = usePrefersReducedMotion()
  const [state, setState] = useState<PlayerState>({
    step: 0,
    t: 1,
    started: false,
    choice: null,
  })
  const playing = state.choice ?? !reducedMotion

  useEffect(() => {
    if (!card || typeof IntersectionObserver === 'undefined') {
      visible.current = true
      return
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.current = entry.isIntersecting
    })
    observer.observe(card)
    return () => observer.disconnect()
  }, [card])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      if (!visible.current || document.hidden) return
      setState((current) => {
        if (!current.started) return { ...current, t: 0, started: true }
        const t = current.t + STEP
        return t >= 1 - 1e-9
          ? { ...current, t: 0, step: (current.step + 1) % chapters }
          : { ...current, t }
      })
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [playing, chapters])

  const toggle = useCallback(
    () => setState((current) => ({ ...current, choice: !playing })),
    [playing],
  )
  const select = useCallback(
    (step: number) => setState({ step, t: 0, started: true, choice: true }),
    [],
  )

  return {
    step: state.step,
    t: state.t,
    playing,
    chapters,
    toggle,
    select,
  }
}

/** Text of the last caption whose moment (0…1 of the chapter) has come. */
export function captionAt(t: number, moments: number[], texts: string[]) {
  let text = texts[0] ?? ''
  moments.forEach((moment, index) => {
    if (t >= moment) text = texts[index] ?? text
  })
  return text
}

/** Part of `text` typed between moments `from` and `to` of the chapter. */
export function typed(text: string, t: number, from: number, to: number) {
  const progress = Math.max(0, Math.min(1, (t - from) / (to - from)))
  return text.slice(0, Math.round(progress * text.length))
}

/** Ease-in-out between path points (as in the mock-up). */
export function ease(u: number) {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
}

/**
 * Position along a path of `[moment, ...point]` keys, eased between keys.
 * `point` is anything `mix` can blend (percent pairs, measured pixels…).
 */
export function along<P>(
  path: readonly (readonly [number, P])[],
  t: number,
  mix: (from: P, to: P, amount: number) => P,
): P {
  const first = path[0]
  if (!first) throw new Error('empty path')
  let point = first[1]
  for (let index = 1; index < path.length; index++) {
    const [t0, from] = path[index - 1]!
    const [t1, to] = path[index]!
    if (t <= t1) {
      const u = t1 > t0 ? Math.max(0, (t - t0) / (t1 - t0)) : 1
      return mix(from, to, ease(u))
    }
    point = to
  }
  return point
}

/** True for a short while after any of the `moments`. */
export function around(t: number, moments: number[], width: number) {
  return moments.some((moment) => t >= moment && t < moment + width)
}
