import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Check, ChevronRight } from 'lucide-react'
import type { Tenant } from '@/api/types'
import {
  Button,
  Notice,
  Sheet,
  Skeleton,
  useOptionalToast,
} from '@/components/app'
import { useT, type Translate } from '@/i18n'
import { cn } from '@/lib/utils'
import type { TenantAccessSnapshot } from '../access-types'
import { BUSINESS_SECTION_IDS } from '../business/business-anchors'
import { cabinetPath } from '../cabinet-paths'
import { cabinetModules, type CabinetModuleKey } from '../module-registry'
import { sourceCreateHref } from '../parts/source-return'
import { evaluateModuleAccess, type ModuleAccessOperation } from '../policy'
import { onboardingMessages } from './messages'
import {
  completedStepCount,
  decideChecklistView,
  isOwnerRole,
  isStepDone,
  ONBOARDING_STEPS,
  type OnboardingChange,
  type OnboardingStep,
} from './onboarding-policy'
import {
  forgetReturnFocus,
  rememberReturnFocus,
  takeReturnFocus,
  type ReturnFocusTarget,
} from './return-focus'
import { useOwnerOnboarding } from './use-owner-onboarding'

type T = Translate<(typeof onboardingMessages)['uk']>

const STEP_TEXT = {
  settings: ['settings', 'settingsHint'],
  currency: ['currency', 'currencyHint'],
  source: ['source', 'sourceHint'],
  part: ['part', 'partHint'],
} as const satisfies Record<
  OnboardingStep,
  readonly [keyof (typeof onboardingMessages)['uk'], string]
>

/** Query the dashboard is opened with when a source form sends the owner back. */
const RETURN_MARK = 'onboarding'
/** What the source form adds to the return path (see `sourceReturnPath`). */
const RETURN_LEFTOVERS = [RETURN_MARK, 'car_id', 'intake_id', 'draft']

/**
 * The owner onboarding checklist on the dashboard (ROZ-163, board component
 * OnboardingChecklist): four required steps with progress from server facts,
 * «Продовжити» to the first incomplete one and «Зробити пізніше» to a compact
 * block. Each step opens the real form — business settings, a new car or
 * intake, a new part — never a copy of it.
 */
