import { useCallback, useEffect, useState } from 'react'
import {
  integrationsApi,
  type NovaPoshtaDispatchPoint,
} from '@/api/integrations'
import { shippingApi, type Shipment } from '@/api/shipping'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { customersApi } from '@/api/customers'
import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import { NOVA_POSHTA } from '../../integrations/integration-labels'

export interface CarrierState {
  /** The integration's own status, or `missing` when there is none at all. */
  status: string
  errorCode: string | null
}

export interface DeliveryOrderState {
  /** Null when Core does not run this order as a delivery order. */
  money: DeliveryOrder | null
  /**
   * Null when Nova Poshta is not usable right now — not configured, switched
   * off, or in error. Everything that talks to the carrier is then out of
   * reach; everything Core owns keeps working.
   */
  integrationId: string | null
  carrier: CarrierState | null
  points: NovaPoshtaDispatchPoint[]
  shipment: Shipment | null
  customerPhone: string | null
}

export interface DeliveryOrderLoad {
  state: DeliveryOrderState | null
  error: string | null
  /** Replaces the money record after an operation answered with a new one. */
  setMoney: (money: DeliveryOrder) => void
  /** Replaces the waybill after a carrier call answered with a new one. */
  setShipment: (shipment: Shipment | null) => void
  reload: () => void
}

/**
 * Everything the cabinet knows about one order's delivery.
 *
 * Core decides the order's kind on its own — `GET /orders/{id}/delivery`
 * answers it, and the carrier's availability has nothing to do with it. The
 * waybill, the dispatch points and the customer's phone need Nova Poshta, and
 * are simply absent while it is unreachable.
 */
export function useDeliveryOrder(
  orderId: string,
  customerId: string | null,
): DeliveryOrderLoad {
  const [state, setState] = useState<DeliveryOrderState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const load = async (): Promise<DeliveryOrderState> => {
      // `ORDER_INVALID_STATUS` is Core saying "this is an ordinary order", not
      // a failure worth reporting.
      const [money, integrations] = await Promise.all([
        deliveryApi
          .get(orderId, { signal: controller.signal })
          .catch((problem: unknown) => {
            if (!isProblemCode(problem, 'ORDER_INVALID_STATUS')) throw problem
            return null
          }),
        integrationsApi.list({ signal: controller.signal }),
      ])
      const nova = integrations.find((item) => item.code === NOVA_POSHTA)
      const usable = nova?.status === 'active' ? nova : undefined

      if (usable === undefined)
        return {
          money,
          shipment: null,
          integrationId: null,
          carrier: {
            status: nova?.status ?? 'missing',
            errorCode: nova?.lastErrorCode ?? null,
          },
          points: [],
          customerPhone: null,
        }

      const [shipment, points, customer] = await Promise.all([
        shippingApi
          .get(usable.id, orderId, { signal: controller.signal })
          .catch((problem: unknown) => {
            if (!isProblemCode(problem, 'delivery_not_configured'))
              throw problem
            return null
          }),
        integrationsApi
          .dispatchPoints(usable.id, { signal: controller.signal })
          .catch(() => [] as NovaPoshtaDispatchPoint[]),
        customerId === null
          ? Promise.resolve(null)
          : customersApi
              .getById(customerId, { signal: controller.signal })
              .catch(() => null),
      ])
      return {
        money,
        shipment,
        integrationId: usable.id,
        carrier: null,
        points: points.filter((point) => point.isActive),
        customerPhone: customer?.phone ?? null,
      }
    }

    void load().then(
      (result) => {
        if (controller.signal.aborted) return
        setState(result)
        setError(null)
      },
      (problem: unknown) => {
        if (!controller.signal.aborted)
          setError(normalizeApiProblem(problem).message)
      },
    )
    return () => controller.abort()
  }, [customerId, orderId, reloads])

  const setMoney = useCallback((money: DeliveryOrder) => {
    setState((current) => (current === null ? current : { ...current, money }))
  }, [])

  const setShipment = useCallback((shipment: Shipment | null) => {
    setState((current) =>
      current === null ? current : { ...current, shipment },
    )
  }, [])

  const reload = useCallback(() => {
    setError(null)
    setReloads((value) => value + 1)
  }, [])

  return { state, error, setMoney, setShipment, reload }
}
