import type { OrganizationPublicProfile, OrganizationSummary } from '@myinventory/shared'

type OrganizationSummarySource = {
  id: string
  orgCode: string
  slug: string
  name: string
  tradingName: string
  ownerName: string
  email: string
  contactNumber: string
  logoUrl: string | null
  loginBackgroundUrl: string | null
  themeColor: string | null
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
    logoUrl: org.logoUrl,
    loginBackgroundUrl: org.loginBackgroundUrl,
    themeColor: org.themeColor,
  }
}

export function mapOrganizationToPublicProfile(org: OrganizationSummarySource): OrganizationPublicProfile {
  return {
    slug: org.slug,
    name: org.name,
    tradingName: org.tradingName,
    logoUrl: org.logoUrl,
    loginBackgroundUrl: org.loginBackgroundUrl,
    themeColor: org.themeColor,
  }
}
