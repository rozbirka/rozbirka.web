import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { carsApi } from '@/api/cars'
import { intakesApi } from '@/api/intakes'
import type { Page } from '@/api/contracts'
import {
  Button,
  Notice,
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
} from '@/components/app'
import { appMessages } from '@/components/app/app-messages'
import { commonMessages, useT } from '@/i18n'
import { partSourceFilterMessages } from './part-source-filter-messages'

interface SourceChoice {
  id: string
  label: string
}

/** Concrete source selection; the parent owns the URL and source exclusivity. */
export function PartSourceFilter({
  kind,
  owner,
  values,
  enabled,
  selectedLabel,
  onChange,
}: {
  kind: 'cars' | 'intakes'
  owner: string
  values: readonly string[]
  enabled: boolean
  selectedLabel?: string | undefined
  onChange: (id: string | null) => void
}) {
  const t = useT(partSourceFilterMessages)
  const ta = useT(appMessages)
  const tc = useT(commonMessages)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data: Page<SourceChoice>
  } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [chosenLabel, setChosenLabel] = useState<{
    key: string
    label: string
  } | null>(null)
  const selectedId = values.length === 1 ? (values[0] ?? null) : null
  const selectionKey = `${owner}:${kind}:${selectedId ?? ''}`
  const requestKey = JSON.stringify([owner, kind, query.trim(), page, attempt])
  const data = result?.key === requestKey ? result.data : null
  const failed = failedKey === requestKey
  const loading = !data && !failed
  const allLabel = t(kind === 'cars' ? 'carsAll' : 'intakesAll')
  const label = t(kind)
  const labelForSelection =
    selectedLabel ??
    (chosenLabel?.key === selectionKey ? chosenLabel.label : undefined) ??
    data?.items.find((item) => item.id === selectedId)?.label ??
    t(kind === 'cars' ? 'selectedCar' : 'selectedIntake')
  const triggerLabel =
    values.length > 1
      ? `${label}: ${t('selectedCount', { count: values.length })}`
      : selectedId
        ? t(kind === 'cars' ? 'carSelected' : 'intakeSelected', {
            name: labelForSelection,
          })
        : allLabel

  useEffect(() => {
    if (!open || !enabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const params = { page, pageSize: 30, search: query.trim() }
      const options = { signal: controller.signal }
      const request: Promise<Page<SourceChoice>> =
        kind === 'cars'
          ? carsApi.list(params, options).then((result) => ({
              ...result,
              items: result.items.map((car) => ({
                id: car.id,
                label: `${car.code} · ${car.brand} ${car.model} (${car.year})`,
              })),
            }))
          : intakesApi.list(params, options).then((result) => ({
              ...result,
              items: result.items.map((intake) => ({
                id: intake.id,
                label: intake.name ?? t('unnamedIntake'),
              })),
            }))
      void request.then(
        (data) => {
          if (!controller.signal.aborted) {
            setResult({ key: requestKey, data })
            setFailedKey((current) => (current === requestKey ? null : current))
          }
        },
        () => {
          if (!controller.signal.aborted) setFailedKey(requestKey)
        },
      )
    }, 150)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, enabled, owner, kind, page, query, requestKey, t])

  useEffect(() => {
    if (
      !enabled ||
      kind !== 'intakes' ||
      !selectedId ||
      chosenLabel?.key === selectionKey
    )
      return
    const controller = new AbortController()
    void intakesApi.get(selectedId, { signal: controller.signal }).then(
      (intake) => {
        if (!controller.signal.aborted)
          setChosenLabel({
            key: selectionKey,
            label: intake.name ?? t('unnamedIntake'),
          })
      },
      () => {
        /* Keep the applied ID and a localised label if its details are unavailable. */
      },
    )
    return () => controller.abort()
  }, [enabled, kind, selectedId, selectionKey, chosenLabel?.key, t])

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setQuery('')
      setPage(1)
    }
  }
  const choose = (choice: SourceChoice | null) => {
    if (choice)
      setChosenLabel({
        key: `${owner}:${kind}:${choice.id}`,
        label: choice.label,
      })
    changeOpen(false)
    if ((choice?.id ?? null) !== selectedId || values.length > 1)
      onChange(choice?.id ?? null)
  }
  return (
    <div className="w-full min-w-0 shrink-0 sm:w-56">
      <SearchPicker
        label={label}
        triggerLabel={triggerLabel}
        triggerClassName={
          values.length ? 'rz-filter rz-filter--set' : 'rz-filter'
        }
        placeholder={t(kind === 'cars' ? 'searchCars' : 'searchIntakes')}
        resultsLabel={label}
        heading={label}
        count={
          data
            ? ta('pickerResultsCount', {
                shown: data.items.length,
                total: data.total,
              })
            : '…'
        }
        query={query}
        open={open}
        onOpenChange={changeOpen}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        disabled={!enabled}
        compact
        allowEmptyQuery
        floating
        footer={
          data && data.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                aria-label={ta('previousPage')}
              >
                {tc('back')}
              </Button>
              <span className="rz-caption">
                {ta('pageOf', { page, total: data.totalPages })}
              </span>
              <Button
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
                aria-label={ta('nextPage')}
              >
                {tc('next')}
              </Button>
            </div>
          ) : undefined
        }
      >
        <SearchPickerOptions label={label}>
          <SearchPickerOption
            label={allLabel}
            compact={kind === 'intakes'}
            selected={values.length === 0}
            onSelect={() => choose(null)}
            aside={
              values.length === 0 ? (
                <Check aria-hidden className="text-app-muted size-4" />
              ) : null
            }
          >
            <span className="rz-strong font-medium">{allLabel}</span>
          </SearchPickerOption>
          {data?.items.map((choice) => (
            <SearchPickerOption
              key={choice.id}
              label={choice.label}
              compact={kind === 'intakes'}
              selected={choice.id === selectedId}
              onSelect={() => choose(choice)}
              aside={
                choice.id === selectedId ? (
                  <Check aria-hidden className="text-app-muted size-4" />
                ) : null
              }
            >
              <span className="rz-strong block break-words font-medium">
                {choice.label}
              </span>
            </SearchPickerOption>
          ))}
        </SearchPickerOptions>
        {loading ? (
          <p className="rz-muted m-0 px-3 py-5 text-center" role="status">
            {ta('loadingData')}
          </p>
        ) : null}
        {failed ? (
          <Notice
            tone="danger"
            action={
              <Button size="sm" onClick={() => setAttempt(attempt + 1)}>
                {tc('retry')}
              </Button>
            }
          >
            {t('loadFailed')}
          </Notice>
        ) : null}
        {data?.items.length === 0 ? (
          <p className="rz-muted m-0 px-3 py-5 text-center" role="status">
            {ta('noMatchingOptions')}
          </p>
        ) : null}
      </SearchPicker>
    </div>
  )
}
