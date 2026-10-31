import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useT } from '@/i18n'
import { PrimaryLink } from './landing-ui'
import { useSupportHref } from './landing-hooks'
import { landingMessages, listOf } from './landing-messages'
import { AppStoreBadge } from './store-badges'

const field =
  'bg-lp-card text-lp-ink h-[52px] rounded-[14px] border border-white/14 px-4 text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-accent'

/**
 * «Допоможемо почати». There is no lead endpoint yet, so the form hands the
 * visitor over to the support bot in Telegram, where the team picks it up.
 */
function StartForm() {
  const l = useT(landingMessages)
  const supportHref = useSupportHref()
  const [sent, setSent] = useState(false)
  const nameId = useId()
  const contactId = useId()
  const carsId = useId()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (supportHref) window.open(supportHref, '_blank', 'noopener,noreferrer')
    setSent(true)
  }

  if (sent) {
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
    <form onSubmit={submit} className="flex flex-col gap-4">
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
      <button
        type="submit"
        className="bg-lp-accent text-lp-bg hover:bg-lp-accent-hover mt-1 flex h-14 cursor-pointer items-center justify-center rounded-full text-[17px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        {l('formSubmit')}
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
      className="mx-auto max-w-[1240px] px-6 pb-28"
    >
      <div className="bg-lp-accent text-lp-bg grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-center gap-12 rounded-[36px] px-14 py-16 max-sm:px-6 max-sm:py-10">
        <div className="flex flex-col gap-6">
          <h2 className="font-unbounded m-0 text-[clamp(34px,5vw,64px)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
            {l('startTitle')}
          </h2>
          <p className="m-0 max-w-[480px] text-[20px] leading-[1.5]">
            {l('startBody')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/login"
              className="bg-lp-bg text-lp-ink hover:text-lp-ink flex h-14 items-center rounded-full px-7 text-[17px] font-semibold transition-transform duration-150 ease-out hover:bg-[#222] active:scale-[0.97]"
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
