import { clearStoredSession, getStoredSessionId } from './auth-storage'

function normalizeApiBaseUrl(url) {
  if (!url) return url
  let normalized = url.trim().replace(/\/+$/, '')
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4)
  }
  return normalized
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3847' : ''),
)

export class ApiRequestError extends Error {
  constructor(message, statusCode, details) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
    this.details = details
  }
}

let sessionGetter = getStoredSessionId
let onUnauthorized = null

export function setSessionGetter(getter) {
  sessionGetter = getter
}

/** @deprecated Use setSessionGetter */
export function setTokenGetter(getter) {
  sessionGetter = getter
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

  const sessionId = sessionGetter()
  const headers = {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {}),
  }

  if (sessionId) {
    headers['X-Session-Id'] = sessionId
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }))

    if (response.status === 401 && sessionId) {
      clearStoredSession()
      onUnauthorized?.()
    }

    throw new ApiRequestError(
      error.message ??
        (response.status === 404
          ? 'API route not found — check NEXT_PUBLIC_API_URL (use base URL without /api suffix)'
          : `Request failed: ${response.status}`),
      response.status,
      error.details,
    )
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

function parseXhrResponse(xhr, sessionId) {
  if (xhr.status >= 200 && xhr.status < 300) {
    if (xhr.status === 204 || !xhr.responseText) {
      return null
    }

    try {
      return JSON.parse(xhr.responseText)
    } catch {
      throw new ApiRequestError('Invalid JSON response', xhr.status, undefined)
    }
  }

  let error = { message: xhr.statusText }
  try {
    error = JSON.parse(xhr.responseText)
  } catch {
    // keep default message
  }

  if (xhr.status === 401 && sessionId) {
    clearStoredSession()
    onUnauthorized?.()
  }

  throw new ApiRequestError(
    error.message ??
      (xhr.status === 404
        ? 'API route not found — check NEXT_PUBLIC_API_URL (use base URL without /api suffix)'
        : `Request failed: ${xhr.status}`),
    xhr.status,
    error.details,
  )
}

/**
 * JSON request with XMLHttpRequest upload progress (for large payloads such as base64 images).
 */
export function apiFetchJsonWithProgress(path, init, onUploadProgress) {
  if (!API_BASE_URL) {
    return Promise.reject(
      new ApiRequestError('NEXT_PUBLIC_API_URL is not configured', 0, undefined),
    )
  }

  return new Promise((resolve, reject) => {
    const sessionId = sessionGetter()
    const xhr = new XMLHttpRequest()
    const method = init?.method ?? 'GET'
    const body = init?.body ?? null

    xhr.open(method, `${API_BASE_URL}${path}`)
    xhr.setRequestHeader('Content-Type', 'application/json')
    if (sessionId) {
      xhr.setRequestHeader('X-Session-Id', sessionId)
    }

    if (onUploadProgress && body) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onUploadProgress(event.loaded, event.total)
        }
      })
    }

    xhr.addEventListener('load', () => {
      try {
        resolve(parseXhrResponse(xhr, sessionId))
      } catch (error) {
        reject(error)
      }
    })

    xhr.addEventListener('error', () => {
      reject(new ApiRequestError('Network error', 0, undefined))
    })

    xhr.addEventListener('abort', () => {
      reject(new ApiRequestError('Request aborted', 0, undefined))
    })

    xhr.send(body)
  })
}
