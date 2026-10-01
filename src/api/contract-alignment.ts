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
import type { ImportMapping, ImportRule } from './part-imports'
import type { CreatePartRequest } from './parts'

type Schemas = components['schemas']

/** Keys the web sends that the pinned contract does not define. */
type Unknown<Sent, Contract> = Exclude<keyof Sent, keyof Contract>
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Check<T extends true> = T

/**
 * Core `feat/remove-free-parts`: one source for the whole import
 * (`ImportSourceSelection` on `ImportMappingPlan`). Remove after re-pinning a
 * Core contract that has it.
 */
type PendingImportMappingFields = 'source'

export type ContractAlignment = [
  Check<
    Same<
      Unknown<ImportMapping, Schemas['ImportMappingPlan']>,
      PendingImportMappingFields
    >
  >,
  Check<Same<Unknown<ImportRule, Schemas['ImportFieldRule']>, never>>,
  Check<Same<Unknown<CreatePartRequest, Schemas['CreatePartRequest']>, never>>,
]
