import { isOrganizationOwner } from '@/lib/org-owner'

export function orgPath(orgSlug, path = '') {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `/${orgSlug}${normalized === '/' ? '' : normalized}`
}

export function orgDashboardPath(orgSlug) {
  return orgPath(orgSlug, '/dashboard')
}

export function orgLoginPath(orgSlug) {
  return orgPath(orgSlug, '/login')
}

export function orgWelcomePath(orgSlug) {
  return orgPath(orgSlug, '/welcome')
}

export function orgPostAuthPath(user) {
  const slug = user?.organization?.slug
  if (!slug) {
    return '/'
  }

  if (isOrganizationOwner(user)) {
    return orgWelcomePath(slug)
  }

  return orgDashboardPath(slug)
}
