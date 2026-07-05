import type { ApiError } from '@myinventory/shared'
import { clearStoredToken, getStoredToken } from './auth-storage'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3847'

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

let tokenGetter: () => string | null = getStoredToken
let onUnauthorized: (() => void) | null = null

export function setTokenGetter(getter: () => string | null): void {
  tokenGetter = getter
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenGetter()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      message: response.statusText,
    }))) as ApiError

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

  return response.json() as Promise<T>
}
