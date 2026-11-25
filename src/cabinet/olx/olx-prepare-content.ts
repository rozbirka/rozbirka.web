import type {
  OlxAttribute,
  OlxLivePublication,
  OlxPrepareContent,
} from '@/api/olx-live'

export const emptyOlxContent: OlxPrepareContent = {
  publicDescription: '',
  categoryId: null,
  categoryConfirmed: false,
  attributes: {},
  advertiserType: '',
  contactName: '',
  contactPhone: '',
  cityId: null,
  districtId: null,
}

export function isCompatibilityWithoutOptions(attribute: OlxAttribute) {
  return attribute.code === 'compatibility_list' && !attribute.values.length
}

export function hasAttributeValue(values: string[] = []) {
  return values.some((value) => value.trim() !== '')
}

export function canPrepareOlxDraft(publication: OlxLivePublication) {
  return (
    !publication.advertId && ['draft', 'rejected'].includes(publication.state)
  )
}
