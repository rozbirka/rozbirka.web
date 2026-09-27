import type { FormEvent, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Notice } from './notice'

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
  onCloseAutoFocus?: (event: Event) => void
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
  cancelLabel = 'Скасувати',
  onSubmit,
  pending = false,
  submitDisabled = false,
  error = null,
  size = 'md',
  onCloseAutoFocus,
}: FormDialogProps) {
  return (
    <Dialog.Root
      onOpenChange={(next) => {
        if (pending && !next) return
        onOpenChange(next)
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'bg-app-overlay border-app-line-2 rounded-sheet fixed inset-x-3 top-1/2 z-50 grid max-h-[90dvh] -translate-y-1/2 grid-rows-[auto_1fr_auto] overflow-hidden border text-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2',
            size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
          )}
        >
          <header className="border-app-line flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="grid gap-1">
              <Dialog.Title className="text-lg font-semibold">
                {title}
              </Dialog.Title>
              {description === undefined ? (
                <Dialog.Description className="sr-only">
                  {typeof title === 'string' ? title : 'Форма'}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="text-app-muted text-sm">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button
                aria-label="Закрити"
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
            <div className="grid content-start gap-3 overflow-y-auto px-5 py-4 [&_[data-slot=field-hint]]:text-app-muted">
              {error === null ? null : <Notice tone="danger">{error}</Notice>}
              {children}
            </div>
            <div className="border-app-line flex flex-wrap justify-end gap-2 border-t px-5 py-3">
              <Dialog.Close asChild>
                <Button disabled={pending}>{cancelLabel}</Button>
              </Dialog.Close>
              <Button
                aria-busy={pending}
                disabled={pending || submitDisabled}
                type="submit"
                variant="primary"
              >
                {submitLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
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
  size?: 'md' | 'lg'
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'bg-app-canvas border-app-line fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] grid-rows-[auto_1fr_auto] overflow-hidden rounded-t-[24px] border-t text-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-full sm:rounded-none sm:border-t-0 sm:border-l',
            size === 'lg' ? 'sm:max-w-[640px]' : 'sm:max-w-[600px]',
          )}
        >
          <header className="border-app-line flex items-start justify-between gap-4 border-b px-5 pt-5 pb-5 sm:px-7 sm:pt-6 sm:pb-5">
            <div className="min-w-0">
              {eyebrow === undefined ? null : (
                <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                  {eyebrow}
                </p>
              )}
              <Dialog.Title
                className={cn(
                  'text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance',
                  eyebrow === undefined ? '' : 'mt-2',
                )}
              >
                {title}
              </Dialog.Title>
              {description === undefined ? (
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="text-app-muted mt-2 text-sm leading-5 text-pretty">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              {/* The drawer's own close: a 34px square, as the design draws it,
                  with the 44px hit area the cabinet keeps put back by a
                  transparent overlay that costs the layout nothing. */}
              <button
                aria-label="Закрити"
                className="border-app-line-2 text-app-muted hover:text-app-ink relative grid size-[34px] shrink-0 place-items-center rounded-[10px] border transition-colors hover:bg-white/[0.06] after:absolute after:-inset-[5px] after:content-['']"
                type="button"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </Dialog.Close>
          </header>
          <div className="grid min-h-0 content-start gap-5 overflow-y-auto px-5 pt-5 pb-7 sm:px-7">
            {children}
          </div>
          {footer === undefined ? null : (
            <div className="border-app-line flex flex-wrap items-center justify-end gap-2.5 border-t bg-black/25 px-5 pt-4 pb-5 sm:px-7">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
