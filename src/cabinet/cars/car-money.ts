/**
 * Car money is in the tenant's accounting currency: a yard buys a car and
 * prices its parts in it. Shared so the detail screen and the profitability
 * card cannot drift apart on how a sum is written.
 */
export {
  wholeMoney as carMoney,
  useWholeMoney as useCarMoney,
} from '../currency/money'
