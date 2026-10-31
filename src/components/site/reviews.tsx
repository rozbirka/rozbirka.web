import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { phoneCarousel } from './landing-classes'
import { Count, Eyebrow, SectionInner, SectionTitle } from './landing-ui'
import { landingMessages, listOf } from './landing-messages'
import { siteMessages } from './site-messages'

const trustFigures = [
  { value: 120, suffix: '+' },
  { value: 2400, suffix: '+' },
  { value: 85000, suffix: '+' },
  { value: 4.8, decimals: 1 },
]

const reviewKeys = [
  ['review1', 'review1Name', 'review1Role'],
  ['review2', 'review2Name', 'review2Role'],
  ['review3', 'review3Name', 'review3Role'],
] as const

export function Reviews() {
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const labels = listOf(l('trust'))
  return (
    <section
      id="reviews"
      data-reveal=""
      className="bg-lp-surface border-t border-white/[0.07]"
    >
      <SectionInner>
        <div className="flex max-w-[760px] flex-col gap-5">
          <Eyebrow>{l('reviewsEyebrow')}</Eyebrow>
          <SectionTitle>{l('reviewsTitle')}</SectionTitle>
        </div>
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4 max-[1071px]:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-2">
          {trustFigures.map((figure, index) => (
            <div
              key={labels[index]}
              className="border-lp-accent flex flex-col-reverse gap-2 border-t-2 py-7 max-sm:py-5"
            >
              <dd className="text-lp-muted m-0 text-[16px] max-sm:text-[14px]">
                {labels[index]}
              </dd>
              <dt className="font-unbounded text-[clamp(36px,4vw,52px)] font-semibold max-sm:text-[32px] tracking-[-0.04em] tabular-nums">
                <Count {...figure} />
              </dt>
            </div>
          ))}
        </dl>
        <div
          role="region"
          aria-label={t('navReviews')}
          tabIndex={0}
          className={cn(
            'grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4',
            phoneCarousel,
          )}
        >
          {reviewKeys.map(([quote, name, role]) => (
            <figure
              key={quote}
              className="bg-lp-bg m-0 flex flex-col gap-7 rounded-3xl border border-white/[0.08] p-7"
            >
              <blockquote className="text-lp-ink m-0 text-[18px] leading-[1.5] text-pretty">
                «{l(quote)}»
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3.5">
                <span
                  className="bg-lp-chip font-unbounded text-lp-accent-hover flex size-11 flex-none items-center justify-center rounded-full font-semibold"
                  aria-hidden
                >
                  {l(name).charAt(0)}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[16px] font-semibold">{l(name)}</span>
                  <span className="text-lp-muted text-[14px]">{l(role)}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </SectionInner>
    </section>
  )
}
