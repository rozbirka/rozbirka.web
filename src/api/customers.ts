import { apiClient } from './client'
import type { Page, RequestOptions } from './contracts'

/**
 * Optional customer address (REQ-LOCALIZATION AC-34/AC-35). Core adds these
 * on an unpinned branch, so every field may be absent: a response without
 * them reads as `null` (not set). The customer's country may differ from the
 * business country and never changes tenant settings.
 */
export const CUSTOMER_ADDRESS_FIELDS = [
  'countryCode',
  'city',
  'street',
  'building',
  'postcode',
] as const
export type CustomerAddressField = (typeof CUSTOMER_ADDRESS_FIELDS)[number]
export type CustomerAddress = Record<CustomerAddressField, string | null>
/** Longest value Core accepts per address field. */
export const CUSTOMER_ADDRESS_MAX_LENGTH: Readonly<
  Record<Exclude<CustomerAddressField, 'countryCode'>, number>
> = { city: 255, street: 255, building: 50, postcode: 32 }

export interface CustomerListItem extends Partial<CustomerAddress> {
  id: string
  name: string
  phone: string | null
  notes: string | null
  ordersCount: number
  totalAmount: number | null
  lastOrderAt: string | null
}
export interface CustomerSearchItem {
  id: string
  name: string
  phone: string | null
  ordersCount: number
}
export interface CustomerOrder {
  id: string
  number: number
  status: string
  totalAmount: number | null
  currency: string | null
  partNames: string[]
  createdAt: string
}
export interface CustomerDetail extends Partial<CustomerAddress> {
  id: string
  name: string
  phone: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  ordersCount: number | null
  totalAmount: number | null
  averageAmount: number | null
  firstOrderAt: string | null
  lastOrderAt: string | null
  orders: CustomerOrder[]
}
/**
 * Request body of create and update. Address fields: on create an empty or
 * missing value means not set; on update a missing field stays unchanged and
 * `""` clears it (Core trims, uppercases the country, stores empty as null).
 */
export interface CustomerInput {
  name?: string
  phone?: string | null
  notes?: string | null
  countryCode?: string
  city?: string
  street?: string
  building?: string
  postcode?: string
}
export interface CustomerPhoneConflict {
  customerId: string
  customerName: string
  isActive: boolean
  message: string
}
export interface CustomerListParams {
  q?: string
  page?: number
  pageSize?: number
}
export type CustomerSegment = 'all' | 'regular' | 'occasional' | 'no_orders'
export type CustomerDirectorySort = 'amount_desc' | 'name_asc'
export interface CustomerDirectoryParams {
  q?: string
  segment: CustomerSegment
  sort: CustomerDirectorySort
  page: number
  pageSize?: number
}
export interface CustomerDirectoryResult extends Page<CustomerListItem> {
  counts: {
    all: number
    regular: number
    occasional: number
    noOrders: number
  }
}
const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}
const endpoint = (id: string) => `/customers/${encodeURIComponent(id)}`
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
  } catch {
    return null
  }
})()

/** ISO 3166-1 alpha-2 code in upper case, or `null` when unknown/invalid. */
export function parseCustomerCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || code === 'ZZ') return null
  if (regionNames === null) return code
  try {
    return regionNames.of(code) === undefined ? null : code
  } catch {
    return null
  }
}

const parseText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

/** The address of a customer response; anything missing or invalid is `null`. */
export function readCustomerAddress(raw: unknown): CustomerAddress {
  const source = isRecord(raw) ? raw : {}
  return {
    countryCode: parseCustomerCountry(source['countryCode']),
    city: parseText(source['city']),
    street: parseText(source['street']),
    building: parseText(source['building']),
    postcode: parseText(source['postcode']),
  }
}

const withAddress = <T extends object>(raw: T): T & CustomerAddress => ({
  ...raw,
  ...readCustomerAddress(raw),
})

/**
 * Address fields for a create request: only the ones filled in, trimmed.
 */
export function customerAddressForCreate(
  address: Readonly<Record<CustomerAddressField, string>>,
): Partial<Record<CustomerAddressField, string>> {
  const input: Partial<Record<CustomerAddressField, string>> = {}
  for (const field of CUSTOMER_ADDRESS_FIELDS) {
    const value = address[field].trim()
    if (value !== '') input[field] = value
  }
  return input
}

