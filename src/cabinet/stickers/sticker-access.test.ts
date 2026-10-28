import { describe, expect, it } from 'vitest'
import type { TenantAccessState } from '../access-types'
import { cabinetModules } from '../module-registry'
import {
  stickerAccessDefinition,
  stickerModeAccess,
  stickerNavigationTarget,
} from './sticker-access'

const ready = (
  permissions: string[],
  state: 'active' | 'blocked' = 'active',
): TenantAccessState => ({
  status: 'ready',
  error: null,
  snapshot: {
    userId: 'u',
    tenantId: 't',
    generation: 1,
    role: 'member',
    permissions: new Set(permissions),
    features: new Set(),
    subscription: null,
    entitlement: {
      state,
      usage: {
        parts: { used: 10, max: 10 },
        cars: { used: 0, max: 10 },
        intakes: { used: 0, max: 10 },
        users: { used: 0, max: 10 },
        cashRegisters: { used: 0, max: 10 },
      },
    },
  },
})

describe('sticker mode access', () => {
  it('preserves the existing part definition', () => {
    expect(stickerAccessDefinition('parts')).toBe(cabinetModules.stickers)
  })

  it.each([
    [['parts.view'], 'allowed', 'permission-denied', '/app/koval/stickers'],
    [
      ['inventory.view'],
      'permission-denied',
      'allowed',
      '/app/koval/stickers?type=locations',
    ],
    [
      ['parts.view', 'inventory.view'],
      'allowed',
      'allowed',
      '/app/koval/stickers',
    ],
    [[], 'permission-denied', 'permission-denied', null],
  ] as const)(
    'uses each mode permission for %j',
    (permissions, parts, locations, destination) => {
      const access = ready([...permissions])
      expect(stickerModeAccess('parts', access).kind).toBe(parts)
      expect(stickerModeAccess('locations', access).kind).toBe(locations)
      expect(stickerNavigationTarget('koval', access)).toBe(destination)
    },
  )

  it('allows location output with inventory.view and an exhausted parts quota', () => {
    expect(
      stickerModeAccess('locations', ready(['inventory.view']), 'mutation'),
    ).toEqual({ kind: 'allowed' })
    expect(
      stickerModeAccess('parts', ready(['parts.view']), 'mutation'),
    ).toEqual({ kind: 'permission-denied' })
  })

  it('retains subscription constraints for location viewing and output', () => {
    const access = ready(['parts.view', 'inventory.view'], 'blocked')
    expect(stickerModeAccess('locations', access)).toEqual({
      kind: 'subscription-blocked',
      state: 'blocked',
    })
    expect(stickerModeAccess('locations', access, 'mutation')).toEqual({
      kind: 'subscription-blocked',
      state: 'blocked',
    })
    expect(stickerNavigationTarget('koval', access)).toBeNull()
  })

  it.each([
    [{ status: 'loading', snapshot: null, error: null }, 'access-loading'],
    [
      { status: 'error', snapshot: null, error: new Error('offline') },
      'access-error',
    ],
  ] as const)(
    'does not expose destinations while access is %s',
    (access, expected) => {
      expect(stickerModeAccess('locations', access).kind).toBe(expected)
      expect(stickerNavigationTarget('koval', access)).toBeNull()
    },
  )
})
