const UKRAINE_PHONE_PREFIX = '+380'

export const newCustomerPhoneDraft = () => UKRAINE_PHONE_PREFIX

export const normalizeCustomerPhoneDraft = (value: string) => {
  const digits = value.replace(/\D/g, '')
  let localDigits = digits
  if (localDigits.startsWith('380380')) localDigits = localDigits.slice(6)
  else if (localDigits.startsWith('380')) localDigits = localDigits.slice(3)
  else if (localDigits.startsWith('0')) localDigits = localDigits.slice(1)
  return `${UKRAINE_PHONE_PREFIX}${localDigits.slice(0, 9)}`
}
