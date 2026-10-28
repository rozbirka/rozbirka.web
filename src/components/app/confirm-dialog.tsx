import { useRef, type ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Notice } from './notice'
import { useT } from '@/i18n/hooks'
import { commonMessages } from '@/i18n/common-messages'

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
  /** Ignored since v2 (scheme 1b has no icon square); kept for callers. */
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
  onCloseAutoFocus?: ((event: Event) => void) | undefined
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
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending = false,
  confirmDisabled = false,
  destructive = true,
  error = null,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
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
        <Dialog.Overlay className="rz-scrim">
          <Dialog.Content
            onCloseAutoFocus={onCloseAutoFocus}
            onOpenAutoFocus={(event) => {
              // Opening a destructive question lands on the way out of it.
              event.preventDefault()
              cancelRef.current?.focus()
            }}
            className="rz-dialog text-app-ink grid-rows-[auto_minmax(0,1fr)_auto]"
          >
            {/* Scheme 1b: a band with the question, the consequence in the
                body, a band with the way out and the verb. The icon square
                is gone from v2; `icon` is kept for callers and ignored. */}
            <header className="rz-dialog__head items-center">
              <Dialog.Title className="rz-h-title flex-1">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  aria-label={tc('close')}
                  disabled={pending}
                  size="icon"
                  variant="quiet"
                >
                  <X aria-hidden />
                </Button>
              </Dialog.Close>
            </header>
            <div className="rz-dialog__body">
              <Dialog.Description className="text-app-ink m-0 text-pretty">
                {consequence}
              </Dialog.Description>
              {effects === undefined || effects.length === 0 ? null : (
                <ul
                  className={cn(
                    'rz-inset m-0 grid list-none gap-2',
                    destructive && 'bg-state-danger-soft',
                  )}
                >
                  {effects.map((effect, index) => (
                    <li
                      className="text-app-ink flex gap-2.5 text-pretty"
                      key={index}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-[7px] size-[5px] shrink-0 rounded-full',
                          destructive ? 'bg-state-danger' : 'bg-app-dim',
                        )}
                      />
                      {effect}
                    </li>
                  ))}
                </ul>
              )}
              {children}
              {error === null ? null : <Notice tone="danger">{error}</Notice>}
            </div>
            <footer className="rz-dialog__foot">
              <Dialog.Close asChild>
                <Button disabled={pending} ref={cancelRef} size="lg">
                  {cancelLabel ?? tc('cancel')}
                </Button>
              </Dialog.Close>
              <Button
                aria-busy={pending}
                disabled={pending || confirmDisabled}
                onClick={onConfirm}
                size="lg"
                variant={destructive ? 'danger' : 'primary'}
              >
                {confirmLabel}
              </Button>
            </footer>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
