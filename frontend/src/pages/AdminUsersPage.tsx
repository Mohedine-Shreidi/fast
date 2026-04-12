import { useEffect, useState, type FormEvent } from 'react'

import { ApiError, apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { UserRecord, UsersPageResponse, UserType } from '../types/auth'

type UserDraft = {
  city: string
  age: string
  type: UserType
}

export function AdminUsersPage() {
  const { token } = useAuth()

  const [users, setUsers] = useState<UserRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [nameFilter, setNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | UserType>('all')
  const [drafts, setDrafts] = useState<Record<number, UserDraft>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<number | null>(null)

  const loadUsers = async (activePage: number) => {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const params = new URLSearchParams({
        page: String(activePage),
        limit: String(limit),
      })

      if (nameFilter.trim()) {
        params.set('name', nameFilter.trim())
      }

      if (typeFilter !== 'all') {
        params.set('type', typeFilter)
      }

      const response = await apiFetch<UsersPageResponse>(`/users?${params.toString()}`, {}, token)
      setUsers(response.items)
      setTotal(response.total)
      setDrafts(
        Object.fromEntries(
          response.items.map((user) => [
            user.id,
            { city: user.city, age: String(user.age), type: user.type },
          ]),
        ),
      )
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not load users.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers(page).catch(() => setError('Could not load users.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const onSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    await loadUsers(1)
  }

  const onDraftChange = (id: number, field: keyof UserDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  const onSaveUser = async (userId: number) => {
    if (!token || !drafts[userId]) {
      return
    }

    setError('')
    setSuccess('')
    setPendingUserId(userId)

    try {
      await apiFetch<UserRecord>(
        `/users/${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: drafts[userId].city,
            age: Number(drafts[userId].age),
            type: drafts[userId].type,
          }),
        },
        token,
      )
      setSuccess(`User #${userId} updated.`)
      await loadUsers(page)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Update failed.')
      }
    } finally {
      setPendingUserId(null)
    }
  }

  const onDeleteUser = async (userId: number) => {
    if (!token) {
      return
    }

    const confirmed = window.confirm(`Delete user #${userId}?`)
    if (!confirmed) {
      return
    }

    setError('')
    setSuccess('')
    setPendingUserId(userId)

    try {
      await apiFetch<void>(
        `/users/${userId}`,
        {
          method: 'DELETE',
        },
        token,
      )
      const remainingRows = users.length - 1
      const shouldGoPrev = remainingRows <= 0 && page > 1
      const nextPage = shouldGoPrev ? page - 1 : page
      if (shouldGoPrev) {
        setPage(nextPage)
      }
      setSuccess(`User #${userId} deleted.`)
      await loadUsers(nextPage)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Delete failed.')
      }
    } finally {
      setPendingUserId(null)
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / limit))

  return (
    <section className="stack-md">
      <h1>Admin user management</h1>

      <form className="filters" onSubmit={onSearch}>
        <input
          value={nameFilter}
          onChange={(event) => setNameFilter(event.target.value)}
          placeholder="Filter by name"
        />

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | UserType)}
        >
          <option value="all">All roles</option>
          <option value="admin">admin</option>
          <option value="client">client</option>
        </select>

        <button type="submit" disabled={loading}>
          Apply
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
  {success && <p className="success-text">{success}</p>}
  {loading && <p className="hint-text">Loading users...</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>City</th>
              <th>Age</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const draft = drafts[user.id]
              return (
                <tr key={user.id}>
                  <td>{`${user.first_name} ${user.last_name}`}</td>
                  <td>{user.email}</td>
                  <td>
                    <input
                      value={draft?.city ?? user.city}
                      onChange={(event) => onDraftChange(user.id, 'city', event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={draft?.age ?? String(user.age)}
                      onChange={(event) => onDraftChange(user.id, 'age', event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={draft?.type ?? user.type}
                      onChange={(event) => onDraftChange(user.id, 'type', event.target.value)}
                    >
                      <option value="admin">admin</option>
                      <option value="client">client</option>
                    </select>
                  </td>
                  <td className="row-actions">
                    <button onClick={() => onSaveUser(user.id)} disabled={pendingUserId === user.id || loading}>
                      {pendingUserId === user.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="danger"
                      onClick={() => onDeleteUser(user.id)}
                      disabled={pendingUserId === user.id || loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
            {!users.length && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
          Previous
        </button>
        <span>
          Page {page} / {maxPage}
        </span>
        <button
          onClick={() => setPage((prev) => Math.min(maxPage, prev + 1))}
          disabled={page >= maxPage}
        >
          Next
        </button>
      </div>
    </section>
  )
}
