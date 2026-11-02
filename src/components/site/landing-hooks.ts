import { intlLocale, useLocale } from '@/i18n'
import { telegramSupportHref } from '@/lib/telegram-support'

/** Public support bot link, or `null` when the build has no bot configured. */
export function useSupportHref(): string | null {
  const username: unknown = import.meta.env['VITE_TELEGRAM_SUPPORT_BOT']
  return telegramSupportHref(
    typeof username === 'string' ? username : undefined,
  )
}

/** Demo figures of the landing are shown in US dollars, as in the mock-up. */
export function useMoney() {
  const { locale } = useLocale()
  const format = new Intl.NumberFormat(intlLocale(locale))
  return (value: number) => `$${format.format(Math.round(value))}`
}
