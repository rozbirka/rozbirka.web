import { useEffect, useId, useRef, useState } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import { useAuth } from '@/auth/AuthContext'
import { Button, Notice } from '@/components/app'
import { useOptionalToast } from '@/components/app/toast-context'
import {
  browserLanguages,
  isLocale,
  LOCALE_NATIVE_NAMES,
  resolveLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/i18n/locales'
import { useLocale } from '@/i18n/LocaleProvider'
import { useT } from '@/i18n/hooks'
import { languageNameMessages, profileMessages } from './profile-messages'

type Choice = Locale | 'auto'
type SaveState = 'idle' | 'pending' | 'error'

/** Native name of a browser language tag, e.g. `de-DE` → `Deutsch`. */
function nativeLanguageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag)
    if (!name) return tag
    return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
  } catch {
    return tag
  }
}

/**
 * Personal interface language (ROZ-161 1a–1d): automatic or one of the
 * supported languages, saved in the Core profile (`PATCH /auth/me/language`).
 * A deployment whose Core predates that endpoint answers 404/405: the choice
 * is then kept on this device and said so. It never changes the public-site
 * language (`siteLocalePreference`).
 */
export function LanguageCard({ embedded = false }: { embedded?: boolean }) {
  const auth = useAuth()
  const { locale, resolution, devicePreference, setDevicePreference } =
    useLocale()
  const t = useT(profileMessages)
  const names = useT(languageNameMessages)
  const toast = useOptionalToast()
  const groupName = useId()
  const alertRef = useRef<HTMLDivElement>(null)

  const profileLanguage = auth.user?.language
  const saved: Choice = isLocale(profileLanguage)
    ? profileLanguage
    : (devicePreference ?? 'auto')
  const [choice, setChoice] = useState<Choice>(saved)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the draft follows the saved value when it changes elsewhere.
    setChoice(saved)
  }, [saved])

  useEffect(() => {
    if (saveState === 'error') alertRef.current?.focus()
  }, [saveState])

  const browser = browserLanguages()
  const detected = resolveLocale({ browser }).locale
  const pending = saveState === 'pending'
  const showFallback =
    resolution.source === 'fallback' && resolution.browserLanguage !== null

  const save = async () => {
    const language = choice === 'auto' ? null : choice
    setSaveState('pending')
    const keepOnDevice = () => {
      setDevicePreference(language)
      setSaveState('idle')
      toast?.show({ tone: 'info', message: t('savedDevice') })
    }
    if (!auth.updateLanguage) {
      keepOnDevice()
      return
    }
    try {
      await auth.updateLanguage(language)
      // Mirror the saved choice so the sign-in screen opens in it too.
      setDevicePreference(language)
      setSaveState('idle')
      toast?.show({ tone: 'ok', message: t('savedToast'), duration: 4000 })
    } catch (error) {
      const problem = normalizeApiProblem(error)
      if (problem.kind === 'cancelled') return
      // An older Core without the endpoint answers 404/405.
      if (
        problem.kind === 'not-found' ||
        problem.status === 404 ||
        problem.status === 405 ||
        problem.status === 501
      ) {
        keepOnDevice()
        return
      }
      setSaveState('error')
    }
  }

  const rows: { value: Choice; name: string; sub: string; lang: Locale }[] = [
    {
      value: 'auto',
      name: t('auto'),
      sub: t('autoSub', { language: LOCALE_NATIVE_NAMES[detected] }),
      lang: locale,
    },
    ...SUPPORTED_LOCALES.map((code) => ({
      value: code,
      name: LOCALE_NATIVE_NAMES[code],
      sub: names(code) === LOCALE_NATIVE_NAMES[code] ? '' : names(code),
      lang: code,
    })),
  ]

  return (
    <section
      aria-busy={pending || undefined}
      aria-labelledby={`${groupName}-title`}
      className={embedded ? 'grid min-w-0 gap-3' : 'rz-card min-w-0'}
    >
      <div
        className={
          embedded
            ? 'grid gap-1'
            : 'rz-card__head grid content-center gap-1 py-2.5'
        }
      >
        <h2 className="rz-h-card" id={`${groupName}-title`}>
          {t('langTitle')}
        </h2>
        <p className="rz-caption m-0">{t('langHint')}</p>
      </div>
      <div className={embedded ? 'grid gap-3' : 'rz-card__body grid gap-3'}>
        {saveState === 'error' && (
          <div ref={alertRef} tabIndex={-1}>
            <Notice
              action={
                <Button onClick={() => void save()}>
                  {t('retryLanguage')}
                </Button>
              }
              tone="danger"
            >
              <strong>{t('errTitle')}</strong> {t('errBody')}
            </Notice>
          </div>
        )}
        <fieldset className="m-0 grid gap-1.5 border-0 p-0" disabled={pending}>
          <legend className="sr-only">{t('langTitle')}</legend>
          {rows.map((row) => {
            const checked = choice === row.value
            return (
              <label
                className="rz-choice-card items-center py-2"
                key={row.value}
              >
                <input
                  checked={checked}
                  className="rz-radio shrink-0"
                  name={groupName}
                  onChange={() => {
                    setChoice(row.value)
                    if (saveState !== 'pending') setSaveState('idle')
                  }}
                  type="radio"
                  value={row.value}
                />
                <span className="grid min-w-0">
                  <span className="rz-strong font-medium" lang={row.lang}>
                    {row.name}
                  </span>
                  {row.sub && <span className="rz-caption">{row.sub}</span>}
                </span>
              </label>
            )
          })}
        </fieldset>

        {showFallback && choice === 'auto' && (
          <Notice tone="info">
            {t('fallback', {
              language: nativeLanguageName(resolution.browserLanguage ?? ''),
            })}
          </Notice>
        )}
      </div>
      <div
        className={
          embedded
            ? 'border-app-line flex justify-end border-t pt-3'
            : 'rz-card__foot justify-end'
        }
      >
        <Button
          aria-busy={pending || undefined}
          disabled={pending || choice === saved}
          onClick={() => void save()}
          variant="primary"
        >
          {pending ? t('saving') : t('saveLanguage')}
        </Button>
      </div>
    </section>
  )
}
