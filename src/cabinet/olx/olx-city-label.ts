import type { OlxCity } from '@/api/olx-live'

export function olxCityArea(city: OlxCity) {
  return Array.from(
    new Set([city.municipality, city.county, city.region].filter(Boolean)),
  ).join(' · ')
}

export function olxCityLabel(city: OlxCity) {
  return [city.name, olxCityArea(city)].filter(Boolean).join(' · ')
}
