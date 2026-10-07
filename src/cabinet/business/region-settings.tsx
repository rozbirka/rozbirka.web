import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { businessApi } from '@/api/business'
import { normalizeApiProblem } from '@/api/errors'
import {
  BUSINESS_COUNTRIES,
  tenantSettings,
  type BusinessCountry,
} from '@/api/tenant-settings'
import type { Tenant } from '@/api/types'
import {
  Button,
  ConfirmDialog,
  Field,
  Notice,
  Segmented,
  SelectInput,
} from '@/components/app'
import { formatDateWith, formatMoney, formatTime } from '@/i18n/format'
import { useT } from '@/i18n/hooks'
import { useLocale } from '@/i18n/LocaleProvider'
import {
  LOCALE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/i18n/locales'
import { tenantsApi } from '@/api/tenants'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { BUSINESS_SECTION_IDS } from './business-anchors'
import { regionMessages } from './region-messages'

type Translate = ReturnType<typeof useT<typeof regionMessages.uk>>

/** Default zone per business country; the owner may pick another one. */
const COUNTRY_TIME_ZONE: Record<BusinessCountry, string> = {
  UA: 'Europe/Kyiv',
  GB: 'Europe/London',
  PL: 'Europe/Warsaw',
}

const ZONE_CITY_KEY = {
  'Europe/Kyiv': 'tzKyiv',
  'Europe/London': 'tzLondon',
  'Europe/Warsaw': 'tzWarsaw',
} as const

const COUNTRY_KEY = {
  UA: 'countryUA',
  GB: 'countryGB',
  PL: 'countryPL',
} as const

const ROLE_KEY = {
  owner: 'roleOwner',
  manager: 'roleManager',
  master: 'roleMaster',
} as const

/** A fixed sample moment for the document preview: 7 Oct 2026, 14:30 Kyiv. */
const PREVIEW_INSTANT = '2026-10-07T11:30:00Z'

/** `UTC+02:00` for the zone right now (it moves with daylight saving). */
function utcOffset(timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName')?.value
    if (!part || part === 'GMT') return 'UTC+00:00'
    return part.replace('GMT', 'UTC')
  } catch {
    return ''
  }
}

function zoneLabel(timeZone: string, t: Translate): string {
  const key = ZONE_CITY_KEY[timeZone as keyof typeof ZONE_CITY_KEY]
  const city = key ? t(key) : timeZone
  const offset = utcOffset(timeZone)
  return offset ? `${city} (${offset})` : city
}

function ReadOnlyRow({
  label,
  children,
  lang,
}: {
  label: string
  children: ReactNode
  lang?: string | undefined
}) {
  return (
    <div className="border-app-line flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0">
      <dt className="text-app-muted text-[13px]">{label}</dt>
      <dd className="text-app-ink text-[14px] font-medium" lang={lang}>
        {children}
      </dd>
    </div>
  )
}

/**
 * The region as everyone may read it (ROZ-161 3d): country, time zone and
 * document language, plus whether country and time zone are locked and what
 * locks them. Core sends only `regionLocked` (no reason field), so the reason
 * is the rule itself: the first saved car, batch, part, order (or its item),
 * car expense or till transaction.
 */
export function RegionSummary({ tenant }: { tenant: Tenant }) {
  const t = useT(regionMessages)
  const settings = tenantSettings(tenant)
  if (settings.countryCode === null || settings.documentLanguage === null)
    return (
      <p className="text-app-muted text-[13px] leading-5 text-pretty">
        <strong className="text-app-ink">{t('unknownTitle')}</strong>{' '}
        {t('unknownBody')}
      </p>
    )
  return (
    <>
      <LockStatus locked={settings.regionLocked === true} t={t} />
      <dl>
        <ReadOnlyRow label={t('country')}>
          {t(COUNTRY_KEY[settings.countryCode])}
        </ReadOnlyRow>
        <ReadOnlyRow label={t('tz')}>
          {zoneLabel(settings.timeZone, t)}
        </ReadOnlyRow>
        <ReadOnlyRow label={t('docLang')} lang={settings.documentLanguage}>
          {LOCALE_NATIVE_NAMES[settings.documentLanguage]}
        </ReadOnlyRow>
      </dl>
    </>
  )
}

