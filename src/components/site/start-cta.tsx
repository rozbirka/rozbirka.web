import { useId, useState, type FormEvent } from 'react'
import { supportApi } from '@/api/support'
import { useLocale, useT } from '@/i18n'
import { Eyebrow, PrimaryLink, SectionTitle } from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages, listOf } from './landing-messages'

const field =
  'bg-lp-bg text-lp-ink h-[52px] rounded-[14px] border border-white/14 px-4 text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-accent'

/**
 * «Допоможемо почати». Core posts the lead to the Telegram support group,
 * where managers pick it up; on failure the visitor gets the bot link.
 */
function StartForm() {
  const l = useT(landingMessages)
  const { locale } = useLocale()
  const supportHref = useSupportHref()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const nameId = useId()
  const contactId = useId()
  const errorId = useId()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'sending') return
    const form = new FormData(event.currentTarget)
    const field = (name: string) => {
      const value = form.get(name)
      return typeof value === 'string' ? value : ''
    }
    setStatus('sending')
    try {
      await supportApi.createLead({
        name: field('name'),
        contact: field('phone'),
        locale,
        website: field('website'),
      })
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col gap-4 py-6" role="status">
        <span
          className="bg-lp-accent text-lp-bg flex size-14 items-center justify-center rounded-full text-[26px] font-semibold"
          aria-hidden
        >
          ✓
        </span>
        <span className="font-unbounded text-[24px] font-semibold">
          {l('formThanks')}
        </span>
        <span className="text-lp-muted text-[17px] leading-[1.5]">
          {l('formThanksBody')}
        </span>
        <PrimaryLink to="/login">{l('formThanksCta')}</PrimaryLink>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-describedby={status === 'error' ? errorId : undefined}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="font-unbounded m-0 text-[22px] font-semibold">
          {l('formTitle')}
        </h3>
        <p className="text-lp-muted m-0 text-[15px] leading-[1.5]">
          {l('formIntro')}
        </p>
      </div>
      <div className="text-lp-muted flex flex-col gap-2 text-[14px]">
        <label htmlFor={nameId}>{l('formName')}</label>
        <input
          id={nameId}
          required
          name="name"
          maxLength={80}
          autoComplete="name"
          placeholder={l('formNamePlaceholder')}
          className={field}
        />
      </div>
      <div className="text-lp-muted flex flex-col gap-2 text-[14px]">
        <label htmlFor={contactId}>{l('formContact')}</label>
        <input
          id={contactId}
          required
          name="phone"
          minLength={3}
          maxLength={64}
          autoComplete="tel"
          placeholder={l('formContactPlaceholder')}
          className={field}
        />
      </div>
      {/* Honeypot for form bots: off-screen, skipped by keyboard and readers. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
      {status === 'error' && (
        <p
          id={errorId}
          role="alert"
          className="m-0 rounded-[14px] bg-[rgba(255,106,26,0.12)] px-4 py-3 text-[15px] leading-[1.45]"
        >
          {l('formError')}
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-lp-accent text-lp-bg hover:bg-lp-accent-hover lp-btn-glow mt-1 flex h-14 cursor-pointer items-center justify-center rounded-full text-[17px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
      >
        {status === 'sending' ? l('formSending') : l('formSubmit')}
      </button>
      {supportHref && (
        <a
          href={supportHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lp-muted hover:text-lp-accent-hover flex min-h-11 items-center justify-center text-center text-[15px]"
        >
          {l('formTelegram')}
        </a>
      )}
    </form>
  )
}

/** Closing block: «Ти все ще ведеш облік вручну?», what you get, lead form. */
export function StartCta() {
  const l = useT(landingMessages)
  return (
    <section
      id="start"
      data-reveal=""
      className="lp-sec lp-sec-gap mx-auto max-w-[1240px] px-6 pb-28 max-sm:px-5 max-sm:pb-16"
    >
      <div className="relative grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-center gap-12 overflow-hidden rounded-[36px] border border-[rgba(255,106,26,0.35)] bg-[radial-gradient(90%_120%_at_0%_0%,rgba(255,106,26,0.28),transparent_55%),var(--color-lp-surface)] px-14 py-16 max-lg:px-10 max-lg:py-12 max-sm:gap-8 max-sm:rounded-3xl max-sm:px-[22px] max-sm:py-7">
        <div className="flex flex-col gap-7">
          <Eyebrow>{l('startEyebrow')}</Eyebrow>
          <SectionTitle>
            {l('startTitleStart')}{' '}
            <span className="text-lp-accent">{l('startTitleAccent')}</span>
          </SectionTitle>
          <p className="text-lp-muted m-0 max-w-[480px] text-[18px] leading-[1.5] text-pretty">
            {l('startBody')}
          </p>
          <ul role="list" className="m-0 flex list-none flex-col gap-3.5 p-0">
            {listOf(l('startPoints')).map((point) => (
              <li
                key={point}
                className="text-lp-soft flex items-center gap-3.5 text-[17px]"
              >
                <span
                  className="bg-lp-accent text-lp-bg flex size-7 flex-none items-center justify-center rounded-full text-[14px] font-bold"
                  aria-hidden
                >
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-lp-bg text-lp-ink flex flex-col gap-5 rounded-[28px] border border-white/[0.08] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] max-sm:px-[22px] max-sm:py-7">
          <StartForm />
        </div>
      </div>
    </section>
  )
}
