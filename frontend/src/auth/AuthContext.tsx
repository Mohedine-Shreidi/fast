import {
    createContext,
    useEffect,
    useContext,
    useMemo,
    useState,
    type PropsWithChildren,
} from 'react'

import { AUTH_UNAUTHORIZED_EVENT, apiFetch } from '../api/client'
import { getRoleFromToken, isTokenExpired } from './jwt'
import type {
    LoginPayload,
    RegisterPayload,
    TokenResponse,
    UserType,
} from '../types/auth'

const TOKEN_STORAGE_KEY = 'ram_store_auth_token'

interface AuthContextValue {
    token: string | null
    role: UserType | null
    isAuthenticated: boolean
    login: (payload: LoginPayload) => Promise<void>
    register: (payload: RegisterPayload) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function safeStorageGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function safeStorageSetItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value)
    } catch {
        // Swallow storage failures (private mode/quota) and keep in-memory session.
    }
}

function safeStorageRemoveItem(key: string): void {
    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage removal failures to avoid breaking logout/session cleanup.
    }
}

function getStoredToken(): string | null {
    const token = safeStorageGetItem(TOKEN_STORAGE_KEY)
    if (!token || isTokenExpired(token)) {
        safeStorageRemoveItem(TOKEN_STORAGE_KEY)
        return null
    }
    return token
}

export function AuthProvider({ children }: PropsWithChildren) {
    const [token, setToken] = useState<string | null>(getStoredToken)

    const role = useMemo(() => getRoleFromToken(token), [token])

    const setSession = (nextToken: string | null) => {
        if (nextToken) {
            safeStorageSetItem(TOKEN_STORAGE_KEY, nextToken)
        } else {
            safeStorageRemoveItem(TOKEN_STORAGE_KEY)
        }
        setToken(nextToken)
    }

    useEffect(() => {
        const handleUnauthorized = () => {
            safeStorageRemoveItem(TOKEN_STORAGE_KEY)
            setToken(null)
        }

        window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
        return () => {
            window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
        }
    }, [])

    const login = async (payload: LoginPayload) => {
        const response = await apiFetch<TokenResponse>('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        setSession(response.access_token)
    }

    const register = async (payload: RegisterPayload) => {
        await apiFetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        await login({ email: payload.email, password: payload.password })
    }

    const logout = () => {
        setSession(null)
    }

    const value: AuthContextValue = {
        token,
        role,
        isAuthenticated: Boolean(token && role),
        login,
        register,
        logout,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider')
    }
    return context
}
