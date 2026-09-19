import {
  registrationCookie,
  readRegistrationSession,
  createRegistrationSession,
} from './registration-session'
const COOKIE_NAME = 'rozbirka_refresh'
const REFRESH_MAX_AGE = 90 * 24 * 60 * 60
const SESSION_PATHS = new Set([
  '/session/registration/send',
  '/session/registration/verify',
  '/session/registration/cancel',
  '/session/otp/send',
  '/session/otp/verify',
  '/session/refresh',
  '/session/logout',
])

export interface SessionEnv {
  CORE_ORIGIN: string
  AUTH_REGISTRATION_KEY?: string
}

type JsonRecord = Record<string, unknown>

interface SendBrowserDto {
  cooldownSeconds: number
  retryAfterSeconds: number
  challengeId: string
  expiresAt: string
  resendAt: string
}

interface VerifyBrowserDto {
  accessToken: string
  user: {
    id: string
    phone: string
    displayName: string
  }
  isNewUser: boolean
}

interface RefreshBrowserDto {
  accessToken: string
  expiresIn: number
}

const SAFE_OTP_ERROR_CODES = new Set([
  'OTP_INVALID',
  'OTP_COOLDOWN',
  'OTP_RATE_LIMITED',
  'OTP_EXPIRED',
  'OTP_MAX_ATTEMPTS',
  'OTP_UNAVAILABLE',
  'RATE_LIMIT_EXCEEDED',
])
const SAFE_OTP_SEND_ERROR_CODES = new Set([
  'OTP_COOLDOWN',
  'OTP_RATE_LIMITED',
  'OTP_UNAVAILABLE',
  'RATE_LIMIT_EXCEEDED',
])

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function responseHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra)
  headers.set('Cache-Control', 'no-store')
  return headers
}

export function json(value: unknown, init?: ResponseInit) {
  return Response.json(value, {
    ...init,
    headers: responseHeaders(init?.headers),
  })
}

export function jsonProblem(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
) {
  return json({ error: { code, message } }, { status, headers })
}

function cookieValue(request: Request) {
  const cookie = request.headers.get('cookie')
  if (!cookie) return null

  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== COOKIE_NAME) continue
    const value = part.slice(separator + 1).trim()
    if (!value) return null
    try {
      return decodeURIComponent(value)
    } catch {
      return null
    }
  }

  return null
}

function isInsecureLocalRequest(url: URL) {
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  )
}

function refreshCookie(url: URL, refreshToken: string | null) {
  const parts = [
    `${COOKIE_NAME}=${refreshToken ? encodeURIComponent(refreshToken) : ''}`,
    `Max-Age=${refreshToken ? REFRESH_MAX_AGE : 0}`,
    'HttpOnly',
  ]
  if (!isInsecureLocalRequest(url)) parts.push('Secure')
  parts.push('SameSite=Strict', 'Path=/session')
  return parts.join('; ')
}

