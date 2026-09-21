import { apiClient, withIdempotency } from './client'
import type { IdempotentMutation, Page, RequestOptions } from './contracts'

export interface OrderListItem {
  id: string
  number: number
  status: string
  customerName: string | null
  itemCount: number
  partNames: string[]
  paymentAccountNames: string[]
  totalAmount: number | null
  createdAt: string
}
export interface OrderItemInput {
  partId: string
  quantity: number
  unitPrice: number
}
export interface CreateOrderInput {
  customerId: string | null
  notes: string | null
  items: OrderItemInput[]
}
export interface ConfirmPayment {
  accountId: string
  amount: number
  currency: string
}
export interface OrderDetail {
  id: string
  number: number
  status: string
  customerId: string | null
  customerName: string | null
  notes: string | null
  items: (OrderItemInput & {
    id: string
    partName: string
    totalPrice: number
  })[]
  payments: (ConfirmPayment & { id: string; accountName: string })[]
  history: {
    eventType: string
    userName: string
    createdAt: string
    data: string | null
  }[]
  totalAmount: number | null
  totalPaid: number | null
  paymentCurrency: string | null
  itemsTotalUsd?: number | null
  createdAt: string
  createdByName: string
}
export interface OrderListParams {
  search?: string
  status?: string
  customerId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}
const endpoint = (id: string) => `/orders/${encodeURIComponent(id)}`
const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

/**
 * Core omits collections that are empty, so a fresh order arrives without
 * `history` and a screen that maps over it crashes. Every response that
 * carries an order passes through here, and the type stays a promise the
 * rest of the app can trust.
 */
const withCollections = (order: OrderDetail): OrderDetail => ({
  ...order,
  items: order.items ?? [],
  payments: order.payments ?? [],
  history: order.history ?? [],
})

export const ordersApi = {
  async list(
    params: OrderListParams = {},
    options: RequestOptions = {},
  ): Promise<Page<OrderListItem>> {
    return (
      await apiClient.get<Page<OrderListItem>>('/orders', {
        params,
        ...requestConfig(options),
      })
    ).data
  },
  async getById(
    id: string,
    options: RequestOptions = {},
  ): Promise<OrderDetail> {
    return withCollections(
      (await apiClient.get<OrderDetail>(endpoint(id), requestConfig(options)))
        .data,
    )
  },
  async create(input: CreateOrderInput): Promise<OrderDetail> {
    return withCollections(
      (await apiClient.post<OrderDetail>('/orders', input)).data,
    )
  },
  async updateItems(id: string, items: OrderItemInput[]): Promise<OrderDetail> {
    return withCollections(
      (await apiClient.put<OrderDetail>(`${endpoint(id)}/items`, { items }))
        .data,
    )
  },
  async updateNotes(id: string, notes: string | null): Promise<OrderDetail> {
    return withCollections(
      (await apiClient.put<OrderDetail>(`${endpoint(id)}/notes`, { notes }))
        .data,
    )
  },
  async updatePayments(
    id: string,
    payments: ConfirmPayment[],
  ): Promise<OrderDetail> {
    return (
      await apiClient.put<OrderDetail>(`${endpoint(id)}/payments`, { payments })
    ).data
  },
  async setCustomer(
    id: string,
    customerId: string | null,
  ): Promise<OrderDetail> {
    return withCollections(
      (
        await apiClient.put<OrderDetail>(`${endpoint(id)}/customer`, {
          customerId,
        })
      ).data,
    )
  },
  async confirm(
    id: string,
    input: { payments: ConfirmPayment[] },
    replay: IdempotentMutation,
  ): Promise<OrderDetail> {
    return withCollections(
      (
        await apiClient.post<OrderDetail>(
          `${endpoint(id)}/confirm`,
          input,
          withIdempotency({}, replay),
        )
      ).data,
    )
  },
  async cancel(id: string): Promise<OrderDetail> {
    return withCollections(
      (await apiClient.post<OrderDetail>(`${endpoint(id)}/cancel`)).data,
    )
  },
  async refund(
    id: string,
    input: { refundReason: string },
    replay: IdempotentMutation,
  ): Promise<OrderDetail> {
    return withCollections(
      (
        await apiClient.post<OrderDetail>(
          `${endpoint(id)}/refund`,
          input,
          withIdempotency({}, replay),
        )
      ).data,
    )
  },
}
