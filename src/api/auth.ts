import axios from 'axios'
import { identityClient } from './client'
import { credentials } from './credentials'
import { sessionApi } from './session'
import type {
  SendOtpRequest,
  SendOtpResponse,
  SessionVerifyResponse,
  UpdateNameResponse,
  User,
  VerifyUser,
  VerifyOtpRequest,
} from './types'

export const authApi = {
  async otpSend(
    req: SendOtpRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<SendOtpResponse> {
    return sessionApi.send(req, 'login', options)
  },

  async registrationSend(
    req: SendOtpRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<SendOtpResponse> {
    return sessionApi.send(req, 'registration', options)
  },

  async otpVerify(
    req: VerifyOtpRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<SessionVerifyResponse> {
    return sessionApi.verify(req, 'login', options)
  },

  async registrationVerify(
    req: VerifyOtpRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<SessionVerifyResponse> {
    return sessionApi.verify(req, 'registration', options)
  },

  async cancelRegistration(): Promise<void> {
    await sessionApi.cancelRegistration()
  },

  async logout(): Promise<void> {
    await sessionApi.logout()
  },

  async me(): Promise<User> {
    const resp = await identityClient.get<User>('/auth/me')
    return resp.data
  },

  async updateName(
    name: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<VerifyUser> {
    const config = options.signal ? { signal: options.signal } : undefined
    const sessionGeneration = credentials.getSessionGeneration()
    const response = await identityClient.patch<UpdateNameResponse>(
      '/auth/me/name',
      { name },
      config,
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
}
