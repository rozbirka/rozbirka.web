import axios, { type AxiosInstance, type CreateAxiosDefaults } from 'axios'
import type { ApiProblem } from './contracts'
import { credentials } from './credentials'
import { normalizeApiProblem } from './errors'
import type {
  SendOtpRequest,
  SendOtpResponse,
  SessionRefreshResponse,
  SessionVerifyResponse,
  VerifyOtpRequest,
} from './types'

type AxiosInstanceFactory = (config: CreateAxiosDefaults) => AxiosInstance

interface ActiveRefresh {
  controller: AbortController
  settled: Promise<void>
  settle: () => void
}

const problemError = (problem: ApiProblem): Error & ApiProblem =>
  Object.assign(new Error(problem.message), problem)

export const createSessionApi = (
  createInstance: AxiosInstanceFactory = (config) => axios.create(config),
) => {
  const client = createInstance({
    baseURL: '',
    timeout: 15000,
    withCredentials: true,
  })
  let sessionMutationDepth = 0
  // Serialize cookie-changing responses, not only in-memory token updates.
  let mutationTail = Promise.resolve()
  const acquireMutation = async () => {
    const previous = mutationTail
    let release!: () => void
    mutationTail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    return release
  }
  const activeRefreshes = new Set<ActiveRefresh>()

  const invalidateRefreshes = async () => {
    credentials.clear()
    const refreshes = [...activeRefreshes]
    refreshes.forEach(({ controller }) => controller.abort())
    await Promise.all(refreshes.map(({ settled }) => settled))
  }

  return {
    async send(
      req: SendOtpRequest,
      purpose: 'login' | 'registration' = 'login',
      options: { signal?: AbortSignal } = {},
    ): Promise<SendOtpResponse> {
      try {
        const response = await client.post<SendOtpResponse>(
          purpose === 'registration'
            ? '/session/registration/send'
            : '/session/otp/send',
          req,
          options,
        )
        return {
          cooldownSeconds: response.data.cooldownSeconds,
          retryAfterSeconds: response.data.retryAfterSeconds,
          challengeId: response.data.challengeId,
          expiresAt: response.data.expiresAt,
          resendAt: response.data.resendAt,
        }
      } catch (error) {
        throw problemError(normalizeApiProblem(error))
      }
    },

    async verify(
      req: VerifyOtpRequest,
      purpose: 'login' | 'registration' = 'login',
      options: { signal?: AbortSignal } = {},
    ): Promise<SessionVerifyResponse> {
      sessionMutationDepth += 1
      const release = await acquireMutation()
      try {
        await invalidateRefreshes()
        if (options.signal?.aborted) throw new axios.CanceledError()
        const generation = credentials.getSessionGeneration()
        const response = await client.post<SessionVerifyResponse>(
          purpose === 'registration'
            ? '/session/registration/verify'
            : '/session/otp/verify',
          req,
          options,
        )
        if (
          options.signal?.aborted ||
          generation !== credentials.getSessionGeneration()
        ) {
          throw new axios.CanceledError()
        }
        const payload: SessionVerifyResponse = {
          accessToken: response.data.accessToken,
          user: {
            id: response.data.user.id,
            phone: response.data.user.phone,
            displayName: response.data.user.displayName,
          },
          isNewUser: response.data.isNewUser,
        }
        credentials.startSession(payload.accessToken)
        return payload
      } catch (error) {
        throw problemError(normalizeApiProblem(error))
      } finally {
        sessionMutationDepth -= 1
        release()
      }
    },

    async cancelRegistration(): Promise<void> {
      await client.post(
        '/session/registration/cancel',
        {},
        { headers: { 'Content-Type': 'application/json' } },
      )
    },

    async refresh(): Promise<SessionRefreshResponse> {
      if (sessionMutationDepth > 0) {
        throw problemError(normalizeApiProblem(new axios.CanceledError()))
      }

      const generation = credentials.getSessionGeneration()
      const controller = new AbortController()
      let settle!: () => void
      const activeRefresh: ActiveRefresh = {
        controller,
        settled: new Promise((resolve) => {
          settle = resolve
        }),
        settle: () => settle(),
      }
      activeRefreshes.add(activeRefresh)

      try {
        const response = await client.post<SessionRefreshResponse>(
          '/session/refresh',
          undefined,
          { signal: controller.signal },
        )
        if (generation !== credentials.getSessionGeneration()) {
          throw new axios.CanceledError()
        }
        const payload: SessionRefreshResponse = {
          accessToken: response.data.accessToken,
          expiresIn: response.data.expiresIn,
        }
        credentials.setAccess(payload.accessToken)
        return payload
      } catch (error) {
        throw problemError(normalizeApiProblem(error))
      } finally {
        activeRefreshes.delete(activeRefresh)
        activeRefresh.settle()
      }
    },

    async invalidate(): Promise<void> {
      sessionMutationDepth += 1
      const release = await acquireMutation()
      try {
        await invalidateRefreshes()
      } finally {
        credentials.clear()
        sessionMutationDepth -= 1
        release()
      }
    },

    async logout(): Promise<void> {
      const accessToken = credentials.getAccess()
      sessionMutationDepth += 1
      const release = await acquireMutation()

      try {
        await invalidateRefreshes()
        await client.post(
          '/session/logout',
          undefined,
          accessToken
            ? { headers: { Authorization: `Bearer ${accessToken}` } }
            : {},
        )
      } catch (error) {
        throw problemError(normalizeApiProblem(error))
      } finally {
        credentials.clear()
        sessionMutationDepth -= 1
        release()
      }
    },
  }
}

export const sessionApi = createSessionApi()