/** Static text, not a live region: it describes a state, not an event. */
function LockStatus({ locked, t }: { locked: boolean; t: Translate }) {
  return (
    <p className="border-app-line text-app-muted rounded-[12px] border px-3.5 py-2.5 text-[13px] leading-5 text-pretty">
      {locked ? (
        <>
          <strong className="text-app-ink">{t('lockedTitle')}</strong>{' '}
          {t('lockedBody')}
        </>
      ) : (
        t('notLockedYet')
      )}{' '}
      {t('lockReasons')}
    </p>
  )
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  /** The answer was lost: the saved settings are being read back. */
  | { kind: 'checking' }
  | { kind: 'success' }
  | { kind: 'error'; message: 'regionErr' | 'invalid' | 'forbidden' }
  /** Read back after a lost answer: not saved, or unknown. */
  | { kind: 'lost'; saved: false | null }
  | { kind: 'race' }

/**
 * Business country, time zone and document language (ROZ-161 board 3a–3f).
 * Every member reads them; only the owner edits. Country and time zone lock
 * after the first operation (`regionLocked`, reasons in `RegionSummary`), the
 * document language stays editable (REQ AC-23). A 409
 * `BUSINESS_SETTINGS_LOCKED` race turns the block into its locked state.
 */
export function RegionSettings({
  tenant,
  role,
  onSaved,
}: {
  tenant: Tenant
  /** Cabinet role name from the access snapshot (`Owner`, `Manager`, …). */
  role: string | null | undefined
  onSaved: (tenant: Tenant) => void
}) {
  const t = useT(regionMessages)
  const tl = useT(lostResponseMessages)
  const { locale } = useLocale()
  const titleId = useId()
  const alertRef = useRef<HTMLDivElement>(null)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.business,
  )
  const settings = tenantSettings(tenant)
  const isOwner = role?.toLowerCase() === 'owner'
  const known =
    settings.countryCode !== null && settings.documentLanguage !== null
  const [raceLocked, setRaceLocked] = useState(false)
  const locked = settings.regionLocked === true || raceLocked

  const savedCountry = settings.countryCode ?? 'UA'
  const savedZone = settings.timeZone
  const savedLanguage: Locale = settings.documentLanguage ?? 'uk'
  const [country, setCountry] = useState<BusinessCountry>(savedCountry)
  const [timeZone, setTimeZone] = useState(savedZone)
  const [docLanguage, setDocLanguage] = useState<Locale>(savedLanguage)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafts follow the saved tenant at a scope boundary.
    setCountry(savedCountry)
    setTimeZone(savedZone)
    setDocLanguage(savedLanguage)
  }, [tenant.id, savedCountry, savedZone, savedLanguage])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- outcome and race lock belong to one tenant scope.
    setRaceLocked(false)
    setState({ kind: 'idle' })
  }, [tenant.id])

  useEffect(() => {
    if (
      state.kind === 'error' ||
      state.kind === 'race' ||
      state.kind === 'lost'
    ) {
      alertRef.current?.focus()
    }
  }, [state.kind])

  const pending = state.kind === 'pending' || state.kind === 'checking'
  const regionChanged = country !== savedCountry || timeZone !== savedZone
  const changed = regionChanged || docLanguage !== savedLanguage
  const zoneOptions = [
    ...new Set([...Object.values(COUNTRY_TIME_ZONE), timeZone, savedZone]),
  ]

  const submit = async () => {
    setConfirmOpen(false)
    let scope: ReturnType<typeof requireLatestMutation>
    try {
      scope = requireLatestMutation({ quota: false })
    } catch {
      setState({ kind: 'error', message: 'forbidden' })
      return
    }
    setState({ kind: 'pending' })
    const sendRegion = regionChanged && !locked
    const sendLanguage = docLanguage !== savedLanguage
    try {
      const updated = await businessApi.update(
        tenant.id,
        {
          ...(sendRegion ? { countryCode: country, timeZoneId: timeZone } : {}),
          ...(sendLanguage ? { documentLanguage: docLanguage } : {}),
        },
        { signal: scope.signal },
      )
      if (scope.signal.aborted) return
      setState({ kind: 'success' })
      onSaved(updated)
    } catch (error) {
      if (scope.signal.aborted) return
      const problem = normalizeApiProblem(error)
      if (problem.kind === 'cancelled') return
      if (isLostResponse(error)) {
        // The PATCH may have landed: read the settings back before saying
        // anything. Repeating it is safe (same body, same state).
        setState({ kind: 'checking' })
        try {
          const fresh = (await tenantsApi.list({ signal: scope.signal })).find(
            (item) => item.id === tenant.id,
          )
          if (scope.signal.aborted) return
          const read = fresh === undefined ? null : tenantSettings(fresh)
          const landed =
            fresh !== undefined &&
            read !== null &&
            (!sendRegion ||
              (read.countryCode === country && read.timeZone === timeZone)) &&
            (!sendLanguage || read.documentLanguage === docLanguage)
          if (landed) {
            setState({ kind: 'success' })
            onSaved(fresh)
          } else setState({ kind: 'lost', saved: false })
        } catch {
          if (!scope.signal.aborted) setState({ kind: 'lost', saved: null })
        }
        return
      }
      if (
        problem.code === 'BUSINESS_SETTINGS_LOCKED' ||
        problem.status === 409
      ) {
        setRaceLocked(true)
        setCountry(savedCountry)
        setTimeZone(savedZone)
        setState({ kind: 'race' })
        return
      }
      if (problem.kind === 'forbidden') {
        setState({ kind: 'error', message: 'forbidden' })
        return
      }
      if (
        problem.code === 'INVALID_BUSINESS_SETTINGS' ||
        problem.kind === 'validation'
      ) {
        setState({ kind: 'error', message: 'invalid' })
        return
      }
      setState({ kind: 'error', message: 'regionErr' })
    }
  }

  const requestSave = () => {
    if (regionChanged && !locked) setConfirmOpen(true)
    else void submit()
  }

  const preview = {
    date: formatDateWith(
      PREVIEW_INSTANT,
      docLanguage,
      { day: '2-digit', month: '2-digit', year: 'numeric' },
      timeZone,
    ),
    time: formatTime(PREVIEW_INSTANT, docLanguage, timeZone),
    amount: formatMoney(12480, settings.accountingCurrency, docLanguage),
  }
  const previewLabels = (
    key: 'previewDate' | 'previewTime' | 'previewAmount',
  ) => regionMessages[docLanguage][key] as string

  const roleKey = role
    ? ROLE_KEY[role.toLowerCase() as keyof typeof ROLE_KEY]
    : undefined

  const countryName = (code: BusinessCountry) => t(COUNTRY_KEY[code])

  let body: ReactNode
  if (!known) {
    body = (
      <Notice tone="info">
        <strong>{t('unknownTitle')}</strong> {t('unknownBody')}
      </Notice>
    )
  } else if (!isOwner) {
    body = (
      <>
        <Notice tone="info">
          {t('yourRole')}: {roleKey ? t(roleKey) : (role ?? t('unknownValue'))}.{' '}
          {t('noRights')}
        </Notice>
        <RegionSummary tenant={tenant} />
      </>
    )
  } else {
    body = (
      <>
        {locked ? (
          <>
            <LockStatus locked t={t} />
            <dl>
              <ReadOnlyRow label={t('country')}>
                {countryName(savedCountry)}
              </ReadOnlyRow>
              <ReadOnlyRow label={t('tz')}>
                {zoneLabel(savedZone, t)}
              </ReadOnlyRow>
            </dl>
          </>
        ) : (
          <>
            <Notice tone="warn">
              {t('beforeFirst')} {t('lockReasons')}
            </Notice>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label={t('country')}>
                <SelectInput
                  disabled={pending}
                  onChange={(event) => {
                    const next = event.target.value as BusinessCountry
                    setCountry(next)
                    setTimeZone(COUNTRY_TIME_ZONE[next])
                    setState({ kind: 'idle' })
                  }}
                  value={country}
                >
                  {BUSINESS_COUNTRIES.map((code) => (
                    <option key={code} value={code}>
                      {countryName(code)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={t('tz')}>
                <SelectInput
                  disabled={pending}
                  onChange={(event) => {
                    setTimeZone(event.target.value)
                    setState({ kind: 'idle' })
                  }}
                  value={timeZone}
                >
                  {zoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zoneLabel(zone, t)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          </>
        )}
        <Field hint={t('docLangHint')} label={t('docLang')}>
          <Segmented
            as="toggle"
            label={t('docLang')}
            name={`${titleId}-doc-language`}
            onChange={(value) => {
              setDocLanguage(value)
              setState({ kind: 'idle' })
            }}
            options={SUPPORTED_LOCALES.map((code) => ({
              value: code,
              label: LOCALE_NATIVE_NAMES[code],
              disabled: pending,
            }))}
            value={docLanguage}
          />
        </Field>
        <div
          className="border-app-line rounded-[14px] border px-4 py-3"
          lang={docLanguage}
        >
          <p className="text-app-muted text-[12.5px]" lang={locale}>
            {t('preview')}
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-3 text-[13px]">
            {(
              [
                ['previewDate', preview.date],
                ['previewTime', preview.time],
                ['previewAmount', preview.amount],
              ] as const
            ).map(([key, value]) => (
              <div className="min-w-0" key={key}>
                <dt className="text-app-dim">{previewLabels(key)}</dt>
                <dd className="text-app-ink font-medium tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={pending || !changed}
            onClick={() => {
              setCountry(savedCountry)
              setTimeZone(savedZone)
              setDocLanguage(savedLanguage)
              setState({ kind: 'idle' })
            }}
          >
            {t('cancel')}
          </Button>
          <Button
            aria-busy={pending || undefined}
            className="px-5 text-sm font-bold"
            disabled={pending || !changed}
            onClick={requestSave}
            variant="primary"
          >
            {pending ? t('saving') : t('save')}
          </Button>
        </div>
      </>
    )
  }

  return (
    <section
      aria-busy={pending || undefined}
      aria-labelledby={titleId}
      className="border-app-line bg-app-raised min-w-0 scroll-mt-24 rounded-[20px] border px-5 py-5"
      // Deep-link target: onboarding opens /settings/business#region.
      id={BUSINESS_SECTION_IDS.region}
    >
      <div className="flex items-center gap-3">
        <span className="border-app-line text-app-dim inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]">
          02
        </span>
        <h2 className="text-app-ink text-[15px] font-bold" id={titleId}>
          {t('regionTitle')}
        </h2>
      </div>
      <div className="mt-4 grid gap-3.5">
        {state.kind === 'success' && <Notice tone="ok">{t('saved')}</Notice>}
        {state.kind === 'checking' && (
          <Notice tone="info">{tl('checking')}</Notice>
        )}
        {state.kind === 'lost' && (
          <div ref={alertRef} tabIndex={-1}>
            <Notice
              action={<Button onClick={requestSave}>{t('retry')}</Button>}
              tone="danger"
            >
              {state.saved === false ? tl('notSaved') : tl('checkFailed')}
            </Notice>
          </div>
        )}
        {(state.kind === 'error' || state.kind === 'race') && (
          <div ref={alertRef} tabIndex={-1}>
            <Notice
              action={
                state.kind === 'error' && state.message === 'regionErr' ? (
                  <Button onClick={requestSave}>{t('retry')}</Button>
                ) : undefined
              }
              tone="danger"
            >
              {state.kind === 'race' ? t('raceLocked') : t(state.message)}
            </Notice>
          </div>
        )}
        {body}
      </div>
      <ConfirmDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('save')}
        consequence={t('confirmBody')}
        destructive={false}
        onConfirm={() => void submit()}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t('confirmTitle')}
      >
        <dl>
          <ReadOnlyRow label={t('country')}>{countryName(country)}</ReadOnlyRow>
          <ReadOnlyRow label={t('tz')}>{zoneLabel(timeZone, t)}</ReadOnlyRow>
          <ReadOnlyRow label={t('docLang')} lang={docLanguage}>
            {LOCALE_NATIVE_NAMES[docLanguage]}
          </ReadOnlyRow>
        </dl>
      </ConfirmDialog>
    </section>
  )
}
