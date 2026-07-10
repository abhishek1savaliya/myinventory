export const AUTH_SESSION_KEY = 'myinventory_session_id'
export const AUTH_ORG_SLUG_KEY = 'myinventory_org_slug'
/** @deprecated JWT is stored server-side in Supabase; kept for cleanup only */
export const AUTH_TOKEN_KEY = 'myinventory_token'

/** Opaque session id — JWT lives in Supabase via the API */
export function getStoredSessionId() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_SESSION_KEY)
}

export function getStoredOrgSlug() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_ORG_SLUG_KEY)
}

export function setStoredSessionId(sessionId, orgSlug) {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.setItem(AUTH_SESSION_KEY, sessionId)
  if (orgSlug) {
    localStorage.setItem(AUTH_ORG_SLUG_KEY, orgSlug)
  }
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY)
  localStorage.removeItem(AUTH_ORG_SLUG_KEY)
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
