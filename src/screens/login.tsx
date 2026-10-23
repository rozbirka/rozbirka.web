import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import {
  Button,
  Field,
  Notice,
  TextInput,
  useOperation,
} from '@/components/app'
import { authApi } from '@/api/auth'
import { normalizeApiProblem } from '@/api/errors'
import { useAuth } from '@/auth/AuthContext'
import { needsOwnerName } from '@/auth/owner-name'
import { resolvePostLoginDestination } from '@/auth/post-login'
import type { SendOtpResponse } from '@/api/types'
import { useT } from '@/i18n/hooks'
import { LocaleOverride, useLocale } from '@/i18n/LocaleProvider'
import { siteLocalePreference } from '@/i18n/locale-preference'
import type { Translate } from '@/i18n/messages'
import {
  formatPhone,
  isValidSignInPhone,
  normalizePhone,
  phoneCountry,
  phoneCountryForLocale,
  phoneDialCode,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from '@/lib/phone'
import { useDesignSystemRoot } from '@/components/app/use-design-system-root'
import { AuthBrand } from './auth-brand'
import { loginMessages } from './login-messages'

type Step = 'phone' | 'otp' | 'name' | 'success'

type LoginT = Translate<(typeof loginMessages)['uk']>

const OTP_LENGTH = 6
const PHONE_PATTERN: Record<PhoneCountry, string> = {
  UA: '+380 XX XXX XX XX',
  GB: '+44 XXXX XXXXXX',
  PL: '+48 XXX XXX XXX',
}
const COUNTRY_KEY = {
  UA: 'countryUA',
  GB: 'countryGB',
  PL: 'countryPL',
} as const
const PHONE_FLAGS: Record<PhoneCountry, string> = {
  UA: '🇺🇦',
  GB: '🇬🇧',
  PL: '🇵🇱',
}
const MAX_PHONE_DIGITS = 15
const OTP_FLOW_STORAGE_KEY = 'rozbirka.loginOtpFlow'

interface StoredOtpFlow {
  purpose: 'login' | 'registration'
  phone: string
  challenge: SendOtpResponse
}

function readStoredOtpFlow(): StoredOtpFlow | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(OTP_FLOW_STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredOtpFlow>
    if (
      (value.purpose !== 'login' && value.purpose !== 'registration') ||
      typeof value.phone !== 'string' ||
      typeof value.challenge?.challengeId !== 'string' ||
      typeof value.challenge.expiresAt !== 'string' ||
      typeof value.challenge.resendAt !== 'string' ||
      Date.parse(value.challenge.expiresAt) <= Date.now()
    ) {
      window.sessionStorage.removeItem(OTP_FLOW_STORAGE_KEY)
      return null
    }
    return value as StoredOtpFlow
  } catch {
    window.sessionStorage.removeItem(OTP_FLOW_STORAGE_KEY)
    return null
  }
}

function storeOtpFlow(flow: StoredOtpFlow) {
  window.sessionStorage.setItem(OTP_FLOW_STORAGE_KEY, JSON.stringify(flow))
}

function clearStoredOtpFlow() {
  if (typeof window !== 'undefined')
    window.sessionStorage.removeItem(OTP_FLOW_STORAGE_KEY)
}

const MAPPED_CODES = new Set([
  'OTP_COOLDOWN',
  'OTP_RATE_LIMITED',
  'PHONE_NOT_FOUND',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'REGISTRATION_SESSION_EXPIRED',
  'RATE_LIMIT_EXCEEDED',
  'OTP_UNAVAILABLE',
  'REGISTRATION_UNAVAILABLE',
  'OTP_MAX_ATTEMPTS',
  'PHONE_INVALID',
] as const)
type MappedCode = typeof MAPPED_CODES extends Set<infer C> ? C : never

