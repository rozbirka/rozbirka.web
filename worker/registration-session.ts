// Domain-separated, signed opaque binding. The browser cannot choose or read the session ID.
const COOKIE = 'rozbirka_registration'
const TTL = 15 * 60
const encoder = new TextEncoder()

async function key(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function createRegistrationSession(
  url: URL,
  secret: string,
  id: string = crypto.randomUUID(),
) {
  const payload = `${id}.${Math.floor(Date.now() / 1000) + TTL}`
  const signature = hex(
    await crypto.subtle.sign(
      'HMAC',
      await key(secret),
      encoder.encode(`registration:${url.origin}:${payload}`),
    ),
  )
  return { id, token: `${payload}.${signature}` }
}

export async function readRegistrationSession(
  request: Request,
  secret: string,
) {
  const values = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${COOKIE}=`))
  if (values.length !== 1) return null
  const token = values[0].slice(COOKIE.length + 1)
  const match = /^([a-f0-9-]{36})\.(\d{10})\.([a-f0-9]{64})$/.exec(token)
  if (!match) return null
  const [, id, expires, signature] = match
  const expiresAt = Number(expires)
  const now = Math.floor(Date.now() / 1000)
  if (expiresAt <= now || expiresAt > now + TTL) return null
  const bytes = Uint8Array.from(signature.match(/../g)!, (pair) =>
    parseInt(pair, 16),
  )
  const valid = await crypto.subtle.verify(
    'HMAC',
    await key(secret),
    bytes,
    encoder.encode(
      `registration:${new URL(request.url).origin}:${id}.${expires}`,
    ),
  )
  return valid ? { token, id: id } : null
}

export function registrationCookie(url: URL, token: string | null) {
  const local =
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname)
  return `${COOKIE}=${token ?? ''}; Max-Age=${token ? TTL : 0}; HttpOnly; ${local ? '' : 'Secure; '}SameSite=Strict; Path=/session/registration`
}
