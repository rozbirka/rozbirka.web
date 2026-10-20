import { cn } from '@/lib/utils'

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
  return (
    <div className="bg-app-raised px-6 pt-[22px] pb-6">
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums',
            tone === 'ok'
              ? 'text-state-ok'
              : tone === 'warn'
                ? 'text-state-warn'
                : tone === 'danger'
                  ? 'text-state-danger'
                  : 'text-white',
          )}
        >
          {value}
        </span>
        <span className="text-app-muted font-mono text-[13px] font-medium">
          {unit}
        </span>
      </p>
      {meta ? <p className="text-app-dim mt-3.5 text-[13px]">{meta}</p> : null}
    </div>
  )
}
