import { createContext, useContext } from 'react'

export type ToastTone = 'ok' | 'danger' | 'info'

export type ToastActionKind = 'undo' | 'retry'

export const TOAST_DURATION = 6000
export const TOAST_UNDO_DURATION = 10_000

/** How long a toast stays when the caller does not say (module 00 §5). */
export function toastDuration(request: ToastRequest): number {
  if (request.duration !== undefined) return request.duration
  if (request.action?.kind === 'undo') return TOAST_UNDO_DURATION
  if (request.tone === 'danger' && request.action?.kind === 'retry') return 0
  return TOAST_DURATION
}

export interface ToastRequest {
  tone?: ToastTone
  message: string
  /**
   * One optional follow-up: "Повторити", "Скасувати". `kind` sets how long the
   * toast stays (module 00 §5): `undo` 10 s, `retry` on a danger toast until
   * closed.
   */
  action?: { label: string; onAction: () => void; kind?: ToastActionKind }
  /**
   * Milliseconds until it dismisses itself; 0 keeps it until dismissed.
   * Omitted: 6 s, 10 s with an undo action, until closed for danger + retry.
   */
  duration?: number
}

export interface ToastApi {
  show: (request: ToastRequest) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

/**
 * Transient confirmation of something the user just did. Anything the user must
 * act on belongs on the page as a `Notice`, not here.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (api === null) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return api
}

/**
 * Toasts where they exist, silence where they do not — for shared logic that
 * must also run in a tree without the provider.
 */
export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext)
}
