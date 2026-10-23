import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NoticeTone = 'info' | 'ok' | 'warn' | 'danger'

const toneClass: Record<NoticeTone, string> = {
  info: 'rz-notice--info',
  ok: 'rz-notice--ok',
  warn: 'rz-notice--warn',
  danger: 'rz-notice--danger',
}

const toneIcon: Record<NoticeTone, typeof Info> = {
  info: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  danger: AlertTriangle,
}

/**
 * Inline message tied to the block it belongs to — the styled replacement for
 * a bare `<p role="alert">`. Keeps the live-region role it is given so existing
 * announcements do not change.
 */
export function Notice({
  tone = 'info',
  children,
  role = tone === 'danger' ? 'alert' : 'status',
  action,
  block = false,
  className,
}: {
  tone?: NoticeTone
  children: ReactNode
  role?: 'status' | 'alert'
  action?: ReactNode
  /** Render the body as a block, so it can host a list or several paragraphs. */
  block?: boolean
  className?: string
}) {
  const Icon = toneIcon[tone]

  return (
    <div
      data-slot="app-notice"
      className={cn('rz-notice', toneClass[tone], className)}
      role={role}
    >
      <Icon aria-hidden />
      {block ? (
        <div className="rz-notice__body">{children}</div>
      ) : (
        <span className="rz-notice__body">{children}</span>
      )}
      {action}
    </div>
  )
}
