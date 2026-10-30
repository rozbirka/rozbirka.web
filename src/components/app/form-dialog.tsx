import type { FormEvent, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Notice } from './notice'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'
import { commonMessages } from '@/i18n/common-messages'

export interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** What this dialog is for, one line under the title. */
  description?: ReactNode
  children: ReactNode
  submitLabel: string
  cancelLabel?: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  pending?: boolean
  /** Blocks submitting and says why. */
  submitDisabled?: boolean
  error?: string | null
  /** Wider dialog for forms with two columns. */
  size?: 'md' | 'lg'
  /** Runs when the dialog closes, for callers that restore focus themselves. */
  onCloseAutoFocus?: ((event: Event) => void) | undefined
}

/**
 * A form inside a dialog, for operations that must not cost the user their
 * place on the page. It closes on cancel and on success (the caller flips
 * `open`), never while a request is still running.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel,
  cancelLabel,
  onSubmit,
  pending = false,
  submitDisabled = false,
  error = null,
  size = 'md',
  onCloseAutoFocus,
}: FormDialogProps) {
  const t = useT(appMessages)
  const tc = useT(commonMessages)
  return (
    <Dialog.Root
      onOpenChange={(next) => {
        if (pending && !next) return
        onOpenChange(next)
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="rz-scrim max-sm:p-3">
          <Dialog.Content
            onCloseAutoFocus={onCloseAutoFocus}
            className={cn(
              'rz-dialog text-app-ink grid-rows-[auto_minmax(0,1fr)]',
              size === 'lg' && 'rz-dialog--lg',
            )}
          >
            <header className="rz-dialog__head">
              <div className="grid flex-1 gap-0.5">
                <Dialog.Title className="rz-h-title">{title}</Dialog.Title>
                {description === undefined ? (
                  <Dialog.Description className="sr-only">
                    {typeof title === 'string' ? title : t('form')}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="text-app-muted m-0">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <Button
                  aria-label={tc('close')}
                  className="-mt-0.5 -mr-1.5"
                  disabled={pending}
                  size="icon"
                  variant="quiet"
                >
                  <X aria-hidden />
                </Button>
              </Dialog.Close>
            </header>

            <form
              aria-busy={pending}
              className="grid min-h-0 grid-rows-[1fr_auto]"
              onSubmit={onSubmit}
            >
              {/* The dialog sits on a lighter surface than a page, where the
                page-level hint grey lands a hair under 4.5:1. */}
              <div className="rz-dialog__body [&_[data-slot=field-hint]]:text-app-muted">
                {error === null ? null : <Notice tone="danger">{error}</Notice>}
                {children}
              </div>
              <div className="rz-dialog__foot">
                <Dialog.Close asChild>
                  <Button disabled={pending} size="lg">
                    {cancelLabel ?? tc('cancel')}
                  </Button>
                </Dialog.Close>
                <Button
                  aria-busy={pending}
                  disabled={pending || submitDisabled}
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  {submitLabel}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * A panel that slides in from the edge — the cabinet's drawer. Its chrome
 * matches the rest of the redesign: a canvas-dark panel, a mono eyebrow over a
 * large title, and a footer that keeps its actions in view while the body
 * scrolls.
 */
export function Sheet({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  children,
  footer,
  size = 'md',
  bodyClassName,
  className,
  pending = false,
  onEscapeKeyDown,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where the reader is, in the cabinet's own words: "Склад · Деталі". */
  eyebrow?: ReactNode
  title: string
  /** One line under the title; the sheet stays labelled without it. */
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Wider panel for a form that carries its own sections. */
  size?: 'md' | 'lg' | 'workspace'
  /** Optional bounded layout for a list with its own fixed search and pager. */
  bodyClassName?: string
  /** A reference-specific width or chrome, without changing other sheets. */
  className?: string
  /** Keep all dismissal controls locked while a mutation is running. */
  pending?: boolean
  /** Let a nested editor consume Escape before the sheet dismisses. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  /** Restore focus to a caller-owned trigger when the sheet closes. */
  onCloseAutoFocus?: ((event: Event) => void) | undefined
}) {
  const tc = useT(commonMessages)
  return (
    <Dialog.Root
      onOpenChange={(next) => {
        if (!next && pending) return
        onOpenChange(next)
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="bg-app-scrim fixed inset-0 z-50" />
        <Dialog.Content
          aria-busy={pending || undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          // Land on the sheet itself, not its close button: the reference
          // opens without a focus ring, and Tab still reaches every control.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement | null)?.focus()
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault()
            onEscapeKeyDown?.(event)
            // Radix handles Escape during document capture, before the nested
            // search picker can close its results. Let it consume Escape first.
            if (
              event.target instanceof Element &&
              event.target.closest('[data-search-picker-open="true"]')
            )
              event.preventDefault()
          }}
          // A hidden file input can receive focus when a photo is chosen.
          // Clip the shell without making it scrollable; only the body scrolls.
          className={cn(
            'rz-sheet text-app-ink overflow-clip',
            size === 'workspace'
              ? 'sm:w-[calc(100vw-24px)] sm:max-w-content lg:w-[90vw]'
              : size === 'lg'
                ? 'sm:w-[min(640px,100vw)]'
                : '',
            className,
          )}
        >
          {/* Scheme 1b: header band with a 16px title and one muted line
              under it — the description, or the eyebrow when there is none. */}
          <header className="rz-sheet__head">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <Dialog.Title className="rz-h-title text-balance">
                {title}
              </Dialog.Title>
              {description === undefined ? (
                <>
                  {eyebrow === undefined ? null : (
                    <p className="text-app-muted m-0">{eyebrow}</p>
                  )}
                  <Dialog.Description className="sr-only">
                    {title}
                  </Dialog.Description>
                </>
              ) : (
                <Dialog.Description className="text-app-muted m-0 text-pretty">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                aria-label={tc('close')}
                className="rz-btn rz-btn--ghost rz-btn--icon relative after:absolute after:-inset-2 after:content-['']"
                disabled={pending}
                type="button"
              >
                <X aria-hidden />
              </button>
            </Dialog.Close>
          </header>
          <div
            className={cn(
              'grid min-h-0 content-start gap-3.5 overflow-y-auto p-4',
              bodyClassName,
            )}
          >
            {children}
          </div>
          {footer === undefined ? null : (
            <div className="rz-sheet__foot flex-wrap items-center pb-[calc(12px+env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
