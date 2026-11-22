import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { normalizeApiProblem } from '@/api/errors'
import {
  olxListingSettingsApi,
  type OlxListingSettingsRequest,
  type OlxListingSettingsView,
} from '@/api/olx-listing-settings'
import type { OlxCity, OlxDistrict } from '@/api/olx-live'
import {
  Button,
  Card,
  ErrorState,
  FactRows,
  Field,
  Notice,
  PanelFooter,
  SelectInput,
  SkeletonRows,
  TextArea,
  TextInput,
  useOptionalToast,
} from '@/components/app'
import { useT } from '@/i18n'
import { tenantRequestScope } from '../tenant-request-scope'
import { OlxCityPicker } from './OlxCityPicker'
import { olxCityLabel } from './olx-city-label'
import { olxListingSettingsMessages } from './olx-listing-settings-messages'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; settings: OlxListingSettingsView }

type Setting = keyof OlxListingSettingsRequest
const fieldErrorKeys = {
  contactPhone: 'invalidContactPhone',
  contactName: 'invalidContactName',
  cityId: 'invalidCityId',
  districtId: 'invalidDistrictId',
  descriptionSuffix: 'invalidDescriptionSuffix',
} as const satisfies Record<Setting, keyof typeof olxListingSettingsMessages.uk>
type FieldError = (typeof fieldErrorKeys)[Setting]
type FieldErrors = Partial<Record<Setting, FieldError>>
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'denied' | 'invalid'
interface LocationRead<T> {
  cityId: number
  attempt: number
  data: T | null
}

function trimToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function matches(
  left: OlxListingSettingsRequest,
  right: OlxListingSettingsView,
) {
  return (
    left.contactPhone === right.contactPhone &&
    left.contactName === right.contactName &&
    left.cityId === right.cityId &&
    left.districtId === right.districtId &&
    left.descriptionSuffix === right.descriptionSuffix
  )
}

interface LocationSetup {
  accountHref: string
  onSaved: () => void
}

export function OlxListingSettingsPanel({
  canManage,
  actionsHost = null,
  setupLocation,
}: {
  canManage: boolean
  actionsHost?: HTMLElement | null
  setupLocation?: LocationSetup
}) {
  const t = useT(olxListingSettingsMessages)
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [tenantSignal] = useState(() => tenantRequestScope.signal)

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    void olxListingSettingsApi.get({ signal }).then(
      (settings) => {
        if (!signal.aborted) setLoad({ kind: 'ready', settings })
      },
      () => {
        if (!signal.aborted) setLoad({ kind: 'error' })
      },
    )
    return () => controller.abort()
  }, [attempt, tenantSignal])

  if (load.kind === 'error') {
    return (
      <ErrorState
        title={t('readError')}
        retryLabel={t('retry')}
        onRetry={() => {
          setLoad({ kind: 'loading' })
          setAttempt((value) => value + 1)
        }}
      />
    )
  }

  if (load.kind === 'loading') {
    return (
      <Card title={t('title')}>
        <div aria-busy aria-label={t('loading')} role="status">
          <SkeletonRows rows={4} />
        </div>
      </Card>
    )
  }

  return (
    <ListingSettingsForm
      initial={load.settings}
      canManage={canManage}
      tenantSignal={tenantSignal}
      actionsHost={actionsHost}
      setupLocation={setupLocation}
    />
  )
}

