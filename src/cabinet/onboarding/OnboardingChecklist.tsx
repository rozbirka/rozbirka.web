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
  StatusPill,
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
          <div className="rz-btn-row">
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
          <ol className="m-0 grid list-none gap-px p-0">
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
          <div className="rz-btn-row">
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
    <section aria-labelledby={titleId} className="rz-card">
      <header className="rz-card__head items-start gap-x-6 py-3">
        <div className="grid min-w-0 flex-[1_1_16rem] gap-1">
          <h2
            className="rz-h-card text-balance outline-none"
            id={titleId}
            ref={headingRef}
            tabIndex={headingRef === undefined ? undefined : -1}
          >
            {title}
          </h2>
          {subtitle === undefined ? null : (
            <p className="rz-caption m-0 max-w-[60ch] text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        {aside}
      </header>
      <div className="rz-card__body grid gap-3">{children}</div>
    </section>
  )
}

/** «N із 4 кроків» as text and as a 0–4 progressbar. */
function Progress({ count, t }: { count: number; t: T }) {
  const label = t('progress', { n: count })
  return (
    <div className="grid w-full max-w-[12rem] shrink-0 gap-1.5 sm:w-48">
      <span aria-hidden className="rz-caption rz-mono">
        {label}
      </span>
      <div
        aria-label={t('title')}
        aria-valuemax={4}
        aria-valuemin={0}
        aria-valuenow={count}
        aria-valuetext={label}
        className="rz-meter"
        role="progressbar"
      >
        <span
          className="motion-safe:transition-[width]"
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
          'rz-steps__n mt-px shrink-0',
          done && 'bg-state-ok-soft text-state-ok border-0',
          current && 'bg-brand text-brand-foreground border-0',
        )}
      >
        {done ? <Check className="size-3" /> : number}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span
          className={cn(
            'font-semibold text-pretty',
            done ? 'text-app-muted' : 'text-app-strong',
          )}
        >
          {title}
        </span>
        <span className="rz-caption text-pretty">
          {reachable ? hint : t('stepUnavailable')}
        </span>
      </span>
      {done || current ? (
        <StatusPill className="shrink-0" tone={done ? 'ok' : 'neutral'}>
          {done ? t('done') : t('next')}
        </StatusPill>
      ) : null}
      {reachable ? (
        <ChevronRight
          aria-hidden
          className="text-app-dim mt-0.5 size-4 shrink-0"
        />
      ) : null}
    </>
  )
  const className = cn(
    'flex w-full min-w-0 items-start gap-3 rounded-control border-0 bg-transparent px-2 py-2 text-left text-app-ink transition-colors',
    current ? 'bg-app-selected' : 'hover:bg-app-hover',
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
      <ul className="m-0 grid list-none gap-2 p-0">
        {options.map((option) =>
          option.href === null ? null : (
            <li key={option.title}>
              <Link
                className="rz-card text-app-ink hover:bg-app-hover flex min-w-0 items-start gap-3 px-3 py-2.5"
                to={option.href}
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-app-strong font-semibold">
                    {option.title}
                  </span>
                  <span className="rz-caption text-pretty">{option.hint}</span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="text-app-dim mt-0.5 size-4 shrink-0"
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
      <div className="flex flex-wrap items-center gap-2">
        {recommendations.length === 0 ? null : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
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
      className="rz-card rz-card__body grid gap-3"
    >
      <p className="sr-only" role="status">
        {t('loading')}
      </p>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-2/3" />
      {ONBOARDING_STEPS.map((step) => (
        <Skeleton className="h-control-lg" key={step} />
      ))}
    </section>
  )
}
