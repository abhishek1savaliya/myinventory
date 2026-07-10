import type { OrganizationSummary } from '@myinventory/shared'

type OrganizationSummarySource = {
  id: string
  orgCode: string
  slug: string
  name: string
  tradingName: string
  ownerName: string
  email: string
  contactNumber: string
}

export function mapOrganizationToSummary(org: OrganizationSummarySource): OrganizationSummary {
  return {
    id: org.id,
    orgCode: org.orgCode,
    slug: org.slug,
    name: org.name,
    tradingName: org.tradingName,
    ownerName: org.ownerName,
    email: org.email,
    contactNumber: org.contactNumber,
  }
}
