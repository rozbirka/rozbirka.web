import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

export interface Step {
  key: string
  title: string
  /** What this step is for, one line. Shown under the title of the current step. */
  description?: string
  /** Set while the step is missing something; the step reads as blocked. */
  error?: string | null
}

/**
 * Progress through a creation flow: where I am, what is behind me, how much is
 * left. Completed steps are reachable again — going back to fix an entry must
 * never mean starting over.
 */
export function Stepper({
  steps,
  current,
  onSelect,
  className,
}: {
  steps: readonly Step[]
  current: number
  /** Omit to make the strip read-only. */
  onSelect?: (index: number) => void
  className?: string
}) {
  const t = useT(appMessages)
  return (
    <ol className={cn('rz-steps', className)}>
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        const failed = Boolean(step.error)
        const reachable = onSelect !== undefined && (done || active)
        const label = t('stepOf', {
          step: String(index + 1),
          total: String(steps.length),
          title: step.title,
        })

        const content = (
          <>
            <span aria-hidden className="rz-steps__n">
              {done && !failed ? <Check className="size-3" /> : index + 1}
            </span>
            <span className="truncate">{step.title}</span>
          </>
        )

        return (
          <li
            {...(active ? { 'aria-current': 'step' as const } : {})}
            className="min-w-0 p-0"
            data-state={failed ? 'failed' : done ? 'done' : undefined}
            key={step.key}
          >
            {reachable ? (
              <button
                aria-current={active ? 'step' : undefined}
                aria-label={label}
                className="rounded-rz-full hover:bg-app-hover flex h-7 w-full cursor-pointer items-center gap-2 pr-2.5 pl-1.5 text-inherit"
                onClick={() => onSelect(index)}
                type="button"
              >
                {content}
              </button>
            ) : (
              <span
                aria-current={active ? 'step' : undefined}
                className="flex h-7 w-full items-center gap-2 pr-2.5 pl-1.5"
              >
                <span className="sr-only">{label}</span>
                {content}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** The body of one step: its heading, purpose and fields. */
export function StepPanel({
  step,
  children,
}: {
  step: Step
  children: ReactNode
}) {
  return (
    <section aria-label={step.title} className="grid gap-3">
      {step.description === undefined ? null : (
        <p className="rz-caption">{step.description}</p>
      )}
      {children}
    </section>
  )
}
