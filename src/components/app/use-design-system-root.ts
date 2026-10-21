import { useEffect } from 'react'

let holders = 0

/**
 * Puts the design system root (`.rz`) on `<body>` while a cabinet or account
 * screen is mounted. Dialogs, menus and toasts portal into `<body>`, outside
 * the screen's own `.rz` wrapper; this keeps their font, colours and focus
 * ring the system's. The landing never mounts it, so its body stays its own.
 */
export function useDesignSystemRoot() {
  useEffect(() => {
    holders += 1
    document.body.classList.add('rz')
    return () => {
      holders -= 1
      if (holders === 0) document.body.classList.remove('rz')
    }
  }, [])
}
