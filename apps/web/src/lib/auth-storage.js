export const AUTH_SESSION_KEY = 'myinventory_session_id'
/** @deprecated JWT is stored server-side in Supabase; kept for cleanup only */
export const AUTH_TOKEN_KEY = 'myinventory_token'

/** Opaque session id — JWT lives in Supabase via the API */
export function getStoredSessionId() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_SESSION_KEY)
}

export function setStoredSessionId(sessionId) {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.setItem(AUTH_SESSION_KEY, sessionId)
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY)
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

/** @deprecated Web uses session id + API storage instead of local JWT */
export function getStoredToken() {
  return null
}

/** @deprecated */
export function setStoredToken(_token) {
  // no-op on web — sessions are created by POST /api/auth/login
}

export function clearStoredToken() {
  clearStoredSession()
}