export function OnboardingChecklist({
  tenant,
  snapshot,
}: {
  tenant: Tenant
  snapshot: TenantAccessSnapshot
}) {
  const t = useT(onboardingMessages)
  const toast = useOptionalToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isOwner = isOwnerRole(snapshot.role)
  const key = isOwner ? `${snapshot.userId}:${tenant.id}` : null

  const onChange = useCallback(
    (changes: OnboardingChange[]) => {
      for (const change of changes) {
        if (change.kind === 'credited')
          toast?.show({
            tone: 'ok',
            message: t('credited', { step: t(STEP_TEXT[change.step][0]) }),
          })
        else if (change.kind === 'completed')
          toast?.show({ tone: 'ok', message: t('doneTitle') })
        else toast?.show({ tone: 'info', message: t('reverted') })
      }
    },
    [t, toast],
  )

  const onboarding = useOwnerOnboarding({
    tenantId: tenant.id,
    userId: snapshot.userId,
    enabled: isOwner,
    onChange,
  })

  const decided = decideChecklistView({ isOwner, load: onboarding.load })
  const view =
    decided.kind === 'completed' && onboarding.hiddenLocally
      ? ({ kind: 'hidden' } as const)
      : decided

  // A source form sent the owner back here: drop what it added to the URL.
  useEffect(() => {
    if (!searchParams.has(RETURN_MARK)) return
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const name of RETURN_LEFTOVERS) next.delete(name)
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])

  const slug = tenant.slug
  const can = useCallback(
    (module: CabinetModuleKey, operation: ModuleAccessOperation) =>
      evaluateModuleAccess(
        cabinetModules[module],
        { status: 'ready', snapshot, error: null },
        operation,
      ).kind === 'allowed',
    [snapshot],
  )
  const targets = useMemo(() => {
    const business = cabinetPath(slug, 'business')
    const back = `${cabinetPath(slug, 'dashboard')}?${RETURN_MARK}=source`
    const root = `/app/${slug}`
    return {
      settings: can('business', 'view')
        ? `${business}#${BUSINESS_SECTION_IDS.region}`
        : null,
      currency: can('business', 'view')
        ? `${business}#${BUSINESS_SECTION_IDS.accountingCurrency}`
        : null,
      car: can('cars', 'mutation')
        ? sourceCreateHref(root, 'cars', back)
        : null,
      batch: can('intakes', 'mutation')
        ? sourceCreateHref(root, 'intakes', back)
        : null,
      part: can('parts', 'mutation') ? cabinetPath(slug, 'parts', 'new') : null,
      cash: can('cash', 'view') ? cabinetPath(slug, 'cash') : null,
      team: can('team', 'view') ? cabinetPath(slug, 'team') : null,
    }
  }, [can, slug])

  const [choosingSource, setChoosingSource] = useState(false)
  const continueRef = useRef<HTMLButtonElement>(null)
  const compactContinueRef = useRef<HTMLButtonElement>(null)
  const doneHeadingRef = useRef<HTMLHeadingElement>(null)
  const rowRefs = useRef(new Map<OnboardingStep, HTMLElement>())
  const focusAfterRender = useRef<ReturnFocusTarget | 'compact' | null>(null)

  const stepReachable = (step: OnboardingStep) =>
    step === 'source'
      ? targets.car !== null || targets.batch !== null
      : targets[step] !== null

  /** Open a step's real form; `from` is where focus comes back to. */
  const openStep = (step: OnboardingStep, from: ReturnFocusTarget) => {
    if (key === null) return
    rememberReturnFocus(key, from)
    if (step !== 'source') {
      const target = targets[step]
      if (target !== null) void navigate(target)
      return
    }
    // Only one kind of source this account may create: no need to ask.
    if (targets.car === null || targets.batch === null) {
      const only = targets.car ?? targets.batch
      if (only !== null) void navigate(only)
      return
    }
    setChoosingSource(true)
  }

  const later = async () => {
    if (await onboarding.defer()) focusAfterRender.current = 'compact'
  }

  /** Compact «Продовжити»: the step opens only after Core un-defers. */
  const resumeAndOpen = async (step: OnboardingStep) => {
    if (await onboarding.resume()) openStep(step, 'continue')
  }

  const { action, status } = onboarding.mutation
  const busyWith = (one: typeof action) =>
    action === one && (status === 'saving' || status === 'checking')
  const notice = (one: typeof action, failed: string) =>
    action !== one || status === 'idle' || status === 'saving' ? null : (
      <Notice
        className="mt-4"
        role={status === 'failed' ? 'alert' : 'status'}
        tone={status === 'failed' ? 'danger' : 'info'}
      >
        {status === 'failed' ? failed : t('deferChecking')}
      </Notice>
    )

  // Focus after a re-render: the compact «Продовжити» after deferring, or the
  // row / «Продовжити» the owner left from when coming back to the dashboard.
  const kind = view.kind
  useEffect(() => {
    if (key === null) return
    if (kind !== 'expanded' && kind !== 'compact' && kind !== 'completed')
      return
    const wanted = focusAfterRender.current ?? takeReturnFocus(key)
    focusAfterRender.current = null
    if (wanted === null) return
    if (kind === 'completed') doneHeadingRef.current?.focus()
    else if (kind === 'compact') compactContinueRef.current?.focus()
    else if (wanted === 'continue' || wanted === 'compact')
      continueRef.current?.focus()
    else (rowRefs.current.get(wanted) ?? continueRef.current)?.focus()
  }, [key, kind])

  switch (view.kind) {
    case 'hidden':
      return null
    case 'loading':
      return <ChecklistSkeleton t={t} />
    case 'offline':
      // Eligibility is unknown without a first read: say nothing alarming.
      return (
        <Notice
          action={<Button onClick={onboarding.retry}>{t('retry')}</Button>}
          tone="info"
        >
          {t('offline')}
        </Notice>
      )
    case 'error':
      return (
        <Notice
          action={<Button onClick={onboarding.retry}>{t('retry')}</Button>}
          tone="danger"
        >
          {t('loadFailed')}
        </Notice>
      )
    case 'completed':
      return (
        <CompletedCard
          busy={busyWith('dismiss')}
          headingRef={doneHeadingRef}
          notice={notice('dismiss', t('hideFailed'))}
          onHide={() => void onboarding.dismiss()}
          t={t}
          targets={targets}
        />
      )
    case 'compact':
      return (
        <ChecklistFrame
          aside={<Progress count={completedStepCount(view.facts)} t={t} />}
          title={t('compactTitle')}
        >
          {notice('resume', t('resumeFailed'))}
          <div className="mt-4">
            <Button
              aria-busy={busyWith('resume')}
              disabled={!stepReachable(view.next) || busyWith('resume')}
              onClick={() => void resumeAndOpen(view.next)}
              ref={compactContinueRef}
              variant="primary"
            >
              {busyWith('resume') ? t('saving') : t('continue')}
            </Button>
          </div>
          <SourceChooser
            onClose={() => {
              forgetReturnFocus()
              setChoosingSource(false)
            }}
            open={choosingSource}
            t={t}
            targets={targets}
          />
        </ChecklistFrame>
      )
    case 'expanded': {
      const { facts, next } = view
      const busy = busyWith('defer')
      return (
        <ChecklistFrame
          aside={<Progress count={completedStepCount(facts)} t={t} />}
          subtitle={t('subtitle')}
          title={t('title')}
        >
          <ol className="mt-4 grid gap-1">
            {ONBOARDING_STEPS.map((step, index) => (
              <li key={step}>
                <StepRow
                  current={step === next}
                  done={isStepDone(facts, step)}
                  hint={t(STEP_TEXT[step][1])}
                  href={
                    step === 'source' || !stepReachable(step)
                      ? null
                      : targets[step]
                  }
                  number={index + 1}
                  onOpen={() => openStep(step, step)}
                  reachable={stepReachable(step)}
                  refCallback={(node) => {
                    if (node === null) rowRefs.current.delete(step)
                    else rowRefs.current.set(step, node)
                  }}
                  t={t}
                  title={t(STEP_TEXT[step][0])}
                />
              </li>
            ))}
          </ol>
          {notice('defer', t('deferFailed'))}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              disabled={!stepReachable(next)}
              onClick={() => openStep(next, 'continue')}
              ref={continueRef}
              variant="primary"
            >
              {t('continue')}
            </Button>
            <Button
              aria-busy={busy}
              disabled={busy}
              onClick={() => void later()}
            >
              {action === 'defer' && status === 'saving'
                ? t('saving')
                : t('later')}
            </Button>
          </div>
          <SourceChooser
            onClose={() => {
              forgetReturnFocus()
              setChoosingSource(false)
            }}
            open={choosingSource}
            t={t}
            targets={targets}
          />
        </ChecklistFrame>
      )
    }
  }
}

