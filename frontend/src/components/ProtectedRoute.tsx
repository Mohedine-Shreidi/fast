import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import type { UserType } from '../types/auth'

interface ProtectedRouteProps {
  requiredRole?: UserType
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/forbidden" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
