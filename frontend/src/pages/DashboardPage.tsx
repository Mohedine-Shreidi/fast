import { useMemo } from 'react'

import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { role, token } = useAuth()

  const tokenPreview = useMemo(() => {
    if (!token) {
      return 'No token'
    }
    return `${token.slice(0, 24)}...`
  }, [token])

  return (
    <section className="auth-card">
      <h1>Account dashboard</h1>
      <p className="hint-text">Authenticated route is active.</p>
      <div className="stack-sm">
        <p>
          <strong>Role:</strong> {role}
        </p>
        <p>
          <strong>Token preview:</strong> {tokenPreview}
        </p>
      </div>
    </section>
  )
}
