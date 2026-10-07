import { describe, expect, it } from 'vitest'
import type { OwnerOnboarding } from '@/api/onboarding'
import {
  completedStepCount,
  decideChecklistView,
  diffOnboarding,
  firstIncompleteStep,
  isOwnerRole,
  isUnavailableProblem,
  isUnknownOutcome,
} from './onboarding-policy'

const fresh: OwnerOnboarding = {
  eligible: true,
  deferred: false,
  dismissed: false,
  completed: false,
  settingsCompleted: false,
  currencySelected: false,
  sourceCreated: false,
  firstPartCreated: false,
}
const ready = (facts: Partial<OwnerOnboarding> = {}) =>
  ({ status: 'ready', facts: { ...fresh, ...facts } }) as const
const allDone = {
  settingsCompleted: true,
  currencySelected: true,
  sourceCreated: true,
  firstPartCreated: true,
}

describe('who sees the checklist (DIA-ONBOARDING-DECISION)', () => {
  const view = (isOwner: boolean, facts: Partial<OwnerOnboarding>) =>
    decideChecklistView({ isOwner, load: ready(facts) }).kind

  it('shows nothing for a tenant created before launch, owner or not (SC-7, AC-9)', () => {
    expect(view(true, { eligible: false })).toBe('hidden')
    expect(view(false, { eligible: false })).toBe('hidden')
    expect(view(true, { eligible: false, completed: true })).toBe('hidden')
  })

  it('never shows the owner scenario to an invited worker (AC-1)', () => {
    expect(view(false, {})).toBe('hidden')
    expect(view(false, { completed: true, ...allDone })).toBe('hidden')
    expect(
      decideChecklistView({
        isOwner: false,
        load: { status: 'loading' },
      }).kind,
    ).toBe('hidden')
  })

  it('shows the list, or the compact block the owner chose (AC-7)', () => {
    expect(view(true, {})).toBe('expanded')
    expect(view(true, { deferred: true, settingsCompleted: true })).toBe(
      'compact',
    )
  })

  it('shows the completion card until Core says it is dismissed, and completion beats deferral', () => {
    expect(view(true, { completed: true, ...allDone })).toBe('completed')
    expect(view(true, { completed: true, deferred: true })).toBe('completed')
    expect(view(true, { completed: true, dismissed: true })).toBe('hidden')
    // `dismissed` only hides the completion card, never an unfinished list.
    expect(view(true, { dismissed: true })).toBe('expanded')
  })

  it('treats four saved facts as complete even before Core stamps it', () => {
    expect(view(true, allDone)).toBe('completed')
  })

  it('keeps completion after the first part is deleted (AC-11)', () => {
    expect(
      view(true, {
        completed: true,
        settingsCompleted: true,
        currencySelected: true,
      }),
    ).toBe('completed')
  })

  it('shows loading and failure to the owner without guessed progress (EC-4)', () => {
    expect(
      decideChecklistView({
        isOwner: true,
        load: { status: 'loading' },
      }),
    ).toEqual({ kind: 'loading' })
    expect(
      decideChecklistView({
        isOwner: true,
        load: { status: 'error', problem: null },
      }),
    ).toEqual({ kind: 'error' })
    expect(
      decideChecklistView({
        isOwner: true,
        load: { status: 'unavailable' },
      }).kind,
    ).toBe('hidden')
  })

  it('keeps a first read without a connection neutral, not an error', () => {
    expect(
      decideChecklistView({ isOwner: true, load: { status: 'offline' } }),
    ).toEqual({ kind: 'offline' })
    expect(
      decideChecklistView({ isOwner: false, load: { status: 'offline' } }),
    ).toEqual({ kind: 'hidden' })
  })
})

