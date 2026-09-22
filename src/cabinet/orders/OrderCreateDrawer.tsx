import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/app'

export function OrderCreateDrawer({
  busy,
  children,
  onClose,
}: {
  busy: boolean
  children: ReactNode
  onClose: () => void
}) {
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px]"
          data-testid="order-create-overlay"
        />
        <Dialog.Content className="bg-app-canvas border-app-line fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] grid-rows-[auto_1fr] overflow-hidden rounded-t-[22px] border-t text-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-full sm:max-w-[600px] sm:rounded-none sm:border-t-0 sm:border-l">
          <header className="border-app-line flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <p className="text-app-dim font-mono text-[10px] font-semibold tracking-[0.16em] uppercase">
                Продажі · Замовлення
              </p>
              <Dialog.Title className="mt-1.5 text-[24px] leading-none font-extrabold tracking-[-0.025em]">
                Нове замовлення
              </Dialog.Title>
              <Dialog.Description className="text-app-muted mt-1.5 text-[13px] leading-5">
                Додайте позиції, виберіть клієнта та перевірте суму.
              </Dialog.Description>
            </div>
            <Button
              aria-label="Закрити"
              disabled={busy}
              onClick={onClose}
              size="icon"
              type="button"
              variant="quiet"
            >
              <X aria-hidden />
            </Button>
          </header>
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
