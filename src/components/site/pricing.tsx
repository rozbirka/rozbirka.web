import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { billingApi } from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { resolveLandingPlans } from '@/lib/landing-plans'
import { accountPathForPlan, loginPathForPlan } from '@/lib/plan-selection'
import { useLocale, useT } from '@/i18n'
import { Eyebrow, SectionInner, SectionTitle } from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages, listOf } from './landing-messages'
import { siteMessages } from './site-messages'
export function Pricing() {
  const { status } = useAuth()
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const supportHref = useSupportHref()
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

  // The landing sells one plan (Pro); see `landing-plans`.
  const plan = plans[0]!
  const destination =
    status === 'authenticated'
      ? accountPathForPlan(plan.code)
      : loginPathForPlan(plan.code)

  return (
    <section id="pricing" data-reveal="" className="bg-lp-ink text-lp-bg">
      <SectionInner className="gap-12 max-sm:gap-10">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow tone="paper">{l('pricingEyebrow')}</Eyebrow>
          <SectionTitle>{t('pricingTitle')}</SectionTitle>
        </div>
        <article className="bg-lp-bg text-lp-ink grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] overflow-hidden rounded-[32px] max-sm:rounded-3xl">
          <div className="flex flex-col gap-7 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,106,26,0.22),transparent_60%)] p-12 max-sm:px-[22px] max-sm:py-7">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-unbounded m-0 text-[24px] font-semibold">
                {plan.name}
              </h3>
              <span className="bg-lp-accent text-lp-bg rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap">
                {t('pricingTrial', { count: plan.trialDays })}
              </span>
            </div>
            <p className="m-0 flex flex-wrap items-baseline gap-2.5">
              <span className="font-unbounded text-[clamp(64px,8vw,104px)] leading-[0.95] font-semibold tracking-[-0.05em] tabular-nums">
                {plan.price}
              </span>
              <span className="text-lp-muted text-[18px]">/ {plan.period}</span>
            </p>
            <p className="text-lp-muted m-0 max-w-[380px] text-[17px] leading-[1.5] text-pretty">
              {plan.description}
            </p>
            <div className="mt-auto flex flex-col gap-3">
              <Link
                to={destination}
                className="bg-lp-accent text-lp-bg hover:bg-lp-accent-hover lp-btn-glow flex h-14 items-center justify-center rounded-full px-7 text-center text-[17px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                {plan.ctaLabel}
              </Link>
              {supportHref && (
                <a
                  href={supportHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lp-muted hover:text-lp-accent-hover flex min-h-11 items-center justify-center text-center text-[15px]"
                >
                  {l('pricingAsk')}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 border-l border-white/[0.08] p-12 max-[847px]:border-t max-[847px]:border-l-0 max-sm:px-[22px] max-sm:py-7">
            <h4 className="text-lp-dim m-0 text-[14px] font-normal">
              {l('pricingIncluded')}
            </h4>
            <ul
              role="list"
              className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-x-6 gap-y-3.5 p-0 max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3"
            >
              {listOf(l('pricingModules')).map((module) => (
                <li
                  key={module}
                  className="text-lp-soft flex items-baseline gap-3 text-[17px] leading-[1.4] max-sm:text-[15px]"
                >
                  <span className="text-lp-accent flex-none" aria-hidden>
                    ✓
                  </span>
                  {module}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </SectionInner>
    </section>
  )
}
