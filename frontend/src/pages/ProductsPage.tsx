import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiFetch } from '../api/client'
import { useCart } from '../cart/CartContext'
import type { ProductRecord, ProductsPageResponse } from '../types/auth'

type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'speed-desc' | 'stock-desc'

export function ProductsPage() {
  const { addToCart } = useCart()

  const [products, setProducts] = useState<ProductRecord[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [search, setSearch] = useState('')
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'DDR4' | 'DDR5'>('all')
  const [sortBy, setSortBy] = useState<ProductSort>('newest')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const loadProducts = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch<ProductsPageResponse>('/products?page=1&limit=100')
      setProducts(response.items)
      setQuantities(Object.fromEntries(response.items.map((p) => [p.id, 1])))
    } catch {
      setError('Could not load products. Check backend availability.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts().catch(() => setError('Could not load products.'))
  }, [])

  const inStockCount = useMemo(() => products.filter((item) => item.stock > 0).length, [products])

  const visibleProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase()

    const filtered = products.filter((item) => {
      const matchesSearch =
        !searchText ||
        item.name.toLowerCase().includes(searchText) ||
        (item.description ?? '').toLowerCase().includes(searchText)

      const matchesMemory = memoryFilter === 'all' || item.memory_type === memoryFilter
      return matchesSearch && matchesMemory
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.price - b.price
        case 'price-desc':
          return b.price - a.price
        case 'speed-desc':
          return b.speed_mhz - a.speed_mhz
        case 'stock-desc':
          return b.stock - a.stock
        default:
          return b.id - a.id
      }
    })

    return sorted
  }, [memoryFilter, products, search, sortBy])

  const addProductToCart = (product: ProductRecord) => {
    setError('')
    setSuccess('')

    const quantity = quantities[product.id] ?? 1
    if (quantity <= 0) {
      setError('Quantity must be at least 1.')
      return
    }

    addToCart(product, quantity)
    setSuccess(`Added ${quantity} x ${product.name} to cart.`)
  }

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <p className="eyebrow">Storefront</p>
        <h1>RAM catalog</h1>
        <p>{inStockCount} products currently in stock. Showing {visibleProducts.length} result(s).</p>
        <p>
          <Link className="inline-link" to="/cart">
            Go to cart checkout
          </Link>
        </p>
      </div>

      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or description"
          aria-label="Search products"
        />

        <select value={memoryFilter} onChange={(event) => setMemoryFilter(event.target.value as 'all' | 'DDR4' | 'DDR5')}>
          <option value="all">All memory types</option>
          <option value="DDR4">DDR4</option>
          <option value="DDR5">DDR5</option>
        </select>

        <select value={sortBy} onChange={(event) => setSortBy(event.target.value as ProductSort)}>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="speed-desc">Speed: highest first</option>
          <option value="stock-desc">Stock: highest first</option>
        </select>
      </form>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}
      {loading && <p className="hint-text">Loading products...</p>}

      <section className="cards-grid" aria-label="RAM Products">
        {visibleProducts.map((product) => (
          <article key={product.id} className="product-card stack-sm">
            <h2>{product.name}</h2>
            <p>{product.description ?? 'No description available.'}</p>
            <p>
              {product.capacity_gb}GB • {product.memory_type} • {product.speed_mhz}MHz
            </p>
            <p>
              <strong>${product.price.toFixed(2)}</strong> • Stock: {product.stock}
            </p>

            <p>
              <Link className="inline-link" to={`/products/${product.id}`}>
                View details
              </Link>
            </p>

            <div className="row-actions">
              <input
                type="number"
                min={1}
                max={Math.max(1, product.stock)}
                value={quantities[product.id] ?? 1}
                onChange={(event) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [product.id]: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
              <button
                onClick={() => addProductToCart(product)}
                disabled={product.stock <= 0}
              >
                {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
              </button>
            </div>
          </article>
        ))}

        {!loading && !visibleProducts.length && (
          <article className="product-card">
            <p className="hint-text">No products match your filters.</p>
          </article>
        )}
      </section>
    </section>
  )
}