function ListingSettingsForm({
  initial,
  canManage,
  tenantSignal,
  actionsHost,
  setupLocation,
}: {
  initial: OlxListingSettingsView
  canManage: boolean
  tenantSignal: AbortSignal
  actionsHost: HTMLElement | null
  setupLocation: LocationSetup | undefined
}) {
  const t = useT(olxListingSettingsMessages)
  const formId = useId()
  const toast = useOptionalToast()
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState<OlxListingSettingsRequest>(initial)
  const [state, setState] = useState<SaveState>('idle')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pickedCity, setPickedCity] = useState<OlxCity | null>(null)
  const [cityLookup, setCityLookup] = useState<LocationRead<OlxCity> | null>(
    null,
  )
  const [districtLookup, setDistrictLookup] = useState<LocationRead<
    OlxDistrict[]
  > | null>(null)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const mutation = useRef<AbortController | null>(null)

  useEffect(() => () => mutation.current?.abort(), [])

  const cityId = draft.cityId ?? null
  const districtId = draft.districtId ?? null
  const chosenCity = pickedCity?.id === cityId ? pickedCity : null

  useEffect(() => {
    if (cityId === null) return
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    const options = { signal }
    if (chosenCity === null) {
      void olxListingSettingsApi.city(cityId, options).then(
        (data) => {
          if (!signal.aborted)
            setCityLookup({ cityId, attempt: catalogAttempt, data })
        },
        () => {
          if (!signal.aborted)
            setCityLookup({ cityId, attempt: catalogAttempt, data: null })
        },
      )
    }
    void olxListingSettingsApi.districts(cityId, options).then(
      (data) => {
        if (!signal.aborted)
          setDistrictLookup({ cityId, attempt: catalogAttempt, data })
      },
      () => {
        if (!signal.aborted)
          setDistrictLookup({ cityId, attempt: catalogAttempt, data: null })
      },
    )
    return () => controller.abort()
  }, [cityId, chosenCity, catalogAttempt, tenantSignal])

  const currentCity = cityLookup?.cityId === cityId ? cityLookup : null
  const city = chosenCity ?? currentCity?.data
  const cityFailed =
    !chosenCity &&
    currentCity?.attempt === catalogAttempt &&
    currentCity.data === null
  const districts =
    districtLookup?.cityId === cityId &&
    districtLookup.attempt === catalogAttempt
      ? districtLookup.data
      : undefined
  const district = districts?.find((item) => item.id === districtId)
  const catalogFailed = cityFailed || districts === null
  const busy = state === 'saving'
  const choosingInitialLocation = Boolean(
    canManage && setupLocation && saved.cityId === null,
  )
  const locationReady =
    cityId !== null &&
    districts != null &&
    (districts.length === 0 || district !== undefined)

  const request: OlxListingSettingsRequest = {
    contactName: trimToNull(draft.contactName),
    contactPhone: trimToNull(draft.contactPhone),
    cityId,
    districtId,
    descriptionSuffix: trimToNull(draft.descriptionSuffix),
  }
  const changed = !matches(request, saved)
  const changedLocation =
    cityId !== saved.cityId || districtId !== saved.districtId
  const canSave =
    canManage &&
    changed &&
    !busy &&
    (!choosingInitialLocation || locationReady) &&
    (!changedLocation || cityId === null || Boolean(districts))

  function change(values: Partial<OlxListingSettingsRequest>) {
    setDraft((current) => ({ ...current, ...values }))
    setFieldErrors((current) => {
      const next = { ...current }
      for (const field of Object.keys(values) as Setting[]) delete next[field]
      return next
    })
    setState('idle')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave || mutation.current || tenantSignal.aborted) return

    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, tenantSignal])
    mutation.current = controller
    setState('saving')
    setFieldErrors({})
    try {
      const updated = await olxListingSettingsApi.update(request, { signal })
      if (signal.aborted) return
      setSaved(updated)
      setDraft(updated)
      setState('saved')
      toast?.show({ tone: 'ok', message: t('saved') })
      if (choosingInitialLocation && updated.cityId !== null)
        setupLocation?.onSaved()
    } catch (error) {
      if (signal.aborted) return
      const problem = normalizeApiProblem(error)
      const fields = new Set(
        Object.keys(problem.fieldErrors ?? {}).map((field) =>
          field.toLowerCase(),
        ),
      )
      const errors: FieldErrors = Object.fromEntries(
        Object.entries(fieldErrorKeys).filter(([field]) =>
          fields.has(field.toLowerCase()),
        ),
      )
      setFieldErrors(errors)
      setState(
        problem.kind === 'forbidden'
          ? 'denied'
          : Object.keys(errors).length > 0
            ? 'invalid'
            : 'error',
      )
    } finally {
      mutation.current = null
    }
  }

  function fieldError(field: Setting) {
    const error = fieldErrors[field]
    return error ? t(error) : undefined
  }

  const cityLabel = city
    ? olxCityLabel(city)
    : cityId === null
      ? t('chooseCity')
      : t(cityFailed ? 'unavailable' : 'loading')
  const districtLabel =
    district?.name ??
    t(
      districts === undefined
        ? 'loading'
        : districtId === null
          ? 'notSet'
          : 'unavailable',
    )
  const needsDistrict =
    canManage && changedLocation && Boolean(districts?.length)

  const actions = canManage && (
    <>
      <Button
        disabled={busy || (!changed && state === 'idle')}
        onClick={() => {
          setDraft(saved)
          setFieldErrors({})
          setState('idle')
        }}
      >
        {t('cancel')}
      </Button>
      <Button form={formId} type="submit" variant="primary" disabled={!canSave}>
        {t(busy ? 'saving' : 'save')}
      </Button>
    </>
  )

  return (
    <form
      id={formId}
      className="grid min-w-0 gap-3.5"
      onSubmit={(event) => void save(event)}
      aria-busy={busy || undefined}
    >
      {!canManage && <Notice>{t('readOnly')}</Notice>}
      {choosingInitialLocation && setupLocation && (
        <Notice
          block
          className="max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:items-start"
          action={
            !busy && (
              <Button
                asChild
                variant="quiet"
                className="max-sm:col-start-2 max-sm:justify-self-start max-sm:px-0"
              >
                <Link to={setupLocation.accountHref}>{t('setupLater')}</Link>
              </Button>
            )
          }
        >
          <p className="m-0 font-medium">{t('setupCityTitle')}</p>
          <p className="m-0 mt-1">{t('setupCityHint')}</p>
        </Notice>
      )}
      <Card
        title={t('contacts')}
        headerClassName="min-h-0 border-0 pt-4 pb-0"
        bodyClassName="grid gap-3 pt-1"
      >
        <p className="rz-caption m-0">{t('contactsHint')}</p>
        <div className="grid min-w-0 gap-x-3 gap-y-4 sm:grid-cols-2">
          <Field label={t('contactPhone')} error={fieldError('contactPhone')}>
            <TextInput
              type="tel"
              autoComplete="tel"
              className="font-mono"
              maxLength={30}
              disabled={busy}
              readOnly={!canManage}
              value={draft.contactPhone ?? ''}
              onChange={(event) => change({ contactPhone: event.target.value })}
            />
          </Field>
          <Field label={t('contactName')} error={fieldError('contactName')}>
            <TextInput
              autoComplete="name"
              maxLength={100}
              disabled={busy}
              readOnly={!canManage}
              value={draft.contactName ?? ''}
              onChange={(event) => change({ contactName: event.target.value })}
            />
          </Field>
          {canManage ? (
            <OlxCityPicker
              cityId={cityId}
              initiallyOpen={choosingInitialLocation}
              required={choosingInitialLocation}
              selectedLabel={cityLabel}
              load={olxListingSettingsApi.cities}
              disabled={busy}
              error={fieldError('cityId')}
              tenantSignal={tenantSignal}
              onPick={(item) => {
                setPickedCity(item)
                if (item?.id !== cityId)
                  change({ cityId: item?.id ?? null, districtId: null })
              }}
            />
          ) : (
            <Field label={t('cityId')}>
              <TextInput
                readOnly
                value={cityId === null ? t('notSet') : cityLabel}
              />
            </Field>
          )}
          {cityId !== null &&
            (districtId !== null ||
              districts?.length !== 0 ||
              fieldErrors.districtId) && (
              <Field
                label={t('districtId')}
                hint={canManage ? t('districtHint') : undefined}
                error={fieldError('districtId')}
                required={needsDistrict}
              >
                {!canManage || !districts ? (
                  <TextInput
                    readOnly
                    disabled={canManage}
                    value={districtLabel}
                  />
                ) : (
                  <SelectInput
                    aria-required={needsDistrict || undefined}
                    disabled={busy}
                    value={districtId ?? ''}
                    onChange={(event) =>
                      change({ districtId: Number(event.target.value) || null })
                    }
                  >
                    <option value="">{t('chooseDistrict')}</option>
                    {districtId !== null && !district && (
                      <option value={districtId}>{t('unavailable')}</option>
                    )}
                    {districts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
            )}
        </div>
        {catalogFailed && (
          <Notice
            tone="warn"
            action={
              <div className="rz-btn-row">
                {canManage && changedLocation && (
                  <Button
                    onClick={() =>
                      change({
                        cityId: saved.cityId ?? null,
                        districtId: saved.districtId ?? null,
                      })
                    }
                    disabled={busy}
                  >
                    {t('restoreLocation')}
                  </Button>
                )}
                <Button
                  onClick={() => setCatalogAttempt((attempt) => attempt + 1)}
                  disabled={busy}
                >
                  {t('retry')}
                </Button>
              </div>
            }
          >
            {t(
              canManage && !changedLocation
                ? 'dictionaryError'
                : 'dictionaryReadError',
            )}
          </Notice>
        )}
      </Card>
      <Card
        title={t('descriptionSuffix')}
        headerClassName="min-h-0 border-0 pt-4 pb-0"
        bodyClassName="grid gap-3 pt-1"
      >
        <p className="rz-caption m-0">{t('suffixHint')}</p>
        <Field
          label={t('descriptionSuffix')}
          hiddenLabel
          error={fieldError('descriptionSuffix')}
        >
          <TextArea
            rows={3}
            maxLength={9000}
            disabled={busy}
            readOnly={!canManage}
            value={draft.descriptionSuffix ?? ''}
            onChange={(event) =>
              change({ descriptionSuffix: event.target.value })
            }
          />
        </Field>
      </Card>
      <Card
        title={t('price')}
        headerClassName="min-h-0 border-0 pt-4 pb-0"
        bodyClassName="pt-2"
      >
        <FactRows
          rows={[
            { label: t('priceSource'), value: t('priceValue') },
            { label: t('priceAdjustments'), value: t('priceAdjustmentsValue') },
          ]}
        />
      </Card>
      {state === 'saved' && !toast && <Notice tone="ok">{t('saved')}</Notice>}
      {state === 'denied' && <Notice tone="danger">{t('saveDenied')}</Notice>}
      {state === 'invalid' && (
        <Notice tone="danger">{t('validationError')}</Notice>
      )}
      {state === 'error' && <Notice tone="danger">{t('saveError')}</Notice>}
      {actions &&
        (actionsHost ? (
          createPortal(actions, actionsHost)
        ) : (
          <PanelFooter standalone>{actions}</PanelFooter>
        ))}
    </form>
  )
}
