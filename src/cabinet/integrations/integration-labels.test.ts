import { describe, expect, it } from 'vitest'
import {
  diagnosticCheckLabel,
  integrationErrorMessage,
  integrationKind,
  integrationMark,
  integrationProblemMessage,
  integrationStatusPresentation,
  isNovaPoshtaAvailable,
  trackingProblemMessage,
  trackingReasonMessage,
  trackingStatePresentation,
} from './integration-labels'
import { waitedFor } from './webhook-wait'

describe('integration labels', () => {
  it('keeps the Ukrainian source when no locale is passed', () => {
    expect(integrationStatusPresentation('active')).toEqual({
      label: 'Підключена',
      tone: 'ok',
    })
    expect(integrationMark('nova_poshta')).toBe('НП')
    expect(integrationErrorMessage('nova_poshta_rejected')).toBe(
      'Нова пошта відхилила запит.',
    )
  })

  it('translates statuses, marks, kinds and checks', () => {
    expect(integrationStatusPresentation('draft', 'en-GB').label).toBe(
      'Not set up',
    )
    expect(integrationStatusPresentation('error', 'pl')).toEqual({
      label: 'Błąd',
      tone: 'danger',
    })
    expect(integrationStatusPresentation('paused', 'en-GB')).toEqual({
      label: 'paused',
      tone: 'neutral',
    })
    expect(integrationMark('nova_poshta', 'en-GB')).toBe('NP')
    expect(integrationMark('courier_x', 'pl')).toBe('CO')
    expect(integrationKind('nova_poshta', 'pl')).toBe('Dostawa')
    expect(integrationKind('courier_x', 'en-GB')).toBeNull()
    expect(diagnosticCheckLabel('configuration', 'en-GB')).toBe(
      'Access key saved',
    )
    expect(diagnosticCheckLabel('new_check', 'en-GB')).toBe('new_check')
  })

  it('explains error codes and keeps unknown ones visible', () => {
    expect(integrationErrorMessage('division_not_found', 'en-GB')).toBe(
      'The dispatch point’s branch can no longer be found.',
    )
    expect(integrationErrorMessage('something_new', 'pl')).toBe(
      'Usługa zwróciła błąd: something_new',
    )
    expect(
      integrationErrorMessage('integration_country_unavailable', 'pl'),
    ).toBe(
      'Nova Poshta jest dostępna tylko dla firm na Ukrainie. Integracje dla Twojego kraju pojawią się później.',
    )
  })

  it('maps the country refusal and passes other server messages through', () => {
    expect(
      integrationProblemMessage(
        { code: 'INTEGRATION_COUNTRY_UNAVAILABLE', message: 'raw' },
        'en-GB',
      ),
    ).toBe(
      'Nova Poshta is only available for businesses in Ukraine. Integrations for your country will come later.',
    )
    expect(
      integrationProblemMessage(
        { code: 'other', message: 'As received' },
        'pl',
      ),
    ).toBe('As received')
  })

  it('decides Nova Poshta by business country only', () => {
    expect(isNovaPoshtaAvailable('UA')).toBe(true)
    expect(isNovaPoshtaAvailable(null)).toBe(true)
    expect(isNovaPoshtaAvailable('GB')).toBe(false)
    expect(isNovaPoshtaAvailable('PL')).toBe(false)
  })

  it('translates the tracking subscription lifecycle', () => {
    expect(trackingStatePresentation('Connected', 'en-GB')).toEqual({
      label: 'Connected',
      tone: 'ok',
      detail: 'New waybills will be connected automatically.',
    })
    expect(trackingStatePresentation('Whatever', 'pl').label).toBe(
      'Nieznany stan',
    )
    expect(trackingReasonMessage(null, 'en-GB')).toBeNull()
    expect(trackingReasonMessage('provider_notfound', 'en-GB')).toBe(
      'Nova Poshta couldn’t find this subscription.',
    )
    expect(trackingReasonMessage('mystery', 'en-GB')).toMatch(
      /gave no reason we can explain/,
    )
    expect(
      trackingProblemMessage(
        { kind: 'conflict', code: 'TRACKING_BUSY', message: 'busy' },
        'en-GB',
      ),
    ).toMatch(/^This action is already running/)
    expect(
      trackingProblemMessage(
        { kind: 'unknown', code: 'nova_poshta_rejected', message: 'x' },
        'pl',
      ),
    ).toBe('Nova Poshta odrzuciła żądanie subskrypcji.')
    expect(
      trackingProblemMessage({ kind: 'forbidden', message: 'x' }, 'en-GB'),
    ).toBe('No access: you need permission to manage team settings.')
  })

  it('says how long an event has waited in each language', () => {
    const now = Date.parse('2026-10-07T12:00:00Z')
    expect(waitedFor('2026-10-07T11:22:00Z', 'uk', now)).toBe('38 хв')
    expect(waitedFor('2026-10-07T09:00:00Z', 'en-GB', now)).toBe('3 h')
    expect(waitedFor('2026-10-04T12:00:00Z', 'pl', now)).toBe('3 dn.')
  })
})
