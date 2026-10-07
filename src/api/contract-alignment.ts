/**
 * Compile-time guard for the hand-written API adapters. `contracts:check`
 * keeps `generated/core.ts` byte-identical to the Core contract pinned in
 * `contracts/openapi-sources.json`; this file makes `npm run typecheck` fail
 * when a request the web sends carries a field that pinned contract does not
 * define.
 *
 * A field that belongs to a Core change which is not pinned yet goes into the
 * matching `Pending…` list with its reason. Once the pin includes the field,
 * typecheck fails again until the entry is removed — so a branch cannot quietly
 * ship against a contract that is not merged and pinned.
 *
 * Covers request payloads only: an unknown field sent to Core is the silent
 * failure. Add a line here when another adapter starts sending new fields.
 */
import type { components } from './generated/core'
import type { components as identityComponents } from './generated/identity'
import type { UpdateBusinessRequest } from './business'
import type { ImportMapping, ImportRule } from './part-imports'
import type { CreatePartRequest } from './parts'

type Schemas = components['schemas']
type IdentitySchemas = identityComponents['schemas']

/** Keys the web sends that the pinned contract does not define. */
type Unknown<Sent, Contract> = Exclude<keyof Sent, keyof Contract>
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Check<T extends true> = T

/**
 * Core `feat/backend-localization-currency-onboarding`: tenant business
 * settings on `UpdateTenantRequest` (PATCH /api/v1/tenants/{id}). Remove after
 * re-pinning a Core contract that has them.
 */
type PendingUpdateTenantFields =
  | 'countryCode'
  | 'timeZoneId'
  | 'documentLanguage'
  | 'accountingCurrency'

/**
 * Identity `feat/backend-localization-currency-onboarding`: whole requests the
 * pinned Identity contract does not have yet (`PATCH /auth/me/language`).
 * Typecheck fails once the pin adds the schema, so the adapter can switch to
 * the generated type and the entry can be removed.
 */
type PendingIdentitySchemas =
  'Rozbirka.Identity.Application.Auth.DTOs.UpdateLanguageRequest'

export type ContractAlignment = [
  Check<Same<Extract<PendingIdentitySchemas, keyof IdentitySchemas>, never>>,
  Check<Same<Unknown<ImportMapping, Schemas['ImportMappingPlan']>, never>>,
  Check<Same<Unknown<ImportRule, Schemas['ImportFieldRule']>, never>>,
  Check<Same<Unknown<CreatePartRequest, Schemas['CreatePartRequest']>, never>>,
  Check<
    Same<
      Unknown<UpdateBusinessRequest, Schemas['UpdateTenantRequest']>,
      PendingUpdateTenantFields
    >
  >,
]
