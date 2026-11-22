import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { olxListingSettingsApi } from './olx-listing-settings'

afterEach(() => vi.restoreAllMocks())

it('normalises null fields omitted by Core on read and save', async () => {
  const endpoint = '/integrations/olx/listing-settings'
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ data: { cityId: 1 } })
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: {} })
  const options = { signal: new AbortController().signal }
  const empty = {
    contactName: null,
    contactPhone: null,
    cityId: null,
    districtId: null,
    descriptionSuffix: null,
  }

  expect(await olxListingSettingsApi.get(options)).toEqual({
    ...empty,
    cityId: 1,
  })
  expect(get).toHaveBeenCalledWith(endpoint, options)

  expect(await olxListingSettingsApi.update(empty, options)).toEqual(empty)
  expect(put).toHaveBeenCalledWith(endpoint, empty, options)
})
