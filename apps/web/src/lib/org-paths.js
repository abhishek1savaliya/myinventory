export function orgPath(orgSlug, path = '') {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return normalized ? `/${orgSlug}/${normalized}` : `/${orgSlug}`
}

export function dashboardPath(orgSlug) {
  return orgPath(orgSlug, 'dashboard')
}

export function loginPath(orgSlug) {
  return orgPath(orgSlug, 'login')
}
