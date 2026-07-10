import type { Organization } from '@prisma/client'
import type { OrganizationSummary } from '@myinventory/shared'

export function mapOrganizationToSummary(org: Organization): OrganizationSummary {
  return {
    id: org.id,
    orgCode: org.orgCode,
    slug: org.slug,
    name: org.name,
    tradingName: org.tradingName,
  }
}
