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
    <span className={cn('rz-code', className)}>
      <span className="text-app-ink">{code}</span>
      <button
        aria-label={label}
        className="relative after:absolute after:-inset-3 after:content-['']"
        onClick={onCopy}
        title={label}
        type="button"
      >
        <Copy aria-hidden />
      </button>
    </span>
  )
}
