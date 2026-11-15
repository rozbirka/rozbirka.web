import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  funnelEvents,
  trackFunnelEvent,
  trackLandingLead,
} from './marketing-events'

beforeEach(() => vi.stubEnv('VITE_APP_ENV', 'production'))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function setup(hostname = 'rozbirka.pro', protocol = 'https:') {
  const dataLayer: unknown[] = []
  vi.stubGlobal('window', {
    location: { hostname, protocol },
    dataLayer,
    __rozbirkaMarketingInitialized: true,
  })
  return dataLayer
}

it('sends only fixed, sanitized funnel facts, never browser URLs or form values', () => {
  const queue = setup()
  for (const event of funnelEvents) trackFunnelEvent(event)
  expect(queue).toHaveLength(funnelEvents.length)
  for (const [index, args] of queue.entries()) {
    expect(Array.from(args as IArguments)).toEqual([
      'event',
      funnelEvents[index],
      {
        send_to: 'G-D35DJ28PLE',
        page_location: 'https://rozbirka.pro/',
        page_referrer: '',
        page_title: 'Rozbirka',
      },
    ])
  }
})

it.each(['qa', 'development', 'test', ''])(
  'does not queue or load scripts in %s builds even on prod host',
  (env) => {
    const queue = setup()
    vi.stubEnv('VITE_APP_ENV', env)
    funnelEvents.forEach(trackFunnelEvent)
    trackLandingLead()
    expect(queue).toEqual([])
  },
)
it.each([
  'localhost',
  'qa.rozbirka.pro',
  'preview.workers.dev',
  'rozbirka.pro.example.com',
])('never queues on %s', (hostname) => {
  const queue = setup(hostname)
  funnelEvents.forEach(trackFunnelEvent)
  trackLandingLead()
  expect(queue).toEqual([])
})
it('excludes HTTP and unknown event names', () => {
  const queue = setup('rozbirka.pro', 'http:')
  trackLandingLead()
  expect(queue).toEqual([])
  setup()
  trackFunnelEvent('phone=secret' as never)
  expect((window as Window & { dataLayer?: unknown[] }).dataLayer).toEqual([])
})
it('initializes GA once for a direct registration entry, without automatic pageviews', () => {
  const queue = setup()
  delete (window as Window & { __rozbirkaMarketingInitialized?: boolean })
    .__rozbirkaMarketingInitialized
  const append = vi
    .spyOn(document.head, 'appendChild')
    .mockImplementation((node) => node)
  trackFunnelEvent('registration_view')
  trackFunnelEvent('registration_otp_requested')
  expect(append).toHaveBeenCalledTimes(1)
  expect(Array.from(queue[1] as IArguments)).toEqual([
    'config',
    'G-D35DJ28PLE',
    expect.objectContaining({
      send_page_view: false,
      page_location: 'https://rozbirka.pro/',
    }),
  ])
  append.mockRestore()
})
it('does not break successful operations if analytics is blocked', () => {
  setup()
  Object.freeze((window as Window & { dataLayer?: unknown[] }).dataLayer)
  expect(() => trackFunnelEvent('trial_started_web')).not.toThrow()
})
it('keeps accepted lead measurement distinct from trial', () => {
  const queue = setup()
  trackLandingLead()
  expect(Array.from(queue[0] as IArguments)).toEqual([
    'event',
    'generate_lead',
    expect.objectContaining({ lead_source: 'landing_form' }),
  ])
})
