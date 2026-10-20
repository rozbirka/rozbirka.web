import { useDesignSystemRoot } from '@/components/app/use-design-system-root'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Loader2, LogOut } from 'lucide-react'
import { normalizeApiProblem } from '@/api/errors'
import { tenantsApi } from '@/api/tenants'
import { tenantPreference } from '@/api/tenant-preference'
import { useAuth } from '@/auth/AuthContext'
import {
  Button,
  Field,
  Notice,
  TextInput,
  useOperation,
} from '@/components/app'
import { BrandLogo } from '@/components/site/brand-logo'
import { useT } from '@/i18n'
import { cabinetPath } from '../cabinet-paths'
import { tenantOnboardingMessages } from './tenant-onboarding-messages'

/*
 * Creating the yard is the whole first-run flow. Settings, accounting
 * currency, the first source and the first part are an owner checklist on the
 * dashboard (ROZ-163), so the wizard hands over to it as soon as the yard
 * exists. Core creates the main warehouse itself; the team is a recommended
 * step after onboarding, not part of it.
 */
export function TenantOnboardingScreen() {
  useDesignSystemRoot()
  const t = useT(tenantOnboardingMessages)
  const auth = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [touched, setTouched] = useState(false)
  const [resume, setResume] = useState<{
    generation: number
    tenantId: string
  } | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const generationRef = useRef(0)
  const activeCreateRef = useRef<{
    generation: number
    controller: AbortController
  } | null>(null)

  useEffect(() => {
    return () => {
      generationRef.current += 1
      activeCreateRef.current?.controller.abort('onboarding-unmounted')
      activeCreateRef.current = null
    }
  }, [])

  // The created yard, resolved from the hydrated list rather than from the
  // create response: its slug is the one the cabinet routes by.
  const createdTenant =
    resume === null
      ? undefined
      : auth.tenants.find((tenant) => tenant.id === resume.tenantId)
  const slug = createdTenant?.slug ?? null

  // Creating the yard is irreversible; once it exists the owner continues on
  // the dashboard, where the onboarding checklist picks up.
  useEffect(() => {
    if (slug === null) return
    void navigate(cabinetPath(slug, 'dashboard'), { replace: true })
  }, [navigate, slug])

  const invalidateCreate = (reason: string) => {
    generationRef.current += 1
    activeCreateRef.current?.controller.abort(reason)
    activeCreateRef.current = null
  }

  const handleLogout = async () => {
    invalidateCreate('onboarding-logout')
    tenantPreference.clear()
    void navigate('/', { replace: true, flushSync: true })
    await auth.signOut()
  }

  const create = useOperation(
    useCallback(async () => {
      const operation = {
        generation: generationRef.current + 1,
        controller: new AbortController(),
      }
      generationRef.current = operation.generation
      activeCreateRef.current = operation
      const isCurrent = () =>
        activeCreateRef.current === operation &&
        generationRef.current === operation.generation &&
        !operation.controller.signal.aborted
      try {
        const created = await tenantsApi.create(
          {
            tenantName: name.trim(),
            ...(city.trim() ? { city: city.trim() } : {}),
          },
          { signal: operation.controller.signal },
        )
        if (!isCurrent()) return
        tenantPreference.set(created.tenantId)
        await auth.hydrate()
        if (!isCurrent()) return
        setResume({
          generation: operation.generation,
          tenantId: created.tenantId,
        })
      } catch (failure) {
        // A superseded attempt (logout, unmount) is not a failure to report.
        if (!isCurrent()) return
        throw failure
      } finally {
        if (activeCreateRef.current === operation) {
          activeCreateRef.current = null
        }
      }
    }, [auth, city, name]),
    {
      errorMessage: (failure) =>
        t('createFailed', { reason: normalizeApiProblem(failure).message }),
    },
  )

  const nameIssue = name.trim().length < 2 ? t('nameTooShort') : null

  const attemptCreate = () => {
    setTouched(true)
    if (nameIssue !== null) {
      nameRef.current?.focus()
      return
    }
    if (create.pending) return
    create.run()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    attemptCreate()
  }

  return (
    <div className="rz flex min-h-dvh flex-col">
      <header className="rz-topbar min-h-topbar h-auto flex-wrap justify-between gap-y-1.5 py-1.5">
        <BrandLogo />
        <div className="rz-topbar__actions flex-wrap items-center">
          <Button asChild variant="quiet">
            <Link to="/account/security">{t('account')}</Link>
          </Button>
          <Button onClick={() => void handleLogout()} variant="quiet">
            <LogOut aria-hidden />
            {t('signOut')}
          </Button>
        </div>
      </header>

      <main className="rz-page mx-auto w-full max-w-[880px]">
        <div className="grid gap-2">
          <span className="rz-eyebrow">{t('step')}</span>
          <h1 className="rz-h-page">{t('title')}</h1>
          <p className="rz-muted m-0 max-w-[56ch] text-pretty">
            {t('subtitle')}
          </p>
        </div>

        <form
          aria-busy={create.pending}
          className="rz-card"
          noValidate
          onSubmit={submit}
        >
          <div className="rz-card__body grid items-start gap-4 sm:grid-cols-2">
            <Field
              error={touched ? nameIssue : null}
              hint={t('nameHint')}
              label={t('nameLabel')}
              required
            >
              <TextInput
                autoComplete="organization"
                autoFocus
                onBlur={() => setTouched(true)}
                onChange={(event) => setName(event.target.value)}
                ref={nameRef}
                value={name}
              />
            </Field>
            <Field hint={t('cityHint')} label={t('cityLabel')}>
              <TextInput
                autoComplete="address-level2"
                onChange={(event) => setCity(event.target.value)}
                placeholder={t('cityPlaceholder')}
                value={city}
              />
            </Field>

            {create.error === null ? null : (
              <Notice
                className="sm:col-span-2"
                action={
                  <Button onClick={attemptCreate} {...create.triggerProps}>
                    {t('retry')}
                  </Button>
                }
                tone="danger"
              >
                {create.error}
              </Notice>
            )}
          </div>

          <div className="rz-card__foot flex-wrap items-center">
            <span className="rz-caption">{t('trial')}</span>
            <Button
              {...create.triggerProps}
              size="lg"
              type="submit"
              variant="primary"
            >
              {create.pending ? (
                <>
                  <Loader2 aria-hidden className="motion-safe:animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('create')
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
