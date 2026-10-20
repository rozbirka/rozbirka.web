import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Lock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'
import { commonMessages } from '@/i18n/common-messages'

export type StateTone = 'neutral' | 'brand' | 'warn' | 'danger'

const toneClass: Record<StateTone, string> = {
  neutral: '',
  brand: 'rz-state--brand',
  warn: 'rz-state--warn',
  danger: 'rz-state--danger',
}

export interface StateScreenProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tone?: StateTone
  actions?: ReactNode
  /** Shown in mono under the actions: what support needs to find the request. */
  meta?: ReactNode
  role?: 'status' | 'alert'
  /** Names the live region, so a screen can hold more than one. */
  label?: string
  className?: string
}

/** Shared frame for empty, denied, blocked and failed screens. */
export function StateScreen({
  title,
  description,
  icon,
  tone = 'neutral',
  actions,
  meta,
  role = 'status',
  label,
  className,
}: StateScreenProps) {
  return (
    <section
      aria-label={label}
      className={cn('rz-state rz-card', toneClass[tone], className)}
      role={role}
    >
      {icon === undefined ? null : (
        <span className="rz-state__icon">{icon}</span>
      )}
      <h2 className="rz-state__title">{title}</h2>
      {description === undefined ? null : (
        <p className="rz-state__body">{description}</p>
      )}
      {actions === undefined ? null : (
        <div className="rz-btn-row mt-1 justify-center">{actions}</div>
      )}
      {meta === undefined ? null : <p className="rz-state__meta m-0">{meta}</p>}
    </section>
  )
}

export function EmptyState({
  title,
  description,
  actions,
  icon,
  tone = 'brand',
  role = 'status',
  label,
  className,
}: StateScreenProps) {
  return (
    <StateScreen
      {...(className === undefined ? {} : { className })}
      actions={actions}
      description={description}
      icon={icon ?? <Inbox aria-hidden />}
      {...(label === undefined ? {} : { label })}
      role={role}
      title={title}
      tone={tone}
    />
  )
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  correlationId,
  actions,
  label,
}: {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  correlationId?: string
  actions?: ReactNode
  label?: string
}) {
  const t = useT(appMessages)
  const tc = useT(commonMessages)
  return (
    <StateScreen
      actions={
        actions ??
        (onRetry === undefined ? undefined : (
          <Button onClick={onRetry}>
            <RefreshCw aria-hidden />
            {retryLabel ?? tc('retry')}
          </Button>
        ))
      }
      description={description ?? t('errorBody')}
      icon={<AlertTriangle aria-hidden />}
      {...(label === undefined ? {} : { label })}
      meta={
        correlationId === undefined
          ? undefined
          : t('correlation', { id: correlationId })
      }
      role="alert"
      title={title ?? t('errorTitle')}
      tone="danger"
    />
  )
}

export function DeniedState({
  title,
  description,
  actions,
  role,
  label,
}: Pick<
  StateScreenProps,
  'title' | 'description' | 'actions' | 'role' | 'label'
>) {
  return (
    <StateScreen
      actions={actions}
      description={description}
      icon={<Lock aria-hidden />}
      {...(label === undefined ? {} : { label })}
      role={role ?? 'status'}
      title={title}
      tone="neutral"
    />
  )
}
