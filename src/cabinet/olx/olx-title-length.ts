const minTitleLength = 16
export const maxOlxTitleLength = 150

export function olxTitleLengthIssue(title: string) {
  if (title.length < minTitleLength)
    return {
      key: 'titleTooShort' as const,
      count: minTitleLength - title.length,
    }
  if (title.length > maxOlxTitleLength)
    return {
      key: 'titleTooLong' as const,
      count: title.length - maxOlxTitleLength,
    }
  return null
}