export async function boundedJson(
  input: Request | Response,
  limit = 16_384,
): Promise<unknown> {
  const reader = input.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > limit) {
        await reader.cancel()
        return null
      }
      chunks.push(next.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

async function requestBody(request: Request) {
  try {
    const body: unknown = await boundedJson(request, 4096)
    return isRecord(body) ? body : null
  } catch {
    return null
  }
}

export function identityFailure(status = 502) {
  return jsonProblem(
    status,
    'IDENTITY_REQUEST_FAILED',
    'Identity service request failed',
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function sendBrowserData(data: unknown): SendBrowserDto | null {
  if (
    !isRecord(data) ||
    !isNonNegativeSafeInteger(data.cooldownSeconds) ||
    !isNonNegativeSafeInteger(data.retryAfterSeconds) ||
    !isNonEmptyString(data.challengeId) ||
    !isNonEmptyString(data.expiresAt) ||
    !Number.isFinite(Date.parse(data.expiresAt)) ||
    !isNonEmptyString(data.resendAt) ||
    !Number.isFinite(Date.parse(data.resendAt))
  ) {
    return null
  }

  return {
    cooldownSeconds: data.cooldownSeconds,
    retryAfterSeconds: data.retryAfterSeconds,
    challengeId: data.challengeId,
    expiresAt: data.expiresAt,
    resendAt: data.resendAt,
  }
}

export function verifyBrowserData(data: unknown): {
  browser: VerifyBrowserDto
  refreshToken: string
} | null {
  if (!isRecord(data) || !isRecord(data.user)) return null
  if (
    !isNonEmptyString(data.accessToken) ||
    !isNonEmptyString(data.refreshToken) ||
    !isNonEmptyString(data.user.id) ||
    !isNonEmptyString(data.user.phone) ||
    typeof data.user.displayName !== 'string' ||
    typeof data.isNewUser !== 'boolean'
  ) {
    return null
  }

  return {
    browser: {
      accessToken: data.accessToken,
      user: {
        id: data.user.id,
        phone: data.user.phone,
        displayName: data.user.displayName,
      },
      isNewUser: data.isNewUser,
    },
    refreshToken: data.refreshToken,
  }
}

export function refreshBrowserData(data: unknown): {
  browser: RefreshBrowserDto
  refreshToken: string
} | null {
  if (
    !isRecord(data) ||
    !isNonEmptyString(data.accessToken) ||
    !isNonEmptyString(data.refreshToken) ||
    typeof data.expiresIn !== 'number' ||
    !Number.isSafeInteger(data.expiresIn) ||
    data.expiresIn < 0
  ) {
    return null
  }

  return {
    browser: { accessToken: data.accessToken, expiresIn: data.expiresIn },
    refreshToken: data.refreshToken,
  }
}

function safeRetryAfter(response: Response) {
  const raw = response.headers.get('retry-after')
  if (raw === null || !/^(0|[1-9]\d*)$/.test(raw)) return undefined
  const seconds = Number(raw)
  return Number.isSafeInteger(seconds) ? raw : undefined
}

async function otpFailure(response: Response) {
  return safeOtpFailure(
    response,
    SAFE_OTP_ERROR_CODES,
    'OTP verification failed',
  )
}

export async function safeOtpFailure(
  response: Response,
  safeCodes: ReadonlySet<string>,
  message: string,
) {
  let code: string | undefined
  try {
    const payload: unknown = await boundedJson(response)
    if (isRecord(payload) && isRecord(payload.error)) {
      const candidate = payload.error.code
      if (typeof candidate === 'string' && safeCodes.has(candidate)) {
        code = candidate
      }
    }
  } catch {
    // Malformed upstream errors are intentionally collapsed below.
  }

  if (!code) return identityFailure(response.status)
  const retryAfter = safeRetryAfter(response)
  return jsonProblem(
    response.status,
    code,
    message,
    retryAfter === undefined ? undefined : { 'Retry-After': retryAfter },
  )
}

export async function callIdentity(
  url: string,
  body: JsonRecord,
  authorization?: string | null,
  registration?: { key: string; session?: string; clientIp?: string | null },
  method = 'POST',
) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (authorization) headers.set('Authorization', authorization)
  if (registration) {
    headers.set('X-Rozbirka-Registration-Key', registration.key)
    if (registration.session)
      headers.set('X-Rozbirka-Registration-Session', registration.session)
    if (registration.clientIp)
      headers.set('X-Rozbirka-Client-IP', registration.clientIp)
  }

  try {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      headers,
      ...(method === 'GET' || method === 'DELETE'
        ? {}
        : { body: JSON.stringify(body) }),
    })
    return response.status >= 300 && response.status < 400 ? null : response
  } catch {
    return null
  }
}

export async function upstreamData(response: Response) {
  try {
    const payload: unknown = await boundedJson(response)
    if (!isRecord(payload) || !('data' in payload)) return undefined
    return payload.data
  } catch {
    return undefined
  }
}

