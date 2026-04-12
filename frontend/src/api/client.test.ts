import { afterEach, describe, expect, it, vi } from 'vitest'

import { AUTH_UNAUTHORIZED_EVENT, ApiError, apiFetch } from './client'

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses backend error envelope message', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'http_403',
            message: 'Forbidden',
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/admin/users')).rejects.toMatchObject({
      message: 'Forbidden',
      status: 403,
      code: 'http_403',
    })
  })

  it('retries failed GET requests once', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Temporary network issue'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const payload = await apiFetch<{ status: string }>('/health')
    expect(payload.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry failed non-GET requests', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Offline'))
    vi.stubGlobal('fetch', fetchMock)

    try {
      await apiFetch('/orders', { method: 'POST', body: '{}' })
      throw new Error('Expected apiFetch to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(0)
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('emits unauthorized event on 401 responses', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'http_401',
            message: 'Could not validate credentials',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    vi.stubGlobal('fetch', fetchMock)
    const unauthorizedSpy = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorizedSpy)

    try {
      await apiFetch('/stats/count')
      throw new Error('Expected apiFetch to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(401)
    } finally {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorizedSpy)
    }

    expect(unauthorizedSpy).toHaveBeenCalledTimes(1)
  })
})
