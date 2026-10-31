import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { billingApi } from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { resolveLandingPlans, type LandingPlan } from '@/lib/landing-plans'
import { accountPathForPlan, loginPathForPlan } from '@/lib/plan-selection'
import { useLocale, useT } from '@/i18n'
import { Eyebrow, SectionInner, SectionTitle } from './landing-ui'
import { landingMessages } from './landing-messages'
import { siteMessages } from './site-messages'
export function Pricing() {
  const { status } = useAuth()
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  // Raw API catalog; `null` (not loaded or failed) renders the fallback plans.
  const [catalog, setCatalog] = useState<unknown>(null)
  const plans = useMemo(
    () => resolveLandingPlans(catalog, locale),
    [catalog, locale],
  )

  useEffect(() => {
    let cancelled = false
    void billingApi
      .getPlans()
      .then((value) => {
        if (!cancelled) setCatalog(value)
      })
      .catch(() => {
        if (!cancelled) setCatalog(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="pricing" data-reveal="" className="bg-lp-ink text-lp-bg">
      <SectionInner>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-4">
            <Eyebrow tone="paper">{l('pricingEyebrow')}</Eyebrow>
            <SectionTitle>{t('pricingTitle')}</SectionTitle>
          </div>
          <p className="text-lp-paper-muted m-0 text-[18px]">
            {l('pricingNote')}
          </p>
        </div>
        <ul
          role="list"
          className="m-0 flex max-w-[588px] list-none flex-col gap-4 p-0"
        >
          {plans.map((plan) => {
            const destination =
              status === 'authenticated'
                ? accountPathForPlan(plan.code)
                : loginPathForPlan(plan.code)

            return (
              <PlanCard key={plan.name} plan={plan} destination={destination} />
            )
          })}
        </ul>
      </SectionInner>
    </section>
  )
}

function PlanCard({
  plan,
  destination,
}: {
  plan: LandingPlan
  destination: string
}) {
  const t = useT(siteMessages)

  return (
    <li className="bg-lp-bg text-lp-ink flex flex-col gap-7 rounded-[28px] p-10 max-sm:p-7">
      <h3 className="font-unbounded m-0 text-[24px] leading-[31px] font-semibold">
        {plan.name}
      </h3>
      <div className="flex flex-col gap-2">
        <p className="m-0 flex items-baseline gap-2">
          <span className="font-unbounded text-[64px] font-semibold tracking-[-0.04em] tabular-nums max-sm:text-[52px]">
            {plan.price}
          </span>
          <span className="text-lp-muted">/ {plan.period}</span>
        </p>
        <span className="text-lp-accent-hover font-medium">
          {t('pricingTrial', { count: plan.trialDays })}
        </span>
      </div>
      <p className="text-lp-muted m-0 text-[17px]">{plan.description}</p>
      <ul
        role="list"
        className="m-0 flex flex-1 list-none flex-col gap-3.5 p-0"
      >
        {plan.perks.map((perk) => (
          <li key={perk} className="flex gap-3 text-[17px]">
            <span className="text-lp-accent" aria-hidden>
              ✓
            </span>
            {perk}
          </li>
        ))}
      </ul>
      <Link
        to={destination}
        className="bg-lp-accent text-lp-bg hover:bg-lp-accent-hover flex h-14 items-center justify-center rounded-full text-center text-[17px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        {plan.ctaLabel}
      </Link>
    </li>
  )
}
