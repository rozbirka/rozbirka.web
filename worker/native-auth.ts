import {
  boundedJson,
  callIdentity,
  identityFailure,
  json,
  jsonProblem,
  refreshBrowserData,
  safeOtpFailure,
  sendBrowserData,
  upstreamData,
  verifyBrowserData,
  type SessionEnv,
} from './session'

const methods: Record<string, readonly string[]> = {
  '/auth/login/phone': ['POST'],
  '/auth/login/verify': ['POST'],
  '/auth/refresh': ['POST'],
  '/auth/logout': ['POST'],
  '/auth/me': ['GET', 'DELETE'],
  '/auth/me/name': ['PATCH'],
}
const safeCodes = new Set([
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_COOLDOWN',
  'OTP_RATE_LIMITED',
  'OTP_MAX_ATTEMPTS',
  'OTP_UNAVAILABLE',
  'RATE_LIMIT_EXCEEDED',
])
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 256): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max
function user(value: unknown) {
  if (
    !record(value) ||
    !text(value.id) ||
    !text(value.phone, 32) ||
    typeof value.displayName !== 'string'
  )
    return null
  return { id: value.id, phone: value.phone, displayName: value.displayName }
}

/** Transport-only native relay. Core owns auth; registration is never relayed. */
export async function handleNativeAuth(
  request: Request,
  env: SessionEnv,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/auth/')) return null
  const allowed = methods[url.pathname]
  if (!allowed) return jsonProblem(404, 'NOT_FOUND', 'Not found')
  if (!allowed.includes(request.method))
    return jsonProblem(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', {
      Allow: allowed.join(', '),
    })
  const origin = request.headers.get('origin')
  if (origin && origin !== url.origin)
    return jsonProblem(403, 'INVALID_ORIGIN', 'Request origin is not allowed')
  if (!env.AUTH_REGISTRATION_KEY)
    return jsonProblem(
      503,
      'AUTH_UNAVAILABLE',
      'Authentication is temporarily unavailable',
    )

  let body: Record<string, unknown> = {}
  if (request.method !== 'GET' && request.method !== 'DELETE') {
    const input = await boundedJson(request, 4096)
    if (!record(input))
      return jsonProblem(400, 'INVALID_REQUEST', 'Invalid request')
    if (url.pathname.endsWith('/phone')) {
      if (!text(input.phone, 32))
        return jsonProblem(400, 'INVALID_REQUEST', 'Invalid request')
      body = { phone: input.phone }
    } else if (url.pathname.endsWith('/verify')) {
      if (
        !text(input.phone, 32) ||
        !text(input.code, 12) ||
        !text(input.challengeId, 128)
      )
        return jsonProblem(400, 'INVALID_REQUEST', 'Invalid request')
      body = {
        phone: input.phone,
        code: input.code,
        challengeId: input.challengeId,
      }
    } else if (url.pathname.endsWith('/name')) {
      if (!text(input.name, 64))
        return jsonProblem(400, 'INVALID_REQUEST', 'Invalid request')
      body = { name: input.name }
    } else {
      if (!text(input.refreshToken, 1024))
        return jsonProblem(400, 'INVALID_REQUEST', 'Invalid request')
      body = { refreshToken: input.refreshToken }
    }
  }
  const protectedOperation =
    url.pathname === '/auth/logout' || url.pathname.startsWith('/auth/me')
  const authorization = protectedOperation
    ? request.headers.get('authorization')
    : null
  if (protectedOperation && !authorization?.startsWith('Bearer '))
    return jsonProblem(401, 'UNAUTHORIZED', 'Unauthorized')
  const response = await callIdentity(
    `${env.CORE_ORIGIN}${url.pathname}`,
    body,
    authorization,
    {
      key: env.AUTH_REGISTRATION_KEY,
      clientIp: request.headers.get('CF-Connecting-IP'),
    },
    request.method,
  )
  if (!response) return identityFailure()
  if (!response.ok)
    return safeOtpFailure(response, safeCodes, 'Authentication request failed')
  if (request.method === 'DELETE' || url.pathname === '/auth/logout') {
    return response.status === 204
      ? new Response(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        })
      : identityFailure()
  }
  const data = await upstreamData(response)
  if (url.pathname.endsWith('/phone')) {
    const result = sendBrowserData(data)
    return result ? json({ data: result }) : identityFailure()
  }
  if (url.pathname.endsWith('/verify')) {
    const result = verifyBrowserData(data)
    return result
      ? json({ data: { ...result.browser, refreshToken: result.refreshToken } })
      : identityFailure()
  }
  if (url.pathname === '/auth/refresh') {
    const result = refreshBrowserData(data)
    return result
      ? json({ data: { ...result.browser, refreshToken: result.refreshToken } })
      : identityFailure()
  }
  if (url.pathname === '/auth/me') {
    const result = user(data)
    return result ? json({ data: result }) : identityFailure()
  }
  if (
    !record(data) ||
    !text(data.accessToken, 16_384) ||
    typeof data.expiresIn !== 'number' ||
    !Number.isSafeInteger(data.expiresIn) ||
    data.expiresIn < 0
  )
    return identityFailure()
  const result = user(data.user)
  return result
    ? json({
        data: {
          user: result,
          accessToken: data.accessToken,
          expiresIn: data.expiresIn,
        },
      })
    : identityFailure()
}
