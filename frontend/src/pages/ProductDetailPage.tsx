import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, apiFetch } from '../api/client'
import { useCart } from '../cart/CartContext'
import type { ProductRecord } from '../types/auth'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { addToCart } = useCart()

  const [product, setProduct] = useState<ProductRecord | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const loadProduct = async () => {
      const productId = Number(id)
      if (!id || Number.isNaN(productId) || productId <= 0) {
        setError('Invalid product ID.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await apiFetch<ProductRecord>(`/products/${productId}`)
        setProduct(response)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Could not load product details.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadProduct().catch(() => {
      setLoading(false)
      setError('Could not load product details.')
    })
  }, [id])

  const onAddToCart = () => {
    if (!product) {
      return
    }

    setError('')
    setSuccess('')

    const safeQuantity = Math.max(1, Math.trunc(quantity))
    if (safeQuantity > product.stock) {
      setError('Quantity exceeds available stock.')
      return
    }

    addToCart(product, safeQuantity)
    setSuccess(`Added ${safeQuantity} x ${product.name} to cart.`)
  }

  if (loading) {
    return <section className="auth-card">Loading product details...</section>
  }

  if (error && !product) {
    return (
      <section className="auth-card stack-md">
        <h1>Product details</h1>
        <p className="error-text">{error}</p>
        <Link className="inline-link" to="/products">
          Back to store
        </Link>
      </section>
    )
  }

  if (!product) {
    return (
      <section className="auth-card stack-md">
        <h1>Product not found</h1>
        <Link className="inline-link" to="/products">
          Back to store
        </Link>
      </section>
    )
  }

  return (
    <section className="stack-lg">
      <div className="hero-card stack-sm">
        <p className="eyebrow">Product</p>
        <h1>{product.name}</h1>
        <p>{product.description ?? 'No description available.'}</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="auth-card stack-md">
        <p>
          <strong>Specification:</strong> {product.capacity_gb}GB {product.memory_type} {product.speed_mhz}MHz
        </p>
        <p>
          <strong>Price:</strong> ${product.price.toFixed(2)}
        </p>
        <p>
          <strong>Stock:</strong> {product.stock}
        </p>
        <p>
          <strong>Status:</strong> {product.is_active ? 'active' : 'inactive'}
        </p>

        <div className="row-actions">
          <input
            type="number"
            min={1}
            max={Math.max(1, product.stock)}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
          <button onClick={onAddToCart} disabled={!product.is_active || product.stock <= 0}>
            {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>

        <div className="row-actions">
          <Link className="inline-link" to="/products">
            Back to store
          </Link>
          <Link className="inline-link" to="/cart">
            Go to cart
          </Link>
        </div>
      </div>
    </section>
  )
}
