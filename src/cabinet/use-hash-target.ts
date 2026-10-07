import { useEffect } from 'react'
import { useLocation } from 'react-router'

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/** How long a section that renders after its data loads is waited for. */
const WAIT_MS = 5000

/**
 * Bring the section named by the URL fragment into view and focus its first
 * field, so a link such as `…/settings/business#region` opens that form, not
 * the top of the page. The router does not do this by itself, and the section
 * may only appear once the screen's data has loaded, so it is waited for.
 * Without a matching element nothing happens.
 */
export function useHashTarget() {
  const { hash } = useLocation()

  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''))
    if (id === '') return
    let observer: MutationObserver | null = null

    const reveal = () => {
      const target = document.getElementById(id)
      if (target === null) return false
      const field = target.querySelector<HTMLElement>(FOCUSABLE)
      const reduceMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      target.scrollIntoView?.({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      })
      if (field !== null) {
        field.focus({ preventScroll: true })
      } else {
        if (!target.hasAttribute('tabindex'))
          target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
      }
      return true
    }

    if (reveal()) return
    observer = new MutationObserver(() => {
      if (reveal()) observer?.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setTimeout(() => observer?.disconnect(), WAIT_MS)
    return () => {
      window.clearTimeout(timer)
      observer?.disconnect()
    }
  }, [hash])
}
