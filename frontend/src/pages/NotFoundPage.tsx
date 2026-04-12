import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="auth-card">
      <h1>Page not found</h1>
      <p className="hint-text">The route does not exist in this build.</p>
      <Link to="/" className="inline-link">
        Back to store
      </Link>
    </section>
  )
}
