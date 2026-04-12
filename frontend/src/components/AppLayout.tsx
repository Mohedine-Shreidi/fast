import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'

export function AppLayout() {
    const { isAuthenticated, role, logout } = useAuth()
    const { totalItems } = useCart()

    return (
        <div className="app-shell">
            <a className="skip-link" href="#main-content">
                Skip to main content
            </a>

            <header className="topbar">
                <Link className="brand" to="/">
                    RAM Atlas
                </Link>

                <nav className="nav-links" aria-label="Primary">
                    <NavLink to="/">Home</NavLink>
                    <NavLink to="/products">Store</NavLink>
                    <NavLink to="/cart">Cart ({totalItems})</NavLink>
                    {isAuthenticated && <NavLink to="/dashboard">Dashboard</NavLink>}
                    {isAuthenticated && <NavLink to="/orders/me">My Orders</NavLink>}
                    {role === 'admin' && <NavLink to="/admin/users">Admin Users</NavLink>}
                    {role === 'admin' && <NavLink to="/admin/products">Admin Products</NavLink>}
                    {role === 'admin' && <NavLink to="/admin/orders">Admin Orders</NavLink>}
                    {!isAuthenticated && <NavLink to="/register">Register</NavLink>}
                    {!isAuthenticated && <NavLink to="/login">Login</NavLink>}
                </nav>

                {isAuthenticated ? (
                    <button className="ghost-btn" onClick={logout}>
                        Logout
                    </button>
                ) : (
                    <span className="role-pill">Guest</span>
                )}
            </header>

            <main className="page-body" id="main-content" tabIndex={-1}>
                <Outlet />
            </main>
        </div>
    )
}