function extractError(err: unknown, fallback: string, t: LoginT): string {
  const problem = normalizeApiProblem(err)
  if (problem.code && MAPPED_CODES.has(problem.code as MappedCode))
    return t(problem.code as MappedCode)
  if (problem.kind === 'network') return t('networkError')
  if (problem.kind === 'timeout') return t('timeoutError')
  if (problem.kind === 'unknown' || problem.kind === 'cancelled')
    return fallback
  return problem.message || fallback
}

const cooldownFrom = (response: SendOtpResponse): number =>
  Math.max(0, Math.ceil((Date.parse(response.resendAt) - Date.now()) / 1000))

const toE164 = (formatted: string) => '+' + formatted.replace(/\D/g, '')

/** What the phone field shows: the typed number as grouped E.164. */
function phoneDisplay(raw: string, country: PhoneCountry): string {
  const typed = raw.trim()
  if (!typed) return ''
  const normalized = typed.startsWith('+')
    ? `+${typed.replace(/\D/g, '')}`
    : normalizePhone(typed, country)
  const digits = normalized.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS)
  return digits ? formatPhone(`+${digits}`) : '+'
}

interface VerifyOutcome {
  generation: number
  next: 'name' | 'success'
}

/** Keep the public language for the whole auth flow without changing the profile. */
export function LoginScreen() {
  useDesignSystemRoot()
  const { locale } = useLocale()
  const [language] = useState(() => siteLocalePreference.get() ?? locale)
  return (
    <LocaleOverride locale={language} syncRequestLocale>
      <LoginFlow />
    </LocaleOverride>
  )
}

