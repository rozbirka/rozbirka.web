import { useCallback, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'

/** Extend an existing link to a row's free space without hijacking its controls. */
export function useRowNavigation() {
  const navigate = useNavigate()
  return useCallback(
    (event: MouseEvent<HTMLElement>, href: string | null) => {
      if (
        href === null ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable]',
          ))
      )
        return
      void navigate(href)
    },
    [navigate],
  )
}
