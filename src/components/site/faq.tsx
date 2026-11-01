import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/i18n'
import {
  faqAskMessages,
  landingFaqEntries,
  type FaqEntry,
} from './faq-messages'
import { Eyebrow, TelegramIcon } from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages } from './landing-messages'
import { siteMessages } from './site-messages'

export type { FaqEntry }

/** Ukrainian FAQ of `/`, kept for callers that render the source page. */
// eslint-disable-next-line react-refresh/only-export-components
export const homepageFaqEntries: readonly FaqEntry[] = landingFaqEntries('uk')

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const { locale } = useLocale()
  const t = useT(siteMessages)
  const l = useT(landingMessages)
  const ask = useT(faqAskMessages)
  const supportHref = useSupportHref()
  const entries = useMemo(() => landingFaqEntries(locale), [locale])

  return (
    <section id="faq" data-reveal="">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] items-start gap-16 px-6 py-28 max-[860px]:grid-cols-1 max-[860px]:gap-8 max-[860px]:px-5 max-[860px]:py-16">
        <div className="sticky top-[110px] flex flex-col gap-5 max-[860px]:static">
          <Eyebrow>{t('faqEyebrow')}</Eyebrow>
          <h2 className="font-unbounded m-0 text-[clamp(30px,3.6vw,48px)] leading-[1.08] font-semibold tracking-[-0.03em]">
            {l('faqTitle')}
          </h2>
          {supportHref && (
            <div className="lp-glass mt-3 flex flex-col gap-3.5 rounded-[20px] p-[22px]">
              <span className="text-[17px] font-semibold">{ask('title')}</span>
              <span className="text-lp-muted text-[15px] leading-[1.5]">
                {ask('body')}
              </span>
              <a
                href={supportHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('supportAria')}
                className="bg-lp-ink text-lp-bg hover:text-lp-bg flex h-11 items-center gap-2.5 self-start rounded-full pr-[18px] pl-3 text-[15px] font-semibold whitespace-nowrap transition-opacity duration-200 hover:opacity-85"
              >
                <TelegramIcon size={22} />
                {t('support')}
              </a>
            </div>
          )}
        </div>
        <ul
          role="list"
          className="m-0 flex min-w-0 list-none flex-col border-b border-white/10 p-0"
        >
          {entries.map((entry, i) => (
            <FaqRow
              key={entry.question}
              number={String(i + 1).padStart(2, '0')}
              entry={entry}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </ul>
      </div>
    </section>
  )
}

interface FaqRowProps {
  number: string
  entry: FaqEntry
  isOpen: boolean
  onToggle: () => void
}

/**
 * One question. Closed answers stay in the HTML (search engines read them)
 * but are inert and hidden from assistive technology.
 */
function FaqRow({ number, entry, isOpen, onToggle }: FaqRowProps) {
  const panelId = useId()

  return (
    <li className="border-t border-white/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="hover:text-lp-accent-hover grid w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_36px] items-center gap-4 py-[26px] text-left max-sm:gap-3.5 max-sm:px-4 max-sm:py-[18px]"
      >
        <span
          className={cn(
            'font-mono text-[13px] transition-colors duration-[250ms] [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]',
            isOpen ? 'text-lp-accent' : 'text-lp-dim',
          )}
          aria-hidden
        >
          {number}
        </span>
        <span className="text-[clamp(17px,1.6vw,20px)] leading-[1.35] font-semibold text-pretty max-sm:text-[17px]">
          {entry.question}
        </span>
        <span
          aria-hidden
          className={cn(
            'flex size-9 items-center justify-center rounded-full text-[20px] leading-none transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
            isOpen
              ? 'bg-lp-accent text-lp-bg rotate-45'
              : 'text-lp-ink bg-white/[0.08]',
          )}
        >
          +
        </span>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)]',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div
          id={panelId}
          role={isOpen ? 'region' : undefined}
          aria-label={isOpen ? entry.question : undefined}
          aria-hidden={!isOpen}
          inert={!isOpen}
          className="min-h-0 overflow-hidden"
        >
          <p className="text-lp-muted m-0 max-w-[640px] pr-[52px] pb-7 pl-14 text-[17px] leading-[1.6] text-pretty max-[860px]:px-0 max-[860px]:pb-6 max-sm:px-5 max-sm:pb-5">
            {entry.answer}
          </p>
        </div>
      </div>
    </li>
  )
}
