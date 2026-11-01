export interface RecipientName {
  lastName: string
  firstName: string
  middleName: string
}

/** NP stores names in surname / given name / optional patronymic order. */
export function splitRecipientName(value: string): RecipientName {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2)
    return { lastName: '', firstName: words[0] ?? '', middleName: '' }
  return {
    lastName: words[0] ?? '',
    firstName: words[1] ?? '',
    middleName: words.slice(2).join(' '),
  }
}

export const recipientFullName = (value: RecipientName): string =>
  [value.lastName, value.firstName, value.middleName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
