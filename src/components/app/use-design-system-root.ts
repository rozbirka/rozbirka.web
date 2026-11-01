import { useLayoutEffect } from 'react'
import { useTheme } from './theme-preference'

let holders = 0
let previousTheme: string | undefined

/**
 * Puts the design system root (`.rz`) on `<body>` while a cabinet or account
 * screen is mounted. Dialogs, menus and toasts portal into `<body>`, outside
 * the screen's own `.rz` wrapper; this keeps their font, colours and focus
 * ring the system's. The landing never mounts it, so its body stays its own.
 */
export function useDesignSystemRoot() {
  const [theme] = useTheme()
  useLayoutEffect(() => {
    if (holders === 0) previousTheme = document.body.dataset['theme']
    holders += 1
    document.body.classList.add('rz')
    return () => {
      holders -= 1
      if (holders === 0) {
        document.body.classList.remove('rz')
        if (previousTheme === undefined) delete document.body.dataset['theme']
        else document.body.dataset['theme'] = previousTheme
      }
    }
  }, [])
  useLayoutEffect(() => {
    document.body.dataset['theme'] = theme
  }, [theme])
}
