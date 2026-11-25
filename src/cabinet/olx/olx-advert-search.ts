import type { OlxAdvert } from '@/api/olx-live'

export function filterOlxAdverts(adverts: OlxAdvert[], query: string) {
  const title = query.trim().toLocaleLowerCase()
  const number = title.replace(/[\s#№]/g, '')

  return adverts.filter(
    (advert) =>
      advert.title.toLocaleLowerCase().includes(title) ||
      (number !== '' && advert.id.includes(number)),
  )
}