describe('progress and the next step', () => {
  it('counts only saved facts', () => {
    expect(completedStepCount(fresh)).toBe(0)
    expect(
      completedStepCount({
        ...fresh,
        settingsCompleted: true,
        sourceCreated: true,
      }),
    ).toBe(2)
    expect(completedStepCount({ ...fresh, ...allDone })).toBe(4)
  })

  it('continues at the first incomplete step, whatever was done out of order (AC-6)', () => {
    expect(firstIncompleteStep(fresh)).toBe('settings')
    expect(firstIncompleteStep({ ...fresh, settingsCompleted: true })).toBe(
      'currency',
    )
    // A car added from «Склад» before the currency was chosen (SC-4).
    expect(
      firstIncompleteStep({
        ...fresh,
        settingsCompleted: true,
        sourceCreated: true,
      }),
    ).toBe('currency')
    expect(
      firstIncompleteStep({
        ...fresh,
        settingsCompleted: true,
        currencySelected: true,
        sourceCreated: true,
      }),
    ).toBe('part')
    expect(firstIncompleteStep({ ...fresh, ...allDone })).toBeNull()
  })

  it('points back to the source once the last source is gone (AC-14)', () => {
    const view = decideChecklistView({
      isOwner: true,
      load: ready({ settingsCompleted: true, currencySelected: true }),
    })
    expect(view).toMatchObject({ kind: 'expanded', next: 'source' })
  })
})

describe('what changed between two reads', () => {
  it('credits each newly saved step, wherever it was saved (AC-4)', () => {
    expect(
      diffOnboarding(fresh, {
        ...fresh,
        settingsCompleted: true,
        sourceCreated: true,
      }),
    ).toEqual([
      { kind: 'credited', step: 'settings' },
      { kind: 'credited', step: 'source' },
    ])
  })

  it('announces completion once, not every step that led to it', () => {
    expect(
      diffOnboarding(
        {
          ...fresh,
          settingsCompleted: true,
          currencySelected: true,
          sourceCreated: true,
        },
        { ...fresh, ...allDone, completed: true },
      ),
    ).toEqual([{ kind: 'completed' }])
  })

  it('reports the source step reverting before the first part (AC-14)', () => {
    expect(
      diffOnboarding(
        { ...fresh, settingsCompleted: true, sourceCreated: true },
        { ...fresh, settingsCompleted: true },
      ),
    ).toEqual([{ kind: 'source-reverted' }])
  })

  it('says nothing on the first read, after completion or for ineligible tenants', () => {
    expect(diffOnboarding(null, { ...fresh, ...allDone })).toEqual([])
    expect(
      diffOnboarding(
        { ...fresh, ...allDone, completed: true },
        { ...fresh, completed: true, settingsCompleted: true },
      ),
    ).toEqual([])
    expect(
      diffOnboarding(
        { ...fresh, eligible: false },
        { ...fresh, eligible: false, sourceCreated: true },
      ),
    ).toEqual([])
  })
})

describe('roles and failures', () => {
  it('recognises the owner role whatever its case', () => {
    expect(isOwnerRole('owner')).toBe(true)
    expect(isOwnerRole('Owner')).toBe(true)
    expect(isOwnerRole('manager')).toBe(false)
    expect(isOwnerRole('')).toBe(false)
    expect(isOwnerRole(null)).toBe(false)
  })

  it('hides on 403/404/405/501 and re-reads after a lost answer', () => {
    expect(isUnavailableProblem({ kind: 'forbidden', message: '' })).toBe(true)
    expect(isUnavailableProblem({ kind: 'not-found', message: '' })).toBe(true)
    expect(
      isUnavailableProblem({ kind: 'server', message: '', status: 501 }),
    ).toBe(true)
    expect(
      isUnavailableProblem({ kind: 'server', message: '', status: 500 }),
    ).toBe(false)
    expect(isUnknownOutcome({ kind: 'network', message: '' })).toBe(true)
    expect(isUnknownOutcome({ kind: 'timeout', message: '' })).toBe(true)
    expect(isUnknownOutcome({ kind: 'conflict', message: '' })).toBe(false)
  })
})
