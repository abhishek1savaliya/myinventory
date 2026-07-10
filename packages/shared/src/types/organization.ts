export interface OrganizationSummary {
  id: string
  orgCode: string
  slug: string
  name: string
  tradingName: string
  ownerName: string
  email: string
  contactNumber: string
}

export interface OrganizationSignupResponse {
  organization: OrganizationSummary
  orgCode: string
  slug: string
  ownerEmail: string
}

export interface OrganizationPublicProfile {
  slug: string
  name: string
  tradingName: string
}