/**
 * Address fields for an update request: only the ones that changed against
 * what was loaded; a field emptied by the user is sent as `""` to clear it.
 */
export function customerAddressChanges(
  before: Readonly<CustomerAddress>,
  after: Readonly<Record<CustomerAddressField, string>>,
): Partial<Record<CustomerAddressField, string>> {
  const input: Partial<Record<CustomerAddressField, string>> = {}
  for (const field of CUSTOMER_ADDRESS_FIELDS) {
    const value = after[field].trim()
    if (value !== (before[field] ?? '')) input[field] = value
  }
  return input
}

export const readCustomerPhoneConflict = (
  error: unknown,
): CustomerPhoneConflict | null => {
  if (!isRecord(error) || !isRecord(error['response'])) return null
  const response = error['response']
  if (response['status'] !== 409 || !isRecord(response['data'])) return null
  const conflict = response['data']['error']
  if (
    !isRecord(conflict) ||
    conflict['code'] !== 'CUSTOMER_PHONE_EXISTS' ||
    typeof conflict['customerId'] !== 'string' ||
    typeof conflict['customerName'] !== 'string' ||
    typeof conflict['isActive'] !== 'boolean' ||
    typeof conflict['message'] !== 'string'
  )
    return null
  return {
    customerId: conflict['customerId'],
    customerName: conflict['customerName'],
    isActive: conflict['isActive'],
    message: conflict['message'],
  }
}

export const customersApi = {
  async directory(
    params: CustomerDirectoryParams,
    options: RequestOptions = {},
  ): Promise<CustomerDirectoryResult> {
    const result = (
      await apiClient.get<CustomerDirectoryResult>('/customers/directory', {
        params,
        ...requestConfig(options),
      })
    ).data
    return { ...result, items: result.items.map(withAddress) }
  },
  async list(
    params: CustomerListParams = {},
    options: RequestOptions = {},
  ): Promise<Page<CustomerListItem>> {
    const result = (
      await apiClient.get<Page<CustomerListItem>>('/customers', {
        params,
        ...requestConfig(options),
      })
    ).data
    return { ...result, items: result.items.map(withAddress) }
  },
  async search(
    q: string,
    options: RequestOptions = {},
  ): Promise<CustomerSearchItem[]> {
    return (
      await apiClient.get<CustomerSearchItem[]>('/customers/search', {
        params: { q },
        ...requestConfig(options),
      })
    ).data
  },
  async getById(
    id: string,
    options: RequestOptions = {},
  ): Promise<CustomerDetail> {
    return withAddress(
      (
        await apiClient.get<CustomerDetail>(
          endpoint(id),
          requestConfig(options),
        )
      ).data,
    )
  },
  async create(
    input: Required<Pick<CustomerInput, 'name'>> & CustomerInput,
    options: RequestOptions = {},
  ) {
    const result = (
      await apiClient.post<{ customer: CustomerListItem }>(
        '/customers',
        input,
        requestConfig(options),
      )
    ).data
    return { ...result, customer: withAddress(result.customer) }
  },
  async update(id: string, input: CustomerInput, options: RequestOptions = {}) {
    const result = (
      await apiClient.patch<{ customer: CustomerListItem }>(
        endpoint(id),
        input,
        requestConfig(options),
      )
    ).data
    return { ...result, customer: withAddress(result.customer) }
  },
  async activate(
    id: string,
    options: RequestOptions = {},
  ): Promise<CustomerDetail> {
    return withAddress(
      (
        await apiClient.patch<CustomerDetail>(
          `${endpoint(id)}/activate`,
          undefined,
          requestConfig(options),
        )
      ).data,
    )
  },
  async deactivate(
    id: string,
    options: RequestOptions = {},
  ): Promise<CustomerDetail> {
    return withAddress(
      (
        await apiClient.patch<CustomerDetail>(
          `${endpoint(id)}/deactivate`,
          undefined,
          requestConfig(options),
        )
      ).data,
    )
  },
  async remove(id: string, options: RequestOptions = {}): Promise<void> {
    await apiClient.delete(endpoint(id), requestConfig(options))
  },
}
