/** Public username only; bot credentials never enter the browser bundle. */
export function telegramSupportHref(
  username: string | undefined,
): string | null {
  const value = username?.trim().replace(/^@/, '')
  return value && /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value)
    ? `https://t.me/${value}`
    : null
}
