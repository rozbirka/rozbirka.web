import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import type {
  CustomerDirectoryResult,
  CustomerDirectorySort,
  CustomerListItem,
  CustomerSegment,
} from '@/api/customers'
import {
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  SkeletonRows,
} from '@/components/app'
import { CustomerAvatar } from './customer-avatar'

const segmentLabel = (orders: number) =>
  orders === 0 ? 'без покупок' : orders >= 3 ? 'постійний' : 'разовий'

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Kyiv',
      }).format(new Date(value))
    : '—'

const formatAmount = (value: number | null) =>
  value === null
    ? '—'
    : `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value)} $`

function CustomerIdentity({ customer }: { customer: CustomerListItem }) {
  return (
    <div className="customer-directory-identity">
      <CustomerAvatar
        className="customer-directory-avatar"
        customerId={customer.id}
        name={customer.name}
      />
      <span>
        <Link to={customer.id}>{customer.name}</Link>
        <small>{segmentLabel(customer.ordersCount)}</small>
      </span>
    </div>
  )
}

export function CustomerDirectoryView({
  result,
  query,
  segment,
  sort,
  canCreate,
  canViewFinance,
  onQuery,
  onSegment,
  onSort,
  onPage,
}: {
  result: CustomerDirectoryResult | null
  query: string
  segment: CustomerSegment
  sort: CustomerDirectorySort
  canCreate: boolean
  canViewFinance: boolean
  onQuery: (query: string) => void
  onSegment: (segment: CustomerSegment) => void
  onSort: (sort: CustomerDirectorySort) => void
  onPage: (page: number) => void
}) {
  const counts = result?.counts ?? {
    all: 0,
    regular: 0,
    occasional: 0,
    noOrders: 0,
  }
  const segments: {
    value: CustomerSegment
    label: string
    count: number
  }[] = [
    { value: 'all', label: 'Усі', count: counts.all },
    { value: 'regular', label: 'Постійні', count: counts.regular },
    { value: 'occasional', label: 'Разові', count: counts.occasional },
    { value: 'no_orders', label: 'Без покупок', count: counts.noOrders },
  ]

  return (
    <div className="customer-directory-page">
      <PageHeader
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link to="new">
                <Plus aria-hidden />
                Новий клієнт
              </Link>
            </Button>
          ) : undefined
        }
        eyebrow="Продажі"
        title="Клієнти"
      />

      <div className="customer-directory-search">
        <SearchInput
          aria-label="Пошук"
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Ім’я або телефон"
          value={query}
        />
      </div>

      <div className="customer-directory-controls">
        <div className="customer-segments" aria-label="Тип клієнта">
          {segments.map((item) => (
            <button
              aria-pressed={segment === item.value}
              key={item.value}
              onClick={() => onSegment(item.value)}
              type="button"
            >
              {item.label} <span>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="customer-sort" aria-label="Сортування">
          <span>СОРТУВАТИ</span>
          {canViewFinance ? (
            <button
              aria-pressed={sort === 'amount_desc'}
              onClick={() => onSort('amount_desc')}
              type="button"
            >
              Сумою
            </button>
          ) : null}
          <button
            aria-pressed={sort === 'name_asc'}
            onClick={() => onSort('name_asc')}
            type="button"
          >
            Іменем
          </button>
        </div>
      </div>

      {result === null ? (
        <SkeletonRows columns={canViewFinance ? 5 : 4} rows={8} />
      ) : result.items.length === 0 ? (
        <div className="customer-directory-empty">
          <EmptyState
            description="Клієнти з’являються після першого замовлення або коли ви додасте їх самі."
            title="Клієнтів поки немає"
          />
        </div>
      ) : (
        <div className="customer-directory-table-wrap">
          <table className="customer-directory-table">
            <caption className="sr-only">Список клієнтів</caption>
            <thead>
              <tr>
                <th>Клієнт</th>
                <th>Телефон</th>
                <th>Остання покупка</th>
                <th className="numeric">Замовлень</th>
                {canViewFinance ? <th className="numeric">Сума</th> : null}
              </tr>
            </thead>
            <tbody>
              {result.items.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <CustomerIdentity customer={customer} />
                  </td>
                  <td className="phone" data-label="Телефон">
                    {customer.phone ?? '—'}
                  </td>
                  <td data-label="Остання покупка">
                    {formatDate(customer.lastOrderAt)}
                  </td>
                  <td className="numeric orders" data-label="Замовлень">
                    {customer.ordersCount}
                  </td>
                  {canViewFinance ? (
                    <td className="numeric amount" data-label="Сума">
                      {formatAmount(customer.totalAmount)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            label="Сторінки клієнтів"
            onPage={onPage}
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            totalPages={Math.max(result.totalPages, 1)}
          />
        </div>
      )}
    </div>
  )
}
