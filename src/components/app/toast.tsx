import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ToastContext,
  toastDuration,
  type ToastApi,
  type ToastRequest,
  type ToastTone,
} from './toast-context'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

interface ActiveToast extends ToastRequest {
  id: number
}

/** Module 00 §5: icon-circle-check / icon-info / icon-triangle-alert. */
const toneIcon: Record<ToastTone, typeof Info> = {
  ok: CircleCheck,
  danger: TriangleAlert,
  info: Info,
}

const toneColor: Record<ToastTone, string> = {
  ok: 'text-state-ok',
  danger: 'text-state-danger',
  info: 'text-state-info',
}

/** At most three at once; the newest joins at the bottom, the oldest leaves. */
const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([])
  const nextId = useRef(0)
  const t = useT(appMessages)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (request: ToastRequest) => {
      const id = nextId.current++
      setToasts((current) => {
        const kept = current.slice(-(MAX_TOASTS - 1))
        // A toast pushed out of the stack must not keep a live timer.
        for (const gone of current.slice(0, current.length - kept.length)) {
          const timer = timers.current.get(gone.id)
          if (timer !== undefined) clearTimeout(timer)
          timers.current.delete(gone.id)
        }
        return [...kept, { ...request, id }]
      })
      const duration = toastDuration(request)
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [dismiss, show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="rz-toasts pointer-events-none max-md:right-3 max-md:bottom-[calc(76px+env(safe-area-inset-bottom))] max-md:left-3 max-md:justify-items-center">
        {toasts.map((toast) => {
          const tone = toast.tone ?? 'info'
          const Icon = toneIcon[tone]
          return (
            <div
              className="rz-toast text-app-ink pointer-events-auto"
              key={toast.id}
              role={tone === 'danger' ? 'alert' : 'status'}
            >
              <Icon
                aria-hidden
                className={cn('size-icon-md shrink-0', toneColor[tone])}
              />
              <span className="rz-toast__msg">{toast.message}</span>
              {toast.action === undefined ? null : (
                <button
                  className="rz-toast__action shrink-0"
                  onClick={() => {
                    toast.action?.onAction()
                    dismiss(toast.id)
                  }}
                  type="button"
                >
                  {toast.action.label}
                </button>
              )}
              <button
                aria-label={t('closeNotification')}
                className="rz-btn rz-btn--ghost rz-btn--sm rz-btn--icon size-6 pointer-coarse:size-control"
                onClick={() => dismiss(toast.id)}
                type="button"
              >
                <X aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
