import type { Ref } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  Copy,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
} from 'lucide-react'
import type { CustomerDetail } from '@/api/customers'
import { ActionMenu, Button, EmptyState, StatusPill } from '@/components/app'
import { CustomerAvatar } from './customer-avatar'

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Kyiv',
      }).format(new Date(value))
    : '—'

const formatNumber = (value: number) =>
  new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })
    .format(value)
    .replace(/[\u00a0\u202f]/g, ' ')

const formatMoney = (value: number | null, currency = '$') =>
  value === null ? '—' : `${formatNumber(value)} ${currency}`

const statusLabel = (status: string) =>
  ({
    draft: 'Чернетка',
    new: 'Нове',
    confirmed: 'Підтверджено',
    pending: 'Очікує',
    processing: 'У роботі',
    completed: 'Завершено',
    cancelled: 'Скасовано',
    refunded: 'Повернено',
  })[status.toLowerCase()] ?? status

export function CustomerDetailView({
  customer,
  directoryPath,
  orderPath,
  tenantSlug,
  canManage,
  canCreateOrder,
  canViewFinance,
  busy,
  deleteTriggerRef,
  onCopyPhone,
  onLifecycle,
  onDelete,
}: {
  customer: CustomerDetail
  directoryPath: string
  orderPath: string
  tenantSlug: string
  canManage: boolean
  canCreateOrder: boolean
  canViewFinance: boolean
  busy: boolean
  deleteTriggerRef: Ref<HTMLButtonElement>
  onCopyPhone: () => void
  onLifecycle: () => void
  onDelete: () => void
}) {
  const secondaryActions = canManage
    ? [
        {
          key: 'lifecycle',
          label: customer.isActive ? 'Деактивувати' : 'Активувати',
          onSelect: onLifecycle,
          disabled: busy,
        },
        ...(customer.ordersCount === 0
          ? [
              {
                key: 'delete',
                label: 'Видалити',
                onSelect: () => window.setTimeout(onDelete, 0),
                destructive: true,
                disabled: busy,
              },
            ]
          : []),
      ]
    : []

  return (
    <div className="customer-card-page">
      <div className="customer-card-nav">
        <div className="customer-card-nav-context">
          <Link to={directoryPath}>
            <ArrowLeft aria-hidden />
            До клієнтів
          </Link>
          <span className="customer-card-breadcrumbs" aria-hidden>
            <span>Продажі</span>
            <span>·</span>
            <span>Клієнти</span>
          </span>
        </div>
        <div className="customer-card-nav-actions">
          {canManage ? (
            <Button asChild>
              <Link to={`${directoryPath}/${customer.id}/edit`}>
                <Pencil aria-hidden />
                Редагувати
              </Link>
            </Button>
          ) : null}
          {canCreateOrder && customer.isActive ? (
            <Button asChild variant="primary">
              <Link to={orderPath}>
                <Plus aria-hidden />
                Створити замовлення
              </Link>
            </Button>
          ) : null}
          <ActionMenu
            actions={secondaryActions}
            label="Дії з клієнтом"
            triggerRef={deleteTriggerRef}
          />
        </div>
      </div>

      <div className="customer-card-overview">
        <section className="customer-card-hero" aria-labelledby="customer-name">
          <CustomerAvatar
            className="customer-card-avatar"
            customerId={customer.id}
            name={customer.name}
          />
          <div className="customer-card-identity">
            <div>
              <h1 id="customer-name">{customer.name}</h1>
              <StatusPill tone={customer.isActive ? 'ok' : 'neutral'}>
                {customer.isActive ? 'Активний' : 'Неактивний'}
              </StatusPill>
            </div>
            {customer.phone ? (
              <div className="customer-card-contact">
                <span>{customer.phone}</span>
                <Button aria-label="Копіювати телефон" onClick={onCopyPhone}>
                  <Copy aria-hidden />
                  Копіювати
                </Button>
                <Button asChild aria-label="Зателефонувати">
                  <a href={`tel:${customer.phone}`}>
                    <Phone aria-hidden />
                    Зателефонувати
                  </a>
                </Button>
                <Button asChild aria-label="SMS">
                  <a href={`sms:${customer.phone}`}>
                    <MessageSquare aria-hidden />
                    SMS
                  </a>
                </Button>
              </div>
            ) : (
              <span className="customer-card-no-phone">Телефон не вказано</span>
            )}
          </div>
        </section>

        <dl className="customer-card-metrics">
          <div>
            <dt>Замовлень</dt>
            <dd>{customer.ordersCount ?? '—'}</dd>
          </div>
          {canViewFinance ? (
            <>
              <div>
                <dt>Витрачено</dt>
                <dd>{formatMoney(customer.totalAmount)}</dd>
              </div>
              <div>
                <dt>Середній чек</dt>
                <dd>{formatMoney(customer.averageAmount)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>

      <div className="customer-card-grid">
        <section
          className="customer-order-history"
          aria-labelledby="order-history-title"
        >
          <div className="customer-card-section-heading">
            <div>
              <h2 id="order-history-title">Історія замовлень</h2>
            </div>
            <strong>{customer.orders.length} замовлень</strong>
          </div>
          {customer.orders.length === 0 ? (
            <EmptyState
              actions={
                canCreateOrder && customer.isActive ? (
                  <Button asChild variant="primary">
                    <Link to={orderPath}>
                      <Plus aria-hidden />
                      Створити замовлення
                    </Link>
                  </Button>
                ) : undefined
              }
              description="Щойно клієнт зробить перше замовлення, воно з’явиться тут."
              title="Замовлень ще не було"
            />
          ) : (
            <div className="customer-orders-table-wrap">
              <table className="customer-orders-table">
                <caption className="sr-only">Історія замовлень клієнта</caption>
                <thead>
                  <tr>
                    <th>Замовлення</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    {canViewFinance ? <th>Сума</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link to={`/app/${tenantSlug}/orders/${order.id}`}>
                          <strong>#{order.number}</strong>
                          <small>
                            {order.partNames.length > 0
                              ? order.partNames.join(', ')
                              : 'Без запчастин'}
                          </small>
                        </Link>
                      </td>
                      <td data-label="Дата">{formatDate(order.createdAt)}</td>
                      <td data-label="Статус">
                        <StatusPill tone="neutral">
                          {statusLabel(order.status)}
                        </StatusPill>
                      </td>
                      {canViewFinance ? (
                        <td data-label="Сума">
                          {formatMoney(
                            order.totalAmount,
                            order.currency === 'USD'
                              ? '$'
                              : (order.currency ?? '$'),
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="customer-card-aside">
          <section aria-labelledby="customer-details-title">
            <div className="customer-card-section-heading">
              <div>
                <h2 id="customer-details-title">Деталі</h2>
              </div>
            </div>
            <dl className="customer-card-facts">
              <div>
                <dt>Телефон</dt>
                <dd>{customer.phone ?? '—'}</dd>
              </div>
              <div>
                <dt>Клієнт від</dt>
                <dd>{formatDate(customer.createdAt)}</dd>
              </div>
              <div>
                <dt>Перше замовлення</dt>
                <dd>{formatDate(customer.firstOrderAt)}</dd>
              </div>
              <div>
                <dt>Остання покупка</dt>
                <dd>{formatDate(customer.lastOrderAt)}</dd>
              </div>
            </dl>
          </section>
          <section aria-labelledby="customer-notes-title">
            <div className="customer-card-section-heading">
              <div>
                <h2 id="customer-notes-title">Нотатки</h2>
              </div>
            </div>
            <p className="customer-card-notes">
              {customer.notes?.trim()
                ? customer.notes.trim()
                : 'Нотаток ще немає.'}
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
