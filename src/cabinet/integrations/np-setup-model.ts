import type { CashRegister } from '@/api/cash'
import type {
  NovaPoshtaContact,
  NovaPoshtaCounterparty,
  NovaPoshtaDispatchPoint,
  NovaPoshtaDivision,
  NovaPoshtaSettlement,
} from '@/api/integrations'
import type { NovaPoshtaSetupConfiguration } from '@/api/nova-poshta-setup'
import type { ShippingContact } from '@/api/shipping'
import { normalizeApiProblem } from '@/api/errors'
import { useLocale } from '@/i18n'
import { integrationProblemMessage } from './integration-labels'

/** A stored key is never shown: only this mask stands for it. */
export const KEY_MASK = '••••••••••••••••'

/**
 * A post-payment is collected in hryvnia, so only an active till that keeps
 * hryvnia is a place it can land.
 */
export const uahTills = (items: readonly CashRegister[]): CashRegister[] =>
  items.filter((item) => item.isActive && 'UAH' in item.balances)

/** `ФОП Коваль Олег Петрович · 3104512877`, the way the carrier lists it. */
export const senderLine = (sender: NovaPoshtaCounterparty): string =>
  sender.tin == null || sender.tin === ''
    ? sender.name
    : `${sender.name} · ${sender.tin}`

export const contactLine = (contact: NovaPoshtaContact): string =>
  contact.phone == null || contact.phone === ''
    ? contact.name
    : `${contact.name} · ${contact.phone}`

/** `ФОП`, `ТОВ` — the legal form a sender's registered name starts with. */
export const senderForm = (name: string): string =>
  name.trim().split(/\s+/)[0] ?? name

/** `№12` out of a carrier branch name; the whole name when it has none. */
export const branchNumber = (name: string): string =>
  /№\s?\d+/.exec(name)?.[0].replace(/\s/g, '') ?? name

/** One place parcels leave from, as the waybill sender needs it. */
export interface SetupPoint {
  settlementRef: string
  settlementName: string | null
  warehouseRef: string
  warehouseName: string | null
}

export const pointFromCatalogue = (
  settlement: NovaPoshtaSettlement,
  division: NovaPoshtaDivision,
): SetupPoint => ({
  settlementRef: settlement.ref,
  settlementName: settlement.name,
  warehouseRef: division.ref,
  warehouseName: division.name,
})

export const pointFromDispatchPoint = (
  point: NovaPoshtaDispatchPoint,
): SetupPoint => ({
  settlementRef: point.settlementRef,
  settlementName: point.settlementName,
  warehouseRef: point.warehouseRef,
  warehouseName: point.warehouseName,
})

/** `Київ · Відділення №12 (до 30 кг): вул. Богатирська, 6`. */
export const pointLine = (point: SetupPoint): string =>
  [point.settlementName, point.warehouseName]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ')

/**
 * What a setup session is configured with: the sender as a waybill contact,
 * the branch it dispatches from and the till a post-payment lands in.
 */
export const setupConfiguration = (
  sender: NovaPoshtaCounterparty,
  contact: NovaPoshtaContact,
  point: SetupPoint,
  tillId: string | null,
): NovaPoshtaSetupConfiguration => {
  const contactInfo: ShippingContact = {
    name: contact.name,
    phone: contact.phone ?? '',
    counterpartyRef: sender.ref,
    contactRef: contact.ref,
    settlementRef: point.settlementRef,
    warehouseRef: point.warehouseRef,
    settlementName: point.settlementName,
    warehouseName: point.warehouseName,
    ...(sender.isOrganization
      ? { companyName: sender.name, companyTin: sender.tin }
      : {}),
  }
  return { sender: contactInfo, codCashRegisterId: tillId }
}

/** True for a problem that says the carrier refused the key itself. */
export const isRejectedKey = (problem: {
  code?: string | undefined
  kind: string
}): boolean => {
  const code = problem.code?.toLowerCase() ?? ''
  return (
    code === 'nova_poshta_unauthorized' ||
    code === 'integration_account_unverified' ||
    code === 'integration_settings_invalid' ||
    (code === '' && problem.kind === 'validation')
  )
}

export const problemCode = (problem: { code?: string | undefined }): string =>
  problem.code?.toLowerCase() ?? ''

/** Where an unfinished setup remembers its verified session between visits. */
const storageKey = (tenantId: string, integrationId: string) =>
  `rz:np-setup:${tenantId}:${integrationId}`

export const pendingSetup = {
  read(tenantId: string, integrationId: string): string | null {
    try {
      return window.localStorage.getItem(storageKey(tenantId, integrationId))
    } catch {
      return null
    }
  },
  write(tenantId: string, integrationId: string, sessionId: string) {
    try {
      window.localStorage.setItem(
        storageKey(tenantId, integrationId),
        sessionId,
      )
    } catch {
      // Without storage the next visit simply starts from the key again.
    }
  },
  clear(tenantId: string, integrationId: string) {
    try {
      window.localStorage.removeItem(storageKey(tenantId, integrationId))
    } catch {
      // Nothing stored, nothing to forget.
    }
  },
}

/** A failure of a session call in the interface language. */
export function useSetupProblem() {
  const { locale } = useLocale()
  return (problem: unknown) =>
    integrationProblemMessage(normalizeApiProblem(problem), locale)
}
