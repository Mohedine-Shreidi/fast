import { Link, useLocation } from 'react-router-dom'

interface ForbiddenState {
    from?: string
}

export function ForbiddenPage() {
    const location = useLocation()
    const state = (location.state ?? {}) as ForbiddenState

    return (
        <section className="auth-card stack-md">
            <h1>Access denied</h1>
            <p className="hint-text">Your account does not have permission to open this page.</p>
            {state.from && <p className="hint-text">Requested path: {state.from}</p>}
            <div className="row-actions">
                <Link className="inline-link" to="/dashboard">
                    Go to dashboard
                </Link>
                <Link className="inline-link" to="/">
                    Go to home
                </Link>
            </div>
        </section>
    )
}
