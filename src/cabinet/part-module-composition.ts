import type { ModuleSummary } from '@/api/part-modules'
import { moduleFeaturePath } from './cabinet-paths'
import {
  independentModules,
  type RegisteredFeatureModule,
} from './module-registry'

type ResolvedModuleSummary =
  | { kind: 'unsupported'; moduleCode: string }
  | {
      kind: 'unavailable'
      moduleCode: string
      retryAfterSeconds: number | null
    }
  | {
      kind: 'ready'
      moduleCode: string
      labelKey: string
      cards: readonly (ModuleSummary['items'][number] & { href: string })[]
    }

export function resolvePartModuleSummary(
  slug: string,
  summary: ModuleSummary,
  entries: readonly RegisteredFeatureModule[] = independentModules,
): ResolvedModuleSummary {
  const entry = entries.find(
    (candidate) => candidate.code === summary.moduleCode,
  )
  if (!entry) return { kind: 'unsupported', moduleCode: summary.moduleCode }
  if (summary.availability !== 'ready') {
    return {
      kind: 'unavailable',
      moduleCode: summary.moduleCode,
      retryAfterSeconds: summary.retryAfterSeconds ?? null,
    }
  }
  return {
    kind: 'ready',
    moduleCode: summary.moduleCode,
    labelKey: entry.labelKey,
    cards: summary.items.map((card) => ({
      ...card,
      href: moduleFeaturePath(slug, entry, { kind: 'view', id: card.id }),
    })),
  }
}
