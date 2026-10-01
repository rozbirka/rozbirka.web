// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleSessionRequest } from './session'
import {
  createRegistrationSession,
  readRegistrationSession,
} from './registration-session'

const origin = 'https://rozbirka.pro'
const env = {
  CORE_ORIGIN: 'https://core.example',
  AUTH_REGISTRATION_KEY: 'server-only-test-key',
}
const challenge = {
  challengeId: 'challenge',
  cooldownSeconds: 60,
  retryAfterSeconds: 300,
  expiresAt: '2099-01-01T00:00:00Z',
  resendAt: '2099-01-01T00:00:00Z',
}
const verified = {
  accessToken: 'access',
  refreshToken: 'private-refresh',
  isNewUser: true,
  user: { id: 'user', phone: '+380501112233', displayName: '' },
}
const body = {
  phone: '+380501112233',
  code: '123456',
  challengeId: 'challenge',
}
function request(
  path = 'send',
  headers: HeadersInit = {},
  payload: unknown = body,
) {
  return new Request(`${origin}/session/registration/${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })
}
async function cookie() {
  const value = await createRegistrationSession(
    new URL(origin),
    env.AUTH_REGISTRATION_KEY,
  )
  return `rozbirka_registration=${value.token}`
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('registration trust boundary', () => {
  it.each<Record<string, string>>([
    { origin: 'https://evil.example' },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
    { 'content-type': 'text/plain' },
  ])('rejects forged browser request %#', async (headers) => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    expect(
      (await handleSessionRequest(request('send', headers), env))?.status,
    ).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('requires origin and fails closed without the server secret', async () => {
    const missing = request()
    missing.headers.delete('origin')
    expect((await handleSessionRequest(missing, env))?.status).toBe(403)
    expect(
      (await handleSessionRequest(request(), { CORE_ORIGIN: env.CORE_ORIGIN }))
        ?.status,
    ).toBe(503)
  })
  it('creates a private bound session and replaces all caller credentials', async () => {
    let upstream: Request | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init: RequestInit) => {
        upstream = new Request(input, init)
        return Promise.resolve(
          Response.json({ data: { ...challenge, privateKey: 'do-not-leak' } }),
        )
      }),
    )
    const response = await handleSessionRequest(
      request(
        'send',
        {
          'X-Rozbirka-Registration-Key': 'forged',
          'X-Rozbirka-Registration-Session': 'chosen',
          cookie: 'rozbirka_registration=forged',
        },
        { ...body, allowRegistration: true, platform: 'web' },
      ),
      env,
    )
    expect(upstream?.url).toBe(`${env.CORE_ORIGIN}/auth/registration/phone`)
    expect(upstream?.headers.get('X-Rozbirka-Registration-Key')).toBe(
      env.AUTH_REGISTRATION_KEY,
    )
    expect(upstream?.headers.get('X-Rozbirka-Registration-Session')).not.toBe(
      'chosen',
    )
    expect(await upstream?.json()).toEqual({ phone: body.phone })
    expect(await response?.json()).toEqual(challenge)
    const setCookie = response!.headers.get('set-cookie')!
    expect(setCookie).toContain(
      'HttpOnly; Secure; SameSite=Strict; Path=/session/registration',
    )
    expect(setCookie).not.toContain(env.AUTH_REGISTRATION_KEY)
    const saved = await readRegistrationSession(
      request('verify', { cookie: setCookie.split(';')[0] }),
      env.AUTH_REGISTRATION_KEY,
    )
    expect(saved?.id).toBe(
      upstream?.headers.get('X-Rozbirka-Registration-Session'),
    )
  })
  it('rejects missing, tampered, duplicate and expired cookies before verification', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const valid = await cookie()
    for (const value of ['', `${valid}bad`, `${valid}; ${valid}`]) {
      expect(
        (await handleSessionRequest(request('verify', { cookie: value }), env))
          ?.status,
      ).toBe(401)
    }
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 16 * 60_000)
    expect(
      (await handleSessionRequest(request('verify', { cookie: valid }), env))
        ?.status,
    ).toBe(401)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('cannot move the signed session between origins', async () => {
    const value = await cookie()
    const other = new Request(
      'https://other.example/session/registration/verify',
      { headers: { cookie: value } },
    )
    expect(
      await readRegistrationSession(other, env.AUTH_REGISTRATION_KEY),
    ).toBeNull()
  })
  it('keeps upstream challenge/session rejection and replay failures generic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { error: { code: 'OTP_INVALID', message: 'private details' } },
            { status: 400 },
          ),
        ),
      ),
    )
    const value = await cookie()
    for (const challengeId of ['login-purpose', 'consumed-challenge']) {
      const response = await handleSessionRequest(
        request('verify', { cookie: value }, { ...body, challengeId }),
        env,
      )
      expect(response?.status).toBe(400)
      expect(await response?.json()).toEqual({
        error: { code: 'OTP_INVALID', message: 'OTP verification failed' },
      })
    }
  })
  it('clears the binding after successful verification and hides refresh credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ data: verified }))),
    )
    const response = await handleSessionRequest(
      request('verify', { cookie: await cookie() }),
      env,
    )
    const text = await response!.text()
    expect(text).not.toContain('private-refresh')
    expect(response!.headers.get('set-cookie')).toContain(
      'rozbirka_registration=; Max-Age=0',
    )
    expect(response!.headers.get('set-cookie')).toContain('rozbirka_refresh=')
  })
  it('cancels locally without an upstream mutation', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const response = await handleSessionRequest(request('cancel'), env)
    expect(response?.status).toBe(204)
    expect(response?.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(upstream).not.toHaveBeenCalled()
  })
  it('does not set a session when upstream delivery fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('secret-provider-error'))),
    )
    const response = await handleSessionRequest(request(), env)
    expect(response?.status).toBe(502)
    expect(response?.headers.get('set-cookie')).toBeNull()
    expect(await response?.text()).not.toContain('secret-provider-error')
  })
  it('never upgrades login to registration from payload or headers', async () => {
    let upstream: Request | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init: RequestInit) => {
        upstream = new Request(input, init)
        return Promise.resolve(Response.json({ data: verified }))
      }),
    )
    await handleSessionRequest(
      new Request(`${origin}/session/otp/verify`, {
        method: 'POST',
        headers: { 'X-Rozbirka-Registration-Key': 'forged' },
        body: JSON.stringify({ ...body, allowRegistration: true }),
      }),
      env,
    )
    expect(upstream?.url).toBe(`${env.CORE_ORIGIN}/auth/login/verify`)
    expect(upstream?.headers.get('X-Rozbirka-Registration-Key')).toBe(
      env.AUTH_REGISTRATION_KEY,
    )
    expect(upstream?.headers.get('X-Rozbirka-Registration-Session')).toBeNull()
    expect(upstream?.headers.get('X-Rozbirka-Client-IP')).toBeNull()
    expect(await upstream?.json()).toEqual(body)
  })
})

it('forwards only the Cloudflare client IP under server authentication, including login', async () => {
  let upstream: Request | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit) => {
      upstream = new Request(input, init)
      return Promise.resolve(Response.json({ data: challenge }))
    }),
  )
  await handleSessionRequest(
    new Request(`${origin}/session/otp/send`, {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '203.0.113.8',
        'X-Rozbirka-Client-IP': 'forged',
        'X-Forwarded-For': 'forged',
      },
      body: JSON.stringify({ phone: body.phone }),
    }),
    env,
  )
  expect(upstream?.headers.get('X-Rozbirka-Client-IP')).toBe('203.0.113.8')
  expect(upstream?.headers.get('X-Rozbirka-Registration-Key')).toBe(
    env.AUTH_REGISTRATION_KEY,
  )
  expect(upstream?.headers.get('X-Forwarded-For')).toBeNull()
  expect(upstream?.headers.get('X-Rozbirka-Registration-Session')).toBeNull()
})

it.each(['refresh', 'logout'])(
  'preserves the trusted end-user rate-limit identity on %s',
  async (action) => {
    let upstream: Request | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init: RequestInit) => {
        upstream = new Request(input, init)
        return Promise.resolve(
          action === 'logout'
            ? new Response(null, { status: 204 })
            : Response.json({
                data: {
                  accessToken: 'access',
                  refreshToken: 'next-private-refresh',
                  expiresIn: 3600,
                },
              }),
        )
      }),
    )
    const response = await handleSessionRequest(
      new Request(`${origin}/session/${action}`, {
        method: 'POST',
        headers: {
          cookie: 'rozbirka_refresh=private-refresh',
          authorization: 'Bearer access',
          'CF-Connecting-IP': '203.0.113.9',
          'X-Rozbirka-Client-IP': 'forged',
        },
      }),
      env,
    )
    expect(upstream?.headers.get('X-Rozbirka-Client-IP')).toBe('203.0.113.9')
    expect(upstream?.headers.get('X-Rozbirka-Registration-Key')).toBe(
      env.AUTH_REGISTRATION_KEY,
    )
    expect(upstream?.headers.get('X-Rozbirka-Registration-Session')).toBeNull()
    expect(response?.headers.get('X-Rozbirka-Registration-Key')).toBeNull()
    expect(await response?.text()).not.toContain(env.AUTH_REGISTRATION_KEY)
  },
)
