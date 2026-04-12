import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    city: '',
    age: 18,
    type: 'client' as const,
    password: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Unexpected registration failure.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-card">
      <h1>Create account</h1>
      <p className="hint-text">New self-service registrations are created as client accounts.</p>

      <form onSubmit={onSubmit} className="form-grid two-cols">
        <label>
          First name
          <input
            value={form.first_name}
            onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
            required
          />
        </label>

        <label>
          Last name
          <input
            value={form.last_name}
            onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </label>

        <label>
          Phone number
          <input
            value={form.phone_number}
            onChange={(event) => setForm((prev) => ({ ...prev, phone_number: event.target.value }))}
            placeholder="+12345678901"
            required
          />
        </label>

        <label>
          City
          <input
            value={form.city}
            onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
            required
          />
        </label>

        <label>
          Age
          <input
            type="number"
            min={1}
            value={form.age}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, age: Number(event.target.value) || 0 }))
            }
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required
          />
        </label>

        {error && <p className="error-text span-two">{error}</p>}

        <button className="span-two" type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>
    </section>
  )
}
