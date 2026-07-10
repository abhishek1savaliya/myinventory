export function isOrganizationOwner(user) {
  if (!user?.email || !user?.organization?.email) {
    return false
  }

  return user.email.toLowerCase().trim() === user.organization.email.toLowerCase().trim()
}
