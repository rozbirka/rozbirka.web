import { useFormat } from '@/i18n'

/** The list's view, as it lives in the address: «До списку» brings it back. */
export interface WaybillFilters {
  q: string
  /** One Nova Poshta tracking code. */
  delivery: string
  cod: '' | 'yes' | 'no'
  sync: '' | 'problem' | 'fine'
  /** `YYYY-MM-DD`, the business day the waybill was made. */
  from: string
  to: string
  page: number
}

export const FILTER_PARAMS = [
  'q',
  'delivery',
  'cod',
  'sync',
  'from',
  'to',
] as const

export function readFilters(params: URLSearchParams): WaybillFilters {
  const cod = params.get('cod')
  const sync = params.get('sync')
  return {
    q: params.get('q') ?? '',
    delivery: params.get('delivery') ?? '',
    cod: cod === 'yes' || cod === 'no' ? cod : '',
    sync: sync === 'problem' || sync === 'fine' ? sync : '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    page: Math.max(Number(params.get('page') ?? 1) || 1, 1),
  }
}

export const filtered = (filters: WaybillFilters) =>
  FILTER_PARAMS.some((name) => filters[name] !== '')

/** `01.10.2026–25.10.2026`; an open end stays open. */
export function usePeriod(filters: WaybillFilters): string {
  const format = useFormat()
  const day = (value: string) =>
    value === '' ? '' : (format.date(`${value}T12:00:00`) ?? value)
  if (filters.from === '' && filters.to === '') return ''
  return `${day(filters.from)}–${day(filters.to)}`
}
