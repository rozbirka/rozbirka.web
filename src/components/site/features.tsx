import { useT, type MessageKey } from '@/i18n'
import { Eyebrow, SectionInner, SectionTitle } from './landing-ui'
import { featuresMessages } from './features-messages'

type FeatureKey = MessageKey<typeof featuresMessages>

/** Module ids in display order; each has `<id>Title` and `<id>1…3`. */
const modules = [
  'cars',
  'intakes',
  'parts',
  'stickers',
  'orders',
  'customers',
  'cash',
  'reports',
  'team',
] as const

/** «Можливості»: nine module cards with their first three benefits. */
export function Features() {
  const t = useT(featuresMessages)
  return (
    <section id="features" className="border-t border-white/[0.07]">
      <SectionInner>
        <div
          data-reveal=""
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div className="flex max-w-[720px] flex-col gap-5">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <SectionTitle>{t('title')}</SectionTitle>
          </div>
          <p className="text-lp-muted m-0 max-w-[400px] text-[18px] leading-[1.5] text-pretty">
            {t('intro')}
          </p>
        </div>
        <ul
          role="list"
          className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4 p-0"
        >
          {modules.map((id, index) => (
            <li
              key={id}
              data-reveal=""
              data-spot=""
              className="lp-spot hover:border-lp-accent/50 relative flex min-h-[280px] flex-col gap-[22px] overflow-hidden rounded-3xl border border-white/[0.08] p-7 max-sm:min-h-0 max-sm:gap-4 max-sm:p-[22px] transition-[transform,border-color] duration-250 ease-out hover:-translate-y-1"
            >
              <span
                className="text-lp-accent font-mono text-[13px]"
                aria-hidden
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-unbounded m-0 text-[28px] font-semibold tracking-[-0.03em] max-sm:text-[24px]">
                {t(`${id}Title`)}
              </h3>
              <ul
                role="list"
                className="m-0 mt-auto flex list-none flex-col gap-2.5 p-0"
              >
                {[1, 2, 3].map((n) => (
                  <li
                    key={n}
                    className="text-lp-bullet flex gap-3 text-[16px] leading-[1.45]"
                  >
                    <span className="text-lp-accent flex-none" aria-hidden>
                      —
                    </span>
                    {t(`${id}${n}` as FeatureKey)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </SectionInner>
    </section>
  )
}
