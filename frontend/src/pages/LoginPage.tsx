import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

interface LocationState {
    from?: string
}

export function LoginPage() {
    const { login, register, role } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const state = (location.state ?? {}) as LocationState

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError('')
        setLoading(true)

        try {
            await login({ email, password })
            const redirectTarget = state.from && state.from !== '/login' ? state.from : '/dashboard'
            navigate(redirectTarget)
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message)
            } else {
                setError('Unexpected login failure.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className="auth-card">
            <h1>Login</h1>
            <p className="hint-text">Use your email and password to access your dashboard.</p>
            <p className="hint-text">Quick test accounts:</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                        // seeded admin from backend seed.py
                        setEmail('admin@ramstore.com')
                        setPassword('Admin@12345')
                    }}
                >
                    Use admin@ramstore.com
                </button>

                <button
                    type="button"
                    className="ghost-btn"
                    onClick={async () => {
                        // create or login a test customer and navigate
                        const custEmail = 'customer@ramstore.com'
                        const custPass = 'Customer@123'
                        setError('')
                        setLoading(true)
                        try {
                            await register({
                                first_name: 'Dev',
                                last_name: 'Customer',
                                email: custEmail,
                                phone_number: '+10000000000',
                                city: 'Testville',
                                age: 28,
                                type: 'client',
                                password: custPass,
                            })
                            setEmail(custEmail)
                            setPassword(custPass)
                            const redirectTarget = state.from && state.from !== '/login' ? state.from : '/dashboard'
                            navigate(redirectTarget)
                        } catch (err) {
                            if (err instanceof ApiError) setError(err.message)
                            else setError('Could not create/test customer.')
                        } finally {
                            setLoading(false)
                        }
                    }}
                >
                    Create/login customer@ramstore.com
                </button>
            </div>
            <form onSubmit={onSubmit} className="form-grid">
                <label>
                    Email
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                    />
                </label>

                <label>
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                </label>

                {error && (
                    <p className="error-text" role="alert" aria-live="assertive">
                        {error}
                    </p>
                )}

                <button type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            {role && <p className="hint-text">Current role: {role}</p>}
        </section>
    )
}
