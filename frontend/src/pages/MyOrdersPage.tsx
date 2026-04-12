import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ApiError, apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { OrderRecord } from '../types/auth'

interface OrderPlacedState {
  placedOrderId?: number
  placedAt?: string
  placedTotal?: number
}

export function MyOrdersPage() {
  const { token } = useAuth()
  const location = useLocation()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const placedState = (location.state ?? {}) as OrderPlacedState

  useEffect(() => {
    const loadOrders = async () => {
      if (!token) {
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await apiFetch<OrderRecord[]>('/orders/me', {}, token)
        setOrders(response)
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

    loadOrders().catch(() => setError('Could not load orders.'))
  }, [token])

  return (
    <section className="stack-md">
      <h1>My orders</h1>
      {placedState.placedOrderId && (
        <p className="success-text">
          Order #{placedState.placedOrderId} placed at {placedState.placedAt} for ${placedState.placedTotal?.toFixed(2)}.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="hint-text">Loading orders...</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
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
                <td>{order.status}</td>
                <td>${order.subtotal_amount.toFixed(2)}</td>
                <td>${order.tax_amount.toFixed(2)}</td>
                <td>${order.shipping_amount.toFixed(2)}</td>
                <td>${order.total_amount.toFixed(2)}</td>
                <td>{order.city}</td>
                <td>{order.items.map((item) => `${item.product_name} x${item.quantity}`).join(', ')}</td>
                <td>
                  <Link className="inline-link" to={`/orders/me/${order.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
