import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supportApi } from '@/api/support'
import { useLocale, useT } from '@/i18n'
import { PrimaryLink } from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages, listOf } from './landing-messages'
import { AppStoreBadge } from './store-badges'

const field =
  'bg-lp-card text-lp-ink h-[52px] rounded-[14px] border border-white/14 px-4 text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-accent'

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
  const carsId = useId()
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
        cars: field('cars'),
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
        <p className="text-lp-muted m-0 text-[15px]">{l('formIntro')}</p>
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
      <div className="text-lp-muted flex flex-col gap-2 text-[14px]">
        <label htmlFor={carsId}>{l('formCars')}</label>
        <select id={carsId} name="cars" className={`${field} px-3.5`}>
          {listOf(l('formCarsOptions')).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
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
        className="bg-lp-accent text-lp-bg hover:bg-lp-accent-hover mt-1 flex h-14 cursor-pointer items-center justify-center rounded-full text-[17px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
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

/** Closing orange block: «Ти все ще ведеш облік вручну?» + lead form. */
export function StartCta() {
  const l = useT(landingMessages)
  return (
    <section
      id="start"
      data-reveal=""
      className="mx-auto max-w-[1240px] px-6 pb-28 max-sm:px-4 max-sm:pb-16"
    >
      <div className="bg-lp-accent text-lp-bg grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-center gap-12 rounded-[36px] px-14 py-16 max-lg:px-10 max-lg:py-12 max-sm:gap-8 max-sm:rounded-[28px] max-sm:px-5 max-sm:py-8">
        <div className="flex flex-col gap-6">
          <h2 className="font-unbounded m-0 text-[clamp(34px,5vw,64px)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
            {l('startTitle')}
          </h2>
          <p className="m-0 max-w-[480px] text-[20px] leading-[1.5] max-sm:text-[17px]">
            {l('startBody')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/login"
              className="bg-lp-bg text-lp-ink hover:text-lp-ink flex h-14 items-center justify-center rounded-full px-7 max-sm:w-full text-[17px] font-semibold transition-transform duration-150 ease-out hover:bg-[#222] active:scale-[0.97]"
            >
              {l('startFree')}
            </Link>
            <AppStoreBadge />
          </div>
        </div>
        <div className="bg-lp-bg text-lp-ink flex flex-col gap-5 rounded-[28px] p-8 max-sm:p-6">
          <StartForm />
        </div>
      </div>
    </section>
  )
}
