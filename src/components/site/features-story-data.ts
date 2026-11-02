/** Data of the «Можливості» scroll story, shared by the steps and the window. */

export type Tone = 'g' | 'y' | 'r' | 'b'

/**
 * The thirteen modules in display order: message id (`<id>Title`, `<id>1…3`
 * in features-messages, `<id>Kpi`/`<id>Events` in features-story-messages),
 * URL slug of the fake window, KPI bar fill and the status tone of each event.
 */
export const storyModules = [
  { id: 'cars', slug: 'cars', pct: 100, tones: ['g', 'g', 'y', 'b'] },
  { id: 'intakes', slug: 'intake', pct: 64, tones: ['b', 'b', 'g', 'g'] },
  { id: 'parts', slug: 'parts', pct: 73, tones: ['g', 'y', 'y', 'r'] },
  {
    id: 'warehouses',
    slug: 'warehouses',
    pct: 100,
    tones: ['g', 'g', 'b', 'g'],
  },
  {
    id: 'stocktaking',
    slug: 'inventory',
    pct: 88,
    tones: ['g', 'g', 'r', 'y'],
  },
  { id: 'stickers', slug: 'stickers', pct: 100, tones: ['g', 'g', 'g', 'b'] },
  { id: 'orders', slug: 'orders', pct: 100, tones: ['y', 'g', 'g', 'g'] },
  {
    id: 'customers',
    slug: 'customers',
    pct: 100,
    tones: ['g', 'g', 'b', 'y'],
  },
  { id: 'cash', slug: 'finance', pct: 100, tones: ['g', 'g', 'b', 'y'] },
  { id: 'reports', slug: 'reports', pct: 100, tones: ['g', 'g', 'y', 'r'] },
  { id: 'team', slug: 'team', pct: 100, tones: ['g', 'b', 'y', 'b'] },
  {
    id: 'novaPoshta',
    slug: 'novaposhta',
    pct: 100,
    tones: ['g', 'g', 'g', 'b'],
  },
  { id: 'olx', slug: 'olx', pct: 100, tones: ['g', 'g', 'r', 'b'] },
] as const satisfies readonly {
  id: string
  slug: string
  pct: number
  tones: readonly Tone[]
}[]

/** Two-digit module number, 1-based. */
export const pad = (index: number) => String(index + 1).padStart(2, '0')
