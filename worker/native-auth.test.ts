// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { handleNativeAuth } from './native-auth'

const env = {
  CORE_ORIGIN: 'https://core.example',
  AUTH_REGISTRATION_KEY: 'edge-secret-only',
}
const auth = {
  accessToken: 'native-access',
  refreshToken: 'native-refresh',
  isNewUser: false,
  user: { id: 'user', phone: '+380501112233', displayName: 'Іван' },
}
function request(
  path: string,
  method = 'POST',
  body: unknown = {},
  headers: HeadersInit = {},
) {
  return new Request(`https://rozbirka.pro${path}`, {
    method,
    headers,
    ...(method === 'GET' || method === 'DELETE'
      ? {}
      : { body: JSON.stringify(body) }),
  })
}
afterEach(() => vi.unstubAllGlobals())

it('returns native credentials in a Core envelope without cookies and strips forged headers/body', async () => {
  let upstream: Request | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit) => {
      upstream = new Request(input, init)
      return Promise.resolve(
        Response.json(
          { data: { ...auth, privateKey: 'never-emit' } },
          { headers: { 'Set-Cookie': 'upstream-private=1' } },
        ),
      )
    }),
  )
  const body = {
    phone: '+380501112233',
    code: '123456',
    challengeId: 'challenge',
  }
  const result = await handleNativeAuth(
    request(
      '/auth/login/verify',
      'POST',
      { ...body, allowRegistration: true },
      {
        cookie: 'rozbirka_refresh=browser-secret',
        'CF-Connecting-IP': '203.0.113.7',
        'X-Rozbirka-Client-IP': 'forged',
        'X-Rozbirka-Registration-Key': 'forged',
        'X-Rozbirka-Registration-Session': 'forged',
        authorization: 'Bearer caller',
      },
    ),
    env,
  )
  expect(upstream?.url).toBe(`${env.CORE_ORIGIN}/auth/login/verify`)
  expect(upstream?.redirect).toBe('manual')
  expect(upstream?.headers.get('X-Rozbirka-Client-IP')).toBe('203.0.113.7')
  expect(upstream?.headers.get('X-Rozbirka-Registration-Key')).toBe(
    env.AUTH_REGISTRATION_KEY,
  )
  for (const header of [
    'cookie',
    'authorization',
    'X-Rozbirka-Registration-Session',
  ])
    expect(upstream?.headers.get(header)).toBeNull()
  expect(await upstream?.json()).toEqual(body)
  expect(await result?.json()).toEqual({ data: auth })
  expect(result?.headers.get('set-cookie')).toBeNull()
  expect(result?.headers.get('cache-control')).toBe('no-store')
})

it.each([
  '/auth/registration/phone',
  '/auth/registration/verify',
  '/auth/anything',
])('never relays %s', async (path) => {
  const upstream = vi.fn()
  vi.stubGlobal('fetch', upstream)
  expect(
    (
      await handleNativeAuth(
        request(
          path,
          'POST',
          {},
          { 'X-Rozbirka-Registration-Key': env.AUTH_REGISTRATION_KEY },
        ),
        env,
      )
    )?.status,
  ).toBe(404)
  expect(upstream).not.toHaveBeenCalled()
})

it('fails closed without the server secret and rejects cross-origin browser callers', async () => {
  expect(
    (
      await handleNativeAuth(request('/auth/login/phone'), {
        CORE_ORIGIN: env.CORE_ORIGIN,
      })
    )?.status,
  ).toBe(503)
  expect(
    (
      await handleNativeAuth(
        request(
          '/auth/login/phone',
          'POST',
          {},
          { origin: 'https://evil.example' },
        ),
        env,
      )
    )?.status,
  ).toBe(403)
})

it.each([
  ['/auth/me', 'GET'],
  ['/auth/me', 'DELETE'],
  ['/auth/me/name', 'PATCH'],
  ['/auth/logout', 'POST'],
])('keeps bearer auth and method on %s %s', async (path, method) => {
  let upstream: Request | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit) => {
      upstream = new Request(input, init)
      if (method === 'DELETE' || path === '/auth/logout')
        return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(
        Response.json({
          data:
            method === 'PATCH'
              ? { user: auth.user, accessToken: 'next-access', expiresIn: 3600 }
              : auth.user,
        }),
      )
    }),
  )
  const result = await handleNativeAuth(
    request(
      path,
      method,
      { name: 'Іван', refreshToken: 'native-refresh', ignored: 'drop' },
      { authorization: 'Bearer access', cookie: 'browser=never-forward' },
    ),
    env,
  )
  expect(result?.status).toBe(
    method === 'DELETE' || path === '/auth/logout' ? 204 : 200,
  )
  expect(upstream?.method).toBe(method)
  expect(upstream?.headers.get('authorization')).toBe('Bearer access')
  expect(upstream?.headers.get('cookie')).toBeNull()
  expect(result?.headers.get('set-cookie')).toBeNull()
})

it('preserves safe 429 Retry-After but not upstream error details', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        Response.json(
          { error: { code: 'OTP_RATE_LIMITED', message: 'private-account' } },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      ),
    ),
  )
  const result = await handleNativeAuth(
    request('/auth/login/phone', 'POST', { phone: '+380501112233' }),
    env,
  )
  expect(result?.status).toBe(429)
  expect(result?.headers.get('retry-after')).toBe('60')
  expect(await result?.text()).not.toContain('private-account')
})

it('rejects redirects without returning a redirect location or credentials', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(null, {
          status: 307,
          headers: { Location: 'https://evil.example' },
        }),
      ),
    ),
  )
  const result = await handleNativeAuth(
    request('/auth/login/phone', 'POST', { phone: '+380501112233' }),
    env,
  )
  expect(result?.status).toBe(502)
  expect(result?.headers.get('location')).toBeNull()
})
