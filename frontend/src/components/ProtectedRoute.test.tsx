import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

import { ProtectedRoute } from './ProtectedRoute'

const useAuthMock = vi.fn()

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, role: null })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/dashboard" element={<ProtectedRoute />}>
            <Route index element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('redirects authenticated users without required role to forbidden', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, role: 'client' })

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/forbidden" element={<div>Forbidden page</div>} />
          <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin" />}>
            <Route index element={<div>Admin users</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Forbidden page')).toBeInTheDocument()
  })

  it('renders protected content for authorized users', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, role: 'admin' })

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin" />}>
            <Route index element={<div>Admin users</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Admin users')).toBeInTheDocument()
  })
})
