import type { ReactNode } from 'react'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useAuth } from '@/auth/AuthContext'
import { LocaleProvider } from './LocaleProvider'
import type { Locale } from './locales'

/**
 * Root locale for the app: feeds the signed-in user's profile language and the
 * current tenant's time zone into `LocaleProvider`. Must sit inside
 * `AuthProvider`. Pass `locale` to pin it (SSR/prerender renders `uk`).
 */
export function AppLocaleProvider({
  children,
  locale,
}: {
  children: ReactNode
  locale?: Locale
}) {
  const { user } = useAuth()
  const { timeZone } = useTenantSettings()
  return (
    <LocaleProvider
      profileLanguage={user?.language}
      timeZone={timeZone}
      locale={locale}
    >
      {children}
    </LocaleProvider>
  )
}
