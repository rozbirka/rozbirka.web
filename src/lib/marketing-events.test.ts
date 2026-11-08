import { afterEach, expect, it, vi } from 'vitest'
import { trackLandingLead } from './marketing-events'

afterEach(() => vi.unstubAllGlobals())

it('sends only a fixed accepted-lead event on HTTPS production', () => {
  const dataLayer: unknown[] = []
  vi.stubGlobal('window', {
    location: { hostname: 'rozbirka.pro', protocol: 'https:' },
    dataLayer,
  })
  trackLandingLead()
  expect(dataLayer).toHaveLength(1)
  expect(Array.from(dataLayer[0] as IArguments)).toEqual([
    'event',
    'generate_lead',
    { lead_source: 'landing_form' },
  ])
})

it.each(['localhost', 'qa.rozbirka.pro', 'preview.workers.dev'])(
  'never queues an event on %s',
  (hostname) => {
    const dataLayer: unknown[] = []
    vi.stubGlobal('window', {
      location: { hostname, protocol: 'https:' },
      dataLayer,
    })
    trackLandingLead()
    expect(dataLayer).toEqual([])
  },
)

it('does not fail the form if the queue is missing or blocked', () => {
  vi.stubGlobal('window', {
    location: { hostname: 'rozbirka.pro', protocol: 'https:' },
  })
  expect(trackLandingLead).not.toThrow()
  vi.stubGlobal('window', {
    location: { hostname: 'rozbirka.pro', protocol: 'https:' },
    dataLayer: Object.freeze([]),
  })
  expect(trackLandingLead).not.toThrow()
})
