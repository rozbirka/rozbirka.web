import { cashApi, type CashRegister, type CashTransaction } from '@/api/cash'

export interface CashFeedEntry extends CashTransaction {
  registerId: string
  registerName: string
}

/**
 * The API has no shared movement feed: transactions are only ever read per
 * till. The overview asks a bounded number of tills for their newest few and
 * merges the answers, so one busy till cannot crowd out the rest — and the
 * screen tells the reader that this is what it is.
 */
export const FEED_REGISTER_LIMIT = 8
const PER_REGISTER = 4
const FEED_SIZE = 8

export async function readCashFeed(
  registers: readonly CashRegister[],
  signal: AbortSignal,
): Promise<{ entries: CashFeedEntry[]; truncated: boolean }> {
  const asked = registers.slice(0, FEED_REGISTER_LIMIT)
  const pages = await Promise.all(
    asked.map(async (register) => {
      try {
        const page = await cashApi.transactions(
          register.id,
          { page: 1, pageSize: PER_REGISTER },
          { signal },
        )
        return page.items.map((entry) => ({
          ...entry,
          registerId: register.id,
          registerName: register.name,
        }))
      } catch {
        // One till refusing its ledger (a permission, a 404 after a delete)
        // must not empty the whole feed.
        return []
      }
    }),
  )
  const entries = pages
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, FEED_SIZE)
  return { entries, truncated: registers.length > asked.length }
}
