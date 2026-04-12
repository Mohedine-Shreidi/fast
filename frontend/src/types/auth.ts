export type UserType = 'admin' | 'client'

export interface RegisterPayload {
  first_name: string
  last_name: string
  email: string
  phone_number: string
  city: string
  age: number
  type: UserType
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserRecord {
  id: number
  first_name: string
  last_name: string
  email: string
  phone_number: string
  city: string
  age: number
  type: UserType
}

export interface UsersPageResponse {
  items: UserRecord[]
  total: number
  page: number
  limit: number
}

export interface CountResponse {
  total_users: number
}

export interface AverageAgeResponse {
  average_age: number
}

export interface TopCity {
  city: string
  count: number
}

export interface TopCitiesResponse {
  top_cities: TopCity[]
}

export interface ProductRecord {
  id: number
  name: string
  capacity_gb: number
  memory_type: string
  speed_mhz: number
  price: number
  stock: number
  description: string | null
  is_active: boolean
}

export interface ProductsPageResponse {
  items: ProductRecord[]
  total: number
  page: number
  limit: number
}

export interface CreateProductPayload {
  name: string
  capacity_gb: number
  memory_type: 'DDR4' | 'DDR5'
  speed_mhz: number
  price: number
  stock: number
  description?: string
  is_active: boolean
}

export interface OrderItemPayload {
  product_id: number
  quantity: number
}

export interface CreateOrderPayload {
  city: string
  items: OrderItemPayload[]
}

export interface OrderItemRecord {
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled'

export interface OrderRecord {
  id: number
  user_id: number
  status: OrderStatus
  subtotal_amount: number
  tax_amount: number
  shipping_amount: number
  total_amount: number
  city: string
  created_at: string
  items: OrderItemRecord[]
}

export interface OrdersPageResponse {
  items: OrderRecord[]
  total: number
  page: number
  limit: number
}

export interface OrderQuoteItemRecord {
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface OrderQuoteRecord {
  city: string
  item_count: number
  subtotal: number
  tax_amount: number
  shipping_amount: number
  total_amount: number
  currency: string
  items: OrderQuoteItemRecord[]
}

export interface ApiErrorEnvelope {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  detail?: string
}
