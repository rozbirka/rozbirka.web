import type { ComponentProps, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/i18n'
import { navigationGroupLabel } from '../module-messages'
import { stickersMessages } from './messages'

export const STICKER_LIST_PAGE_SIZE = 10

/** Both sticker modes share the same heading, description and breadcrumb. */
export function StickerPageWorkspace(
  props: Omit<
    ComponentProps<typeof StickerWorkspace>,
    'title' | 'subtitle' | 'crumb'
  >,
) {
  const t = useT(stickersMessages)
  const { locale } = useLocale()
  return (
    <StickerWorkspace
      {...props}
      title={t('title')}
      subtitle={t('subtitle')}
      crumb={navigationGroupLabel('stock', locale)}
    />
  )
}

/** Shared desktop print workspace: selection on the left, sheet on the right. */
export function StickerWorkspace({
  title,
  subtitle,
  crumb,
  actions,
  back,
  notice,
  list,
  preview,
  children,
  label,
  showHeader = true,
  embedded = false,
  className,
  navigation,
}: {
  title: string
  subtitle: ReactNode
  /** The trail before the title in the topbar, e.g. the sidebar section. */
  crumb?: ReactNode
  /** The page's own actions, at the right of the topbar. */
  actions?: ReactNode
  back?: ReactNode
  notice?: ReactNode
  list: ReactNode
  preview: ReactNode
  children?: ReactNode
  label?: string
  showHeader?: boolean
  embedded?: boolean
  className?: string | undefined
  navigation?: ReactNode
}) {
  const workspace = (
    <>
      {notice}
      <div
        data-slot="sticker-workspace-columns"
        className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]"
      >
        {list}
        {preview}
      </div>
      {children}
    </>
  )
  // Inside another screen (location labels) the host already draws the frame.
  if (embedded)
    return (
      <section
        aria-label={label}
        className={cn('grid min-w-0 gap-3', className)}
      >
        {back}
        {showHeader ? (
          <div className="grid gap-1">
            <h1 className="rz-h-page">{title}</h1>
            <p className="rz-muted m-0 max-w-[72ch]">{subtitle}</p>
          </div>
        ) : null}
        {navigation}
        {workspace}
      </section>
    )
  return (
    <section
      aria-label={label}
      className={cn('grid min-w-0 content-start', className)}
    >
      <header className="rz-topbar h-auto min-h-topbar flex-wrap justify-between gap-y-1.5 py-1.5">
        <p className="rz-crumbs m-0">
          {crumb === undefined ? null : (
            <>
              <span>{crumb}</span>
              <ChevronRight aria-hidden className="size-3 shrink-0" />
            </>
          )}
          <span aria-current="page">{title}</span>
        </p>
        {actions === undefined ? null : (
          <div className="rz-topbar__actions flex-wrap items-center">
            {actions}
          </div>
        )}
      </header>
      <div className="rz-page">
        {back}
        {showHeader ? (
          <div className="grid gap-1">
            <div className="rz-page-head">
              <h1 className="rz-h-page">{title}</h1>
            </div>
            <p className="rz-muted m-0 max-w-[72ch]">{subtitle}</p>
          </div>
        ) : null}
        {navigation}
        {workspace}
      </div>
    </section>
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
      data-slot="sticker-list"
      className={cn('min-w-0', !embedded && 'rz-card')}
    >
      {search != null ? (
        <div className="border-app-line border-b p-3">{search}</div>
      ) : null}
      <div
        data-slot="sticker-list-toolbar"
        className={cn(
          'rz-toolbar border-app-line justify-between border-b py-2',
          embedded ? 'px-3' : 'px-4',
        )}
      >
        <p className="rz-muted m-0 tabular-nums">{summary}</p>
        <div className="rz-btn-row">{actions}</div>
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
  trailing,
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
  trailing?: ReactNode
}) {
  return (
    <li
      data-slot="sticker-selection-row"
      data-appearance={appearance}
      data-selected={selected}
      aria-label={label}
      className={cn(
        'cursor-pointer transition-colors',
        selected ? 'bg-app-row-selected' : 'hover:bg-app-hover',
      )}
      onClick={() => {
        if (!disabled) onToggle()
      }}
    >
      <div
        data-slot="sticker-selection-content"
        className={cn(
          appearance === 'location'
            ? 'flex min-w-0 items-center gap-3 px-3 py-2.5'
            : 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]',
        )}
      >
        <input
          aria-label={checkboxLabel}
          checked={selected}
          className="rz-check"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onChange={onToggle}
          type="checkbox"
        />
        {appearance === 'location' && icon ? (
          <span className="bg-app-input text-app-muted hidden size-8 shrink-0 place-items-center rounded-control sm:grid">
            {icon}
          </span>
        ) : null}
        <div
          data-slot="sticker-selection-text"
          className={cn('min-w-0', appearance === 'location' && 'flex-1')}
        >
          <p
            className={
              appearance === 'location'
                ? 'rz-strong m-0 font-semibold break-words'
                : 'rz-strong m-0 truncate font-semibold'
            }
          >
            {name}
          </p>
          <p
            className={cn(
              'rz-muted m-0 mt-0.5 text-caption',
              appearance === 'location' ? 'break-all' : 'truncate',
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
          <span className="rz-mono rz-caption hidden max-w-28 truncate text-right sm:block">
            {code ?? '—'}
          </span>
        ) : null}
        {trailing != null ? (
          <span data-slot="sticker-selection-trailing">{trailing}</span>
        ) : null}
      </div>
    </li>
  )
}
