import type { ReactNode } from 'react'
import type { SupportedCurrency } from '@/i18n'
import { isPriceValue } from './accounting-currency'
import { PriceCurrencyNote, PriceSaveNotes } from './price-currency'
import { usePriceHint } from './price-hint'
import type { FirstPriceGuard } from './use-accounting-currency'

/** Everything a price form renders around its amount fields. */
export interface PriceSlots {
  /** For `MoneyInput`: the code, `null` (dash) or `'none'` (old contract). */
  currency: SupportedCurrency | null | 'none'
  /** Amount inputs are disabled until a currency is chosen. */
  disabled: boolean
  /** Field hint naming the currency, when there is one. */
  hint: string | undefined
  /** Under the price field: why it is disabled and what to do (2b). */
  note: ReactNode
  /** Next to the save action: will-lock warning or pre-save check (2a, 2c). */
  saveNotes: ReactNode
  /** Whether the typed values hold at least one price (0 counts). */
  hasPrice: boolean
}

/**
 * The first-price pattern for one form, as render slots. `values` are the
 * amounts the save would store; any of them being a price triggers the
 * will-lock warning before the first price.
 */
export function usePriceSlots(
  guard: FirstPriceGuard,
  {
    values,
    onAccept,
    draftKept = false,
    onLeave,
  }: {
    values: readonly (string | number | null | undefined)[]
    /** «Save in EUR» was pressed: save again with the accepted currency. */
    onAccept: (currency: SupportedCurrency | null) => void
    draftKept?: boolean
    onLeave?: () => void
  },
): PriceSlots {
  const hint = usePriceHint()
  const hasPrice = values.some(isPriceValue)
  const { gate } = guard
  return {
    currency: gate.kind === 'legacy' ? 'none' : guard.currency,
    disabled: gate.kind === 'blocked',
    hint: hint(guard.currency),
    note: (
      <PriceCurrencyNote
        draftKept={draftKept}
        gate={gate}
        settingsPath={guard.settingsPath}
        {...(onLeave ? { onLeave } : {})}
      />
    ),
    saveNotes: (
      <PriceSaveNotes
        check={guard.check}
        onAccept={() => onAccept(guard.acceptConflict())}
        onDismiss={guard.dismiss}
        willLock={guard.willLock(hasPrice)}
      />
    ),
    hasPrice,
  }
}
