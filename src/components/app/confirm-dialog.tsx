import { useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Notice } from './notice'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** What this action does that cannot be undone. Say it plainly. */
  consequence: ReactNode
  /**
   * The consequences one by one, when the action moves money, stock and state
   * at once. Drawn as a list under the sentence, in the tone of the action.
   */
  effects?: readonly ReactNode[]
  /** Anything the confirmation itself needs: a reason, a date, a choice. */
  children?: ReactNode
  /** Names the action at a glance above the question. */
  icon?: LucideIcon
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  pending?: boolean
  confirmDisabled?: boolean
  destructive?: boolean
  /** Failure from the last attempt: shown here, where the retry button is. */
  error?: string | null
  /** Runs when the dialog closes, for callers that restore focus themselves. */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * Destructive actions confirm with their consequence, not with "Ви впевнені?".
 * The confirm button repeats the verb, so the choice is readable without the
 * question.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  effects,
  children,
  icon: Icon,
  confirmLabel,
  cancelLabel = 'Скасувати',
  onConfirm,
  pending = false,
  confirmDisabled = false,
  destructive = true,
  error = null,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(event) => {
            // Opening a destructive question lands on the way out of it.
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          className="bg-app-overlay border-app-line-2 rounded-sheet fixed inset-x-4 top-1/2 z-50 grid max-w-md -translate-y-1/2 gap-3 border p-5 text-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
        >
          {Icon === undefined ? null : (
            <span
              aria-hidden
              className={cn(
                'grid size-10 place-items-center rounded-[12px]',
                destructive
                  ? 'bg-state-danger-soft text-state-danger'
                  : 'bg-brand/15 text-brand',
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          )}
          <Dialog.Title className="text-[22px] font-extrabold tracking-[-0.02em]">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-app-muted text-sm leading-6 text-pretty">
            {consequence}
          </Dialog.Description>
          {effects === undefined || effects.length === 0 ? null : (
            <ul
              className={cn(
                'grid gap-2.5 rounded-[12px] border p-4',
                destructive
                  ? 'border-state-danger/20 bg-state-danger/[0.06]'
                  : 'border-app-line bg-white/[0.03]',
              )}
            >
              {effects.map((effect, index) => (
                <li
                  className="text-app-ink flex gap-2.5 text-[13px] leading-[1.45] text-pretty"
                  key={index}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-[7px] size-[5px] shrink-0 rounded-full',
                      destructive ? 'bg-state-danger' : 'bg-brand',
                    )}
                  />
                  {effect}
                </li>
              ))}
            </ul>
          )}
          {children}
          {error === null ? null : <Notice tone="danger">{error}</Notice>}
          <div className="mt-3 flex flex-wrap justify-end gap-2.5">
            <Dialog.Close asChild>
              <Button disabled={pending} ref={cancelRef}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              aria-busy={pending}
              disabled={pending || confirmDisabled}
              onClick={onConfirm}
              variant={destructive ? 'danger' : 'primary'}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
