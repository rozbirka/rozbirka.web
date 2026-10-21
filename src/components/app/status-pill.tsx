import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

const toneClass: Record<StatusTone, string> = {
  ok: 'rz-pill--ok',
  warn: 'rz-pill--warn',
  danger: 'rz-pill--danger',
  info: 'rz-pill--info',
  neutral: '',
}

/**
 * State always carries its label: colour alone would make the list unreadable
 * for anyone who cannot separate the hues.
 */
export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('rz-pill', toneClass[tone], className)}>
      {children}
    </span>
  )
}
