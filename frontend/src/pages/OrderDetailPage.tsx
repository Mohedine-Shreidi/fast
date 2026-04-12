import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { OrderQuoteRecord, OrderRecord, OrdersPageResponse } from '../types/auth'

interface OrderDetailPageProps {
    mode: 'me' | 'admin'
}

const ADMIN_LOOKUP_PAGE_SIZE = 50
const ADMIN_LOOKUP_MAX_PAGES = 5

async function findAdminOrder(orderId: number, token: string): Promise<OrderRecord | null> {
    for (let page = 1; page <= ADMIN_LOOKUP_MAX_PAGES; page += 1) {
        const response = await apiFetch<OrdersPageResponse>(
            `/orders?page=${page}&limit=${ADMIN_LOOKUP_PAGE_SIZE}`,
            {},
            token,
        )

        const found = response.items.find((item) => item.id === orderId)
        if (found) {
            return found
        }

        if (page * ADMIN_LOOKUP_PAGE_SIZE >= response.total) {
            break
        }
    }

    return null
}

export function OrderDetailPage({ mode }: OrderDetailPageProps) {
    const { token } = useAuth()
    const { orderId } = useParams<{ orderId: string }>()

    const [summary, setSummary] = useState<OrderQuoteRecord | null>(null)
    const [orderMeta, setOrderMeta] = useState<OrderRecord | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const parsedOrderId = useMemo(() => {
        const nextId = Number(orderId)
        if (!orderId || Number.isNaN(nextId) || nextId <= 0) {
            return null
        }
        return nextId
    }, [orderId])

    useEffect(() => {
        const loadOrder = async () => {
            if (!token) {
                return
            }

            if (!parsedOrderId) {
                setError('Invalid order ID.')
                setLoading(false)
                return
            }

            setLoading(true)
            setError('')

            try {
                const [summaryResponse, metaResponse] = await Promise.all([
                    apiFetch<OrderQuoteRecord>(`/orders/${parsedOrderId}/summary`, {}, token),
                    mode === 'admin'
                        ? findAdminOrder(parsedOrderId, token)
                        : apiFetch<OrderRecord[]>('/orders/me', {}, token).then(
                            (orders) => orders.find((item) => item.id === parsedOrderId) ?? null,
                        ),
                ])

                setSummary(summaryResponse)
                setOrderMeta(metaResponse)
            } catch (err) {
                if (err instanceof ApiError) {
                    setError(err.message)
                } else {
                    setError('Could not load order details.')
                }
            } finally {
                setLoading(false)
            }
        }

        loadOrder().catch(() => {
            setLoading(false)
            setError('Could not load order details.')
        })
    }, [mode, parsedOrderId, token])

    const backPath = mode === 'admin' ? '/admin/orders' : '/orders/me'

    if (loading) {
        return <section className="auth-card">Loading order details...</section>
    }

    if (!summary) {
        return (
            <section className="auth-card stack-md">
                <h1>Order details</h1>
                {error ? <p className="error-text">{error}</p> : <p className="hint-text">Order was not found.</p>}
                <Link className="inline-link" to={backPath}>
                    Back to orders
                </Link>
            </section>
        )
    }

    return (
        <section className="stack-lg">
            <div className="hero-card stack-sm">
                <p className="eyebrow">Order</p>
                <h1>Order #{parsedOrderId}</h1>
                {orderMeta ? (
                    <p>
                        Status: <strong>{orderMeta.status}</strong> {mode === 'admin' ? `| User: ${orderMeta.user_id}` : ''}
                    </p>
                ) : (
                    <p className="hint-text">Status metadata is unavailable for this order.</p>
                )}
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="auth-card stack-md">
                <p>
                    <strong>Shipping city:</strong> {summary.city}
                </p>
                <p>
                    <strong>Item count:</strong> {summary.item_count}
                </p>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Line Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.items.map((item) => (
                                <tr key={`${item.product_id}-${item.product_name}`}>
                                    <td>{item.product_name}</td>
                                    <td>{item.quantity}</td>
                                    <td>${item.unit_price.toFixed(2)}</td>
                                    <td>${item.line_total.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="quote-grid">
                    <p>
                        <strong>Subtotal:</strong> ${summary.subtotal.toFixed(2)}
                    </p>
                    <p>
                        <strong>Tax:</strong> ${summary.tax_amount.toFixed(2)}
                    </p>
                    <p>
                        <strong>Shipping:</strong> ${summary.shipping_amount.toFixed(2)}
                    </p>
                    <p>
                        <strong>Total:</strong> ${summary.total_amount.toFixed(2)} {summary.currency}
                    </p>
                </div>

                <div className="row-actions">
                    <Link className="inline-link" to={backPath}>
                        Back to orders
                    </Link>
                    <Link className="inline-link" to="/products">
                        Continue shopping
                    </Link>
                </div>
            </div>
        </section>
    )
}
