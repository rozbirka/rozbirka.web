import { useEffect } from 'react'

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const nextFrame = (callback: () => void) =>
  requestAnimationFrame(() => requestAnimationFrame(callback))

/** Count-ups, bar fills and the chart line inside `root`, once each. */
function animate(root: Element, numberLocale: string) {
  root
    .querySelectorAll<HTMLElement>('[data-count]:not([data-done])')
    .forEach((element) => {
      element.setAttribute('data-done', '')
      const target = Number(element.dataset['count'])
      const decimals = Number(element.dataset['decimals'] ?? 0)
      const prefix = element.dataset['prefix'] ?? ''
      const suffix = element.dataset['suffix'] ?? ''
      const finalText = element.textContent
      const format = new Intl.NumberFormat(numberLocale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
      const start = performance.now()
      const duration = 1400
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - progress, 3)
        element.textContent =
          progress < 1
            ? `${prefix}${format.format(target * eased)}${suffix}`
            : finalText
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  root
    .querySelectorAll<SVGPathElement>('[data-draw]:not([data-done])')
    .forEach((path) => {
      path.setAttribute('data-done', '')
      const length = path.getTotalLength()
      path.style.strokeDasharray = String(length)
      path.style.strokeDashoffset = String(length)
      nextFrame(() => {
        path.style.transition =
          'stroke-dashoffset 1.8s cubic-bezier(.4,.1,.2,1)'
        path.style.strokeDashoffset = '0'
      })
    })
  root
    .querySelectorAll<SVGElement>('[data-fade]:not([data-done])')
    .forEach((element) => {
      element.setAttribute('data-done', '')
      element.style.opacity = '0'
      nextFrame(() => {
        element.style.transition = 'opacity 1.2s ease-out .8s'
        element.style.opacity = '1'
      })
    })
  root
    .querySelectorAll<HTMLElement>('[data-bar]:not([data-done])')
    .forEach((bar) => {
      bar.setAttribute('data-done', '')
      const width = bar.style.width
      bar.style.transition = 'none'
      bar.style.width = '0'
      nextFrame(() => {
        bar.style.transition = 'width 1.2s cubic-bezier(.2,.7,.2,1)'
        bar.style.width = width
      })
    })
}

/**
 * Motion of the landing mock-up: blocks marked `data-reveal` fade up when
 * they scroll into view and start their figures; module cards with
 * `data-spot` follow the pointer. Server HTML is the final state, so nothing
 * is hidden without JavaScript or with reduced motion.
 */
export function useLandingMotion(numberLocale: string) {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const card =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-spot]')
          : null
      if (!card) return
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
      card.style.setProperty('--my', `${event.clientY - rect.top}px`)
    }
    document.addEventListener('pointermove', onMove)

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      return () => document.removeEventListener('pointermove', onMove)
    }

    // Orange buttons lean towards the pointer.
    let magnet: HTMLElement | null = null
    const onMagnet = (event: PointerEvent) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('.lp-btn-glow')
          : null
      if (magnet && magnet !== button) {
        magnet.style.translate = ''
        magnet = null
      }
      if (!button) return
      const rect = button.getBoundingClientRect()
      const x = (event.clientX - rect.left - rect.width / 2) * 0.18
      const y = (event.clientY - rect.top - rect.height / 2) * 0.3
      button.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`
      magnet = button
    }
    document.addEventListener('pointermove', onMagnet)

    // The background glows drift with the scroll position (0–100).
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const max = document.documentElement.scrollHeight - innerHeight
        document.documentElement.style.setProperty(
          '--sy',
          ((scrollY / Math.max(1, max)) * 100).toFixed(2),
        )
      })
    }
    addEventListener('scroll', onScroll, { passive: true })

    const timers: number[] = []
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const element = entry.target as HTMLElement
          element.setAttribute('data-revealed', '')
          element.style.opacity = '1'
          element.style.transform = ''
          observer.unobserve(element)
          animate(element, numberLocale)
          timers.push(
            window.setTimeout(() => {
              element.style.transition = ''
            }, 1000),
          )
        }),
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
    )

    const top = document.getElementById('top')
    if (top) animate(top, numberLocale)
    const hidden: HTMLElement[] = []
    document
      .querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])')
      .forEach((element) => {
        if (element.getBoundingClientRect().top < window.innerHeight) {
          element.setAttribute('data-revealed', '')
          animate(element, numberLocale)
          return
        }
        hidden.push(element)
        const siblings = element.parentElement
          ? [...element.parentElement.children].indexOf(element) % 3
          : 0
        const delay = `${siblings * 90}ms`
        element.style.opacity = '0'
        element.style.transform = 'translateY(28px)'
        element.style.transition = `opacity .7s cubic-bezier(.2,.7,.2,1) ${delay}, transform .7s cubic-bezier(.2,.7,.2,1) ${delay}`
        observer.observe(element)
      })

    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointermove', onMagnet)
      removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      if (magnet) magnet.style.translate = ''
      document.documentElement.style.removeProperty('--sy')
      observer.disconnect()
      timers.forEach((timer) => window.clearTimeout(timer))
      // Blocks still waiting for the observer go back to their final state.
      hidden
        .filter((element) => !element.hasAttribute('data-revealed'))
        .forEach((element) => {
          element.style.opacity = ''
          element.style.transform = ''
          element.style.transition = ''
        })
    }
  }, [numberLocale])
}
