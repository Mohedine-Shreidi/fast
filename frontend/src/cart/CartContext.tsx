import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import type { ProductRecord } from '../types/auth'

const CART_STORAGE_KEY = 'ram_store_cart'

export interface CartItem {
  product: ProductRecord
  quantity: number
}

interface CartContextValue {
  items: CartItem[]
  totalItems: number
  totalAmount: number
  addToCart: (product: ProductRecord, quantity?: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  removeFromCart: (productId: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

function readStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as CartItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>(readStoredCart)

  const persist = (nextItems: CartItem[]) => {
    setItems(nextItems)
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems))
  }

  const addToCart = (product: ProductRecord, quantity = 1) => {
    const safeQuantity = Math.max(1, Math.trunc(quantity))

    const existing = items.find((item) => item.product.id === product.id)
    if (!existing) {
      persist([...items, { product, quantity: safeQuantity }])
      return
    }

    const nextItems = items.map((item) =>
      item.product.id === product.id
        ? {
            ...item,
            quantity: item.quantity + safeQuantity,
            product,
          }
        : item,
    )
    persist(nextItems)
  }

  const updateQuantity = (productId: number, quantity: number) => {
    const safeQuantity = Math.max(1, Math.trunc(quantity))
    const nextItems = items.map((item) =>
      item.product.id === productId
        ? {
            ...item,
            quantity: safeQuantity,
          }
        : item,
    )
    persist(nextItems)
  }

  const removeFromCart = (productId: number) => {
    persist(items.filter((item) => item.product.id !== productId))
  }

  const clearCart = () => {
    persist([])
  }

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.product.price, 0),
    [items],
  )

  const value: CartContextValue = {
    items,
    totalItems,
    totalAmount,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }
  return context
}
