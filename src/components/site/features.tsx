import { useT, type MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'
import { Eyebrow, SectionInner, SectionTitle } from './landing-ui'
import { featuresMessages } from './features-messages'
import { phoneCarousel } from './landing-classes'

type FeatureKey = MessageKey<typeof featuresMessages>

/** Module ids in display order; each has `<id>Title` and `<id>1…3`. */
const modules = [
  'cars',
  'intakes',
  'parts',
  'warehouses',
  'stocktaking',
  'stickers',
  'orders',
  'customers',
  'cash',
  'reports',
  'team',
  'novaPoshta',
  'olx',
] as const

/** Groups of consecutive modules (`group<id>Title`, `group<id>Sub`). */
const groups = [
  { id: 1, first: 0, ids: modules.slice(0, 6) },
  { id: 2, first: 6, ids: modules.slice(6, 11) },
  { id: 3, first: 11, ids: modules.slice(11) },
] as const

const pad = (index: number) => String(index + 1).padStart(2, '0')

/** «Можливості»: thirteen module cards in three groups, first three benefits each. */
export function Features() {
  const t = useT(featuresMessages)
  return (
    <section id="features" className="lp-surface lp-island">
      <SectionInner>
        <div
          data-reveal=""
          className="flex flex-col items-center gap-5 text-center"
        >
          <div className="flex justify-center">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
          </div>
          <SectionTitle className="w-full">{t('title')}</SectionTitle>
          <p className="text-lp-muted m-0 max-w-[440px] text-[18px] leading-[1.5] text-pretty">
            {t('intro')}
          </p>
        </div>
        <div className="flex flex-col gap-14">
          {groups.map(({ id, first, ids }) => {
            const title = t(`group${id}Title`)
            return (
              <div
                key={id}
                className="grid grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-10 border-t border-white/10 pt-8 max-[960px]:grid-cols-1 max-[960px]:gap-5 max-sm:pt-6"
              >
                <div className="flex flex-col gap-2.5">
                  <span
                    className="text-lp-accent font-mono text-[13px]"
                    aria-hidden
                  >
                    {pad(first)}–{pad(first + ids.length - 1)}
                  </span>
                  <h3 className="font-unbounded m-0 text-[24px] font-semibold tracking-[-0.03em]">
                    {title}
                  </h3>
                  <p className="text-lp-muted m-0 text-[15px] leading-[1.5] text-pretty">
                    {t(`group${id}Sub`)}
                  </p>
                </div>
                <ul
                  role="list"
                  aria-label={title}
                  tabIndex={0}
                  className={cn(
                    'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-3 p-0',
                    phoneCarousel,
                  )}
                >
                  {ids.map((module, index) => (
                    <li
                      key={module}
                      data-reveal=""
                      className="lp-glass relative flex flex-col gap-3.5 overflow-hidden rounded-[22px] p-6 transition-transform duration-250 ease-out hover:-translate-y-1 max-sm:gap-4 max-sm:p-[22px]"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h4 className="font-unbounded m-0 text-[20px] font-semibold tracking-[-0.02em]">
                          {t(`${module}Title`)}
                        </h4>
                        <span
                          className="text-lp-dim font-mono text-[12px]"
                          aria-hidden
                        >
                          {pad(first + index)}
                        </span>
                      </div>
                      <ul
                        role="list"
                        className="m-0 flex list-none flex-col gap-2 p-0"
                      >
                        {[1, 2, 3].map((n) => (
                          <li
                            key={n}
                            className="text-lp-bullet flex gap-2.5 text-[15px] leading-[1.4]"
                          >
                            <span
                              className="text-lp-accent flex-none"
                              aria-hidden
                            >
                              —
                            </span>
                            {t(`${module}${n}` as FeatureKey)}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </SectionInner>
    </section>
  )
}
