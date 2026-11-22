import type { OlxPrepareContent } from '@/api/olx-live'

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
