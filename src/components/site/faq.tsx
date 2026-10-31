import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/i18n'
import { landingFaqEntries, type FaqEntry } from './faq-messages'
import { Eyebrow, SectionTitle, TelegramIcon } from './landing-ui'
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
  const supportHref = useSupportHref()
  const entries = useMemo(() => landingFaqEntries(locale), [locale])

  return (
    <section
      id="faq"
      data-reveal=""
      className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-12 px-6 py-28 max-sm:gap-8 max-sm:py-16"
    >
      <div className="flex flex-col gap-5">
        <Eyebrow>{t('faqEyebrow')}</Eyebrow>
        <SectionTitle>{l('faqTitle')}</SectionTitle>
        {supportHref && (
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('supportAria')}
            className="text-lp-ink hover:text-lp-accent-hover flex h-11 items-center gap-2.5 self-start rounded-full border border-white/16 pr-[18px] pl-2.5 text-[15px]"
          >
            <TelegramIcon />
            {t('support')}
          </a>
        )}
      </div>
      <ul
        role="list"
        className="col-span-2 flex min-w-0 flex-col gap-2 max-lg:col-span-1"
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
    </section>
  )
}

interface FaqRowProps {
  number: string
  entry: FaqEntry
  isOpen: boolean
  onToggle: () => void
}

function FaqRow({ number, entry, isOpen, onToggle }: FaqRowProps) {
  const panelId = useId()

  return (
    <li
      className={cn(
        'rounded-[20px] transition-colors duration-200 ease-out',
        isOpen && 'bg-lp-surface',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="hover:text-lp-accent-hover flex w-full cursor-pointer items-center gap-5 px-6 py-[22px] text-left max-sm:gap-3 max-sm:px-4 max-sm:py-[18px]"
      >
        <span
          className="text-lp-dim flex-none font-mono text-[13px]"
          aria-hidden
        >
          {number}
        </span>
        <span className="flex-1 text-[19px] leading-[1.35] font-medium max-sm:text-[17px]">
          {entry.question}
        </span>
        <span
          aria-hidden
          className="flex size-8 flex-none items-center justify-center rounded-full border border-white/18 text-[18px]"
        >
          {isOpen ? '–' : '+'}
        </span>
      </button>

      {isOpen && (
        <div id={panelId} role="region" aria-label={entry.question}>
          <p className="text-lp-muted m-0 pr-[76px] pb-6 pl-[57px] text-[17px] leading-[1.55] text-pretty max-sm:pr-4 max-sm:pb-5 max-sm:pl-[49px] max-sm:text-[16px]">
            {entry.answer}
          </p>
        </div>
      )}
    </li>
  )
}
