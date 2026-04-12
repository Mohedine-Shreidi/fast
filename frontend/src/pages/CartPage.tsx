import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import type { CreateOrderPayload, OrderQuoteRecord, OrderRecord } from '../types/auth'

export function CartPage() {
  const { token, isAuthenticated } = useAuth()
  const { items, totalAmount, totalItems, updateQuantity, removeFromCart, clearCart } = useCart()
  const navigate = useNavigate()

  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<OrderQuoteRecord | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')

  const orderPayload = useMemo<CreateOrderPayload | null>(() => {
    if (!items.length || !city.trim()) {
      return null
    }

    return {
      city: city.trim(),
      items: items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      })),
    }
  }, [items, city])

  useEffect(() => {
    const fetchQuote = async () => {
      if (!isAuthenticated || !token || !orderPayload) {
        setQuote(null)
        setQuoteError('')
        return
      }

      setQuoteLoading(true)
      setQuoteError('')

      try {
        const nextQuote = await apiFetch<OrderQuoteRecord>(
          '/orders/quote',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload),
          },
          token,
        )
        setQuote(nextQuote)
      } catch (err) {
        setQuote(null)
        if (err instanceof ApiError) {
          setQuoteError(err.message)
        } else {
          setQuoteError('Could not calculate quote.')
        }
      } finally {
        setQuoteLoading(false)
      }
    }

    fetchQuote().catch(() => setQuote(null))
  }, [isAuthenticated, token, orderPayload])

  const placeOrder = async () => {
    setError('')
    setSuccess('')

    if (!isAuthenticated || !token) {
      setError('Please login before checkout.')
      return
    }

    if (!items.length) {
      setError('Your cart is empty.')
      return
    }

    if (!city.trim()) {
      setError('Please enter a shipping city.')
      return
    }

    if (!orderPayload) {
      setError('Invalid checkout payload.')
      return
    }

    setLoading(true)

    try {
      const createdOrder = await apiFetch<OrderRecord>('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      }, token)

      clearCart()
      setSuccess('Order placed successfully.')
      navigate('/orders/me', {
        state: {
          placedOrderId: createdOrder.id,
          placedAt: createdOrder.created_at,
          placedTotal: createdOrder.total_amount,
        },
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not place order.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <p className="eyebrow">Checkout</p>
        <h1>Cart</h1>
        <p>{totalItems} item(s) selected.</p>
        {!isAuthenticated && (
          <p>
            Login is required for quote and order placement.{' '}
            <Link className="inline-link" to="/login">
              Sign in
            </Link>
          </p>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Spec</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Line Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.product.id}>
                <td>{item.product.name}</td>
                <td>{`${item.product.capacity_gb}GB ${item.product.memory_type} ${item.product.speed_mhz}MHz`}</td>
                <td>${item.product.price.toFixed(2)}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, item.product.stock)}
                    value={item.quantity}
                    onChange={(event) => updateQuantity(item.product.id, Number(event.target.value) || 1)}
                  />
                </td>
                <td>${(item.product.price * item.quantity).toFixed(2)}</td>
                <td>
                  <div className="row-actions">
                    <Link className="inline-link" to={`/products/${item.product.id}`}>
                      View
                    </Link>
                    <button className="danger" onClick={() => removeFromCart(item.product.id)}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="empty-row">
                  Cart is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="checkout-card stack-md">
        <label>
          Shipping city
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Berlin" />
        </label>

        {quote ? (
          <div className="quote-grid">
            <p>
              <strong>Subtotal:</strong> ${quote.subtotal.toFixed(2)}
            </p>
            <p>
              <strong>Tax:</strong> ${quote.tax_amount.toFixed(2)}
            </p>
            <p>
              <strong>Shipping:</strong> ${quote.shipping_amount.toFixed(2)}
            </p>
            <p>
              <strong>Total:</strong> ${quote.total_amount.toFixed(2)} {quote.currency}
            </p>
          </div>
        ) : (
          <div className="stack-sm">
            <p>
              <strong>Estimated cart subtotal:</strong> ${totalAmount.toFixed(2)}
            </p>
            {quoteLoading && <p className="hint-text">Calculating quote...</p>}
            {!quoteLoading && quoteError && <p className="hint-text">Quote unavailable: {quoteError}</p>}
          </div>
        )}

        <div className="row-actions">
          <button className="ghost-btn" onClick={clearCart} disabled={!items.length || loading}>
            Clear cart
          </button>
          <button onClick={placeOrder} disabled={!items.length || loading}>
            {loading ? 'Placing order...' : 'Place order'}
          </button>
        </div>
      </div>
    </section>
  )
}
