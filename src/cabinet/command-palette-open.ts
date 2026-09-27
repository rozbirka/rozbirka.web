/**
 * The palette opens on Cmd+K, which is invisible to anyone who has not been
 * told. The dashboard puts a search field in its header that opens the same
 * thing, and this is how it asks — an event rather than a context, because the
 * palette is mounted once in the shell and nothing else needs to know it
 * exists.
 */
const EVENT = 'cabinet:open-command-palette'

export const openCommandPalette = () => {
  window.dispatchEvent(new CustomEvent(EVENT))
}

export const onOpenCommandPalette = (open: () => void) => {
  window.addEventListener(EVENT, open)
  return () => window.removeEventListener(EVENT, open)
}

/**
 * What the shortcut is called on this keyboard. The palette itself accepts
 * both modifiers; only the hint has to pick one.
 */
export const commandPaletteHint = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl K'
