/**
 * Car money is dollars: a yard buys a car and prices its parts in them.
 * Shared so the detail screen and the profitability card cannot drift apart
 * on how a sum is written.
 */
export const money = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // A round headline sum reads as 10 380 $; only real cents earn decimals.
    trailingZeroDisplay: 'stripIfInteger',
  }).format(value)