function withCookie(response: Response, cookie: string) {
  const headers = new Headers(response.headers)
  headers.append('Set-Cookie', cookie)
  headers.set('Cache-Control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function handleSessionRequest(
  request: Request,
  env: SessionEnv,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (!SESSION_PATHS.has(url.pathname)) return null

  const origin = request.headers.get('origin')
  if (origin && origin !== url.origin) {
    return jsonProblem(403, 'INVALID_ORIGIN', 'Request origin is not allowed')
  }

  if (request.method !== 'POST') {
    return jsonProblem(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', {
      Allow: 'POST',
    })
  }

  const registration = url.pathname.startsWith('/session/registration/')
  if (registration) {
    // Browser JSON requests must carry an exact origin. Never trust forwarded origin/platform headers.
    if (
      origin !== url.origin ||
      (request.headers.has('sec-fetch-site') &&
        request.headers.get('sec-fetch-site') !== 'same-origin') ||
      !request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('application/json')
    ) {
      return jsonProblem(403, 'INVALID_ORIGIN', 'Request origin is not allowed')
    }
    if (url.pathname.endsWith('/cancel')) {
      return withCookie(
        new Response(null, { status: 204 }),
        registrationCookie(url, null),
      )
    }
    if (!env.AUTH_REGISTRATION_KEY)
      return jsonProblem(
        503,
        'REGISTRATION_UNAVAILABLE',
        'Registration is temporarily unavailable',
      )
  }

  const sending =
    url.pathname === '/session/otp/send' ||
    url.pathname === '/session/registration/send'
  const verifying =
    url.pathname === '/session/otp/verify' ||
    url.pathname === '/session/registration/verify'
  if (sending || verifying) {
    const body = await requestBody(request)
    if (
      !body ||
      !isNonEmptyString(body.phone) ||
      body.phone.length > 32 ||
      (verifying &&
        (!isNonEmptyString(body.code) ||
          body.code.length > 12 ||
          !isNonEmptyString(body.challengeId) ||
          body.challengeId.length > 128))
    ) {
      return jsonProblem(400, 'INVALID_REQUEST', 'Invalid request')
    }
    let session: { token: string; id: string } | null = null
    if (registration) {
      session = await readRegistrationSession(
        request,
        env.AUTH_REGISTRATION_KEY!,
      )
      if (!session && verifying)
        return jsonProblem(
          401,
          'REGISTRATION_SESSION_EXPIRED',
          'Restart registration',
        )
      if (sending)
        session = await createRegistrationSession(
          url,
          env.AUTH_REGISTRATION_KEY!,
          session?.id,
        )
      session ??= await createRegistrationSession(
        url,
        env.AUTH_REGISTRATION_KEY!,
      )
    }
    const response = await callIdentity(
      `${env.CORE_ORIGIN}/auth/${registration ? 'registration' : 'login'}/${sending ? 'phone' : 'verify'}`,
      sending
        ? { phone: body.phone }
        : { phone: body.phone, code: body.code, challengeId: body.challengeId },
      undefined,
      env.AUTH_REGISTRATION_KEY
        ? {
            key: env.AUTH_REGISTRATION_KEY,
            ...(session ? { session: session.id } : {}),
            clientIp: request.headers.get('CF-Connecting-IP'),
          }
        : undefined,
    )
    if (!response) return identityFailure()
    if (!response.ok)
      return sending
        ? safeOtpFailure(response, SAFE_OTP_SEND_ERROR_CODES, 'OTP send failed')
        : otpFailure(response)
    const data = await upstreamData(response)
    if (sending) {
      const validated = sendBrowserData(data)
      if (!validated) return identityFailure()
      const result = json(validated)
      return session
        ? withCookie(result, registrationCookie(url, session.token))
        : result
    }
    const validated = verifyBrowserData(data)
    if (!validated) return identityFailure()
    const result = withCookie(
      json(validated.browser),
      refreshCookie(url, validated.refreshToken),
    )
    return registration
      ? withCookie(result, registrationCookie(url, null))
      : result
  }

  const refreshToken = cookieValue(request)
  if (!refreshToken) {
    const response = jsonProblem(
      401,
      'MISSING_REFRESH_TOKEN',
      'Refresh credential is missing',
    )
    return url.pathname === '/session/logout'
      ? withCookie(response, refreshCookie(url, null))
      : response
  }

  if (url.pathname === '/session/refresh') {
    const response = await callIdentity(
      `${env.CORE_ORIGIN}/auth/refresh`,
      {
        refreshToken,
      },
      undefined,
      env.AUTH_REGISTRATION_KEY
        ? {
            key: env.AUTH_REGISTRATION_KEY,
            clientIp: request.headers.get('CF-Connecting-IP'),
          }
        : undefined,
    )
    if (!response) return identityFailure()
    if (!response.ok) return identityFailure(response.status)

    const data = await upstreamData(response)
    const validated = refreshBrowserData(data)
    if (!validated) return identityFailure()
    return withCookie(
      json(validated.browser),
      refreshCookie(url, validated.refreshToken),
    )
  }

  const response = await callIdentity(
    `${env.CORE_ORIGIN}/auth/logout`,
    { refreshToken },
    request.headers.get('authorization'),
    env.AUTH_REGISTRATION_KEY
      ? {
          key: env.AUTH_REGISTRATION_KEY,
          clientIp: request.headers.get('CF-Connecting-IP'),
        }
      : undefined,
  )
  const expiredCookie = refreshCookie(url, null)
  if (!response) return withCookie(identityFailure(), expiredCookie)
  if (!response.ok) {
    return withCookie(identityFailure(response.status), expiredCookie)
  }
  return withCookie(new Response(null, { status: 204 }), expiredCookie)
}
