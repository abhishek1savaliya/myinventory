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

function parseXhrResponse(xhr: XMLHttpRequest, token: string | null) {
  if (xhr.status >= 200 && xhr.status < 300) {
    if (xhr.status === 204 || !xhr.responseText) {
      return null
    }

    try {
      return JSON.parse(xhr.responseText) as unknown
    } catch {
      throw new ApiRequestError('Invalid JSON response', xhr.status, undefined)
    }
  }

  let error: { message?: string; details?: unknown } = { message: xhr.statusText }
  try {
    error = JSON.parse(xhr.responseText) as { message?: string; details?: unknown }
  } catch {
    // keep default message
  }

  if (xhr.status === 401 && token) {
    clearStoredToken()
    onUnauthorized?.()
  }

  throw new ApiRequestError(
    error.message ?? `Request failed: ${xhr.status}`,
    xhr.status,
    error.details,
  )
}

export function apiUploadFormData<T = unknown>(
  path: string,
  formData: FormData,
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = tokenGetter()
    const xhr = new XMLHttpRequest()

    xhr.open('POST', `${API_BASE_URL}${path}`)
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    if (onUploadProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onUploadProgress(event.loaded, event.total)
        }
      })
    }

    xhr.addEventListener('load', () => {
      try {
        resolve(parseXhrResponse(xhr, token) as T)
      } catch (error) {
        reject(error)
      }
    })

    xhr.addEventListener('error', () => {
      reject(new ApiRequestError('Network error', 0, undefined))
    })

    xhr.addEventListener('abort', () => {
      reject(new ApiRequestError('Upload aborted', 0, undefined))
    })

    xhr.send(formData)
  })
}
