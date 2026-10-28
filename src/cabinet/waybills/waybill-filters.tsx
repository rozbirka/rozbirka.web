import { useId } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  Button,
  FilterOption,
  FilterPopover,
  SearchInput,
  TextInput,
} from '@/components/app'
import { useT } from '@/i18n'
import {
  type FILTER_PARAMS,
  filtered,
  usePeriod,
  type WaybillFilters,
} from './waybill-filter-state'
import { DELIVERY_FILTERS } from './waybill-presentation'
import { waybillsMessages } from './waybills-messages'

/**
 * Search, the four filters and «Скинути» (7.2), in the tab order section 11
 * asks for. «Післяплата» needs the finance right: Core refuses that filter
 * without it.
 */
export function WaybillToolbar({
  filters,
  finance,
  found,
  onChange,
  onReset,
}: {
  filters: WaybillFilters
  finance: boolean
  /** The total once a filtered answer came back. */
  found: number | null
  onChange: (name: (typeof FILTER_PARAMS)[number], value: string) => void
  onReset: () => void
}) {
  const t = useT(waybillsMessages)
  const period = usePeriod(filters)
  const fromId = useId()
  const toId = useId()
  const deliveryChoice = DELIVERY_FILTERS.find(
    (choice) => choice.code === filters.delivery,
  )

  return (
    <div className="rz-toolbar" role="search">
      <SearchInput
        aria-label={t('searchPlaceholder')}
        className="sm:max-w-80"
        onChange={(event) => onChange('q', event.target.value)}
        placeholder={t('searchPlaceholder')}
        value={filters.q}
      />
      <FilterPopover
        label={t('filterDate')}
        placeholder={t('filterDate')}
        setKey={period === '' ? undefined : t('filterDate')}
        setValue={period === '' ? undefined : period}
      >
        <div className="grid gap-2 p-3">
          <label className="grid gap-1" htmlFor={fromId}>
            <span className="rz-caption">{t('dateFrom')}</span>
            <TextInput
              id={fromId}
              max={filters.to || undefined}
              onChange={(event) => onChange('from', event.target.value)}
              type="date"
              value={filters.from}
            />
          </label>
          <label className="grid gap-1" htmlFor={toId}>
            <span className="rz-caption">{t('dateTo')}</span>
            <TextInput
              id={toId}
              min={filters.from || undefined}
              onChange={(event) => onChange('to', event.target.value)}
              type="date"
              value={filters.to}
            />
          </label>
        </div>
      </FilterPopover>
      <FilterPopover
        label={t('filterDelivery')}
        placeholder={t('filterDelivery')}
        setKey={deliveryChoice === undefined ? undefined : t('filterDelivery')}
        setValue={
          deliveryChoice === undefined ? undefined : t(deliveryChoice.key)
        }
      >
        <div className="grid gap-px p-1">
          <FilterOption
            active={filters.delivery === ''}
            label={t('any')}
            onSelect={() => onChange('delivery', '')}
          />
          {DELIVERY_FILTERS.map((choice) => (
            <FilterOption
              active={filters.delivery === choice.code}
              key={choice.code}
              label={t(choice.key)}
              onSelect={() => onChange('delivery', choice.code)}
            />
          ))}
        </div>
      </FilterPopover>
      {finance ? (
        <FilterPopover
          label={t('filterCod')}
          placeholder={t('filterCod')}
          setKey={filters.cod === '' ? undefined : t('filterCod')}
          setValue={
            filters.cod === ''
              ? undefined
              : t(filters.cod === 'yes' ? 'codWith' : 'codWithout')
          }
        >
          <div className="grid gap-px p-1">
            {(['', 'yes', 'no'] as const).map((value) => (
              <FilterOption
                active={filters.cod === value}
                key={value}
                label={t(
                  value === ''
                    ? 'any'
                    : value === 'yes'
                      ? 'codWith'
                      : 'codWithout',
                )}
                onSelect={() => onChange('cod', value)}
              />
            ))}
          </div>
        </FilterPopover>
      ) : null}
      <FilterPopover
        label={t('filterSync')}
        placeholder={t('filterSync')}
        setKey={filters.sync === '' ? undefined : t('filterSync')}
        setValue={
          filters.sync === ''
            ? undefined
            : t(filters.sync === 'problem' ? 'syncProblem' : 'syncFine')
        }
      >
        <div className="grid gap-px p-1">
          {(['', 'problem', 'fine'] as const).map((value) => (
            <FilterOption
              active={filters.sync === value}
              key={value}
              label={t(
                value === ''
                  ? 'any'
                  : value === 'problem'
                    ? 'syncProblem'
                    : 'syncFine',
              )}
              onSelect={() => onChange('sync', value)}
            />
          ))}
        </div>
      </FilterPopover>
      {filtered(filters) ? (
        <Button onClick={onReset} variant="quiet">
          <RotateCcw aria-hidden />
          {t('reset')}
        </Button>
      ) : null}
      {found === null || !filtered(filters) ? null : (
        <span className="rz-muted ml-auto font-mono text-caption" role="status">
          {t('found', { count: String(found) })}
        </span>
      )}
    </div>
  )
}
