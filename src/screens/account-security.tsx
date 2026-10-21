import { Link } from 'react-router'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { AccountDeletion } from '@/components/account/account-deletion'
import { Button, Card, FactRows } from '@/components/app'
import { useDesignSystemRoot } from '@/components/app/use-design-system-root'
import { AuthBrand } from './auth-brand'
import { useT } from '@/i18n'
import { accountMessages } from '@/components/account/account-messages'

/**
 * Personal account controls deliberately do not require company access, so the
 * page wears the login screen's chrome rather than the cabinet shell: the same
 * 420px column, brand mark and step header, because a person can land here with
 * no yard, no subscription and no sidebar to return to.
 */
export function AccountSecurityScreen() {
  useDesignSystemRoot()
  const auth = useAuth()
  const user = auth.user
  const t = useT(accountMessages)
  return (
    <div className="rz flex min-h-dvh flex-col">
      <title>{t('documentTitle')}</title>
      <meta name="robots" content="noindex, nofollow" />
      <header className="flex items-center justify-end px-4 pt-4">
        <Link className="rz-btn rz-btn--ghost" to="/account">
          <ArrowLeft aria-hidden />
          <span>{t('back')}</span>
        </Link>
      </header>

      <main className="grid flex-1 justify-items-center p-6 pt-2">
        <div className="grid w-full max-w-[420px] content-start gap-5">
          <AuthBrand />
          <div className="grid gap-1.5">
            <span className="rz-eyebrow">{t('eyebrow')}</span>
            <h1 className="rz-h-page text-balance">{t('title')}</h1>
            <p className="text-app-muted m-0">{t('lead')}</p>
          </div>

          <Card title={t('signedInAs')}>
            <FactRows
              rows={[
                { label: t('name'), value: user?.displayName ?? '—' },
                {
                  label: t('phone'),
                  value: (
                    <span className="font-mono tabular-nums">
                      {user?.phone ?? '—'}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          <Card title={t('session')}>
            <div className="grid gap-2.5">
              <Button
                className="rz-btn--block"
                onClick={() => void auth.signOut()}
                size="lg"
              >
                <LogOut aria-hidden />
                {t('logout')}
              </Button>
              <p className="rz-caption m-0 text-pretty">{t('logoutHint')}</p>
            </div>
          </Card>

          <AccountDeletion key={user?.id} />

          <p className="rz-caption m-0 text-center">
            <Link to="/privacy">{t('privacy')}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
