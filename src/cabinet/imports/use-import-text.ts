import { useCallback } from 'react'
import {
  useLocale,
  type Message,
  type MessageCatalog,
  type MessageParams,
  type Translate,
} from '@/i18n'
import { formatCount, importText } from './import-model'

/**
 * `useT` for the import screens: numbers in messages group with plain spaces,
 * like every other count on these screens.
 */
export function useImportT<M extends Readonly<Record<string, Message>>>(
  catalog: MessageCatalog<M>,
): Translate<M> {
  const { locale } = useLocale()
  return useCallback(
    (key: keyof M & string, params?: MessageParams) =>
      importText(catalog, locale, key, params),
    [catalog, locale],
  )
}

/** Locale-bound whole-number formatter with plain grouping spaces. */
export function useCount() {
  const { locale } = useLocale()
  return useCallback((value: number) => formatCount(value, locale), [locale])
}
