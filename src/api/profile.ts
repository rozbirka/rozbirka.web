import axios from 'axios'
import { identityClient } from './client'
import type { RequestOptions } from './contracts'
import { credentials } from './credentials'
import type { UpdateNameResponse } from './types'

export interface ProfileUser {
  id: string
  phone: string | null
  displayName: string
}

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

export const profileApi = {
  async updateName(
    name: string,
    options: RequestOptions = {},
  ): Promise<ProfileUser> {
    const sessionGeneration = credentials.getSessionGeneration()
    const response = await identityClient.patch<UpdateNameResponse>(
      '/auth/me/name',
      { name },
      requestConfig(options),
    )
    if (
      options.signal?.aborted ||
      sessionGeneration !== credentials.getSessionGeneration()
    ) {
      throw new axios.CanceledError(
        'Profile request belongs to an ended session',
      )
    }
    credentials.setAccess(response.data.accessToken)
    return response.data.user
  },

  async deleteAccount(options: RequestOptions = {}): Promise<void> {
    await identityClient.delete('/auth/me', requestConfig(options))
  },
}
