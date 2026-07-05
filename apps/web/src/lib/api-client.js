import { clearStoredToken, getStoredToken } from './auth-storage'

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3847' : '')

export class ApiRequestError extends Error {
  constructor(message, statusCode, details) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
    this.details = details
  }
}

let tokenGetter = getStoredToken
let onUnauthorized = null

export function setTokenGetter(getter) {
  tokenGetter = getter
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export async function apiFetch(path, init) {
  if (!API_BASE_URL) {
    throw new ApiRequestError(
      'NEXT_PUBLIC_API_URL is not configured',
      0,
      undefined,
    )
  }

  const token = tokenGetter()
  const headers = {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }))

    if (response.status === 401 && token) {
      clearStoredToken()
      onUnauthorized?.()
    }

    throw new ApiRequestError(
      error.message ?? `Request failed: ${response.status}`,
      response.status,
      error.details,
    )
  }

  return response.json()
}
