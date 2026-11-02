import { publicApiClient } from './client'

/** «Допоможемо почати» lead of the public landing. */
export interface LandingLeadRequest {
  name: string
  contact: string
  locale: string
  /** Honeypot: hidden from people; Core drops leads that fill it. */
  website: string
}

/**
 * Core posts the lead to the Telegram support group; nothing is stored.
 * The endpoint is anonymous and rate limited, so it is not part of the
 * generated cabinet contract.
 */
export const supportApi = {
  async createLead(body: LandingLeadRequest): Promise<void> {
    await publicApiClient.post('/support/leads', body)
  },
}
