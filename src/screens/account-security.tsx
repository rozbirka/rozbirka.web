import { Link } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { AccountDeletion } from '@/components/account/account-deletion'
import { Button } from '@/components/app'

/** Personal account controls deliberately do not require company access. */
export function AccountSecurityScreen() {
  const auth = useAuth()
  return (
    <main className="type-redesign bg-app-canvas text-app-ink min-h-dvh px-6 py-12">
      <title>Особистий акаунт · Rozbirka</title>
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto grid max-w-xl gap-6">
        <h1 className="text-3xl font-semibold">Особистий акаунт</h1>
        <p className="text-app-muted">
          Керування акаунтом доступне незалежно від членства в компанії та її
          підписки.
        </p>
        <p>{auth.user?.displayName}</p>
        <AccountDeletion key={auth.user?.id} />
        <Link className="text-brand underline" to="/privacy">
          Політика конфіденційності
        </Link>
        <Button onClick={() => void auth.signOut()}>Вийти</Button>
        <Link className="text-brand underline" to="/account">
          Повернутися
        </Link>
      </div>
    </main>
  )
}
