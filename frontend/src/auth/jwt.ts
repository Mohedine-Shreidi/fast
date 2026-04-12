import type { UserType } from '../types/auth'

interface JwtPayload {
  sub?: string
  role?: UserType
  exp?: number
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return atob(normalized + padding)
}

export function parseJwt(token: string | null): JwtPayload | null {
  if (!token) {
    return null
  }

  const segments = token.split('.')
  if (segments.length !== 3) {
    return null
  }

  try {
    return JSON.parse(decodeBase64Url(segments[1])) as JwtPayload
  } catch {
    return null
  }
}

export function getRoleFromToken(token: string | null): UserType | null {
  const payload = parseJwt(token)
  if (!payload?.role) {
    return null
  }
  return payload.role
}

export function isTokenExpired(token: string | null): boolean {
  const payload = parseJwt(token)
  if (!payload?.exp) {
    return true
  }

  const currentEpoch = Math.floor(Date.now() / 1000)
  return payload.exp <= currentEpoch
}
