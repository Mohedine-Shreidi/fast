import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider, useAuth } from './auth/AuthContext'
import { CartProvider } from './cart/CartContext'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminOrdersPage } from './pages/AdminOrdersPage'
import { AdminProductsPage } from './pages/AdminProductsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { DashboardPage } from './pages/DashboardPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { CartPage } from './pages/CartPage'
import { MyOrdersPage } from './pages/MyOrdersPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ProductsPage } from './pages/ProductsPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { RegisterPage } from './pages/RegisterPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import './App.css'

function RoleRedirect() {
  const { role } = useAuth()
  if (role === 'admin') {
    return <Navigate to="/admin/users" replace />
  }
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forbidden" element={<ForbiddenPage />} />

              <Route element={<ProtectedRoute />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="orders/me" element={<MyOrdersPage />} />
                <Route path="orders/me/:orderId" element={<OrderDetailPage mode="me" />} />
                <Route path="account" element={<RoleRedirect />} />
              </Route>

              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route path="admin/users" element={<AdminUsersPage />} />
                <Route path="admin/products" element={<AdminProductsPage />} />
                <Route path="admin/orders" element={<AdminOrdersPage />} />
                <Route path="admin/orders/:orderId" element={<OrderDetailPage mode="admin" />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