function ChecklistFrame({
  title,
  subtitle,
  aside,
  children,
  headingRef,
}: {
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="border-app-line bg-app-raised rounded-[20px] border px-4 py-5 sm:px-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-[1_1_16rem]">
          <h2
            className="text-[18px] font-bold tracking-[-0.01em] text-balance text-white outline-none"
            id={titleId}
            ref={headingRef}
            tabIndex={headingRef === undefined ? undefined : -1}
          >
            {title}
          </h2>
          {subtitle === undefined ? null : (
            <p className="text-app-muted mt-1.5 max-w-[60ch] text-[14px] leading-5 text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

/** «N із 4 кроків» as text and as a 0–4 progressbar. */
function Progress({ count, t }: { count: number; t: T }) {
  const label = t('progress', { n: count })
  return (
    <div className="grid w-full max-w-[12rem] shrink-0 gap-1.5 sm:w-48">
      <span aria-hidden className="text-app-muted text-[13px] tabular-nums">
        {label}
      </span>
      <div
        aria-label={t('title')}
        aria-valuemax={4}
        aria-valuemin={0}
        aria-valuenow={count}
        aria-valuetext={label}
        className="bg-app-line-2 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
      >
        <div
          className="bg-brand h-full rounded-full motion-safe:transition-[width]"
          style={{ width: `${String(count * 25)}%` }}
        />
      </div>
    </div>
  )
}

function StepRow({
  number,
  title,
  hint,
  done,
  current,
  reachable,
  href,
  onOpen,
  refCallback,
  t,
}: {
  number: number
  title: string
  hint: string
  done: boolean
  current: boolean
  reachable: boolean
  /** A link for steps with one destination; `null` opens via `onOpen`. */
  href: string | null
  onOpen: () => void
  refCallback: (node: HTMLElement | null) => void
  t: T
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[12px]',
          done
            ? 'border-state-ok/50 bg-state-ok-soft text-state-ok'
            : current
              ? 'border-brand text-brand bg-brand/10'
              : 'border-app-line-2 text-app-dim',
        )}
      >
        {done ? <Check className="size-3.5" /> : number}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[15px] font-bold text-pretty',
            done ? 'text-app-muted' : 'text-white',
          )}
        >
          {title}
        </span>
        <span className="text-app-dim mt-0.5 block text-[13px] leading-5 text-pretty">
          {reachable ? hint : t('stepUnavailable')}
        </span>
      </span>
      {done || current ? (
        <span
          className={cn(
            'mt-1 shrink-0 text-[12.5px] font-bold',
            done ? 'text-state-ok' : 'text-brand',
          )}
        >
          {done ? t('done') : t('next')}
        </span>
      ) : null}
      {reachable ? (
        <ChevronRight
          aria-hidden
          className="text-app-dim mt-1 size-4 shrink-0"
        />
      ) : null}
    </>
  )
  const className = cn(
    'flex min-h-11 w-full min-w-0 items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40',
    current
      ? 'border-brand/30 bg-brand/[0.06]'
      : 'border-transparent hover:bg-white/[0.03]',
  )
  const ariaCurrent = current ? ('step' as const) : undefined

  if (!reachable)
    return (
      <div aria-current={ariaCurrent} className={className}>
        {body}
      </div>
    )
  if (href !== null)
    return (
      <Link
        aria-current={ariaCurrent}
        className={className}
        onClick={onOpen}
        ref={refCallback}
        to={href}
      >
        {body}
      </Link>
    )
  return (
    <button
      aria-current={ariaCurrent}
      className={className}
      onClick={onOpen}
      ref={refCallback}
      type="button"
    >
      {body}
    </button>
  )
}

