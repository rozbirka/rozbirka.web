import type { ReactNode } from 'react'
import { PageBody } from '@/components/app'
import { cn } from '@/lib/utils'

/** Shared desktop print workspace: selection on the left, sheet on the right. */
export function StickerWorkspace({
  title,
  subtitle,
  back,
  notice,
  list,
  preview,
  children,
  label,
  showHeader = true,
  embedded = false,
}: {
  title: string
  subtitle: ReactNode
  back?: ReactNode
  notice?: ReactNode
  list: ReactNode
  preview: ReactNode
  children?: ReactNode
  label?: string
  showHeader?: boolean
  embedded?: boolean
}) {
  return (
    <PageBody className={embedded ? 'gap-3' : 'gap-6 pb-8'} aria-label={label}>
      {back}
      {showHeader ? (
        <header>
          <h1 className="text-[clamp(34px,4vw,48px)] leading-none font-extrabold tracking-[-0.035em] text-white">
            {title}
          </h1>
          <p className="text-app-muted mt-3 max-w-3xl text-[14px] leading-6">
            {subtitle}
          </p>
        </header>
      ) : null}
      {notice}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {list}
        {preview}
      </div>
      {children}
    </PageBody>
  )
}
export function StickerListPanel({
  search,
  summary,
  actions,
  children,
  footer,
  embedded = false,
}: {
  search: ReactNode
  summary: ReactNode
  actions: ReactNode
  children: ReactNode
  footer?: ReactNode
  embedded?: boolean
}) {
  return (
    <section
      className={cn(
        'min-w-0',
        !embedded &&
          'border-app-line bg-app-raised overflow-hidden rounded-[20px] border',
      )}
    >
      {search != null ? (
        <div className="border-app-line border-b p-4 sm:p-5">{search}</div>
      ) : null}
      <div
        className={cn(
          'border-app-line flex flex-wrap items-center justify-between gap-3 border-b py-3',
          embedded ? 'px-3' : 'px-4 sm:px-5',
        )}
      >
        <p className="text-app-muted text-[13px] tabular-nums">{summary}</p>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
      {footer}
    </section>
  )
}
export function StickerSelectionRow({
  label,
  checkboxLabel,
  selected,
  disabled,
  onToggle,
  name,
  detail,
  controls,
  code,
  appearance = 'sticker',
  icon,
}: {
  label: string
  checkboxLabel: string
  selected: boolean
  disabled?: boolean
  onToggle: () => void
  name: string
  detail: ReactNode
  controls?: ReactNode
  code?: string | null
  appearance?: 'sticker' | 'location'
  icon?: ReactNode
}) {
  return (
    <li
      aria-label={label}
      className={
        appearance === 'location'
          ? cn(
              'cursor-pointer transition-colors',
              selected ? 'bg-app-overlay/40' : 'hover:bg-app-overlay/40',
            )
          : selected
            ? 'cursor-pointer bg-white/[0.035] shadow-[inset_2px_0_0_var(--color-brand)]'
            : 'cursor-pointer transition-colors hover:bg-white/[0.025]'
      }
      onClick={() => {
        if (!disabled) onToggle()
      }}
    >
      <div
        className={cn(
          appearance === 'location'
            ? 'flex min-h-20 min-w-0 items-center gap-3 px-3 py-3 sm:gap-4'
            : 'grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:px-5',
        )}
      >
        <input
          aria-label={checkboxLabel}
          checked={selected}
          className="accent-brand size-[18px] shrink-0"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onChange={onToggle}
          type="checkbox"
        />
        {appearance === 'location' && icon ? (
          <span className="bg-app-input text-app-muted hidden size-10 shrink-0 place-items-center rounded-control sm:grid">
            {icon}
          </span>
        ) : null}
        <div className={cn('min-w-0', appearance === 'location' && 'flex-1')}>
          <p
            className={
              appearance === 'location'
                ? 'text-app-ink break-words text-base font-bold sm:text-lg'
                : 'truncate text-[14px] font-bold text-white'
            }
          >
            {name}
          </p>
          <p
            className={cn(
              'text-app-muted mt-1',
              appearance === 'location'
                ? 'break-all text-sm'
                : 'truncate text-[12.5px]',
            )}
          >
            {detail}
          </p>
        </div>
        {controls ? (
          <div
            className={
              appearance === 'location'
                ? 'shrink-0'
                : 'col-start-2 sm:col-start-auto'
            }
            onClick={(event) => event.stopPropagation()}
          >
            {controls}
          </div>
        ) : appearance === 'sticker' ? (
          <span className="hidden sm:block" />
        ) : null}
        {appearance === 'sticker' ? (
          <span className="text-app-dim hidden max-w-28 truncate text-right font-mono text-[12.5px] sm:block">
            {code ?? '—'}
          </span>
        ) : null}
      </div>
    </li>
  )
}
