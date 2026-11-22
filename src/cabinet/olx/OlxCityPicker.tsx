import { useEffect, useState } from 'react'
import type { RequestOptions } from '@/api/contracts'
import type { OlxCity } from '@/api/olx-live'
import {
  Button,
  Notice,
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
} from '@/components/app'
import { useT } from '@/i18n'
import { olxCityArea, olxCityLabel } from './olx-city-label'
import { olxListingSettingsMessages } from './olx-listing-settings-messages'

export function OlxCityPicker({
  cityId,
  initiallyOpen = false,
  fieldLabel,
  selectedLabel,
  disabled,
  error,
  required,
  tenantSignal,
  load,
  onPick,
}: {
  cityId: number | null
  initiallyOpen?: boolean
  fieldLabel?: string
  selectedLabel?: string
  disabled?: boolean
  error?: string | undefined
  required?: boolean
  tenantSignal?: AbortSignal
  load: (query: string, options: RequestOptions) => Promise<OlxCity[]>
  onPick: (city: OlxCity | null) => void
}) {
  const t = useT(olxListingSettingsMessages)
  const [open, setOpen] = useState(initiallyOpen)
  const [query, setQuery] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    term: string
    attempt: number
    cities: OlxCity[] | null
  } | null>(null)
  const term = query.trim()
  const cities =
    result?.term === term && result.attempt === attempt
      ? result.cities
      : undefined

  useEffect(() => {
    if (!open || disabled || term.length < 2) return
    const controller = new AbortController()
    const signal = tenantSignal
      ? AbortSignal.any([controller.signal, tenantSignal])
      : controller.signal
    const timer = window.setTimeout(() => {
      if (signal.aborted) return
      void load(term, { signal }).then(
        (items) => {
          if (!signal.aborted) setResult({ term, attempt, cities: items })
        },
        () => {
          if (!signal.aborted) setResult({ term, attempt, cities: null })
        },
      )
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, disabled, term, attempt, tenantSignal, load])

  function pick(city: OlxCity | null) {
    onPick(city)
    setOpen(false)
    setQuery('')
  }

  const counts = new Map<string, number>()
  for (const city of cities ?? []) {
    const label = olxCityLabel(city)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return (
    <SearchPicker
      label={fieldLabel ?? t('cityId')}
      showLabel
      required={required === true}
      placeholder={t('searchCity')}
      resultsLabel={t('cityResults')}
      heading={t('cityResults')}
      count={cities?.length ?? '—'}
      triggerLabel={selectedLabel ?? t('chooseCity')}
      error={error}
      query={query}
      onQueryChange={setQuery}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled === true}
      allowEmptyQuery
      floating
      footer={
        cityId !== null ? (
          <Button variant="quiet" onClick={() => pick(null)}>
            {t('clearCity')}
          </Button>
        ) : undefined
      }
    >
      {term.length < 2 ? (
        <p className="rz-caption m-0 p-3">{t('searchCity')}</p>
      ) : cities === undefined ? (
        <p className="rz-caption m-0 p-3" role="status">
          {t('loading')}
        </p>
      ) : cities === null ? (
        <div className="p-2">
          <Notice
            tone="danger"
            action={
              <Button onClick={() => setAttempt((current) => current + 1)}>
                {t('retry')}
              </Button>
            }
          >
            {t('citiesError')}
          </Notice>
        </div>
      ) : cities.length === 0 ? (
        <p className="rz-caption m-0 p-3" role="status">
          {t('noCities')}
        </p>
      ) : (
        <SearchPickerOptions label={t('cityResults')}>
          {cities.map((item) => {
            const label = olxCityLabel(item)
            const area = olxCityArea(item)
            const alias =
              (counts.get(label) ?? 0) > 1 ? `OLX № ${item.id}` : null
            return (
              <SearchPickerOption
                key={item.id}
                label={[label, alias].filter(Boolean).join(' · ')}
                aside={null}
                selected={item.id === cityId}
                onSelect={() => pick(item)}
              >
                <span className="block min-w-0">
                  <span className="text-app-strong block font-medium">
                    {item.name}
                  </span>
                  {(area || alias) && (
                    <span className="rz-caption block text-pretty">
                      {[area, alias].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </SearchPickerOption>
            )
          })}
        </SearchPickerOptions>
      )}
    </SearchPicker>
  )
}
