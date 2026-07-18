import type { AuthUser } from '@myinventory/shared'
import { isOrganizationOwner } from './org-owner'

export function orgWelcomePath() {
  return '/welcome'
}

export function orgLoginPath(slug: string) {
  return `/login/${slug}`
}

export function orgPostAuthPath(user: AuthUser | null) {
  if (isOrganizationOwner(user)) {
    return '/welcome'
  }
  return '/'
}