function LoginFlow() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const t = useT(loginMessages)
  const { locale } = useLocale()
  const fallbackReturnTo = (location.state as { from?: string } | null)?.from
  const returnTo = resolvePostLoginDestination(
    location.search,
    fallbackReturnTo ?? '/account',
    auth.tenant,
  )
  const ownerSetup = returnTo.startsWith('/account') && auth.tenant === null
  const [step, setStep] = useState<Step>(() =>
    auth.status === 'authenticated' && needsOwnerName(auth.user)
      ? 'name'
      : 'phone',
  )
  const [purpose, setPurpose] = useState<'login' | 'registration'>('login')
  const [challenge, setChallenge] = useState<SendOtpResponse | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const cancellationRef = useRef<Promise<void> | null>(null)
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<PhoneCountry>(() =>
    phoneCountryForLocale(locale),
  )
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const resendDeadlineRef = useRef(0)
  const mountedRef = useRef(false)
  const navigationGenerationRef = useRef(0)
  const navigationTimerRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestControllerRef.current?.abort()
      navigationGenerationRef.current += 1
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current)
        navigationTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (auth.status === 'authenticated') {
      clearStoredOtpFlow()
      return
    }
    const stored = readStoredOtpFlow()
    if (!stored) return
    const restoreId = window.setTimeout(() => {
      setPurpose(stored.purpose)
      setChallenge(stored.challenge)
      setPhone(stored.phone)
      setCountry((current) => phoneCountry(stored.phone) ?? current)
      resendDeadlineRef.current = Date.parse(stored.challenge.resendAt)
      setResendIn(cooldownFrom(stored.challenge))
      setStep('otp')
    }, 0)
    return () => window.clearTimeout(restoreId)
  }, [auth.status])

  const beginNavigationOperation = useCallback(() => {
    navigationGenerationRef.current += 1
    if (navigationTimerRef.current !== null) {
      window.clearTimeout(navigationTimerRef.current)
      navigationTimerRef.current = null
    }
    return navigationGenerationRef.current
  }, [])

  const isCurrentNavigationOperation = useCallback(
    (generation: number) =>
      mountedRef.current && navigationGenerationRef.current === generation,
    [],
  )

  const scheduleNavigation = useCallback(
    (generation: number) => {
      if (!isCurrentNavigationOperation(generation)) return
      navigationTimerRef.current = window.setTimeout(() => {
        if (isCurrentNavigationOperation(generation)) {
          void navigate(returnTo, { replace: true })
        }
        if (navigationGenerationRef.current === generation) {
          navigationTimerRef.current = null
        }
      }, 800)
    },
    [isCurrentNavigationOperation, navigate, returnTo],
  )

  useEffect(() => {
    if (resendIn <= 0) return
    const id = window.setTimeout(
      () =>
        setResendIn(
          Math.max(
            0,
            Math.ceil((resendDeadlineRef.current - Date.now()) / 1000),
          ),
        ),
      1000,
    )
    return () => window.clearTimeout(id)
  }, [resendIn])

  const requestOtp = useCallback(async () => {
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    const request = { phone: toE164(phone) }
    const options = { signal: controller.signal }
    await cancellationRef.current
    const response =
      purpose === 'registration'
        ? await authApi.registrationSend(request, options)
        : await authApi.otpSend(request, options)
    if (!mountedRef.current || controller.signal.aborted) return null
    return response
  }, [phone, purpose])

  const sendOtp = useOperation<SendOtpResponse | null>(requestOtp, {
    errorMessage: (error) => extractError(error, t('sendFailed'), t),
    onSuccess: (response) => {
      if (!response) return
      storeOtpFlow({ purpose, phone, challenge: response })
      setChallenge(response)
      setOtp('')
      setCodeError(null)
      setStep('otp')
      resendDeadlineRef.current = Date.parse(response.resendAt)
      setResendIn(cooldownFrom(response))
    },
    onError: (error) => {
      const problem = normalizeApiProblem(error)
      if (problem.retryAfterSeconds !== undefined) {
        resendDeadlineRef.current =
          Date.now() + problem.retryAfterSeconds * 1000
        setResendIn(problem.retryAfterSeconds)
      }
    },
  })

  const verifyOtp = useOperation<VerifyOutcome | null>(
    useCallback(async () => {
      const generation = beginNavigationOperation()
      if (!challenge || Date.parse(challenge.expiresAt) <= Date.now())
        throw Object.assign(new Error(t('OTP_EXPIRED')), {
          kind: 'validation',
          code: 'OTP_EXPIRED',
        })
      const controller = new AbortController()
      requestControllerRef.current = controller
      const request = {
        phone: toE164(phone),
        code: otp,
        challengeId: challenge.challengeId,
      }
      const options = { signal: controller.signal }
      const response =
        purpose === 'registration'
          ? await authApi.registrationVerify(request, options)
          : await authApi.otpVerify(request, options)
      if (!isCurrentNavigationOperation(generation)) return null
      clearStoredOtpFlow()
      // A provisioned account still has its phone as display name until the
      // owner supplies a name. Ask for it even when the user row already exists.
      if (response.isNewUser || needsOwnerName(response.user))
        return { generation, next: 'name' }
      await auth.hydrate(response.accessToken)
      if (!isCurrentNavigationOperation(generation)) return null
      return { generation, next: 'success' }
    }, [
      auth,
      beginNavigationOperation,
      isCurrentNavigationOperation,
      otp,
      phone,
      purpose,
      challenge,
      t,
    ]),
    {
      errorMessage: (error) => extractError(error, t('OTP_INVALID'), t),
      onSuccess: (outcome) => {
        if (outcome === null) return
        if (outcome.next === 'name') {
          setStep('name')
          return
        }
        setStep('success')
        scheduleNavigation(outcome.generation)
      },
    },
  )

  const resendOtp = useOperation<SendOtpResponse | null>(requestOtp, {
    errorMessage: (error) => extractError(error, t('sendFailed'), t),
    onSuccess: (response) => {
      if (!response) return
      storeOtpFlow({ purpose, phone, challenge: response })
      setChallenge(response)
      setOtp('')
      resendDeadlineRef.current = Date.parse(response.resendAt)
      setResendIn(cooldownFrom(response))
    },
    onError: (error) => {
      const problem = normalizeApiProblem(error)
      if (problem.retryAfterSeconds !== undefined) {
        resendDeadlineRef.current = Math.max(
          resendDeadlineRef.current,
          Date.now() + problem.retryAfterSeconds * 1000,
        )
        setResendIn(
          Math.max(
            0,
            Math.ceil((resendDeadlineRef.current - Date.now()) / 1000),
          ),
        )
      }
    },
  })

  const saveName = useOperation<number | null>(
    useCallback(async () => {
      const generation = beginNavigationOperation()
      const controller = new AbortController()
      requestControllerRef.current = controller
      await authApi.updateName(name.trim(), { signal: controller.signal })
      if (!isCurrentNavigationOperation(generation)) return null
      await auth.hydrate()
      if (!isCurrentNavigationOperation(generation)) return null
      return generation
    }, [auth, beginNavigationOperation, isCurrentNavigationOperation, name]),
    {
      errorMessage: (error) => extractError(error, t('nameFailed'), t),
      onSuccess: (generation) => {
        if (generation === null) return
        setStep('success')
        scheduleNavigation(generation)
      },
    },
  )

  const busy =
    sendOtp.pending ||
    verifyOtp.pending ||
    resendOtp.pending ||
    saveName.pending

  const handlePhoneSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const e164 = toE164(phone)
    if (!isValidSignInPhone(e164)) {
      const detected = phoneCountry(e164)
      setPhoneError(
        detected === null && e164.length > 4
          ? t('phoneUnsupported')
          : t('phoneIncomplete', {
              hint: t('phoneHint', {
                pattern: PHONE_PATTERN[detected ?? country],
              }),
            }),
      )
      return
    }
    setPhoneError(null)
    sendOtp.run()
  }

  const handleOtpSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (otp.length < OTP_LENGTH) {
      setCodeError(t('codeIncomplete', { count: OTP_LENGTH }))
      return
    }
    setCodeError(null)
    resendOtp.reset()
    verifyOtp.run()
  }

  const handleResend = () => {
    if (resendIn > 0 || busy) return
    setCodeError(null)
    verifyOtp.reset()
    resendOtp.run()
  }

  const handleNameSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (name.trim().length < 2) {
      setNameError(t('nameTooShort'))
      return
    }
    setNameError(null)
    saveName.run()
  }

  const backToPhone = () => {
    if (busy) return
    beginNavigationOperation()
    requestControllerRef.current?.abort()
    clearStoredOtpFlow()
    setChallenge(null)
    if (purpose === 'registration')
      cancellationRef.current = authApi
        .cancelRegistration()
        .catch(() => undefined)
    setStep('phone')
    setOtp('')
    setCodeError(null)
    setResendIn(0)
    verifyOtp.reset()
    resendOtp.reset()
  }

  return (
    <div className="rz relative flex min-h-dvh flex-col">
      <header className="absolute inset-x-0 top-0 flex items-center justify-end px-4 pt-4">
        <Link className="rz-btn rz-btn--ghost" to="/">
          <ArrowLeft aria-hidden />
          <span>{t('home')}</span>
        </Link>
      </header>

      <main className="grid flex-1 content-center justify-items-center px-4 py-16">
        <div className="grid w-full max-w-[560px] gap-6 text-title [&_.rz-caption]:text-input [&_.rz-error]:text-input [&_.rz-hint]:text-input [&_.rz-label]:text-input">
          <AuthBrand showMark={false} />
          {step === 'phone' && (
            <PhoneStep
              purpose={purpose}
              onPurposeChange={() => {
                if (busy) return
                beginNavigationOperation()
                requestControllerRef.current?.abort()
                clearStoredOtpFlow()
                setChallenge(null)
                setOtp('')
                setResendIn(0)
                setPhoneError(null)
                sendOtp.reset()
                if (purpose === 'registration')
                  cancellationRef.current = authApi
                    .cancelRegistration()
                    .catch(() => undefined)
                setPurpose(purpose === 'login' ? 'registration' : 'login')
              }}
              country={country}
              error={sendOtp.error}
              fieldError={phoneError}
              onChange={(value) => {
                const display = phoneDisplay(value, country)
                setPhone(display)
                const detected = phoneCountry(display)
                if (detected) setCountry(detected)
                if (phoneError) setPhoneError(null)
              }}
              onCountryChange={(next) => {
                setCountry(next)
                const e164 = toE164(phone)
                const current = phoneCountry(e164)
                const national = current
                  ? e164.slice(phoneDialCode(current).length)
                  : ''
                setPhone(
                  national
                    ? formatPhone(`${phoneDialCode(next)}${national}`)
                    : '',
                )
                if (phoneError) setPhoneError(null)
              }}
              onSubmit={handlePhoneSubmit}
              pending={sendOtp.pending}
              resendIn={resendIn}
              phone={phone}
            />
          )}
          {step === 'otp' && (
            <OtpStep
              busy={busy}
              error={codeError ?? verifyOtp.error ?? resendOtp.error}
              onBack={backToPhone}
              onChange={(value) => {
                setOtp(value)
                if (codeError) setCodeError(null)
              }}
              onResend={handleResend}
              onSubmit={handleOtpSubmit}
              otp={otp}
              pending={verifyOtp.pending}
              phone={phone}
              resendIn={resendIn}
              resending={resendOtp.pending}
            />
          )}
          {step === 'name' && (
            <NameStep
              busy={busy}
              error={saveName.error}
              fieldError={nameError}
              name={name}
              ownerSetup={ownerSetup}
              onChange={(value) => {
                setName(value)
                if (nameError) setNameError(null)
              }}
              onSubmit={handleNameSubmit}
              pending={saveName.pending}
            />
          )}
          {step === 'success' && <SuccessStep returnTo={returnTo} />}
        </div>
      </main>
    </div>
  )
}

function StepHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <span className="rz-eyebrow text-caption">{eyebrow}</span>
      <h1 className="rz-h-page text-display text-balance">{title}</h1>
      {children}
    </div>
  )
}

function PhoneStep({
  resendIn,
  purpose,
  onPurposeChange,
  phone,
  country,
  onCountryChange,
  onChange,
  onSubmit,
  pending,
  error,
  fieldError,
}: {
  resendIn: number
  purpose: 'login' | 'registration'
  onPurposeChange: () => void
  phone: string
  country: PhoneCountry
  onCountryChange: (country: PhoneCountry) => void
  onChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  pending: boolean
  error: string | null
  fieldError: string | null
}) {
  const t = useT(loginMessages)
  const dialCode = phoneDialCode(country)
  const nationalPhone = phone.startsWith(dialCode)
    ? phone.slice(dialCode.length).trimStart()
    : phone
  return (
    <div className="grid gap-5">
      <StepHeader
        eyebrow={
          purpose === 'login' ? t('eyebrowLogin') : t('eyebrowRegistration')
        }
        title={purpose === 'login' ? t('titleLogin') : t('titleRegistration')}
      >
        <p className="text-app-muted m-0">
          {purpose === 'login' ? t('leadLogin') : t('leadRegistration')}
        </p>
      </StepHeader>

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        {error !== null && (
          // Being offline is a condition to wait out, not a failure.
          <Notice
            role="alert"
            tone={error === t('networkError') ? 'warn' : 'danger'}
          >
            {error}
          </Notice>
        )}

        <Field
          error={fieldError ?? undefined}
          hint={t('phoneHint', { pattern: PHONE_PATTERN[country] })}
          label={t('phoneLabel')}
        >
          <div className="rz-input-group h-touch has-[input[aria-invalid=true]]:border-state-danger">
            <div className="border-app-line relative flex h-full shrink-0 items-center border-r">
              <span
                aria-hidden
                className="text-app-ink pointer-events-none flex h-full items-center gap-1.5 px-2.5"
              >
                <span>{PHONE_FLAGS[country]}</span>
                <span className="font-mono tabular-nums">{dialCode}</span>
                <ChevronDown className="text-app-dim size-3.5" />
              </span>
              <select
                aria-label={t('phoneCountry')}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                disabled={pending}
                onChange={(event) =>
                  onCountryChange(event.target.value as PhoneCountry)
                }
                value={country}
              >
                {PHONE_COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {PHONE_FLAGS[code]} {t(COUNTRY_KEY[code])}{' '}
                    {phoneDialCode(code)}
                  </option>
                ))}
              </select>
            </div>
            <TextInput
              autoComplete="tel"
              autoFocus
              disabled={pending}
              className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-2.5 font-mono text-title tabular-nums shadow-none hover:border-0 focus:shadow-none"
              inputMode="tel"
              maxLength={22}
              onChange={(e) => onChange(e.target.value)}
              placeholder={PHONE_PATTERN[country]
                .slice(dialCode.length)
                .trimStart()
                .replace(/X/g, '0')}
              type="tel"
              value={nationalPhone}
            />
          </div>
        </Field>

        <Button
          aria-busy={pending}
          className="rz-btn--block text-title"
          size="touch"
          disabled={pending || resendIn > 0}
          type="submit"
          variant="primary"
        >
          {pending ? t('sending') : t('getCode')}
        </Button>

        {resendIn > 0 && (
          <p className="rz-caption m-0 text-center" role="status">
            {t('tryAgainIn', { seconds: resendIn })}
          </p>
        )}

        <div className="flex justify-center">
          <button
            className="group text-app-dim min-h-touch cursor-pointer border-0 bg-transparent px-2 text-center disabled:cursor-not-allowed disabled:opacity-55"
            disabled={pending}
            onClick={onPurposeChange}
            type="button"
          >
            {purpose === 'login' ? t('toRegistrationLead') : t('toLoginLead')}{' '}
            <span className="text-brand-text group-hover:underline group-focus-visible:underline">
              {purpose === 'login'
                ? t('toRegistrationAction')
                : t('toLoginAction')}
            </span>
          </button>
        </div>

        <p className="rz-caption m-0 text-center">
          {t('privacyLead')} <Link to="/privacy">{t('privacyLink')}</Link>
        </p>
      </form>
    </div>
  )
}

