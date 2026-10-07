import { normalizeApiProblem } from '@/api/errors'
import { defineMessages } from '@/i18n'

/**
 * Retry policy for writes whose answer was lost (no connection, timeout).
 * The write may or may not have landed, so the cabinet first re-reads the
 * actual state — keeping the draft — and only then reports success or offers
 * a retry. A retry is offered only where Core makes repeating safe:
 *
 * - Idempotency-Key honoured (the same key replays the first result):
 *   `POST orders/{id}/confirm`, `PUT orders/{id}/payments`,
 *   `POST orders/{id}/refund`, `POST cash/{id}/transactions`,
 *   `POST cash/transfer`, `POST billing/subscribe`, `POST reports`, and the
 *   delivery payment record/link/refund calls (key required there).
 * - Naturally idempotent (the same body leads to the same state):
 *   `PATCH tenants/{id}` (business, region and currency settings),
 *   `PATCH tenants/{id}/onboarding`, `PATCH parts/{id}` (asking price),
 *   `PUT orders/{id}/items`.
 * - Not idempotent: creates (`POST` cars, batches, parts, orders, customers,
 *   …) — never repeated blindly; after a lost answer the list is re-read.
 */
export const isLostResponse = (error: unknown): boolean => {
  const kind = normalizeApiProblem(error).kind
  return kind === 'network' || kind === 'timeout'
}

export const lostResponseMessages = defineMessages({
  uk: {
    reread:
      'Звʼязок перервався. Замовлення перечитано — перевірте, чи зміна збереглася, перш ніж повторювати.',
    checking: 'Звʼязок перервався. Перевіряємо, чи збережено…',
    notSaved:
      'Звʼязок перервався, і зміни не збереглися. Введене залишилось — можна безпечно спробувати ще раз.',
    checkFailed:
      'Звʼязок перервався, і перевірити, чи збережено, не вдалося. Введене залишилось — перевірте пізніше або спробуйте ще раз.',
  },
  'en-GB': {
    reread:
      'The connection dropped. The order has been reloaded — check whether the change was saved before trying again.',
    checking: 'The connection dropped. Checking whether it was saved…',
    notSaved:
      'The connection dropped and the changes weren’t saved. What you entered is still here — it’s safe to try again.',
    checkFailed:
      'The connection dropped and we couldn’t check whether it was saved. What you entered is still here — check later or try again.',
  },
  pl: {
    reread:
      'Połączenie zostało przerwane. Zamówienie wczytano ponownie — sprawdź, czy zmiana została zapisana, zanim spróbujesz ponownie.',
    checking: 'Połączenie zostało przerwane. Sprawdzamy, czy zapisano…',
    notSaved:
      'Połączenie zostało przerwane i zmian nie zapisano. Wprowadzone dane zostały — możesz bezpiecznie spróbować ponownie.',
    checkFailed:
      'Połączenie zostało przerwane i nie udało się sprawdzić, czy zapisano. Wprowadzone dane zostały — sprawdź później lub spróbuj ponownie.',
  },
})