/** Step 3 accepts a car OR a batch (AC-3): the owner picks which form. */
function SourceChooser({
  open,
  onClose,
  targets,
  t,
}: {
  open: boolean
  onClose: () => void
  targets: { car: string | null; batch: string | null }
  t: T
}) {
  const options = [
    { href: targets.car, title: t('car'), hint: t('carHint') },
    { href: targets.batch, title: t('batch'), hint: t('batchHint') },
  ]
  return (
    <Sheet
      description={t('sourceHint')}
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>{t('cancel')}</Button>
        </div>
      }
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      open={open}
      title={t('source')}
    >
      <ul className="grid gap-2.5 px-5 py-5 sm:px-7">
        {options.map((option) =>
          option.href === null ? null : (
            <li key={option.title}>
              <Link
                className="border-app-line bg-app-raised hover:border-app-line-2 flex min-h-11 min-w-0 items-start gap-3 rounded-[16px] border px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                to={option.href}
              >
                <span className="min-w-0 flex-1">
                  <span className="text-app-ink block text-[15px] font-bold">
                    {option.title}
                  </span>
                  <span className="text-app-dim mt-1 block text-[13px] text-pretty">
                    {option.hint}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="text-app-dim mt-1 size-4 shrink-0"
                />
              </Link>
            </li>
          ),
        )}
      </ul>
    </Sheet>
  )
}

function CompletedCard({
  t,
  targets,
  onHide,
  busy,
  notice,
  headingRef,
}: {
  t: T
  targets: { cash: string | null; team: string | null }
  /** Saves Core `dismissed`; the card goes once the server has it. */
  onHide: () => void
  busy: boolean
  notice: ReactNode
  headingRef: Ref<HTMLHeadingElement>
}) {
  const recommendations = [
    { href: targets.cash, label: t('recommendCash') },
    { href: targets.team, label: t('recommendTeam') },
  ].filter((one): one is { href: string; label: string } => one.href !== null)
  return (
    <ChecklistFrame
      headingRef={headingRef}
      subtitle={t('doneSubtitle')}
      title={t('doneTitle')}
    >
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {recommendations.length === 0 ? null : (
          <ul className="flex flex-wrap gap-2.5">
            {recommendations.map((one) => (
              <li key={one.href}>
                <Button asChild>
                  <Link to={one.href}>{one.label}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button
          aria-busy={busy}
          className="ml-auto"
          disabled={busy}
          onClick={onHide}
          variant="quiet"
        >
          {busy ? t('saving') : t('hide')}
        </Button>
      </div>
      {notice}
    </ChecklistFrame>
  )
}

function ChecklistSkeleton({ t }: { t: T }) {
  return (
    <section
      aria-busy="true"
      aria-label={t('title')}
      className="border-app-line bg-app-raised grid gap-3 rounded-[20px] border px-4 py-5 sm:px-6"
    >
      <p className="sr-only" role="status">
        {t('loading')}
      </p>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-2/3" />
      {ONBOARDING_STEPS.map((step) => (
        <Skeleton className="h-12 rounded-[14px]" key={step} />
      ))}
    </section>
  )
}