function OtpStep({
  phone,
  otp,
  onChange,
  onSubmit,
  onBack,
  onResend,
  resendIn,
  pending,
  resending,
  busy,
  error,
}: {
  phone: string
  otp: string
  onChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onBack: () => void
  onResend: () => void
  resendIn: number
  pending: boolean
  resending: boolean
  busy: boolean
  error: string | null
}) {
  const groupId = useId()
  const labelId = `${groupId}-label`
  const hintId = `${groupId}-hint`
  const waitId = `${groupId}-wait`
  const waiting = resendIn > 0
  const t = useT(loginMessages)

  return (
    <div className="grid gap-5">
      <StepHeader eyebrow={t('eyebrowConfirm')} title={t('otpTitle')}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-app-muted m-0">
            {t('sentTo')}{' '}
            <span className="text-app-ink font-mono tabular-nums">{phone}</span>
          </p>
          <Button
            className="-ml-2 px-2 text-body"
            disabled={busy}
            onClick={onBack}
            variant="quiet"
          >
            <ArrowLeft />
            {t('changeNumber')}
          </Button>
        </div>
      </StepHeader>

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        {error !== null && <Notice tone="danger">{error}</Notice>}

        <div
          aria-describedby={hintId}
          aria-labelledby={labelId}
          className="flex flex-col gap-1.5"
          role="group"
        >
          <span className="rz-label" id={labelId}>
            {t('codeLabel')}
          </span>
          <OtpInput
            autoFocus
            describedBy={hintId}
            invalid={error !== null}
            length={OTP_LENGTH}
            onChange={onChange}
            value={otp}
          />
          <p className="rz-hint m-0" id={hintId}>
            {t('codeHint')}
          </p>
        </div>

        <Button
          aria-busy={pending}
          className="rz-btn--block text-title"
          size="touch"
          disabled={pending}
          type="submit"
          variant="primary"
        >
          {pending ? t('verifying') : t('confirm')}
        </Button>

        <div className="flex flex-col items-center gap-1.5">
          <Button
            aria-busy={resending}
            aria-describedby={waiting ? waitId : undefined}
            disabled={waiting || busy}
            onClick={onResend}
            size="wide"
            variant="quiet"
          >
            {resending ? t('sending') : t('resend')}
          </Button>
          {waiting && (
            <p className="rz-caption m-0 text-center" id={waitId}>
              {t('resendIn', { seconds: resendIn })}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

function NameStep({
  name,
  ownerSetup,
  onChange,
  onSubmit,
  pending,
  busy,
  error,
  fieldError,
}: {
  name: string
  ownerSetup: boolean
  onChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  pending: boolean
  busy: boolean
  error: string | null
  fieldError: string | null
}) {
  const t = useT(loginMessages)
  return (
    <div className="grid gap-5">
      <StepHeader
        eyebrow={ownerSetup ? t('eyebrowOwnerName') : t('eyebrowName')}
        title={ownerSetup ? t('ownerNameTitle') : t('nameTitle')}
      >
        <p className="text-app-muted m-0">{t('nameLead')}</p>
      </StepHeader>

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        {error !== null && <Notice tone="danger">{error}</Notice>}

        <Field
          error={fieldError ?? undefined}
          hint={t('nameHint')}
          label={ownerSetup ? t('ownerNameLabel') : t('nameLabel')}
        >
          <TextInput
            autoComplete="name"
            autoFocus
            className="rz-input h-touch text-title"
            inputMode="text"
            maxLength={64}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('namePlaceholder')}
            type="text"
            value={name}
          />
        </Field>

        <Button
          aria-busy={pending}
          className="rz-btn--block text-title"
          size="touch"
          disabled={busy}
          type="submit"
          variant="primary"
        >
          {pending ? t('savingName') : t('continue')}
        </Button>
      </form>
    </div>
  )
}

function SuccessStep({ returnTo }: { returnTo: string }) {
  const t = useT(loginMessages)
  return (
    <div className="grid gap-5">
      <StepHeader eyebrow={t('eyebrowLogin')} title={t('signedIn')} />
      <Notice tone="ok">{t('redirecting')}</Notice>
      <Button
        asChild
        className="rz-btn--block text-title"
        size="touch"
        variant="primary"
      >
        <Link to={returnTo}>{t('continue')}</Link>
      </Button>
    </div>
  )
}

function OtpInput({
  value,
  onChange,
  length,
  autoFocus,
  invalid,
  describedBy,
}: {
  value: string
  onChange: (v: string) => void
  length: number
  autoFocus?: boolean
  invalid: boolean
  describedBy: string
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const t = useT(loginMessages)

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus()
  }, [autoFocus])

  const handleInput = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    const chars = value.split('')
    while (chars.length < length) chars.push('')
    chars[i] = digit
    const next = chars.join('').slice(0, length)
    onChange(next)
    if (digit && i < length - 1) {
      inputsRef.current[i + 1]?.focus()
    }
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      e.preventDefault()
      inputsRef.current[i - 1]?.focus()
      const chars = value.split('')
      chars[i - 1] = ''
      onChange(chars.join(''))
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault()
      inputsRef.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault()
      inputsRef.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length)
    if (!pasted) return
    onChange(pasted)
    const focusIdx = Math.min(pasted.length, length - 1)
    inputsRef.current[focusIdx]?.focus()
  }

  return (
    <div className="grid grid-cols-6 gap-1.5">
      {Array.from({ length }).map((_, i) => (
        <input
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoComplete="one-time-code"
          className="rz-input h-touch min-w-0 px-0 text-center font-mono text-title"
          inputMode="numeric"
          key={i}
          aria-label={t('digit', { index: i + 1 })}
          maxLength={1}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          pattern="[0-9]*"
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          value={value[i] ?? ''}
        />
      ))}
    </div>
  )
}
