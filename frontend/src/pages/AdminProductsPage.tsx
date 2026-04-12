import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import { ApiError, apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type {
  CreateProductPayload,
  ProductRecord,
  ProductsPageResponse,
} from '../types/auth'

type ProductSort = 'newest' | 'name-asc' | 'price-asc' | 'price-desc' | 'stock-desc'

const initialForm: CreateProductPayload = {
  name: '',
  capacity_gb: 16,
  memory_type: 'DDR5',
  speed_mhz: 5600,
  price: 89.99,
  stock: 10,
  description: '',
  is_active: true,
}

export function AdminProductsPage() {
  const { token } = useAuth()
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [form, setForm] = useState<CreateProductPayload>(initialForm)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CreateProductPayload>(initialForm)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<ProductSort>('newest')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadProducts = async () => {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiFetch<ProductsPageResponse>('/products?page=1&limit=100&active_only=false', {}, token)
      setProducts(response.items)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not load products.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts().catch(() => setError('Could not load products.'))
  }, [token])

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = event.target as HTMLInputElement
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) {
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await apiFetch<ProductRecord>(
        '/products',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            capacity_gb: Number(form.capacity_gb),
            speed_mhz: Number(form.speed_mhz),
            price: Number(form.price),
            stock: Number(form.stock),
          }),
        },
        token,
      )
      setForm(initialForm)
      setSuccess('Product created successfully.')
      await loadProducts()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Create product failed.')
      }
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (product: ProductRecord) => {
    setEditingProductId(product.id)
    setEditForm({
      name: product.name,
      capacity_gb: product.capacity_gb,
      memory_type: product.memory_type as 'DDR4' | 'DDR5',
      speed_mhz: product.speed_mhz,
      price: product.price,
      stock: product.stock,
      description: product.description ?? '',
      is_active: product.is_active,
    })
    setError('')
    setSuccess('')
  }

  const onEditChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = event.target as HTMLInputElement
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const updateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !editingProductId) {
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await apiFetch<ProductRecord>(
        `/products/${editingProductId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...editForm,
            capacity_gb: Number(editForm.capacity_gb),
            speed_mhz: Number(editForm.speed_mhz),
            price: Number(editForm.price),
            stock: Number(editForm.stock),
          }),
        },
        token,
      )

      setSuccess('Product updated successfully.')
      setEditingProductId(null)
      setEditForm(initialForm)
      await loadProducts()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Update product failed.')
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteProduct = async (id: number) => {
    if (!token) {
      return
    }

    const confirmed = window.confirm('Delete this product permanently?')
    if (!confirmed) {
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await apiFetch<void>(
        `/products/${id}`,
        {
          method: 'DELETE',
        },
        token,
      )
      setSuccess('Product deleted successfully.')
      await loadProducts()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Delete product failed.')
      }
    } finally {
      setSaving(false)
    }
  }

  const visibleProducts = [...products]
    .filter((item) => {
      const searchText = search.trim().toLowerCase()
      if (!searchText) {
        return true
      }

      return (
        item.name.toLowerCase().includes(searchText) ||
        (item.description ?? '').toLowerCase().includes(searchText) ||
        item.memory_type.toLowerCase().includes(searchText)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'price-asc':
          return a.price - b.price
        case 'price-desc':
          return b.price - a.price
        case 'stock-desc':
          return b.stock - a.stock
        default:
          return b.id - a.id
      }
    })

  return (
    <section className="stack-lg">
      <h1>Admin products</h1>
      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}
      {loading && <p className="hint-text">Loading products...</p>}

      <form className="form-grid two-cols auth-card" onSubmit={createProduct}>
        <label>
          Name
          <input name="name" value={form.name} onChange={onChange} required />
        </label>
        <label>
          Capacity GB
          <input name="capacity_gb" type="number" min={1} value={form.capacity_gb} onChange={onChange} required />
        </label>
        <label>
          Memory type
          <select name="memory_type" value={form.memory_type} onChange={onChange}>
            <option value="DDR4">DDR4</option>
            <option value="DDR5">DDR5</option>
          </select>
        </label>
        <label>
          Speed MHz
          <input name="speed_mhz" type="number" min={1} value={form.speed_mhz} onChange={onChange} required />
        </label>
        <label>
          Price
          <input name="price" type="number" min={0.01} step="0.01" value={form.price} onChange={onChange} required />
        </label>
        <label>
          Stock
          <input name="stock" type="number" min={0} value={form.stock} onChange={onChange} required />
        </label>
        <label className="span-two">
          Description
          <input name="description" value={form.description ?? ''} onChange={onChange} />
        </label>
        <label>
          Active
          <input name="is_active" type="checkbox" checked={form.is_active} onChange={onChange} />
        </label>

        <button className="span-two" type="submit">
          {saving ? 'Saving...' : 'Add product'}
        </button>
      </form>

      {editingProductId && (
        <form className="form-grid two-cols auth-card" onSubmit={updateProduct}>
          <h2 className="span-two">Edit product #{editingProductId}</h2>

          <label>
            Name
            <input name="name" value={editForm.name} onChange={onEditChange} required />
          </label>
          <label>
            Capacity GB
            <input name="capacity_gb" type="number" min={1} value={editForm.capacity_gb} onChange={onEditChange} required />
          </label>
          <label>
            Memory type
            <select name="memory_type" value={editForm.memory_type} onChange={onEditChange}>
              <option value="DDR4">DDR4</option>
              <option value="DDR5">DDR5</option>
            </select>
          </label>
          <label>
            Speed MHz
            <input name="speed_mhz" type="number" min={1} value={editForm.speed_mhz} onChange={onEditChange} required />
          </label>
          <label>
            Price
            <input name="price" type="number" min={0.01} step="0.01" value={editForm.price} onChange={onEditChange} required />
          </label>
          <label>
            Stock
            <input name="stock" type="number" min={0} value={editForm.stock} onChange={onEditChange} required />
          </label>
          <label className="span-two">
            Description
            <input name="description" value={editForm.description ?? ''} onChange={onEditChange} />
          </label>
          <label>
            Active
            <input name="is_active" type="checkbox" checked={editForm.is_active} onChange={onEditChange} />
          </label>

          <div className="row-actions span-two">
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" className="ghost-btn" onClick={() => setEditingProductId(null)} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="filters">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
        />

        <select value={sortBy} onChange={(event) => setSortBy(event.target.value as ProductSort)}>
          <option value="newest">Newest</option>
          <option value="name-asc">Name: A-Z</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="stock-desc">Stock: highest first</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Spec</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{`${product.capacity_gb}GB ${product.memory_type} ${product.speed_mhz}MHz`}</td>
                <td>${product.price.toFixed(2)}</td>
                <td>{product.stock}</td>
                <td>{product.is_active ? 'active' : 'inactive'}</td>
                <td className="row-actions">
                  <button className="ghost-btn" onClick={() => startEdit(product)} disabled={saving}>
                    Edit
                  </button>
                  <button className="danger" onClick={() => deleteProduct(product.id)} disabled={saving}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!visibleProducts.length && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
