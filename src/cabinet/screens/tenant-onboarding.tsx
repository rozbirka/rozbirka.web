import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Loader2, LogOut } from 'lucide-react'
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
import { cabinetPath } from '../cabinet-paths'

/*
 * Creating the yard is the whole first-run flow. Settings, accounting
 * currency, the first source and the first part are an owner checklist on the
 * dashboard (ROZ-163), so the wizard hands over to it as soon as the yard
 * exists. Core creates the main warehouse itself; the team is a recommended
 * step after onboarding, not part of it.
 */
const TITLE = 'Розкажіть про свій бізнес'
const SUBTITLE =
  'Назву бачить ваша команда й клієнти в документах. Змінити її можна будь-коли в налаштуваннях.'

const nameTooShort = 'Вкажіть назву розбірки — щонайменше 2 символи'

export function TenantOnboardingScreen() {
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
        `Не вдалося створити розбірку. ${normalizeApiProblem(failure).message}`,
    },
  )

  const nameIssue = name.trim().length < 2 ? nameTooShort : null

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
    <div className="bg-app-canvas text-app-ink type-redesign relative flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
        <BrandLogo />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="text-app-muted hover:text-app-ink text-[13px] transition-colors"
            to="/account/security"
          >
            Особистий акаунт
          </Link>
          <Button onClick={() => void handleLogout()} variant="quiet">
            <LogOut aria-hidden />
            Вийти
          </Button>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-16 sm:px-6">
        <div className="grid w-full max-w-[600px] content-start gap-6">
          <div>
            <h1 className="text-[32px] leading-[1.04] font-extrabold tracking-[-0.03em] text-white sm:text-[40px]">
              {TITLE}
            </h1>
            <p className="text-app-muted mt-3 max-w-[56ch] text-[14.5px] leading-6 text-pretty">
              {SUBTITLE}
            </p>
          </div>

          <form
            aria-busy={create.pending}
            className="grid gap-5"
            noValidate
            onSubmit={submit}
          >
            <Field
              error={touched ? nameIssue : null}
              hint="Наприклад: CarDubliany"
              label="Назва розбірки"
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
            <Field
              hint="Показуємо в картках запчастин, щоб покупці бачили, звідки доставка."
              label="Місто (необовʼязково)"
            >
              <TextInput
                autoComplete="address-level2"
                onChange={(event) => setCity(event.target.value)}
                placeholder="Львів"
                value={city}
              />
            </Field>

            {create.error === null ? null : (
              <Notice
                action={
                  <Button onClick={attemptCreate} {...create.triggerProps}>
                    Спробувати ще раз
                  </Button>
                }
                tone="danger"
              >
                {create.error}
              </Notice>
            )}

            <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <span className="text-app-dim text-[13px]">
                14 днів безкоштовно, картка не потрібна
              </span>
              <Button
                {...create.triggerProps}
                size="touch"
                type="submit"
                variant="primary"
              >
                {create.pending ? (
                  <>
                    <Loader2 aria-hidden className="motion-safe:animate-spin" />
                    Створюємо…
                  </>
                ) : (
                  <>
                    Створити розбірку
                    <ArrowRight aria-hidden />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(80%_60%_at_50%_0%,rgba(247,116,37,0.12),transparent_60%)]"
      />
    </div>
  )
}
