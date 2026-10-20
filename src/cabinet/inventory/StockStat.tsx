import { Kpi } from '../redesign-kpi'

export function StockStat({
  label,
  value,
  unit,
  meta,
  tone = 'plain',
}: {
  label: string
  value: string
  unit: string
  meta: string
  tone?: 'plain' | 'ok' | 'warn' | 'danger'
}) {
  return <Kpi label={label} value={value} unit={unit} meta={meta} tone={tone} />
}
