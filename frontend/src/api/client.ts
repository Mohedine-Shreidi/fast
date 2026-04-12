import type { ApiErrorEnvelope } from '../types/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15000)
export const AUTH_UNAUTHORIZED_EVENT = 'ram_store:unauthorized'

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

function getErrorDetails(payload: ApiErrorEnvelope | null): {
  message: string
  code?: string
  details?: unknown
} {
  if (!payload) {
    return { message: 'Request failed' }
  }

  if (payload.error?.message) {
    return {
      message: payload.error.message,
      code: payload.error.code,
      details: payload.error.details,
    }
  }

  if (payload.detail) {
    return { message: payload.detail }
  }

  return { message: 'Request failed' }
}

function shouldRetry(method: string, status: number, attempt: number, maxAttempts: number) {
  if (method !== 'GET' || attempt >= maxAttempts - 1) {
    return false
  }

  return status === 408 || status === 429 || status >= 500
}

function emitUnauthorizedEvent(status: number) {
  if (status !== 401 || typeof window === 'undefined' || typeof CustomEvent !== 'function') {
    return
  }

  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT))
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers)
  const method = (options.method ?? 'GET').toUpperCase()
  const maxAttempts = method === 'GET' ? 2 : 1

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let lastNetworkError: unknown = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let payload: ApiErrorEnvelope | null = null

        try {
          payload = (await response.json()) as ApiErrorEnvelope
        } catch {
          payload = null
        }

        if (shouldRetry(method, response.status, attempt, maxAttempts)) {
          continue
        }

        emitUnauthorizedEvent(response.status)

        const errorData = getErrorDetails(payload)
        throw new ApiError(
          errorData.message || response.statusText || 'Request failed',
          response.status,
          errorData.code,
          errorData.details,
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      return (await response.json()) as T
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof ApiError) {
        throw error
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (attempt < maxAttempts - 1) {
          continue
        }
        throw new ApiError('Request timed out. Please try again.', 408, 'request_timeout')
      }

      lastNetworkError = error
      if (attempt < maxAttempts - 1) {
        continue
      }
    }
  }

  if (lastNetworkError instanceof Error) {
    throw new ApiError(lastNetworkError.message || 'Network request failed', 0, 'network_error')
  }

  throw new ApiError('Network request failed', 0, 'network_error')
}
