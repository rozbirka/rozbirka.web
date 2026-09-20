import { Link } from 'react-router'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { AccountDeletion } from '@/components/account/account-deletion'
import { BrandLogo } from '@/components/site/brand-logo'
import { Button } from '@/components/app'

/**
 * Personal account controls deliberately do not require company access, so the
 * page wears the login screen's chrome rather than the cabinet shell: the same
 * 420px column, brand mark and step header, because a person can land here with
 * no yard, no subscription and no sidebar to return to.
 */
export function AccountSecurityScreen() {
  const auth = useAuth()
  const user = auth.user
  return (
    <div className="bg-app-canvas relative flex min-h-dvh flex-col text-white">
      <title>Особистий акаунт · Rozbirka</title>
      <meta name="robots" content="noindex, nofollow" />
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        <BrandLogo />
        <Link
          className="text-app-muted group -mr-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-[13px] transition-colors hover:text-white"
          to="/account"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Повернутися</span>
        </Link>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid w-full max-w-[420px] content-start gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-brand text-[11px] font-medium tracking-[0.28em] uppercase">
              Акаунт
            </span>
            <h1 className="text-[30px] leading-[1.05] font-light tracking-[-0.02em] text-balance sm:text-[38px]">
              Особистий акаунт
            </h1>
            <p className="text-app-muted text-[13.5px] leading-[1.5]">
              Ці дії доступні завжди — навіть коли доступу до розбірки немає або
              її підписка неактивна.
            </p>
          </div>

          <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
            <h2 className="text-app-ink text-[15px] font-bold">
              Ви увійшли як
            </h2>
            <dl className="mt-3 grid gap-2.5 text-[13.5px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Ім’я</dt>
                <dd className="text-app-ink min-w-0 truncate text-right font-medium">
                  {user?.displayName ?? '—'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Телефон</dt>
                <dd className="text-app-ink text-right font-medium tabular-nums">
                  {user?.phone ?? '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
            <h2 className="text-app-ink text-[15px] font-bold">Сеанс</h2>
            <Button
              className="mt-3.5 w-full justify-center"
              onClick={() => void auth.signOut()}
            >
              <LogOut aria-hidden />
              Вийти
            </Button>
            <p className="text-app-dim mt-3 text-[12.5px] leading-5 text-pretty">
              Вихід діє лише в цьому браузері.
            </p>
          </section>

          <AccountDeletion key={user?.id} />

          <p className="text-app-dim text-center text-[12px] leading-[1.5]">
            <Link
              className="text-app-muted underline underline-offset-4 hover:text-white"
              to="/privacy"
            >
              Політика конфіденційності
            </Link>
          </p>
        </div>
      </main>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(80%_60%_at_50%_0%,rgba(247,116,37,0.12),transparent_60%)]"
      />
    </div>
  )
}
