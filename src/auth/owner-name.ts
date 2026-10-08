/** A newly provisioned account uses its phone as a temporary display name. */
export function needsOwnerName(
  user: { displayName: string; phone: string } | null | undefined,
): boolean {
  if (!user) return false
  const name = user.displayName.trim()
  if (name.length < 2) return true
  const phoneDigits = user.phone.replace(/\D/g, '')
  return (
    phoneDigits.length > 0 &&
    /^[+\d\s().-]+$/.test(name) &&
    name.replace(/\D/g, '') === phoneDigits
  )
}
