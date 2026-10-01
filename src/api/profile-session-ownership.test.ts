import axios, {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, expect, it } from 'vitest'
import { authApi } from './auth'
import { profileApi } from './profile'
import { identityClient } from './client'
import { credentials } from './credentials'

const original = identityClient.defaults.adapter!
afterEach(() => {
  identityClient.defaults.adapter = original
  credentials.clear()
})

for (const [label, update] of [
  ['auth', (name: string) => authApi.updateName(name)],
  ['profile', (name: string) => profileApi.updateName(name)],
] as const) {
  it(`${label} ignores a late name response after logout and login as another user`, async () => {
    credentials.startSession('account-A')
    let finish!: () => void
    identityClient.defaults.adapter = (config: InternalAxiosRequestConfig) =>
      new Promise<AxiosResponse>((resolve) => {
        finish = () =>
          resolve({
            config,
            status: 200,
            statusText: 'OK',
            headers: new AxiosHeaders(),
            data: {
              data: {
                accessToken: 'late-A-token',
                user: {
                  id: 'A',
                  phone: '+380501112233',
                  displayName: 'A updated',
                },
                expiresIn: 3600,
              },
            },
          })
      })
    const pending = update('A updated').catch((error: unknown) => error)
    // Let Axios dispatch the request before simulating the session change.
    await new Promise((resolve) => setTimeout(resolve, 0))
    credentials.clear()
    credentials.startSession('account-B')
    finish()
    expect(axios.isCancel(await pending)).toBe(true)
    expect(credentials.getAccess()).toBe('account-B')
  })

  it(`${label} accepts profile rotation after a same-session token refresh`, async () => {
    credentials.startSession('account-A')
    identityClient.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      credentials.setAccess('account-A-refreshed')
      return Promise.resolve({
        config,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        data: {
          data: {
            accessToken: 'account-A-profile-token',
            user: { id: 'A', phone: '+380501112233', displayName: 'A updated' },
            expiresIn: 3600,
          },
        },
      })
    }
    await expect(update('A updated')).resolves.toMatchObject({ id: 'A' })
    expect(credentials.getAccess()).toBe('account-A-profile-token')
  })
}
