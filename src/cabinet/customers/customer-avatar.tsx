import type { CSSProperties } from 'react'

const avatarPalette = [
  { background: '#3b2318', foreground: '#ff7a2f' },
  { background: '#172d3d', foreground: '#61b7ed' },
  { background: '#173328', foreground: '#55cf91' },
  { background: '#2c2342', foreground: '#b69af8' },
  { background: '#3b202b', foreground: '#fb8299' },
  { background: '#392e17', foreground: '#f6c64f' },
  { background: '#16343a', foreground: '#55d5e5' },
  { background: '#3a2020', foreground: '#f98a7b' },
] as const

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '—'

const paletteIndex = (key: string) => {
  let hash = 0
  for (const character of key) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0
  }
  return hash % avatarPalette.length
}

export function CustomerAvatar({
  customerId,
  name,
  className,
}: {
  customerId: string
  name: string
  className: string
}) {
  const tone = avatarPalette[paletteIndex(customerId || name)]!
  const style = {
    '--customer-avatar-bg': tone.background,
    '--customer-avatar-fg': tone.foreground,
  } as CSSProperties

  return (
    <span aria-hidden className={className} style={style}>
      {initials(name)}
    </span>
  )
}
