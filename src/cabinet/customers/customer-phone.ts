const UKRAINE_PHONE_PREFIX = '+380'

export const newCustomerPhoneDraft = () => UKRAINE_PHONE_PREFIX

export const normalizeCustomerPhoneDraft = (value: string) => {
  if (value.startsWith(`${UKRAINE_PHONE_PREFIX}${UKRAINE_PHONE_PREFIX}`))
    return value.slice(UKRAINE_PHONE_PREFIX.length)
  if (value.startsWith(UKRAINE_PHONE_PREFIX)) return value
  const withoutCountryPrefix = value.replace(/^\+?380/, '')
  return `${UKRAINE_PHONE_PREFIX}${withoutCountryPrefix}`
}
