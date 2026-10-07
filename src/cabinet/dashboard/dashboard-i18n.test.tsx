import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n'
import { ActivityCard } from './ActivityCard'
import { DashboardErrorState } from './DashboardErrorState'
import { activityLabel } from './dashboard-labels'

afterEach(() => {
  vi.useRealTimers()
})

describe('DashboardErrorState in en-GB', () => {
  it('explains a billing problem and offers both ways out', async () => {
    const retry = vi.fn(() => Promise.resolve())
    render(
      <LocaleProvider locale="en-GB" syncDocumentLang={false}>
        <MemoryRouter>
          <DashboardErrorState
            ariaLabel="Summary"
            billingPath="/app/koval/settings/billing/overview"
            genericMessage="Couldn’t load the summary."
            problem={{ kind: 'unknown', status: 402, message: 'raw upstream' }}
            retry={retry}
          />
        </MemoryRouter>
      </LocaleProvider>,
    )

    const alert = screen.getByRole('alert', { name: 'Summary' })
    expect(alert).toHaveTextContent('Your subscription needs attention')
    expect(alert).not.toHaveTextContent('raw upstream')
    expect(
      screen.getByRole('link', { name: 'Go to subscription' }),
    ).toHaveAttribute('href', '/app/koval/settings/billing/overview')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it.each([
    ['QUOTA_EXCEEDED', 'Limit reached'],
    ['FEATURE_NOT_AVAILABLE', 'This feature isn’t available on your plan'],
  ])('names %s', (code, title) => {
    render(
      <LocaleProvider locale="en-GB" syncDocumentLang={false}>
        <MemoryRouter>
          <DashboardErrorState
            ariaLabel="Analytics"
            billingPath={null}
            genericMessage="Couldn’t load analytics."
            problem={{ kind: 'conflict', code, message: 'raw' }}
            retry={() => Promise.resolve()}
          />
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(screen.getByRole('heading', { name: title })).toBeVisible()
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('ActivityCard in other languages', () => {
  it('labels events and stamps them on the business clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T18:00:00Z'))

    render(
      <LocaleProvider
        locale="en-GB"
        syncDocumentLang={false}
        timeZone="Europe/London"
      >
        <ActivityCard
          lastActivity={{
            type: 'car_created',
            userName: 'Dmytro',
            timestamp: '2026-10-07T11:36:00Z',
          }}
          lastMyActivity={{
            type: 'sale',
            userName: 'Olena',
            timestamp: '2026-09-18T11:36:00Z',
          }}
        />
      </LocaleProvider>,
    )

    const card = screen.getByRole('region', { name: 'Activity' })
    expect(card).toHaveTextContent('Car added')
    expect(card).toHaveTextContent('Dmytro · in the business')
    // Today in London: the clock; an older event: its date.
    expect(card).toHaveTextContent('12:36')
    expect(card).toHaveTextContent('18/09')
    expect(card).toHaveTextContent('Olena · mine')
  })

  it('says nothing happened yet in Polish', () => {
    render(
      <LocaleProvider locale="pl" syncDocumentLang={false}>
        <ActivityCard lastActivity={null} lastMyActivity={null} />
      </LocaleProvider>,
    )

    expect(screen.getByRole('region', { name: 'Aktywność' })).toHaveTextContent(
      'Na razie nic się nie wydarzyło.',
    )
  })

  it('translates known activity codes and keeps unknown ones', () => {
    expect(activityLabel('intake_created')).toBe('Створено приймання')
    expect(activityLabel('intake_created', 'pl')).toBe('Utworzono przyjęcie')
    expect(activityLabel('part_created', 'en-GB')).toBe('Part added')
    expect(activityLabel('inventory_started', 'en-GB')).toBe(
      'inventory_started',
    )
  })
})
