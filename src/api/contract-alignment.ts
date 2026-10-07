/**
 * Compile-time guard for the hand-written API adapters. `contracts:check`
 * keeps `generated/core.ts` byte-identical to the Core contract pinned in
 * `contracts/openapi-sources.json`; this file makes `npm run typecheck` fail
 * when a request the web sends carries a field that pinned contract does not
 * define.
 *
 * Core owns every API the web calls, `/auth/*` included; the separate
 * Identity contract is obsolete and no longer generated.
 *
 * A field that belongs to a Core change which is not pinned yet goes into a
 * `Pending…` list with its reason, checked with `Same<Unknown<…>, Pending…>`.
 * Once the pin includes the field, typecheck fails again until the entry is
 * removed — so a branch cannot quietly ship against a contract that is not
 * merged and pinned. There are no pending entries at the moment.
 *
 * Covers request payloads only: an unknown field sent to Core is the silent
 * failure. Add a line here when another adapter starts sending new fields.
 */
import type { components } from './generated/core'
import type { UpdateBusinessRequest } from './business'
import type { CustomerInput } from './customers'
import type { UpdateOnboardingRequest } from './onboarding'
import type { ConfirmPayment } from './orders'
import type { ImportMapping, ImportRule } from './part-imports'
import type { CreatePartRequest } from './parts'
import type { UpdateLanguageRequest } from './types'

type Schemas = components['schemas']

/** Keys the web sends that the pinned contract does not define. */
type Unknown<Sent, Contract> = Exclude<keyof Sent, keyof Contract>
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Check<T extends true> = T
/** Every value the web sends fits the contract's type for that field. */
type Fits<Sent, Contract> = [Sent] extends [Contract] ? true : false

export type ContractAlignment = [
  Check<Same<Unknown<ImportMapping, Schemas['ImportMappingPlan']>, never>>,
  Check<Same<Unknown<ImportRule, Schemas['ImportFieldRule']>, never>>,
  Check<Same<Unknown<CreatePartRequest, Schemas['CreatePartRequest']>, never>>,
  Check<Same<Unknown<ConfirmPayment, Schemas['ConfirmPaymentRequest']>, never>>,
  Check<
    Same<Unknown<UpdateBusinessRequest, Schemas['UpdateTenantRequest']>, never>
  >,
  Check<Same<Unknown<CustomerInput, Schemas['CreateCustomerRequest']>, never>>,
  Check<Same<Unknown<CustomerInput, Schemas['UpdateCustomerRequest']>, never>>,
  Check<
    Same<
      Unknown<UpdateOnboardingRequest, Schemas['UpdateOnboardingRequest']>,
      never
    >
  >,
  Check<Fits<UpdateOnboardingRequest, Schemas['UpdateOnboardingRequest']>>,
  Check<
    Same<
      Unknown<UpdateLanguageRequest, Schemas['UpdateLanguageRequest']>,
      never
    >
  >,
  Check<Fits<UpdateLanguageRequest, Schemas['UpdateLanguageRequest']>>,
]
