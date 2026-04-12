import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { OrderRecord, OrderStatus, OrdersPageResponse } from '../types/auth'

const STATUSES: OrderStatus[] = ['pending', 'processing', 'completed', 'cancelled']

export function AdminOrdersPage() {
  const { token } = useAuth()

  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const loadOrders = async (targetPage = page) => {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(limit),
      })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const response = await apiFetch<OrdersPageResponse>(`/orders?${params.toString()}`, {}, token)
      setOrders(response.items)
      setTotal(response.total)
      setPage(targetPage)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not load orders.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders(page).catch(() => setError('Could not load orders.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, token])

  const updateStatus = async (orderId: number, status: OrderStatus) => {
    if (!token) {
      return
    }

    setError('')
    setUpdatingOrderId(orderId)

    try {
      await apiFetch<OrderRecord>(
        `/orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
        token,
      )
      await loadOrders(page)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Status update failed.')
      }
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / limit))

  return (
    <section className="stack-md">
      <h1>Admin orders</h1>

      <div className="filters">
        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1)
            setStatusFilter(event.target.value as 'all' | OrderStatus)
          }}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading orders...</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Status</th>
              <th>Subtotal</th>
              <th>Tax</th>
              <th>Shipping</th>
              <th>Total</th>
              <th>City</th>
              <th>Items</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.user_id}</td>
                <td>
                  <select
                    value={order.status}
                    onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}
                    disabled={updatingOrderId === order.id}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>${order.subtotal_amount.toFixed(2)}</td>
                <td>${order.tax_amount.toFixed(2)}</td>
                <td>${order.shipping_amount.toFixed(2)}</td>
                <td>${order.total_amount.toFixed(2)}</td>
                <td>{order.city}</td>
                <td>{order.items.map((item) => `${item.product_name} x${item.quantity}`).join(', ')}</td>
                <td>
                  <Link className="inline-link" to={`/admin/orders/${order.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={10} className="empty-row">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading}>
          Previous
        </button>
        <span>
          Page {page} / {maxPage}
        </span>
        <button
          onClick={() => setPage((prev) => Math.min(maxPage, prev + 1))}
          disabled={page >= maxPage || loading}
        >
          Next
        </button>
      </div>
    </section>
  )
}
