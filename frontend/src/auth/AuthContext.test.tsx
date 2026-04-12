import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './AuthContext'

const apiFetchMock = vi.fn()

vi.mock('../api/client', () => ({
    AUTH_UNAUTHORIZED_EVENT: 'ram_store:unauthorized',
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

const TOKEN_STORAGE_KEY = 'ram_store_auth_token'

function toBase64Url(value: string): string {
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createJwt(role: 'admin' | 'client', expSecondsFromNow = 3600): string {
    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = toBase64Url(
        JSON.stringify({
            sub: 'test-user',
            role,
            exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
        }),
    )
    return `${header}.${payload}.signature`
}

function AuthProbe() {
    const { isAuthenticated, role, token, login, logout, register } = useAuth()

    return (
        <div>
            <p data-testid="is-authenticated">{isAuthenticated ? 'yes' : 'no'}</p>
            <p data-testid="role">{role ?? 'none'}</p>
            <p data-testid="token">{token ?? 'none'}</p>

            <button
                onClick={() =>
                    login({
                        email: 'user@test.com',
                        password: 'Password@123',
                    })
                }
            >
                login
            </button>

            <button
                onClick={() =>
                    register({
                        first_name: 'Test',
                        last_name: 'User',
                        email: 'user@test.com',
                        phone_number: '+15550000000',
                        city: 'Metro',
                        age: 30,
                        type: 'client',
                        password: 'Password@123',
                    })
                }
            >
                register
            </button>

            <button onClick={logout}>logout</button>
        </div>
    )
}

describe('AuthProvider', () => {
    beforeEach(() => {
        apiFetchMock.mockReset()
        localStorage.clear()
    })

    it('hydrates from a valid stored token', () => {
        localStorage.setItem(TOKEN_STORAGE_KEY, createJwt('admin', 3600))

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        )

        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes')
        expect(screen.getByTestId('role')).toHaveTextContent('admin')
    })

    it('clears expired stored token during initialization', () => {
        localStorage.setItem(TOKEN_STORAGE_KEY, createJwt('client', -120))

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        )

        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no')
        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    })

    it('stores token after successful login', async () => {
        const nextToken = createJwt('client', 3600)
        apiFetchMock.mockResolvedValueOnce({
            access_token: nextToken,
            token_type: 'bearer',
        })

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'login' }))

        await waitFor(() => {
            expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes')
        })

        expect(screen.getByTestId('role')).toHaveTextContent('client')
        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(nextToken)
    })

    it('registers then logs in automatically', async () => {
        const nextToken = createJwt('admin', 3600)

        apiFetchMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ access_token: nextToken, token_type: 'bearer' })

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'register' }))

        await waitFor(() => {
            expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes')
        })

        expect(apiFetchMock).toHaveBeenNthCalledWith(
            1,
            '/register',
            expect.objectContaining({ method: 'POST' }),
        )
        expect(apiFetchMock).toHaveBeenNthCalledWith(
            2,
            '/login',
            expect.objectContaining({ method: 'POST' }),
        )
        expect(screen.getByTestId('role')).toHaveTextContent('admin')
    })

    it('clears session when unauthorized event is emitted', async () => {
        const token = createJwt('client', 3600)
        localStorage.setItem(TOKEN_STORAGE_KEY, token)

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        )

        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes')

        act(() => {
            window.dispatchEvent(new CustomEvent('ram_store:unauthorized'))
        })

        await waitFor(() => {
            expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no')
        })

        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    })

    it('clears storage on explicit logout', async () => {
        const token = createJwt('client', 3600)
        localStorage.setItem(TOKEN_STORAGE_KEY, token)

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'logout' }))

        await waitFor(() => {
            expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no')
        })

        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    })
})
