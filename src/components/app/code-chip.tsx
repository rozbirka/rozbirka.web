import { Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A code with a button to copy it — a part's label, a car's VIN. The chip is
 * sized to the text, so the button inside it is small; its hit area is grown
 * back to the 44px the rest of the cabinet keeps, with a transparent overlay
 * that costs the layout nothing.
 */
export function CodeChip({
  className,
  code,
  label,
  onCopy,
}: {
  className?: string
  code: string
  /** Names the button for assistive technology: "Копіювати VIN". */
  label: string
  onCopy: () => void
}) {
  return (
    <span
      className={cn(
        'border-app-line inline-flex h-[30px] items-center gap-2 rounded-[8px] border bg-white/[0.03] pr-1 pl-2.5',
        className,
      )}
    >
      <span className="text-app-ink font-mono text-[13px] whitespace-nowrap">
        {code}
      </span>
      <button
        aria-label={label}
        className="text-app-muted hover:text-app-ink relative grid size-6 shrink-0 place-items-center rounded-[6px] transition-colors hover:bg-white/[0.08] after:absolute after:-inset-2.5 after:content-['']"
        onClick={onCopy}
        title={label}
        type="button"
      >
        <Copy aria-hidden className="size-3" />
      </button>
    </span>
  )
}
